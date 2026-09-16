# [개발 계획 최종 확정본] 전남대학교 도서관 AI 스마트 큐레이터 (VibeLib)

> **문서 버전**: v2.0 (grill-me 인터뷰를 통한 기술 아키텍처 세부 결정 반영본)  
> **스킬 적용**: `writing-plans` (단위별 상세 태스크) + `karpathy-guidelines` (군더더기 없는 미니멀 개발) + `frontend-design` (shadcn/ui 고품격 디자인)  
> **저장 위치**: [c:\Library\DEVELOPMENT_PLAN.md](file:///c:/Library/DEVELOPMENT_PLAN.md)  
> **최종 수정일**: 2026-09-15

---

## 1. grill-me 인터뷰로 확정된 4대 핵심 기술 의사결정

1. **메인 데이터베이스 & 스토리지: [Supabase (무료 티어 PostgreSQL)]**
   * 인기 도서 큐레이션 캐시(`books_cache`)와 학생들의 스마트 반납 알림 신청 내역(`push_subscribers`)을 영구 저장.
2. **외부 API 개발 모드: [스마트 하이브리드 (Mock 가상데이터 + 실 API 자동 전환)]**
   * 개발 초기에는 API 키 발급 대기 없이도 **실제 전남대 도서관 검색 + 가상 목차/AI**로 로컬 화면 및 기능을 100% 즉시 검증 가능.
   * `.env.local`에 실제 키(Gemini, 알라딘, Supabase)를 입력하는 순간 실서비스 모드로 자동 전환.
3. **런타임 환경 구성: [Windows winget을 통한 Node.js LTS 무인 자동 설치]**
   * Microsoft 공식 패키지 관리자를 통해 안정된 최신 Node.js LTS 버전을 설치하고 환경 변수 즉시 연동.
4. **프로젝트 배치: [작업 공간 루트(`c:\Library`)에 직접 구성]**
   * 하위 폴더 분리 없이 `c:\Library` 루트에 `package.json`, `src/`, `components/`가 위치하여 가장 직관적으로 관리.

---

## 2. 최종 기술 스택 요약

| 계층 | 선정 기술 | 비고 |
| :--- | :--- | :--- |
| **런타임 & 패키지 매니저** | **Node.js LTS (v20+) + npm** | winget 무인 설치 |
| **웹 프레임워크** | **Next.js 14/15 (App Router, TypeScript)** | SSR + Route Handlers 통합 |
| **디자인 & UI** | **Tailwind CSS + shadcn/ui** | Radix UI 기반 컴포넌트 라이브러리 |
| **데이터베이스** | **Supabase (PostgreSQL)** | 무료 티어, 캐시 및 푸시 구독 저장 |
| **도서관 스크래퍼** | **Native fetch + Cheerio** | 전남대 도서관 HTML 및 MARC JSON 추출 |
| **목차 & 평점 API** | **알라딘 Open API (TTB)** | ISBN 기반 상세 목차 및 평점 연동 |
| **AI 큐레이터** | **Google Gemini 2.5 Flash API** | 초저비용(회당 ~0.7원), Mock 모드 기본 지원 |
| **스마트 반납 알림** | **W3C Web Push (`web-push` 라이브러리)** | 무료 VAPID 푸시, 평일 09시/13시/16시 크론 |

---

## 3. 프로젝트 폴더 구조 (`c:\Library` 루트 기준)

```
c:\Library\
├── .agent/skills/               # 설치된 10종 AI 전문 스킬
├── public/
│   ├── favicon.ico              # 전남대 그린 AI 책 파비콘
│   ├── manifest.json            # PWA 홈화면 추가 매니페스트
│   └── sw.js                    # Web Push 수신용 서비스 워커
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 전역 폰트, 테마 프로바이더, 네비게이션, 푸터
│   │   ├── page.tsx             # 메인 탐색 페이지 (Hero, 목적 선택, Top 5 피드)
│   │   ├── articles/            # [애드센스 심사용] 큐레이션 칼럼 정적 페이지들
│   │   └── api/
│   │       ├── curate/route.ts  # [핵심] 도서관 검색 + 알라딘 목차 + AI 큐레이션 통합 API
│   │       └── push/
│   │           ├── subscribe/route.ts # 웹 푸시 구독 등록
│   │           └── cron/route.ts      # 09시/13시/16시 반납 체크 크론 트리거
│   ├── components/
│   │   ├── ui/                  # shadcn/ui 컴포넌트들 (button, card, badge, etc.)
│   │   ├── navbar.tsx           # 상단 헤더, 로고, 다크모드 토글
│   │   ├── search-hero.tsx      # 검색창, 입문/실무 사전 목적 선택 토글
│   │   ├── book-card.tsx        # Top 5 큐레이션 도서 카드 (청구기호, 목차 아코디언)
│   │   ├── ad-banner.tsx        # 반응형 애드센스/애드핏 배너 슬롯
│   │   └── push-modal.tsx       # 반납 알림 동의 모달
│   └── lib/
│       ├── cnu-library.ts       # 전남대 도서관 소장자료 및 MARC 파서
│       ├── aladin.ts            # 알라딘 Open API 목차/평점 연동기 (Mock 지원)
│       ├── ai-curator.ts        # 목차 기반 Top 5 선별 프롬프트 (Mock 지원)
│       └── supabase.ts          # Supabase 클라이언트 및 캐시/구독 CRUD
├── DEVELOPMENT_PLAN.md          # 본 개발 계획 문서
├── PRD.md                       # 제품 기획서 v3.0
├── UI_UX.md                     # 디자인 가이드 v2.0
├── TRD.md                       # 기술 아키텍처 v2.0
└── 해결해야할_문제.md            # 애드센스 승인 전략 추적
```

---

## 4. 단계별 상세 개발 실행 로드맵 (Action Checklist)

### Phase 1. 로컬 환경 구성 & 도서관 코어 데이터 파이프라인
- [x] **Step 1.1**: Windows `winget`을 통해 Node.js LTS 버전 무인 자동 설치 및 버전 검증
- [x] **Step 1.2**: `c:\Library` 루트에 Next.js 14/15 App Router + TypeScript + Tailwind CSS 초기화
- [x] **Step 1.3**: `shadcn/ui` 초기화 및 에메랄드 그린/다크모드 테마 토큰 구성
- [x] **Step 1.4**: 전남대 도서관 실제 크롤러 및 MARC 서지 파서 구현 (`src/lib/cnu-library.ts`)
- [x] **Step 1.5**: 알라딘 Open API 목차/평점 연동기 구현 (`src/lib/aladin.ts`, Mock fallback 내장)

### Phase 2. Supabase 스토리지 및 AI 큐레이터 엔진
- [x] **Step 2.1**: Supabase 클라이언트 세팅 및 `books_cache`, `push_subscribers` 테이블 스키마 정의 (`src/lib/supabase.ts`)
- [x] **Step 2.2**: AI 목차 기반 Top 5 큐레이션 엔진 구현 (`src/lib/ai-curator.ts`, Mock fallback 내장)
- [x] **Step 2.3**: 통합 검색 Route Handler 완성 (`src/app/api/curate/route.ts`)

### Phase 3. 프론트엔드 UI/UX 구현 (shadcn/ui)
- [x] **Step 3.1**: 상단 네비게이션 및 다크모드 토글러 (`src/components/navbar.tsx`)
- [x] **Step 3.2**: Hero 검색창 및 `[🌱 입문/교양]` / `[⚡ 실습/실무]` 사전 목적 선택 칩 (`src/components/search-hero.tsx`)
- [x] **Step 3.3**: Top 5 골든 도서 카드 컴포넌트 (`src/components/book-card.tsx`)
  - 청구기호 하이라이트 박스
  - 목차 분석 접이식 아코디언
  - 상태별 분기 버튼: 대출가능 / 반납알림신청 / 제휴구매 / 희망도서신청
- [x] **Step 3.4**: 로딩 스켈레톤 애니메이션 (`src/components/ui/skeleton.tsx`)

### Phase 4. 스마트 반납 알림 (Web Push) & 배너 슬롯
- [x] **Step 4.1**: 서비스 워커 및 VAPID 웹 푸시 권한 모달 연동 (`public/sw.js`, `src/components/push-modal.tsx`)
- [x] **Step 4.2**: 평일 09:00, 13:00, 16:00 반납 상태 체크 크론 핸들러 (`src/app/api/push/cron/route.ts`)
- [x] **Step 4.3**: 구글 애드센스/카카오 애드핏 배너 슬롯 컴포넌트 마크업 (`src/components/ad-banner.tsx`)
- [x] **Step 4.4**: 애드센스 심사용 북 매거진 정적 아티클 3편 페이지 구성 (`src/app/articles/*`)
