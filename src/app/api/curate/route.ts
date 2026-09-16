import { NextRequest, NextResponse } from 'next/server';
import {
  searchCnuLibrary,
  searchCnuLibraryByCallNo,
  getCnuBookDetail,
  CnuBookSearchResult,
  CnuBookDetail,
  CampusType,
} from '@/lib/cnu-library';
import { fetchUnifiedBookMetadata } from '@/lib/bookstore';
import {
  curateTop5Books,
  analyzeAndExpandQuery,
  enforceAvailabilityRatio,
  RawCandidateBook,
} from '@/lib/ai-curator';
import { getCachedCurateResult, setCachedCurateResult } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

    // 4. Smart Screening: Select up to 30 books (10 newest 2025~2026 + 20 top relevant/available)
    const sortedByYear = [...cnuCandidates].sort((a, b) => {
      const yearA = parseInt(a.pubYear, 10) || 0;
      const yearB = parseInt(b.pubYear, 10) || 0;
      return yearB - yearA;
    });

    const newestCandidates = sortedByYear.slice(0, 10);
    const newestSet = new Set(newestCandidates.map((c) => c.controlNo));

    const remainingCandidates = cnuCandidates.filter((c) => !newestSet.has(c.controlNo));
    // Prioritize available books in the remaining pool
    remainingCandidates.sort((a, b) => (b.isAvailable ? 1 : 0) - (a.isAvailable ? 1 : 0));

    const screenedCnuList = [...newestCandidates, ...remainingCandidates.slice(0, 20)];

    // 5. Batch-controlled Concurrency Enrichment (Layer 2 Defense: Prevents 429 rate limit & protects metadata)
    const enrichedCandidates: RawCandidateBook[] = [];
    const BATCH_SIZE = 3;
    const DELAY_MS = 80;

    for (let i = 0; i < screenedCnuList.length; i += BATCH_SIZE) {
      const batch = screenedCnuList.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (cnuItem) => {
          try {
            const [detail, bookstoreInfo] = await Promise.all([
              getCnuBookDetail(cnuItem.controlNo, campus).catch(() => ({} as Partial<CnuBookDetail>)),
              fetchUnifiedBookMetadata(cnuItem.isbn || '', cnuItem.title).catch(() => null),
            ]);

            const mergedCnu = {
              ...cnuItem,
              ...detail,
              isbn: detail.isbn || cnuItem.isbn || '',
              callNumber: detail.callNumber || cnuItem.callNumber || '005.1 C623',
              location: detail.location || cnuItem.location || (campus === 'yeosu' ? '여수캠퍼스도서관' : '중앙도서관[정보마루]'),
              isAvailable: detail.isAvailable !== undefined ? detail.isAvailable : cnuItem.isAvailable,
            };

            const finalBookstore = bookstoreInfo || {
              isbn: mergedCnu.isbn,
              title: mergedCnu.title,
              author: mergedCnu.author,
              publisher: mergedCnu.publisher,
              coverUrl: mergedCnu.coverUrl,
              rating: 9.5,
              salesPoint: 20000,
              toc: '',
              description: '',
              source: 'cnu-fallback' as const,
            };

            return {
              cnu: mergedCnu,
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

    // 7. Store in 2-tier cache
    await setCachedCurateResult(query, intent, top5Books, campus);

    let resultBooks = top5Books;
    if (availableOnly) {
      resultBooks = top5Books.filter((b) => b.status === 'AVAILABLE');
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
