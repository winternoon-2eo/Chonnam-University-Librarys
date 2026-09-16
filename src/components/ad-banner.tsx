'use client';

import React from 'react';
import { Sparkles, ExternalLink } from 'lucide-react';

interface AdBannerProps {
  slotId?: string;
  className?: string;
}

export function AdBanner({ slotId = 'default-slot', className = '' }: AdBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4 text-center transition-colors hover:border-emerald-600/40 ${className}`}
    >
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
            스폰서
          </span>
          <span>전남대 학우를 위한 추천 학술 & IT 도서 기획전</span>
        </div>

        <a
          href="https://www.aladin.co.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          <span>신학기 전공/교양 베스트셀러 바로가기</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
