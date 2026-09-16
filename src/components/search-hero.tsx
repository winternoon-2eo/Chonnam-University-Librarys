'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Sparkles, Sprout, Zap, CheckCircle2 } from 'lucide-react';

import { CampusType } from '@/lib/cnu-library';

interface SearchHeroProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  intent: 'beginner' | 'practical';
  setIntent: (i: 'beginner' | 'practical') => void;
  campus: CampusType;
  setCampus: (c: CampusType) => void;
  availableOnly: boolean;
  setAvailableOnly: (a: boolean) => void;
  onSearch: (customQuery?: string) => void;
  isLoading: boolean;
}

const PRESET_KEYWORDS = [
  '글쓰기',
  '바이브코딩',
  '파이썬',
  '자기계발',
  '시간관리',
  '마케팅',
  '인공지능',
  '클린코드',
];

export function SearchHero({
  searchQuery,
  setSearchQuery,
  intent,
  setIntent,
  campus,
  setCampus,
  availableOnly,
  setAvailableOnly,
  onSearch,
  isLoading,
}: SearchHeroProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isLoading) return;
    onSearch();
  };

  const handleChipClick = (keyword: string) => {
    setSearchQuery(keyword);
    onSearch(keyword);
  };

  return (
    <section className="relative overflow-hidden py-10 sm:py-14">
      {/* Background ambient gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-background to-background dark:from-emerald-950/25 dark:via-background dark:to-background" />

      <div className="mx-auto max-w-3xl text-center">
        {/* Top Tagline */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>전남대 학생을 위한 목차 & 평점 기반 AI 선별기</span>
        </div>

        {/* Main Headline */}
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          책 고르는 시간 90% 단축, <br />
          <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-emerald-300 dark:to-teal-300">
            딱 맞는 골든 5권
          </span>
          만 추천합니다
        </h1>

        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          교보·Yes24를 전전할 필요 없이, 수백 권의 <strong>목차(TOC)</strong>와 <strong>독자 평점</strong>을 AI가 심층 분석하여 내 목적에 적합한 책과 서가 청구기호를 즉시 안내합니다.
        </p>

        {/* Campus Selector Toggle */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
          <span className="font-semibold text-foreground/80">소속 도서관:</span>
          <div className="inline-flex rounded-xl border border-border/80 bg-muted/30 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setCampus('gwangju')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                campus === 'gwangju'
                  ? 'bg-emerald-700 text-white shadow-xs dark:bg-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🏛️ 광주캠퍼스 (중앙/정보마루)</span>
            </button>
            <button
              type="button"
              onClick={() => setCampus('yeosu')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                campus === 'yeosu'
                  ? 'bg-emerald-700 text-white shadow-xs dark:bg-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🌊 여수캠퍼스</span>
            </button>
            <button
              type="button"
              onClick={() => setCampus('all')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                campus === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs dark:bg-emerald-600'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🌐 전남대 전체</span>
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <form onSubmit={handleSubmit} className="mt-5">
          <div className="relative flex items-center shadow-lg shadow-emerald-900/5 transition-shadow focus-within:shadow-emerald-900/15">
            <div className="pointer-events-none absolute left-4 text-muted-foreground">
              <Search className="h-5 w-5 text-emerald-600" />
            </div>
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="배우고 싶은 분야나 키워드를 입력하세요 (예: 자기계발, 바이브코딩, 시간관리)"
              className="h-14 rounded-2xl border-emerald-600/30 bg-background pl-12 pr-28 text-base shadow-inner focus-visible:border-emerald-600 focus-visible:ring-emerald-600/20 dark:border-emerald-700/50"
            />
            <div className="absolute right-2">
              <Button
                type="submit"
                disabled={isLoading || !searchQuery.trim()}
                className="h-10 rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow hover:bg-emerald-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    큐레이션 중
                  </span>
                ) : (
                  '분석 추천'
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Intent Selector & Filters */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3 backdrop-blur-sm">
          {/* Pre-search Intent Segmented Toggle */}
          <div className="flex items-center gap-1 text-xs sm:text-sm">
            <span className="mr-1.5 font-medium text-muted-foreground">학습 목적:</span>
            <button
              type="button"
              onClick={() => setIntent('beginner')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                intent === 'beginner'
                  ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-600'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <Sprout className="h-4 w-4" />
              <span>🌱 입문/교양 (쉬운 이해)</span>
            </button>
            <button
              type="button"
              onClick={() => setIntent('practical')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                intent === 'practical'
                  ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-600'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              <Zap className="h-4 w-4" />
              <span>⚡ 실습/실무 (심화 예제)</span>
            </button>
          </div>

          {/* Availability Toggle */}
          <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
            />
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              대출 가능 도서만 보기
            </span>
          </label>
        </div>

        {/* Popular Keywords Chips */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">추천 키워드:</span>
          {PRESET_KEYWORDS.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => handleChipClick(kw)}
              className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/60 dark:hover:text-emerald-300"
            >
              #{kw}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
