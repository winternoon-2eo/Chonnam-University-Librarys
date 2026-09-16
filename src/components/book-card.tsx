'use client';

import React, { useState } from 'react';
import { CuratedBookItem } from '@/lib/ai-curator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Star,
  MapPin,
  Bookmark,
  Bell,
  ExternalLink,
  ChevronDown,
  Sparkles,
  BookOpen,
  ShoppingCart,
  Clock,
  ShieldCheck,
  MessageSquareQuote,
  HelpCircle,
} from 'lucide-react';

interface BookCardProps {
  book: CuratedBookItem;
  onOpenPushModal: (book: CuratedBookItem) => void;
}

export function BookCard({ book, onOpenPushModal }: BookCardProps) {
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const isAvailable = book.status === 'AVAILABLE';

  const rankColorMap: Record<number, string> = {
    1: 'bg-amber-500 text-white shadow-amber-500/30',
    2: 'bg-slate-700 text-white shadow-slate-700/30 dark:bg-slate-300 dark:text-slate-900',
    3: 'bg-amber-700 text-white shadow-amber-700/30',
  };

  const defaultRankColor = 'bg-muted text-muted-foreground';

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-emerald-600/60 hover:shadow-md sm:p-6">
      {/* Top Banner Rank & Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Rank Badge */}
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black shadow-sm ${
              rankColorMap[book.rank] || defaultRankColor
            }`}
          >
            #{book.rank}
          </div>

          {/* YES24 Official Ranking Badge (From Yes24 BestSellerRank_Book API) */}
          {book.rankingBadge && (
            <div className="inline-flex items-center overflow-hidden rounded-md border border-sky-300 text-xs shadow-2xs dark:border-sky-800">
              <span className="bg-sky-600 px-2 py-0.5 text-[11px] font-bold text-white">베스트</span>
              <span className="bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-200">
                {book.rankingBadge.rankingText}
              </span>
            </div>
          )}

          {/* AI Badge */}
          <Badge
            variant="secondary"
            className="border-emerald-600/30 bg-emerald-50 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
          >
            <Sparkles className="mr-1 h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            {book.aiCuration.badge}
          </Badge>
        </div>

        {/* Rating and Popularity */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            <span>YES24 {book.rating.toFixed(1)}</span>
          </div>
          {book.salesPoint > 0 && (
            <span
              title="판매지수란? 최근 4주간의 판매량과 주문액에 가중치를 부여하여 매일 갱신되는 YES24 공식 판매지수입니다 (1만점+: 분야 베스트셀러, 3만점+: 전국 스테디셀러)."
              className="inline-flex cursor-help items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground/85 transition-colors hover:bg-muted"
            >
              <span>판매지수 {book.salesPoint.toLocaleString()}</span>
              <HelpCircle className="h-3 w-3 text-muted-foreground/80" />
            </span>
          )}
        </div>
      </div>

      {/* Main Content: Cover + Info */}
      <div className="mt-4 flex flex-col gap-5 sm:flex-row">
        {/* Cover Image - 100% full view, never cropped */}
        <div className="mx-auto flex h-48 w-32 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-1.5 shadow-inner sm:mx-0">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={book.title}
              className="max-h-full max-w-full object-contain drop-shadow-sm transition-transform group-hover:scale-105"
              onError={(e) => {
                // Fallback to placeholder icon
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
          )}
        </div>

        {/* Metadata & Library Status */}
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
              {book.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              <span className="font-medium text-foreground/80">{book.author}</span> · {book.publisher} ({book.pubYear})
            </p>

            {/* CNU Holding & Call Number Box */}
            <div className="mt-3.5 rounded-xl border border-border/70 bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Bookmark className="h-3.5 w-3.5 text-emerald-600" />
                  <span>청구기호:</span>
                  <span className="rounded bg-background px-2 py-0.5 font-mono text-xs font-bold text-emerald-800 shadow-sm dark:text-emerald-300">
                    {book.callNumber}
                  </span>
                </div>

                {/* Real-time Status Badge */}
                <div>
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      대출 가능
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      <Clock className="h-3 w-3" />
                      대출중
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground/70" />
                <span>{book.location}</span>
                {book.returnDueDate && (
                  <span className="ml-1 text-amber-700 dark:text-amber-400">
                    ({book.returnDueDate})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AI Curation Highlight Box with Persona & Authenticity */}
          <div className="mt-3.5 rounded-xl border border-emerald-600/20 bg-emerald-50/60 p-3.5 text-xs dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-700 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="font-medium text-emerald-950 dark:text-emerald-200">
                  {book.aiCuration.recommendReason}
                </p>
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  ⚡ 30분 공략 챕터: <span className="underline decoration-emerald-500/50">{book.aiCuration.targetChapter}</span>
                </p>
              </div>
            </div>

            {/* Target Audience & Anti-Persona & Difficulty for Maximum Trust */}
            {(book.aiCuration.targetAudience || book.aiCuration.cautionAudience) && (
              <div className="border-t border-emerald-600/15 pt-2 text-[11px] space-y-1">
                {book.aiCuration.targetAudience && (
                  <p className="text-emerald-900 dark:text-emerald-200">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">🎯 이런 분께 추천:</span> {book.aiCuration.targetAudience}
                  </p>
                )}
                {book.aiCuration.cautionAudience && (
                  <p className="text-amber-900 dark:text-amber-200">
                    <span className="font-bold text-amber-700 dark:text-amber-400">⚠️ 이런 분은 비추천:</span> {book.aiCuration.cautionAudience}
                  </p>
                )}
                {book.aiCuration.difficulty && (
                  <p className="text-muted-foreground">
                    <span className="font-bold text-foreground/80">📊 난이도:</span> {book.aiCuration.difficulty}
                  </p>
                )}
              </div>
            )}

            {/* Solved Academic / Practical Problems */}
            {book.aiCuration.solvedProblems && book.aiCuration.solvedProblems.length > 0 && (
              <div className="border-t border-emerald-600/15 pt-2 text-[11px] space-y-1.5">
                <p className="font-bold text-emerald-800 dark:text-emerald-300">
                  💡 이 책으로 해결 가능한 대학 과제/고민:
                </p>
                <ul className="space-y-1 pl-1 text-emerald-950/90 dark:text-emerald-100/90">
                  {book.aiCuration.solvedProblems.map((prob, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">✓</span>
                      <span>{prob}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accordion: Table of Contents Preview */}
      <div className="mt-4 border-t border-border/50 pt-3">
        <button
          type="button"
          onClick={() => setIsTocOpen(!isTocOpen)}
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>상세 목차 (TOC) 확인하기</span>
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isTocOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isTocOpen && (
          <div className="mt-2.5 max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3.5 text-xs leading-relaxed text-foreground/85 whitespace-pre-line">
            {book.toc || '상세 목차 정보를 불러오는 중입니다.'}
          </div>
        )}
      </div>

      {/* Accordion: Real Buyer Reviews from Yes24 */}
      <div className="mt-3 border-t border-border/50 pt-3">
        <button
          type="button"
          onClick={() => setIsReviewsOpen(!isReviewsOpen)}
          className="flex w-full items-center justify-between text-xs font-semibold text-foreground/80 hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <MessageSquareQuote className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            <span>
              회원들이 실제 쓴 후기 {book.reviews && book.reviews.length > 0 ? `(${book.reviews.length}개)` : ''}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isReviewsOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isReviewsOpen && (
          <div className="mt-2.5">
            {book.reviews && book.reviews.length > 0 ? (
              <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                {book.reviews.map((rev, idx) => (
                  <div key={idx} className="rounded-lg border border-border/40 bg-card p-3 shadow-2xs">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                      <span className="font-semibold text-foreground/90">{rev.author}</span>
                      <div className="flex items-center gap-2">
                        {rev.rating > 0 && (
                          <span className="flex items-center text-amber-500 font-bold">
                            ★ {rev.rating}점
                          </span>
                        )}
                        <span>{rev.date}</span>
                      </div>
                    </div>
                    {rev.title && rev.title !== rev.content && (
                      <p className="font-semibold text-foreground text-xs mb-1">{rev.title}</p>
                    )}
                    <p className="text-foreground/85 leading-relaxed text-[11px] whitespace-pre-line">
                      {rev.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-4 text-center text-xs text-muted-foreground">
                구매자 후기 없음 (첫 번째 리뷰어가 되어주세요)
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {isAvailable ? (
            <a
              href={book.links.cnuDetailUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="sm"
                className="h-9 rounded-xl bg-emerald-700 px-4 font-semibold text-white shadow-sm hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                도서관 소장 위치 확인
                <ExternalLink className="ml-1.5 h-3 w-3 opacity-70" />
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              onClick={() => onOpenPushModal(book)}
              className="h-9 rounded-xl bg-amber-600 px-4 font-semibold text-white shadow-sm hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
            >
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              반납 알림 신청 (무료)
            </Button>
          )}

          {/* Hope purchase request button */}
          <a
            href={book.links.cnuPurchaseRequestUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            >
              희망도서 신청
            </Button>
          </a>
        </div>

        {/* Affiliate Shop Link (Sustainable Revenue) */}
        <div>
          <a
            href={book.links.affiliateShopUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
            >
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              <span>YES24 독자후기·구매</span>
              <ExternalLink className="ml-1 h-3 w-3 opacity-70" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
