# [TRD] 전남대학교 도서관 전 분야 AI 스마트 큐레이터 (VibeLib)
> **문서 버전**: v3.0 (캠퍼스 분리 · 청구기호 하이브리드 발굴 · YES24 공식 API 연동 반영본)  
> **대상**: 시스템 아키텍처, CNU OPAC & YES24 API 연동, 청구기호 서가 발굴, 캐싱 및 대출 비율 보장

---

## 1. 시스템 아키텍처 개요

VibeLib은 **Next.js App Router 기반의 서버리스 풀스택 아키텍처**로 구성되며, 전남대 도서관 시스템과 YES24 공식 API를 결합하여 실시간 큐레이션을 제공합니다.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Client (Next.js 14/15 + shadcn/ui)                   │
│           - 모바일 우선 반응형 웹 / PWA (Service Worker Web Push)       │
│           - 캠퍼스 선택 토글 (광주 / 여수 / 전남대 전체)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  VibeLib Backend (Next.js API Routes)                  │
│                                                                        │
│  ┌───────────────────────┐         ┌────────────────────────────────┐  │
│  │   Query Orchestrator  │ ──────▶ │ 2단계 캐시 (Supabase DB + LRU) │  │
│  │ (LLM 질의/청구기호 분석) │      └────────────────────────────────┘  │
│  └───────────┬───────────┘                                             │
│              │                                                         │
│              ├──────────────────────┬───────────────────────┐          │
│              ▼                      ▼                       ▼          │
│   ┌────────────────────┐  ┌───────────────────┐  ┌──────────────────┐  │
│   │ CNU Library Parser │  │  YES24 Official   │  │ AI Curation LLM  │  │
│   │  (키워드 + 청구기호 │  │    Open API        │  │ (목차 과제 도출  │  │
│   │  서가 하이브리드)   │  │(실측랭킹/리뷰/표지)│  │ & 3:2 대출 보장) │  │
│   └──────────┬─────────┘  └───────────────────┘  └──────────────────┘  │
│              │ Direct GET                                              │
│              ▼                                                         │
│   ┌────────────────────┐                                               │
│   │ 전남대 도서관 서버 │                                               │
│   │ (lib.jnu.ac.kr)    │                                               │
│   └────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 외부 데이터 소싱 & 연동 파이프라인

### 2.1. 전남대학교 도서관 (키워드 + 서가 청구기호 하이브리드 수집)
* **엔드포인트**: `GET https://lib.jnu.ac.kr/search/tot/result`
* **파라미터 규격**:
  * `bk_0=jttjmjttj`: 단행본 한정 필터
  * `bk_rf=2022`: 2022년 이후 발행 도서 필터
  * `cpp=50`: 페이지당 50권 고속 수집
  * `bk_2=jttjvyjttj`: 여수캠퍼스 전용 파셋
* **하이브리드 서가 발굴 (Same-Shelf Discovery)**:
  * 청구기호 검색: `si=6&q={prefix}*&st=KWRD` (예: `005.1*`, `006.3*`, `808*`)
  * 키워드 검색 결과와 청구기호 서가 결과를 병합(Hybrid Pool: 50~115권)
* **캠퍼스별 소장처 필터링**:
  * **여수캠퍼스**: 소장처 텍스트에 `여수캠퍼스도서관` 포함 도서만 엄격 추출.
  * **광주캠퍼스**: `중앙도서관[정보마루]`, `중앙도서관[본관]`, `법학도서관`, `의학도서관` 소장 도서 필터링.
* **실시간 대출 상태 및 소장 서지 정보 추출**:
  * `AVAILABLE` (대출 가능) vs `CHECKED_OUT` (대출중 + 반납예정일)
  * 청구기호 (예: `006.3 김68ㅇ`) 및 소장 위치

### 2.2. YES24 공식 Open API (실측 랭킹, 실구매자 리뷰, 무손실 표지)
* **인증 키**: `yk_live_*`
* **엔드포인트**:
  * 상품 검색: `https://api.yes24.com/goods/search`
  * 실측 랭킹: `BestSellerRank_Book` ➔ `[베스트] {분야} top100 {기간}`
  * 구매자 후기: `GoodsReviewList` ➔ 평점, 작성자(마스킹), 등록일자, 리뷰 본문
  * 판매지수: `SalesPoint` 및 공식 산정 가중치 툴팁 지원
  * 표지 이미지: `object-contain` 렌더링으로 잘림 없는 원본 노출

---

## 3. 스마트 30권 스크리닝 & 대출 비율 강제 파이프라인

1. **대량 수집 풀 (50~115권)**
   - `searchCnuLibrary` (키워드) + `searchCnuLibraryByCallNo` (청구기호 접두사) 병렬 실행.
2. **스마트 30권 압축 스크리닝 (`screenCandidatePool`)**
   - **최신 도서군**: 2025~2026년 최신 출간 도서 상위 10권 우선 선발.
   - **인기 도서군**: YES24 판매지수/평점/리뷰 상위 20권 선발.
   - 총 30권으로 압축하여 상세 소장 상태 및 리뷰 데이터를 병렬 조회(지연시간 극소화).
3. **Top 5 대출 비율 강제 엔진 (`enforceAvailabilityRatio`)**
   - 추천 도서 5권 중 **대출 가능(`AVAILABLE`) 최소 3권 이상**, **대출 불가능(`CHECKED_OUT`) 최대 2권 이하** 보장.
   - 대출중 도서가 2권을 초과할 경우 3순위 이하의 대출중 도서를 다음 순위의 대출 가능 도서로 자동 스왑.

---

## 4. 캐싱 전략 (`${query}_${intent}_${campus}`)

* **복합 키 구조**: 검색어, 읽기 목적(`beginner` / `practical`), 선택 캠퍼스(`gwangju` / `yeosu` / `all`)를 결합.
* **캐시 적중 시**: 외부 API 및 도서관 크롤링 없이 0.05초 만에 응답, LLM 비용 0원.
* **미적중 시**: 실시간 수집 ➔ 30권 스크리닝 ➔ AI 목차 분석 ➔ 결과 저장 (24시간 보관).

---

## 5. 핵심 API 명세 (`GET /api/curate`)

* **Query Parameters**:
  * `q` (string): 검색 키워드 (예: "글쓰기", "바이브코딩")
  * `intent` (enum): `beginner` (입문/교양) | `practical` (실습/실무)
  * `campus` (enum): `gwangju` | `yeosu` | `all` (기본값: `gwangju`)
* **Response Body (Top 5 집중 브리핑)**:
```typescript
interface CurateResponse {
  searchMeta: {
    query: string;
    intent: "beginner" | "practical";
    campus: "gwangju" | "yeosu" | "all";
    totalHarvested: number;     // 50 ~ 115권
    screenedCount: number;      // 30권
    cached: boolean;
  };
  books: CuratedBookItem[];     // 정확히 상위 5권 (대출 가능 >= 3권 보장)
}

interface CuratedBookItem {
  rank: number;                  // 1 ~ 5
  id: string;                    // 전남대 소장 도서 ID
  isbn: string;                  // 도서 고유 ISBN
  title: string;                 // 도서명
  author: string;                // 저자
  publisher: string;             // 출판사
  coverUrl: string;              // 고화질 표지 (object-contain)
  rating: number;                // YES24 평점 (10점 만점)
  salesPoint: number;            // YES24 판매지수
  officialRankBadge?: string;    // 예: "[베스트] IT 모바일 top100 4주" (실측치 없을 시 undefined)
  callNumber: string;            // 서가 청구기호 (예: 005.1 최79ㅇ)
  location: string;              // 캠퍼스 소장 자료실 (예: 중앙도서관[본관])
  status: "AVAILABLE" | "CHECKED_OUT";
  returnDueDate?: string;        // "2026-09-30"
  solvedProblems: string[];      // 목차 분석 기반 해결 가능한 대학 과제/고민 2~3개
  reviews: Array<{               // YES24 실제 회원 후기
    rating: number;
    writer: string;
    date: string;
    content: string;
  }>;
}
```
