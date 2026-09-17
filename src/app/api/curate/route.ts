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
  RawCandidateBook,
} from '@/lib/ai-curator';
import { getCachedCurateResult, setCachedCurateResult } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Layer 2 Defense: SingleFlight Request Coalescing
// Prevents duplicate queries (e.g. 50 students searching "경영학" simultaneously) from hammering external APIs
const inFlightRequests = new Map<string, Promise<NextResponse>>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const intent = (searchParams.get('intent') || 'beginner') as 'beginner' | 'practical';
  const campus = (searchParams.get('campus') || 'gwangju') as CampusType;
  const availableOnly = searchParams.get('availableOnly') === 'true';

  if (!query) {
    return NextResponse.json(
      { error: '검색어를 입력해주세요. (예: 글쓰기, 바이브코딩, 시간관리)' },
      { status: 400 }
    );
  }

  const flightKey = `${query.toLowerCase()}_${intent}_${campus}_${availableOnly}`;
  const existingFlight = inFlightRequests.get(flightKey);
  if (existingFlight) {
    return existingFlight.then((res) => res.clone());
  }

  const executionPromise = processCurateRequest(query, intent, campus, availableOnly);
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
  availableOnly: boolean
): Promise<NextResponse> {
  try {
    // 1. Check 2-tier cache (with campus awareness)
    const cachedData = await getCachedCurateResult(query, intent, campus);
    if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
      let filteredBooks = cachedData;
      if (availableOnly) {
        filteredBooks = cachedData.filter((b) => b.status === 'AVAILABLE');
      }
      return NextResponse.json({
        searchMeta: {
          query,
          intent,
          campus,
          cached: true,
          total: filteredBooks.length,
          source: 'cache',
        },
        books: filteredBooks,
      });
    }

    // 2. AI Query Rewriting & Call Number (DDC/KDC) Classification Expansion
    const queryAnalysis = await analyzeAndExpandQuery(query, intent);

    // 3. Hybrid Multi-Angle Harvesting: Keywords + Same-Shelf Call Numbers
    const kwPromises = queryAnalysis.searchKeywords.map((kw) =>
      searchCnuLibrary(kw, { campus, cpp: 50, pageCount: 2, maxResults: 50 })
    );

    const callNoPromises = (queryAnalysis.callNumberPrefixes || []).map((prefix) =>
      searchCnuLibraryByCallNo(prefix, { campus, cpp: 50, maxResults: 30 })
    );

    const [kwBatches, callNoBatches] = await Promise.all([
      Promise.all(kwPromises),
      Promise.all(callNoPromises),
    ]);

    // Flatten and deduplicate candidates by controlNo
    const seenControlNos = new Set<string>();
    const cnuCandidates: CnuBookSearchResult[] = [];

    for (const batch of [...kwBatches, ...callNoBatches]) {
      for (const item of batch) {
        if (!seenControlNos.has(item.controlNo)) {
          seenControlNos.add(item.controlNo);
          cnuCandidates.push(item);
        }
      }
    }

    // Fallback: If 0 books found, try raw query search directly
    if (cnuCandidates.length === 0) {
      const rawCandidates = await searchCnuLibrary(query, { campus, cpp: 50, pageCount: 1, maxResults: 30 });
      for (const item of rawCandidates) {
        if (!seenControlNos.has(item.controlNo)) {
          seenControlNos.add(item.controlNo);
          cnuCandidates.push(item);
        }
      }
    }

    // Strict Ground Truth Gate: If no books exist in CNU library, return empty honestly
    if (cnuCandidates.length === 0) {
      return NextResponse.json({
        searchMeta: {
          query,
          correctedQuery: queryAnalysis.correctedQuery,
          isTypo: queryAnalysis.isTypo,
          searchKeywords: queryAnalysis.searchKeywords,
          callNumberPrefixes: queryAnalysis.callNumberPrefixes,
          queryExplanation: queryAnalysis.explanation,
          intent,
          campus,
          cached: false,
          total: 0,
          source: 'cnu-library-zero-match',
        },
        books: [],
      });
    }

    // 4. Smart Screening: Select up to 15 books (5 newest 2025~2026 + 10 top relevant/available)
    const sortedByYear = [...cnuCandidates].sort((a, b) => {
      const yearA = parseInt(a.pubYear, 10) || 0;
      const yearB = parseInt(b.pubYear, 10) || 0;
      return yearB - yearA;
    });

    const newestCandidates = sortedByYear.slice(0, 5);
    const newestSet = new Set(newestCandidates.map((c) => c.controlNo));

    const remainingCandidates = cnuCandidates.filter((c) => !newestSet.has(c.controlNo));
    // Prioritize available books in the remaining pool
    remainingCandidates.sort((a, b) => (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0));

    const screenedCnuList = [...newestCandidates, ...remainingCandidates.slice(0, 10)];

    // 5. Phase 1 Fast Enrichment: Basic metadata without reviews/ranking scraping (~1.2s total)
    const enrichedCandidates: RawCandidateBook[] = [];
    const BATCH_SIZE = 5;
    const DELAY_MS = 30;

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

    // 6. Run AI Curation with Availability Ratio Guarantee (min 3 available, max 2 checked-out)
    const top5Books = await curateTop5Books(
      queryAnalysis.correctedQuery,
      intent,
      enrichedCandidates
    );

    // 7. Phase 2 Targeted Deep Enrichment: Parallelize detail & official ranking/reviews for Top 5 ONLY (~0.8s)
    const finalizedTop5 = await Promise.all(
      top5Books.map(async (book) => {
        try {
          const matchingCand = enrichedCandidates.find((c) => c.cnu.controlNo === book.id);
          const goodsNo = (matchingCand?.aladin as BookstoreMetadata)?.goodsNo;

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

    // Ensure Availability Ratio Guarantee remains strictly applied
    const guaranteedBooks = enforceAvailabilityRatio(finalizedTop5, enrichedCandidates);

    // 8. Store in 2-tier cache
    await setCachedCurateResult(query, intent, guaranteedBooks, campus);

    let resultBooks = guaranteedBooks;
    if (availableOnly) {
      resultBooks = guaranteedBooks.filter((b) => b.status === 'AVAILABLE');
    }

    return NextResponse.json({
      searchMeta: {
        query,
        correctedQuery: queryAnalysis.correctedQuery,
        isTypo: queryAnalysis.isTypo,
        searchKeywords: queryAnalysis.searchKeywords,
        callNumberPrefixes: queryAnalysis.callNumberPrefixes,
        queryExplanation: queryAnalysis.explanation,
        intent,
        campus,
        totalHarvested: cnuCandidates.length,
        screenedCount: enrichedCandidates.length,
        cached: false,
        total: resultBooks.length,
        source: 'live-curation',
      },
      books: resultBooks,
    });
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
