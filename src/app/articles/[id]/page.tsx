import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Bookmark, Sparkles, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ARTICLES } from '../page';

interface ArticleDetailPageProps {
  params: { id: string };
}

const ARTICLE_CONTENTS: Record<
  string,
  {
    content: string;
    recommendedBooks: { title: string; callNumber: string; location: string }[];
  }
> = {
  'self-development-2026': {
    recommendedBooks: [
      { title: '아주 작은 습관의 힘 (Atomic Habits)', callNumber: '199.5 C623aKㅇ', location: '중앙도서관 본관 3자료실' },
      { title: '원씽 (The ONE Thing)', callNumber: '325.21 K29oKㄱ', location: '중앙도서관 본관 3자료실' },
      { title: '몰입 (Flow)', callNumber: '181.2 황19ㅁ', location: '중앙도서관 본관 3자료실' },
    ],
    content: `
### 1. 도서관 검색의 함정과 목차 분석의 힘
많은 학우들이 "시간관리", "자기계발"이라는 키워드로 도서관 시스템(lib.jnu.ac.kr)을 검색합니다. 그러나 수백 권의 책 제목은 대개 비슷하게 매력적입니다. 과연 어떤 책이 나의 실질적인 습관 변화를 이끌어줄 수 있을까요?

정답은 **'상세 목차(Table of Contents)'의 설계 밀도**에 있습니다. 제목은 출판사의 마케팅이지만, 목차는 저자가 설계한 시스템의 뼈대이기 때문입니다.

### 2. 제임스 클리어의 '아주 작은 습관의 힘'이 독보적인 이유
이 책의 목차를 살펴보면 [1장: 신호], [2장: 열망], [3장: 반응], [4장: 보상]이라는 행동과학 4단계 루프가 명쾌하게 구분되어 있습니다.
- **초심자를 위한 공략 챕터**: 제3장의 '2분 규칙(Two-Minute Rule)'입니다. 새로운 습관을 시작할 때 시작 허들을 2분 이내로 줄이라는 실천 원리는 시험 기간 스마트폰 사용 줄이기나 도서관 착석 습관 형성에 즉시 적용할 수 있습니다.
- **전남대 서가 위치**: 중앙도서관 본관 3자료실, 청구기호 **199.5 C623aKㅇ**

### 3. 게리 켈러의 '원씽' : 도서관에서 무엇에 집중할 것인가
전공 과제, 학점 관리, 대외활동, 자격증까지 한 번에 해내려다 번아웃을 겪는 대학생에게 원씽은 단 하나의 핵심 질문을 던집니다.
"내가 할 수 있는 단 하나의 일, 그것을 함으로써 다른 모든 일이 쉬워지거나 불필요해지는 일은 무엇인가?"
`,
  },
  'vibe-coding-roadmap': {
    recommendedBooks: [
      { title: 'Do it! 점프 투 파이썬 (전면 개정판)', callNumber: '005.133 박68ㅈ', location: '중앙도서관 본관 4자료실' },
      { title: '클린 코드 : 애자일 소프트웨어 장인 정신', callNumber: '005.1 M382cKㅂ', location: '중앙도서관 본관 4자료실' },
    ],
    content: `
### 1. 2026년, 코딩을 배우는 방식이 근본적으로 바뀌었다
지금까지 비전공자가 코딩을 시작하려면 변수, 조건문, 반복문, 자료구조라는 거대한 문법의 장벽을 마주해야 했습니다. 그러나 Claude 3.7 Sonnet, Gemini 2.5, Cursor와 같은 차세대 AI 도구가 등장하면서 패러다임은 **자연어로 설계하고 AI와 협업하는 바이브 코딩(Vibe Coding)**으로 완전히 전환되었습니다.

### 2. 도서관 소장 도서로 시작하는 AI 협업 실전 지침
- **핵심 1**: '문법 암기'가 아닌 **'소프트웨어 아키텍처와 요구사항 정의(PRD/TRD)'**를 세울 수 있는 기획력 (추천: 『클린 코드』)
- **핵심 2**: 에러 로그를 읽고 AI에게 문제를 맥락과 함께 제시하는 기초 문법 이해 (추천: 『Do it! 점프 투 파이썬』)
- **전남대 소장 도서 팁**: 중앙도서관 4자료실 005번대(컴퓨터과학) 서가에서 실습 예제가 풍부한 책을 대출하여 1박 2일 해커톤 방식으로 직접 따라 해보길 권장합니다.
`,
  },
  'deep-work-flow': {
    recommendedBooks: [
      { title: '도파민네이션 : 쾌락 과잉 시대에서 균형 찾기', callNumber: '189.2 L554dKㄱ', location: '중앙도서관 본관 3자료실' },
      { title: '역행자 (확장판)', callNumber: '325.21 자82ㅇ', location: '중앙도서관 본관 3자료실' },
    ],
    content: `
### 1. 중앙도서관 열람실에서 왜 우리는 딴짓을 할까?
스탠탠퍼드대 정신의학 교수 애나 렘키의 '도파민네이션' 목차를 보면 '도파민 저울의 원리(Pleasure-Pain Balance)'가 설명되어 있습니다. 스마트폰과 유튜브 쇼츠 같은 초자극제는 뇌의 저울을 고통 쪽으로 기울어지게 만들어, 일상적인 독서와 공부를 지루하게 느끼게 만듭니다.

### 2. 열람실 집중력 리셋 3단계 루틴
1. **도파민 단식 20분**: 열람실 착석 후 첫 20분간 스마트폰을 가방 깊숙이 넣고 서가 청구기호를 찾아 도서관을 천천히 걷기
2. **시각적 트리거 구축**: 책상 위에 오직 지금 읽을 도서 1권과 필기구만 올려두기
3. **25분 몰입 - 5분 휴식 뽀모도로 실천**
`,
  },
};

export default function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const article = ARTICLES.find((a) => a.id === params.id);
  const detail = ARTICLE_CONTENTS[params.id];

  if (!article || !detail) {
    notFound();
  }

  return (
    <article className="container mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/articles">
        <Button variant="ghost" size="sm" className="mb-6 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          목록으로
        </Button>
      </Link>

      <div className="border-b border-border pb-6">
        <Badge variant="secondary" className="text-xs font-semibold">
          {article.category}
        </Badge>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {article.title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {article.date}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {article.readTime}
          </span>
          <span>· VibeLib 에디토리얼 팀</span>
        </div>
      </div>

      {/* Recommended Books Box */}
      <div className="my-6 rounded-2xl border border-emerald-600/30 bg-emerald-50/60 p-4 text-xs dark:bg-emerald-950/30 sm:p-5">
        <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          <span>칼럼에서 추천하는 전남대 도서관 소장 도서</span>
        </div>
        <div className="mt-3 space-y-2">
          {detail.recommendedBooks.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-background/80 p-2.5">
              <span className="font-semibold text-foreground">{b.title}</span>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                  {b.callNumber}
                </span>
                <span>({b.location})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body Content */}
      <div className="prose prose-emerald max-w-none text-sm leading-relaxed text-foreground dark:prose-invert sm:text-base whitespace-pre-line">
        {detail.content}
      </div>

      <div className="mt-10 border-t border-border pt-6 text-center">
        <Link href="/">
          <Button className="rounded-xl bg-emerald-700 px-6 font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600">
            VibeLib에서 지금 책 검색하기
          </Button>
        </Link>
      </div>
    </article>
  );
}
