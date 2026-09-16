import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'VibeLib - 전남대학교 도서관 AI 스마트 큐레이터',
  description:
    '수백 권의 목차(TOC)와 독자 평점을 AI가 분석하여, 전남대생의 학습 목적에 딱 맞는 골든 5권과 청구기호를 찾아드립니다.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground flex flex-col justify-between">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div>
            <Navbar />
            <main>{children}</main>
          </div>

          {/* Footer with CNU Context and Affiliate Disclosure */}
          <footer className="mt-20 border-t border-border/60 bg-muted/20 py-8 text-xs text-muted-foreground">
            <div className="container mx-auto max-w-5xl px-4 text-center sm:px-6 space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-4 font-medium text-foreground/80">
                <span>전남대학교 중앙도서관 연계 AI 서비스</span>
                <span>·</span>
                <span>전 분야 스마트 큐레이션</span>
                <span>·</span>
                <a
                  href="https://lib.jnu.ac.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-emerald-700 dark:text-emerald-400"
                >
                  전남대 도서관 공식 홈페이지 ↗
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                본 서비스는 전남대학교 학생들의 탐구 및 학습 시간 단축을 위해 제작된 AI 도서 큐레이터입니다.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                ※ 일부 제휴 도서 링크를 통한 구매 시 소정의 수수료를 제공받을 수 있으며, 이는 VibeLib의 서버 유지 및 LLM API 비용으로 전액 환원됩니다.
              </p>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
