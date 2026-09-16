'use client';

import React, { useState, useEffect } from 'react';
import { SearchHero } from '@/components/search-hero';
import { BookCard } from '@/components/book-card';
import { PushModal } from '@/components/push-modal';
import { AdBanner } from '@/components/ad-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { CuratedBookItem } from '@/lib/ai-curator';
import { CampusType } from '@/lib/cnu-library';
import { Sparkles, Library, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('자기계발');
  const [intent, setIntent] = useState<'beginner' | 'practical'>('beginner');
  const [campus, setCampus] = useState<CampusType>('gwangju');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [books, setBooks] = useState<CuratedBookItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<{
    query: string;
    intent: string;
    campus?: string;
    cached: boolean;
    total: number;
    totalHarvested?: number;
    screenedCount?: number;
    correctedQuery?: string;
    isTypo?: boolean;
    searchKeywords?: string[];
    callNumberPrefixes?: string[];
    queryExplanation?: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Push notification modal state
  const [selectedBookForPush, setSelectedBookForPush] = useState<CuratedBookItem | null>(null);
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);

  // Perform search
  const performSearch = async (
    targetQuery?: string,
    targetIntent?: 'beginner' | 'practical',
    targetCampus?: CampusType
  ) => {
    const q = (targetQuery !== undefined ? targetQuery : searchQuery).trim();
    const currentIntent = targetIntent || intent;
    const currentCampus = targetCampus || campus;

    if (!q) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const url = `/api/curate?q=${encodeURIComponent(q)}&intent=${currentIntent}&campus=${currentCampus}&availableOnly=${availableOnly}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '도서관 검색 도중 오류가 발생했습니다.');
      }

      setBooks(data.books || []);
      setSearchMeta(data.searchMeta || null);
    } catch (err: any) {
      console.error('Search error:', err);
      setErrorMessage(err.message || '네트워크 연결을 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load with default topic
  useEffect(() => {
    performSearch('자기계발', 'beginner', 'gwangju');
  }, []);

  // When intent changes, trigger re-search if query exists
  const handleIntentChange = (newIntent: 'beginner' | 'practical') => {
    setIntent(newIntent);
    performSearch(searchQuery, newIntent, campus);
  };

  // When campus changes, trigger re-search
  const handleCampusChange = (newCampus: CampusType) => {
    setCampus(newCampus);
    performSearch(searchQuery, intent, newCampus);
  };

  // When availableOnly toggle changes, re-fetch
  useEffect(() => {
    if (searchMeta) {
      performSearch(searchQuery, intent, campus);
    }
  }, [availableOnly]);

  const handleOpenPushModal = (book: CuratedBookItem) => {
    setSelectedBookForPush(book);
    setIsPushModalOpen(true);
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6">
      {/* Hero with Search and Intent Selection */}
      <SearchHero
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        intent={intent}
        setIntent={handleIntentChange}
        campus={campus}
        setCampus={handleCampusChange}
        availableOnly={availableOnly}
        setAvailableOnly={setAvailableOnly}
        onSearch={(customQ) => performSearch(customQ)}
        isLoading={isLoading}
      />

      {/* Main Results Container */}
      <div className="mt-8">
        {/* Results Header Meta */}
        {searchMeta && !isLoading && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-foreground sm:text-base">
                '{searchMeta.query}' AI 큐레이션 결과
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Top {books.length}권 엄선
              </span>
              <span className="rounded-md border border-border bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground font-medium">
                {searchMeta.campus === 'yeosu' ? '🌊 여수캠퍼스' : (searchMeta.campus === 'all' ? '🌐 전남대 전체' : '🏛️ 광주캠퍼스')}
              </span>
            </div>

            <div className="text-xs text-muted-foreground">
              {searchMeta.totalHarvested && searchMeta.totalHarvested > 0 ? (
                <span>
                  소장 도서 <strong>{searchMeta.totalHarvested}권</strong> 대량 탐색 ➔ 최신·인기 <strong>{searchMeta.screenedCount || 15}권</strong> 스크리닝
                </span>
              ) : searchMeta.cached ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  ⚡ 0.05초 초고속 캐시 응답
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  ✨ 실시간 목차 & 평점 심층 분석 완료
                </span>
              )}
            </div>
          </div>
        )}

        {/* Smart Query Explanation Banner */}
        {searchMeta?.queryExplanation && !isLoading && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-200">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="font-medium">{searchMeta.queryExplanation}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm"
              >
                <div className="flex items-center gap-2 pb-4">
                  <Skeleton className="h-6 w-10 rounded-lg" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Skeleton className="h-44 w-32 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {errorMessage && !isLoading && (
          <div className="my-10 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
            <h3 className="mt-3 text-base font-bold text-foreground">
              도서관 데이터를 불러오지 못했습니다
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => performSearch()}
              className="mt-4 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && books.length === 0 && (
          <div className="my-12 rounded-2xl border border-dashed border-border/80 p-8 text-center">
            <Library className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-semibold text-foreground">
              검색된 도서가 없습니다
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              다른 검색어를 입력하시거나, 대출 가능 필터를 해제해보세요.
            </p>
          </div>
        )}

        {/* Book List */}
        {!isLoading && books.length > 0 && (
          <div className="space-y-6">
            {books.map((book, index) => (
              <React.Fragment key={book.id || index}>
                <BookCard
                  book={book}
                  onOpenPushModal={handleOpenPushModal}
                />

                {/* Insert gentle ad/affiliate banner after book #3 */}
                {index === 2 && (
                  <AdBanner slotId="mid-feed" className="my-4" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Push Subscription Modal */}
      <PushModal
        book={selectedBookForPush}
        isOpen={isPushModalOpen}
        onClose={() => setIsPushModalOpen(false)}
      />
    </div>
  );
}
