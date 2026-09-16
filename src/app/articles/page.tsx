import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, Calendar, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const ARTICLES = [
  {
    id: 'self-development-2026',
    title: '2026 전남대생을 위한 자기계발 필독서 5선 : 목차로 분석한 습관과 몰입의 기술',
    excerpt:
      '단순히 읽고 끝나는 책이 아닌, 3장 실행 챕터와 행동 트리거를 갖춘 진짜 인생 책을 전남대 도서관 소장 자료 중에서 엄선했습니다.',
    date: '2026.03.10',
    readTime: '5분 소요',
    category: '자기계발 / 학습법',
    cover: 'https://image.aladin.co.kr/product/18464/27/cover500/k832534033_1.jpg',
  },
  {
    id: 'vibe-coding-roadmap',
    title: '비전공자를 위한 AI 바이브 코딩 완벽 가이드 : 도서관에서 시작하는 1인 개발',
    excerpt:
      '문법 암기식 코딩에서 벗어나, 자연어 프롬프트와 Cursor/Claude를 결합해 나만의 웹 서비스를 실제로 출시하는 최신 실무 서적 분석.',
    date: '2026.03.08',
    readTime: '6분 소요',
    category: 'IT / 프로그래밍',
    cover: 'https://image.aladin.co.kr/product/33890/42/cover500/k982930291_1.jpg',
  },
  {
    id: 'deep-work-flow',
    title: '중도(중앙도서관) 열람실에서 써먹는 초몰입 테크닉 : 도파민 해독과 집중의 뇌과학',
    excerpt:
      '스마트폰 알림과 숏폼으로 산만해진 뇌를 재부팅하는 방법. 도서관 청구기호 180번대 철학/심리학 서가 속 숨은 명저 3권을 소개합니다.',
    date: '2026.03.01',
    readTime: '4분 소요',
    category: '뇌과학 / 심리',
    cover: 'https://image.aladin.co.kr/product/29087/90/cover500/k812836798_1.jpg',
  },
];

export default function ArticlesPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            VibeLib 검색으로 돌아가기
          </Button>
        </Link>
      </div>

      <div className="border-b border-border pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          <BookOpen className="h-3.5 w-3.5" />
          <span>VibeLib 도서관 매거진 & 큐레이션 칼럼</span>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          전남대인을 위한 깊이 있는 독서 탐구
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          도서관 서가 속에 숨어 있는 양서를 발굴하고, 목차 분석을 통해 학문적·실천적 인사이트를 전달합니다.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {ARTICLES.map((art) => (
          <Link
            key={art.id}
            href={`/articles/${art.id}`}
            className="group block overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:border-emerald-600/60 hover:shadow-md sm:p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[11px] font-semibold">
                    {art.category}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {art.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {art.readTime}
                  </span>
                </div>

                <h2 className="mt-2.5 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-emerald-700 dark:group-hover:text-emerald-400 sm:text-xl">
                  {art.title}
                </h2>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {art.excerpt}
                </p>

                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span>칼럼 전문 읽기</span>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
