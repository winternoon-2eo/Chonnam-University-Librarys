'use client';

import React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, BookOpen, Sparkles, Newspaper } from 'lucide-react';

export function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Logo & Brand */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-800 to-emerald-600 text-white shadow-sm shadow-emerald-900/20 transition-transform group-hover:scale-105">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-foreground">
                VibeLib
              </span>
              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                전남대 AI
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              전남대학교 도서관 목차 기반 스마트 큐레이터
            </p>
          </div>
        </Link>

        {/* Right Action Nav */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/articles">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">도서관 칼럼</span>
              <span className="sm:hidden">칼럼</span>
            </Button>
          </Link>

          {mounted && (
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-border/60"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="테마 전환"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-all" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700 transition-all" />
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
