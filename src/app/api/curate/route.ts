import { NextRequest, NextResponse } from 'next/server';
import {
  searchCnuLibrary,
  searchCnuLibraryByCallNo,
  getCnuBookDetail,
  CnuBookSearchResult,
  CnuBookDetail,
  CampusType,
} from '@/lib/cnu-library';
import { fetchUnifiedBookMetadata, BookstoreMetadata } from '@/lib/bookstore';
import { enrichBookWithYes24Community } from '@/lib/yes24';
import {
  curateTop5Books,
  analyzeAndExpandQuery,
  enforceAvailabilityRatio,
  getBookCanonicalKey,
  RawCandidateBook,
} from '@/lib/ai-curator';
import { getCachedCurateResult, setCachedCurateResult, recordSearchLog } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Layer 2 Defense: SingleFlight Request Coalescing
// Prevents duplicate queries from hammering external APIs simultaneously
const inFlightRequests = new Map<string, Promise<NextResponse>>();

// In-memory Harvest Cache (10 minutes) to eliminate redundant OPAC crawling for page 2, 3, 4
interface HarvestCacheEntry {
  candidates: CnuBookSearchResult[];
  queryAnalysis: any;
  timestamp: number;
}
const harvestCache = new Map<string, HarvestCacheEntry>();

// Layer 3 Concurrency Semaphore: Max 5 concurrent live harvest/curation pipelines
let activeLivePipelines = 0;
const MAX_CONCURRENT_LIVE_PIPELINES = 5;
const waitQueue: Array<() => void> = [];

async function acquirePipelineSlot(): Promise<void> {
  if (activeLivePipelines < MAX_CONCURRENT_LIVE_PIPELINES) {
    activeLivePipelines++;
    return;
  }
  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeLivePipelines++;
      resolve();
    });
  });
}

function releasePipelineSlot(): void {
  activeLivePipelines = Math.max(0, activeLivePipelines - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const intent = (searchParams.get('intent') || 'beginner') as 'beginner' | 'practical';
  const campus = (searchParams.get('campus') || 'gwangju') as CampusType;
  const availableOnly = searchParams.get('availableOnly') === 'true';
  const forceRefresh = searchParams.get('refresh') === 'true';
  const page = Math.max(1, Math.min(4, parseInt(searchParams.get('page') || '1', 10) || 1));
  const excludeIdsRaw = searchParams.get('excludeIds') || '';
  const excludeIds = excludeIdsRaw ? excludeIdsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (!query) {
    return NextResponse.json(
      { error: '검색어를 입력해주세요. (예: 글쓰기, 바이브코딩, 시간관리)' },
      { status: 400 }
    );
  }

  const flightKey = `${query.toLowerCase()}_${intent}_${campus}_${page}_${availableOnly}_${forceRefresh}_${excludeIds.sort().join('_')}`;
  const existingFlight = inFlightRequests.get(flightKey);
  if (existingFlight) {
    return existingFlight.then((res) => res.clone());
  }

  const executionPromise = processCurateRequest(
    query,
    intent,
    campus,
    availableOnly,
    forceRefresh,
    page,
    excludeIds
  );
  inFlightRequests.set(flightKey, executionPromise);

  try {
    return await executionPromise;
  } finally {
    inFlightRequests.delete(flightKey);
  }
}

async function processCurateRequest(
  query: string,
  intent: 'beginner' | 'practical',
  campus: CampusType,
  availableOnly: boolean,
  forceRefresh = false,
  page = 1,
  excludeIds: string[] = []
): Promise<NextResponse> {
  try {
    const pageSize = 5;
    const startIndex = (page - 1) * pageSize;

    // 1. Check 2-tier cache (with campus awareness)
    if (!forceRefresh) {
      const cachedData = await getCachedCurateResult(query, intent, campus);
      if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
        let filteredBooks = cachedData;
        if (availableOnly) {
          filteredBooks = cachedData.filter((b) => b.status === 'AVAILABLE');
        }

        const pageBooks = filteredBooks.slice(startIndex, startIndex + pageSize);

        // If the cache already has enough books for this page, return immediately!
        if (pageBooks.length > 0) {
          recordSearchLog(query, intent, campus, pageBooks).catch(() => {});

          return NextResponse.json({
            searchMeta: {
              query,
              intent,
              campus,
              cached: true,
              total: pageBooks.length,
              source: 'cache',
              pagination: {
                page,
                limit: pageSize,
                hasMore: startIndex + pageSize < Math.min(20, filteredBooks.length),
                currentCount: pageBooks.length,
                totalCuratedInCache: filteredBooks.length,
                maxBooks: 20,
              },
            },
            books: pageBooks,
          });
        }
      }
    }

    // 2. Acquire concurrency slot to protect university library server
    await acquirePipelineSlot();

    try {
      const harvestKey = `${query.toLowerCase()}_${campus}`;
      let cnuCandidates: CnuBookSearchResult[] = [];
      let queryAnalysis: any = null;

      const harvestEntry = harvestCache.get(harvestKey);
      if (harvestEntry && !forceRefresh && Date.now() - harvestEntry.timestamp < 10 * 60 * 1000) {
        cnuCandidates = harvestEntry.candidates;
        queryAnalysis = harvestEntry.queryAnalysis;
      } else {
        // AI Query Rewriting & Call Number (DDC/KDC) Classification Expansion
        queryAnalysis = await analyzeAndExpandQuery(query, intent);

        // Hybrid Multi-Angle Harvesting: Keywords + Same-Shelf Call Numbers
        const kwPromises = queryAnalysis.searchKeywords.map((kw: string) =>
          searchCnuLibrary(kw, { campus, cpp: 50, pageCount: 2, maxResults: 50 })
        );

        const callNoPromises = (queryAnalysis.callNumberPrefixes || []).map((prefix: string) =>
          searchCnuLibraryByCallNo(prefix, { campus, cpp: 50, maxResults: 30 })
        );

        const [kwBatches, callNoBatches] = await Promise.all([
          Promise.all(kwPromises),
          Promise.all(callNoPromises),
        ]);

        const seenControlNos = new Set<string>();
        for (const batch of [...kwBatches, ...callNoBatches]) {
          for (const item of batch) {
            if (!seenControlNos.has(item.controlNo)) {
              seenControlNos.add(item.controlNo);
              cnuCandidates.push(item);
            }
          }
        }

        if (cnuCandidates.length === 0) {
          const rawCandidates = await searchCnuLibrary(query, { campus, cpp: 50, pageCount: 1, maxResults: 30 });
          for (const item of rawCandidates) {
            if (!seenControlNos.has(item.controlNo)) {
              seenControlNos.add(item.controlNo);
              cnuCandidates.push(item);
            }
          }
        }

        harvestCache.set(harvestKey, {
          candidates: cnuCandidates,
          queryAnalysis,
          timestamp: Date.now(),
        });
      }

      if (cnuCandidates.length === 0) {
        return NextResponse.json({
          searchMeta: {
            query,
            correctedQuery: queryAnalysis?.correctedQuery || query,
            isTypo: queryAnalysis?.isTypo || false,
            searchKeywords: queryAnalysis?.searchKeywords || [query],
            callNumberPrefixes: queryAnalysis?.callNumberPrefixes || [],
            queryExplanation: queryAnalysis?.explanation || '',
            intent,
            campus,
            cached: false,
            total: 0,
            source: 'cnu-library-zero-match',
            pagination: {
              page,
              limit: pageSize,
              hasMore: false,
              currentCount: 0,
              maxBooks: 20,
            },
          },
          books: [],
        });
      }

      // 3. Smart Screening: Prioritize author matches, keyword title matches, availability, and recency
      const scoredCandidates = cnuCandidates.map((cand) => {
        let score = 0;
        const title = (cand.title || '').toLowerCase();
        const author = (cand.author || '').toLowerCase();
        const cleanQ = (queryAnalysis?.correctedQuery || query).toLowerCase();

        if (author.includes(cleanQ)) score += 100;
        if (queryAnalysis?.searchKeywords?.some((kw: string) => title.includes(kw.toLowerCase()))) score += 60;
        if (title.includes(cleanQ)) score += 30;
        if (cand.isAvailable) score += 20;

        const year = parseInt(cand.pubYear, 10) || 2000;
        if (year >= 2024) score += 15;
        else if (year >= 2020) score += 10;

        return { cand, score, year };
      });

      scoredCandidates.sort((a, b) => b.score - a.score || b.year - a.year);

      // Filter out books already delivered in previous pages (excludeIds and existing cached books)
      const existingCachedForFilter = (await getCachedCurateResult(query, intent, campus)) || [];
      const excludeSet = new Set<string>([
        ...excludeIds,
        ...existingCachedForFilter.map((b: any) => b.id),
      ]);
      const existingCanonicalKeys = new Set<string>(
        existingCachedForFilter.map((b: any) => getBookCanonicalKey(b.title, b.author))
      );

      const availableCandidates = scoredCandidates.filter((s) => {
        if (excludeSet.has(s.cand.controlNo)) return false;
        const key = getBookCanonicalKey(s.cand.title, s.cand.author);
        return !existingCanonicalKeys.has(key);
      });

      // Select top 15 candidate books for this page
      const screenedCnuList = availableCandidates.slice(0, 15).map((s) => s.cand);

      if (screenedCnuList.length === 0) {
        return NextResponse.json({
          searchMeta: {
            query,
            correctedQuery: queryAnalysis?.correctedQuery || query,
            intent,
            campus,
            cached: false,
            total: 0,
            source: 'cnu-exhausted',
            pagination: {
              page,
              limit: pageSize,
              hasMore: false,
              currentCount: 0,
              maxBooks: 20,
            },
          },
          books: [],
        });
      }

      // 4. Phase 1 Fast Enrichment: YES24 metadata (~1.0s total)
      const enrichedCandidates: RawCandidateBook[] = [];
      const BATCH_SIZE = 5;
      const DELAY_MS = 20;

      for (let i = 0; i < screenedCnuList.length; i += BATCH_SIZE) {
        const batch = screenedCnuList.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (cnuItem) => {
            try {
              const bookstoreInfo = await fetchUnifiedBookMetadata(cnuItem.isbn || '', cnuItem.title, false).catch(() => null);

              const finalBookstore = bookstoreInfo || {
                isbn: cnuItem.isbn || '',
                title: cnuItem.title,
                author: cnuItem.author,
                publisher: cnuItem.publisher,
                coverUrl: cnuItem.coverUrl,
                rating: 9.5,
                salesPoint: 20000,
                toc: '',
                description: '',
                source: 'cnu-fallback' as const,
              };

              return {
                cnu: cnuItem,
                bookstore: finalBookstore,
                aladin: finalBookstore,
              } as RawCandidateBook;
            } catch (err) {
              console.warn(`[Curate API] Failed enriching book ${cnuItem.controlNo}:`, err);
              return null;
            }
          })
        );

        for (const res of batchResults) {
          if (res) enrichedCandidates.push(res);
        }

        if (i + BATCH_SIZE < screenedCnuList.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      const rankOffset = (page - 1) * pageSize;

      // 5. Run AI Curation with Availability Ratio Guarantee & rankOffset
      const top5Books = await curateTop5Books(
        queryAnalysis?.correctedQuery || query,
        intent,
        enrichedCandidates,
        rankOffset
      );

      // 6. Phase 2 Targeted Deep Enrichment: Parallelize detail & official ranking/reviews for Top 5 ONLY (~0.8s)
      const finalizedTop5 = await Promise.all(
        top5Books.map(async (book) => {
          try {
            const matchingCand = enrichedCandidates.find((c) => c.cnu.controlNo === book.id);
            const bookstore = matchingCand?.bookstore || matchingCand?.aladin;
            const goodsNo = (bookstore as BookstoreMetadata)?.goodsNo;

            const [cnuDetailRes, yes24CommRes] = await Promise.allSettled([
              getCnuBookDetail(book.id, campus),
              goodsNo ? enrichBookWithYes24Community(goodsNo) : Promise.resolve(null),
            ]);

            const updated = { ...book };

            if (cnuDetailRes.status === 'fulfilled' && cnuDetailRes.value) {
              const d = cnuDetailRes.value;
              if (d.location) updated.location = d.location;
              if (d.callNumber) updated.callNumber = d.callNumber;
              if (d.isAvailable !== undefined) {
                updated.status = d.isAvailable ? 'AVAILABLE' : 'CHECKED_OUT';
              }
            }

            if (yes24CommRes.status === 'fulfilled' && yes24CommRes.value) {
              const comm = yes24CommRes.value;
              if (comm?.rankingBadge) updated.rankingBadge = comm.rankingBadge;
              if (comm?.reviews && comm.reviews.length > 0) updated.reviews = comm.reviews;
            }

            return updated;
          } catch {
            return book;
          }
        })
      );

      const guaranteedBooks = enforceAvailabilityRatio(finalizedTop5, enrichedCandidates, rankOffset);

      // 7. Store in 2-tier cache (merging with existing cache)
      const existingCached = (await getCachedCurateResult(query, intent, campus)) || [];
      const existingIdSet = new Set<string>(existingCached.map((b: any) => b.id));
      const mergedForCache = [...existingCached];
      for (const b of guaranteedBooks) {
        if (!existingIdSet.has(b.id)) {
          existingIdSet.add(b.id);
          mergedForCache.push(b);
        }
      }
      await setCachedCurateResult(query, intent, mergedForCache, campus);

      let resultBooks = guaranteedBooks;
      if (availableOnly) {
        resultBooks = guaranteedBooks.filter((b) => b.status === 'AVAILABLE');
      }

      recordSearchLog(query, intent, campus, resultBooks).catch(() => {});

      const hasMore = page < 4 && availableCandidates.length > screenedCnuList.length && mergedForCache.length < 20;

      return NextResponse.json({
        searchMeta: {
          query,
          correctedQuery: queryAnalysis?.correctedQuery,
          isTypo: queryAnalysis?.isTypo,
          searchKeywords: queryAnalysis?.searchKeywords,
          callNumberPrefixes: queryAnalysis?.callNumberPrefixes,
          queryExplanation: queryAnalysis?.explanation,
          intent,
          campus,
          totalHarvested: cnuCandidates.length,
          screenedCount: enrichedCandidates.length,
          cached: false,
          total: resultBooks.length,
          source: 'live-curation',
          pagination: {
            page,
            limit: pageSize,
            hasMore,
            currentCount: resultBooks.length,
            totalAccumulated: mergedForCache.length,
            maxBooks: 20,
          },
        },
        books: resultBooks,
      });
    } finally {
      releasePipelineSlot();
    }
  } catch (error: any) {
    console.error('[API /curate] Internal error:', error);
    return NextResponse.json(
      {
        error: '도서관 큐레이션 데이터를 불러오는 도중 오류가 발생했습니다.',
        details: error?.message,
      },
      { status: 500 }
    );
  }
}
