import { AladinBookInfo } from './aladin';
import { CnuBookSearchResult } from './cnu-library';
import { BookstoreMetadata } from './bookstore';
import { Yes24Review } from './yes24';

export interface RawCandidateBook {
  cnu: CnuBookSearchResult;
  aladin: BookstoreMetadata | AladinBookInfo;
}

export interface CuratedBookItem {
  rank: number;
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  pubYear: string;
  coverUrl: string;
  rating: number;
  salesPoint: number;
  rankingBadge?: {
    isBest: boolean;
    rankingText: string;
  };
  reviews?: Yes24Review[];
  callNumber: string;
  location: string;
  status: 'AVAILABLE' | 'CHECKED_OUT' | 'NOT_HELD';
  returnDueDate?: string;
  toc: string;
  aiCuration: {
    recommendReason: string;
    targetChapter: string;
    badge: string;
    targetAudience?: string;
    cautionAudience?: string;
    difficulty?: string;
    solvedProblems?: string[];
  };
  links: {
    cnuDetailUrl: string;
    cnuPurchaseRequestUrl: string;
    affiliateShopUrl: string;
  };
}

export interface QueryAnalysisResult {
  originalQuery: string;
  correctedQuery: string;
  isTypo: boolean;
  searchKeywords: string[];
  callNumberPrefixes: string[];
  explanation: string;
}

/**
 * Universal DDC / KDC Call Number Prefix Resolver for ALL Academic & Practical Disciplines
 * Guarantees that every single keyword search ALWAYS triggers same-shelf call number harvesting.
 */
export function resolveCallNumberPrefixes(query: string): string[] {
  const q = query.trim().toLowerCase();

  // 1. 심리학 / 정신의학 / 상담 / 멘탈
  if (/심리|상담|마음|멘탈|우울|불안|성격|인지|프로이트|아들러|도파민/i.test(q)) {
    return ['180', '150'];
  }
  // 2. 인공지능 / 클로드 / LLM / 생성형
  if (/클로드|claude|챗gpt|gpt|ai|인공지능|llm|생성형|머신러닝|딥러닝|프롬프트|에이전트|바이브/i.test(q)) {
    return ['006.3', '005.13'];
  }
  // 3. 컴퓨터 / 코딩 / 프론트엔드 / 백엔드 / 웹 / 소프트웨어
  if (/프론트|백엔드|웹|코딩|파이썬|자바|자바스크립트|타입스크립트|리액트|스프링|c언어|프로그래밍|개발|알고리즘|자료구조|소프트웨어|html|css/i.test(q)) {
    return ['005.13', '005.1'];
  }
  // 4. 지식관리 / 생산성 / 도구
  if (/옵시디언|노션|메모|생산성|지식관리|기록/i.test(q)) {
    return ['005.5', '005.1'];
  }
  // 5. 자기계발 / 처세 / 습관
  if (/자기계발|습관|시간관리|동기부여|처세|역행자|원씽|카네기|인간관계/i.test(q)) {
    return ['325.211', '199.1'];
  }
  // 6. 경영 / 마케팅 / 비즈니스
  if (/경영|마케팅|비즈니스|전략|회계|재무|스타트업|피터\s*드러커/i.test(q)) {
    return ['325', '658'];
  }
  // 7. 경제 / 금융 / 투자 / 주식
  if (/경제|금융|주식|투자|부동산|재테크|화폐|인플레이션/i.test(q)) {
    return ['320', '327'];
  }
  // 8. 사회과학 / 정치 / 행정
  if (/정치|외교|행정|사회학|복지|정책/i.test(q)) {
    return ['340', '330'];
  }
  // 9. 법학 / 법률
  if (/법학|헌법|민법|형법|법률|판례|소송/i.test(q)) {
    return ['360', '340'];
  }
  // 10. 교육학 / 학습법
  if (/교육|교수법|학습법|공부|학교|수업/i.test(q)) {
    return ['370'];
  }
  // 11. 철학 / 윤리
  if (/철학|윤리|사상|동양철학|서양철학|논리학/i.test(q)) {
    return ['100', '160'];
  }
  // 12. 역사
  if (/역사|한국사|세계사|조선|고대사|전쟁사/i.test(q)) {
    return ['900', '911'];
  }
  // 13. 문학 / 소설 / 시
  if (/문학|소설|시|수필|에세이|작가|한강|김영하/i.test(q)) {
    return ['813', '800'];
  }
  // 14. 글쓰기 / 작문
  if (/글쓰기|작문|문장|보고서|논문|레포트/i.test(q)) {
    return ['808'];
  }
  // 15. 자연과학 / 수학 / 물리 / 화학 / 생물
  if (/물리|화학|생물|수학|통계|지구과학|우주/i.test(q)) {
    return ['410', '420'];
  }
  // 16. 의학 / 간호 / 보건
  if (/의학|간호|보건|약학|해부|질병/i.test(q)) {
    return ['510', '610'];
  }
  // 17. 예술 / 디자인 / 음악 / 미술
  if (/예술|미술|디자인|음악|사진|영화|건축/i.test(q)) {
    return ['600', '650'];
  }

  // Broad Fallback: Computing & General Knowledge
  return ['005.1'];
}

/**
 * Extract a canonical fingerprint from book title & author
 * to prevent duplicate editions/copies of the exact same work in recommendations.
 */
export function getBookCanonicalKey(title: string, author = ''): string {
  // 1. Resolve canonical author
  let cleanAuthor = author
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/(지음|옮김|저|원작|글|그림|역|외|공저|엮음|편저).*/g, '')
    .replace(/[^a-zA-Z0-9가-힣]/g, '')
    .toLowerCase()
    .trim();

  if (/carnegie|카네기/i.test(cleanAuthor) || /카네기/i.test(title)) cleanAuthor = '카네기';
  else if (/자청/i.test(cleanAuthor) || /자청/i.test(title)) cleanAuthor = '자청';
  else if (/한강/i.test(cleanAuthor) || /한강/i.test(title)) cleanAuthor = '한강';
  else if (/김영하/i.test(cleanAuthor) || /김영하/i.test(title)) cleanAuthor = '김영하';
  else if (/마틴|martin/i.test(cleanAuthor) || /로버트.*마틴/i.test(title)) cleanAuthor = '로버트마틴';

  // 2. Clean title: remove brackets, parentheses, subtitles, edition labels
  let cleanTitle = title
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .split(/[:\-=—/]/)[0]
    .replace(/(개정증보판|개정판|개정\s*\d*판|전면개정판|확장판|완전판|특별판|신장판|\d*판)/gi, '')
    .replace(/데일\s*카네기|카네기|dale\s*carnegie|carnegie/gi, '')
    .replace(/자청/gi, '')
    .replace(/한강/gi, '')
    .replace(/김영하/gi, '')
    .replace(/[^a-zA-Z0-9가-힣]/g, '')
    .toLowerCase()
    .trim();

  // Core canonical title normalization
  if (/인간관계론/i.test(cleanTitle)) cleanTitle = '인간관계론';
  else if (/역행자/i.test(cleanTitle)) cleanTitle = '역행자';
  else if (/원씽|theonething/i.test(cleanTitle)) cleanTitle = '원씽';
  else if (/세이노/i.test(cleanTitle)) cleanTitle = '세이노의가르침';
  else if (/미움받을\s*용기/i.test(cleanTitle)) cleanTitle = '미움받을용기';
  else if (/클린\s*코드/i.test(cleanTitle)) cleanTitle = '클린코드';

  return `${cleanTitle}_${cleanAuthor}`;
}

export function getAuthorCanonicalKey(author: string, title = ''): string {
  if (/carnegie|카네기/i.test(author) || /카네기/i.test(title)) return '카네기';
  if (/자청/i.test(author) || /자청/i.test(title)) return '자청';
  if (/한강/i.test(author) || /한강/i.test(title)) return '한강';
  if (/김영하/i.test(author) || /김영하/i.test(title)) return '김영하';
  if (/마틴|martin/i.test(author) || /로버트.*마틴/i.test(title)) return '로버트마틴';
  return author.replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 4).toLowerCase().trim() || '저자미상';
}

/**
 * Intelligent Query Rewriter & Keyword Expansion using Gemini 3.5 Flash
 * Automatically detects typos (e.g. '클롣' -> '클로드'), maps colloquial queries ('코딩 공부' -> '프로그래밍 입문'),
 * derives DDC/KDC call number classification prefixes (e.g. '글쓰기' -> ['808'], '코딩' -> ['005.1', '005.13']),
 * and generates 2-3 optimal library OPAC keywords to harvest rich candidates.
 */
export async function analyzeAndExpandQuery(
  rawQuery: string,
  intent: 'beginner' | 'practical'
): Promise<QueryAnalysisResult> {
  const cleanQ = rawQuery.trim();
  const resolvedPrefixes = resolveCallNumberPrefixes(cleanQ);

  const defaultResult: QueryAnalysisResult = {
    originalQuery: cleanQ,
    correctedQuery: cleanQ,
    isTypo: false,
    searchKeywords: [cleanQ],
    callNumberPrefixes: resolvedPrefixes,
    explanation: '',
  };

  // Deterministic Domain & Author Knowledge Map (Prevents degradation on Gemini 429 rate limit)
  const DOMAIN_KNOWLEDGE_MAP: Record<string, Partial<QueryAnalysisResult>> = {
    '한강': {
      correctedQuery: '한강',
      searchKeywords: ['한강', '소년이 온다', '작별하지 않는다', '채식주의자'],
      callNumberPrefixes: ['813'],
      explanation: '소설가 한강의 문학 세계를 대표하는 주요 작품 서가를 함께 안내합니다.',
    },
    '김영하': {
      correctedQuery: '김영하',
      searchKeywords: ['김영하', '살인자의 기억법', '작별인사', '여행의 이유'],
      callNumberPrefixes: ['813'],
      explanation: '소설가 김영하의 대표 장편소설 및 산문 서가를 함께 탐색합니다.',
    },
    '유발 하라리': {
      correctedQuery: '유발 하라리',
      searchKeywords: ['유발 하라리', '사피엔스', '호모 데우스', '넥서스'],
      callNumberPrefixes: ['909', '303'],
      explanation: '인류학 및 문명사 분야를 대표하는 유발 하라리의 저작을 안내합니다.',
    },
    '글쓰기': {
      searchKeywords: ['글쓰기', '문장론', '보고서 작성', '논문작성'],
      callNumberPrefixes: ['808'],
    },
    '코딩': {
      searchKeywords: ['코딩', '프로그래밍', '파이썬', '자료구조'],
      callNumberPrefixes: ['005.1', '005.13'],
    },
    '자기계발': {
      searchKeywords: ['자기계발', '역행자', '원씽', '세이노의 가르침', '인간관계론'],
      callNumberPrefixes: ['325.211', '199.1'],
      explanation: '전남대 도서관에 소장된 검증된 인생 명저와 스테디셀러 서가를 함께 탐색합니다.',
    },
    '경영학': {
      searchKeywords: ['경영학', '마케팅', '회계원리', '피터 드러커'],
      callNumberPrefixes: ['325', '658'],
      explanation: '경영학 기초 원리와 권위 있는 비즈니스 명저 서가를 함께 안내합니다.',
    },
    '심리학': {
      searchKeywords: ['심리학', '미움받을 용기', '프레임', '생각에 관한 생각', '설득의 심리학'],
      callNumberPrefixes: ['180', '150'],
      explanation: '전남대 도서관에 소장된 기초 심리학 및 대중적으로 검증된 심리 명저 서가를 함께 탐색합니다.',
    },
    '클로드': {
      searchKeywords: ['클로드', 'claude', '바이브 코딩', 'ai 에이전트', '옵시디언'],
      callNumberPrefixes: ['006.3', '005.13'],
      explanation: '앤트로픽 클로드(Claude), 바이브 코딩 및 최신 AI 에이전트 개발 서가를 함께 탐색합니다.',
    },
    '인공지능': {
      searchKeywords: ['인공지능', '머신러닝', '딥러닝', '생성형 ai'],
      callNumberPrefixes: ['006.3', '005.13'],
      explanation: '최신 인공지능 및 딥러닝/머신러닝 핵심 서가를 함께 안내합니다.',
    },
    '경제학': {
      searchKeywords: ['경제학', '맨큐의 경제학', '국부론', '자본주의'],
      callNumberPrefixes: ['320', '327'],
      explanation: '경제학 원론 및 기초 경제 교양 명저 서가를 함께 안내합니다.',
    },
    '옵시디언': {
      searchKeywords: ['옵시디언', '세컨드 브레인', '제텔카스텐', '생산성'],
      callNumberPrefixes: ['005.5', '005.1'],
      explanation: '지식 관리 및 제텔카스텐/세컨드 브레인 생산성 서가를 함께 탐색합니다.',
    },
    '프론트엔드': {
      searchKeywords: ['프론트엔드', '리액트', '자바스크립트', '웹 프로그래밍', '모던 웹'],
      callNumberPrefixes: ['005.13', '005.1'],
      explanation: '전남대 도서관에 소장된 프론트엔드 및 리액트/자바스크립트 최신 개발 서가를 함께 탐색합니다.',
    },
    '백엔드': {
      searchKeywords: ['백엔드', '스프링', '자바', '서버 개발', '시스템 아키텍처'],
      callNumberPrefixes: ['005.13', '005.1'],
      explanation: '전남대 도서관에 소장된 백엔드 및 서버/스프링 아키텍처 서가를 함께 탐색합니다.',
    },
  };

  const matchedKnowledge = DOMAIN_KNOWLEDGE_MAP[cleanQ];
  if (matchedKnowledge) {
    Object.assign(defaultResult, matchedKnowledge);
  }


  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey || !cleanQ) {
    return defaultResult;
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const prompt = `
당신은 전남대학교 도서관 검색 시스템의 'AI 쿼리 분석 및 확장 엔진'입니다.
사용자가 입력한 검색어는 특정 소설가/학자/인물명(예: "한강", "유발 하라리"), 거대 주제(예: "자기계발", "경영학"), 오탈자(예: "클롣" -> "클로드"), 구어체/자연어(예: "코딩 공부"), 특정 도구명(예: "옵시디언")일 수 있습니다.
대학 도서관 서명 검색(단순 키워드 매칭) 및 사서 십진분류 청구기호(DDC/KDC) 서가 탐색에서 가장 우수하고 실질적인 소장 도서를 많이 발굴할 수 있도록 분석해 주세요.

[중요 규칙]:
1. 만약 검색어가 특정 소설가/작가/인물(예: "한강", "김영하")인 경우:
   - 도서관 서명 검색에서 실제 작가의 명저가 검색될 수 있도록 searchKeywords에 작가 이름과 함께 그 작가의 유명 대표작 도서명 2~3개(예: ["한강", "소년이 온다", "작별하지 않는다", "채식주의자"])를 반드시 포함하세요.
   - callNumberPrefixes에는 해당 문학/학문 분류기호(예: 한국소설 -> ["813"])를 반드시 지정하세요.
2. 만약 검색어가 "자기계발", "인문학" 등 방대한 대주제인 경우:
   - 도서관의 단순 최신순 쏠림을 방지하기 위해 해당 분야의 공인된 스테디셀러 명저(예: ["역행자", "원씽", "세이노의 가르침", "인간관계론"])를 searchKeywords에 함께 포함하세요.
3. 오탈자가 있으면 올바르게 교정하세요.

[사용자 입력 검색어]: "${cleanQ}"
[사용자 학습 목적]: ${intent === 'beginner' ? '입문/교양 (기초, 첫걸음)' : '실무/실습 (실전, 심화)'}

반드시 다음 JSON 단일 객체 형식으로만 응답하세요:
{
  "correctedQuery": string (오탈자가 있으면 바르게 교정한 단어, 없으면 원본 단어),
  "isTypo": boolean (오탈자가 있었는지 여부),
  "searchKeywords": string[] (대학 도서관 OPAC에서 소장 도서를 검색할 최적의 핵심 단어 2~4개. 작가 이름인 경우 대표작 도서명 포함),
  "callNumberPrefixes": string[] (이 학문/실무 영역에 해당하는 대학 도서관 DDC/KDC 분류번호 1~2개. 예: 문학/한국소설 -> ["813"], 컴퓨터/코딩 -> ["005.1", "005.13"], 인공지능 -> ["006.3"], 글쓰기/작문 -> ["808"], 자기계발/생산성 -> ["325", "199"]),
  "explanation": string (오탈자가 교정되었거나, 연관 지식 영역으로 확장되었을 때 사용자에게 친절하게 보여줄 1문장의 안내 문구. 변화가 없으면 빈 문자열 "")
}
`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      }
    );

    if (res.ok) {
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        return {
          originalQuery: cleanQ,
          correctedQuery: parsed.correctedQuery || cleanQ,
          isTypo: Boolean(parsed.isTypo),
          searchKeywords:
            Array.isArray(parsed.searchKeywords) && parsed.searchKeywords.length > 0
              ? parsed.searchKeywords.slice(0, 3)
              : [parsed.correctedQuery || cleanQ],
          callNumberPrefixes:
            Array.isArray(parsed.callNumberPrefixes) && parsed.callNumberPrefixes.length > 0
              ? parsed.callNumberPrefixes.slice(0, 2)
              : defaultResult.callNumberPrefixes,
          explanation: parsed.explanation || defaultResult.explanation || '',
        };
      }
    }
  } catch (err) {
    console.warn('[AI Curator] Query expansion error:', err);
  }

  return defaultResult;
}

/**
 * Screen 50~100 candidate books down to 30 books:
 * - Up to 10 newest (2025~2026)
 * - Up to 20 popular (YES24 salesPoint / rating)
 */
export function screenCandidatePool(
  candidates: RawCandidateBook[],
  maxPool = 15
): RawCandidateBook[] {
  // Deduplicate candidates representing the same canonical work (e.g. multiple editions of Carnegie or 자청)
  const canonicalMap = new Map<string, RawCandidateBook>();
  for (const cand of candidates) {
    const key = getBookCanonicalKey(cand.cnu.title, cand.cnu.author);
    const existing = canonicalMap.get(key);
    if (!existing) {
      canonicalMap.set(key, cand);
    } else {
      // If new candidate has higher salesPoint, or is available while existing is checked out, keep the better one
      const candScore = (cand.aladin.salesPoint || 0) + (cand.cnu.isAvailable ? 5000 : 0);
      const existScore = (existing.aladin.salesPoint || 0) + (existing.cnu.isAvailable ? 5000 : 0);
      if (candScore > existScore) {
        canonicalMap.set(key, cand);
      }
    }
  }
  const deduplicatedCandidates = Array.from(canonicalMap.values());

  if (deduplicatedCandidates.length <= maxPool) {
    return deduplicatedCandidates;
  }

  // 1. Sort by recency to pick newest 5 (2025~2026)
  const sortedByYear = [...deduplicatedCandidates].sort((a, b) => {
    const yearA = parseInt(a.cnu.pubYear, 10) || 0;
    const yearB = parseInt(b.cnu.pubYear, 10) || 0;
    return yearB - yearA;
  });
  const newest = sortedByYear.slice(0, 5);
  const selectedControlNos = new Set<string>(newest.map((c) => c.cnu.controlNo));

  // 2. Sort remaining by salesPoint and rating to pick 10 popular
  const remaining = deduplicatedCandidates.filter((c) => !selectedControlNos.has(c.cnu.controlNo));
  remaining.sort((a, b) => {
    const scoreA = (a.aladin.salesPoint || 0) + (a.aladin.rating || 0) * 1000;
    const scoreB = (b.aladin.salesPoint || 0) + (b.aladin.rating || 0) * 1000;
    return scoreB - scoreA;
  });

  const popular = remaining.slice(0, maxPool - newest.length);
  return [...newest, ...popular];
}

/**
 * Enforce availability ratio in Top 5:
 * Guarantee at least 3 AVAILABLE books and at most 2 CHECKED_OUT books,
 * while strictly guaranteeing that all 5 books are distinct canonical works.
 */
export function enforceAvailabilityRatio(
  curatedItems: CuratedBookItem[],
  allCandidates: RawCandidateBook[]
): CuratedBookItem[] {
  // 1. Deduplicate curatedItems by canonical work key
  const deduplicatedItems: CuratedBookItem[] = [];
  const seenCanonicalKeys = new Set<string>();

  for (const item of curatedItems) {
    const key = getBookCanonicalKey(item.title, item.author);
    if (!seenCanonicalKeys.has(key)) {
      seenCanonicalKeys.add(key);
      deduplicatedItems.push(item);
    }
  }

  // 2. If deduplication reduced count below 5, fill from allCandidates with unique works
  if (deduplicatedItems.length < 5) {
    for (const cand of allCandidates) {
      const key = getBookCanonicalKey(cand.cnu.title, cand.cnu.author);
      if (!seenCanonicalKeys.has(key)) {
        seenCanonicalKeys.add(key);
        deduplicatedItems.push(
          formatCuratedItem(cand, deduplicatedItems.length + 1, {
            badge: cand.aladin.rankingBadge?.isBest ? cand.aladin.rankingBadge.rankingText : '⭐ 추천 도서',
            recommendReason: `${cand.cnu.author} 저자의 대표작으로, 탄탄한 완성도와 실용성을 겸비한 전남대 소장 도서입니다.`,
            targetChapter: '제1장 핵심 기초와 적용 전략',
            solvedProblems: [
              '전공 및 교양 수업에서 핵심 개념 이해와 학업 과제 해결',
              '체계적인 학습 가이드를 통해 실전 응용 역량 습득',
            ],
          })
        );
        if (deduplicatedItems.length >= 5) break;
      }
    }
  }

  if (deduplicatedItems.length <= 3) return deduplicatedItems;

  const availableItems = deduplicatedItems.filter((item) => item.status === 'AVAILABLE');
  const checkedOutItems = deduplicatedItems.filter((item) => item.status !== 'AVAILABLE');

  // If checked out items <= 2, requirement is strictly satisfied!
  if (checkedOutItems.length <= 2) {
    return deduplicatedItems.slice(0, 5).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  // Keep top 2 checked-out items, replace 3rd+ with available candidates (checking canonical keys)
  const keptCheckedOut = checkedOutItems.slice(0, 2);
  const activeKeys = new Set<string>([
    ...availableItems.map((i) => getBookCanonicalKey(i.title, i.author)),
    ...keptCheckedOut.map((i) => getBookCanonicalKey(i.title, i.author)),
  ]);

  const replacementCandidates = allCandidates.filter(
    (c) => c.cnu.isAvailable && !activeKeys.has(getBookCanonicalKey(c.cnu.title, c.cnu.author))
  );

  const neededAvailable = 5 - (availableItems.length + keptCheckedOut.length);
  const replacementItems: CuratedBookItem[] = [];

  for (const cand of replacementCandidates) {
    const key = getBookCanonicalKey(cand.cnu.title, cand.cnu.author);
    if (!activeKeys.has(key)) {
      activeKeys.add(key);
      replacementItems.push(
        formatCuratedItem(cand, 0, {
          badge: '✅ 즉시 대출가능 추천',
          recommendReason: `도서관에 즉시 대출 가능한 상태로 소장되어 있어 당장 학습 및 과제에 활용할 수 있는 서가 추천 도서입니다.`,
          targetChapter: '제1장 핵심 기초와 적용 전략',
          solvedProblems: [
            '당장 도서관에서 대출하여 학업 과제에 즉시 참고',
            '핵심 챕터를 열람하여 개념 이해 및 문제 해결',
          ],
        })
      );
      if (replacementItems.length >= neededAvailable) break;
    }
  }

  const merged = [...availableItems, ...keptCheckedOut, ...replacementItems].slice(0, 5);

  return merged.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}

/**
 * Curate Top 5 books based on Table of Contents and user intent
 */
export async function curateTop5Books(
  query: string,
  intent: 'beginner' | 'practical',
  candidates: RawCandidateBook[]
): Promise<CuratedBookItem[]> {
  // Strict Ground Truth Gate: If no candidate books were found in CNU library, never fabricate books.
  if (!candidates || candidates.length === 0) {
    return [];
  }

  // 1. If Gemini API key is present, run real LLM Curation on the real library holdings
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    try {
      const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
      const prompt = buildCurationPrompt(query, intent, candidates);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const rawResponseText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawResponseText) {
          const parsedAi = JSON.parse(rawResponseText);
          if (Array.isArray(parsedAi) && parsedAi.length > 0) {
            const rawItems = mapAiResultsToCuratedItems(parsedAi, candidates);
            return enforceAvailabilityRatio(rawItems, candidates);
          }
        }
      }
    } catch (err) {
      console.warn('[AI Curator] Gemini API failed, falling back to heuristic curation:', err);
    }
  }

  // 2. Deterministic heuristic ranking on the ACTUAL candidates (no fabrication)
  return enforceAvailabilityRatio(fallbackHeuristicCuration(query, intent, candidates), candidates);
}

function buildCurationPrompt(
  query: string,
  intent: 'beginner' | 'practical',
  candidates: RawCandidateBook[]
): string {
  const intentDescription =
    intent === 'beginner'
      ? '🌱 입문/교양 (비전공자도 이해하기 쉬운 개념 설명, 기초 원리, 친근한 비유, 가독성 높은 구성)'
      : '⚡ 실습/실무 (현업 및 과제에 즉시 적용 가능한 구체적 예제, 행동 프레임워크, 최신 트렌드, 심화 테크닉)';

  const booksSummary = candidates.map((c, idx) => ({
    index: idx,
    title: c.cnu.title,
    author: c.cnu.author,
    publisher: c.cnu.publisher,
    pubYear: c.cnu.pubYear,
    rating: c.aladin.rating,
    salesPoint: c.aladin.salesPoint,
    toc: c.aladin.toc.substring(0, 450),
  }));

  return `
당신은 전남대학교 도서관의 수석 AI 큐레이터 'VibeLib'입니다.
도서관의 단순 키워드 검색 결과에서 제목만 비슷한 책들을 솎아내고, [상세 목차(TOC)], [출판연도], [출판사], [저자 전문성]을 분석하여 사용자 학습 목적에 가장 완벽히 부합하는 최상위 5권을 선별하고 순위를 매겨주세요.

[사용자 검색어]: "${query}"
[사용자 학습 목적]: ${intentDescription}

[★ 신뢰도 및 타깃 독자 심사 기준 (Evaluation Rubric)]:
1. 베스트셀러 및 대중적 검증도 최우선: YES24 salesPoint(판매지수)가 높거나 대중과 학계에서 오랫동안 검증된 베스트셀러/스테디셀러를 최우선 순위로 배치하세요. 단순 2026년 출간이라는 이유만으로 독자 평가가 전무한 책을 1위로 두지 마세요.
2. 작가/인물 검색 시 동음이의어 100% 배제: 사용자가 소설가나 인물(예: "한강")을 검색한 경우, 단순 서명에 단어가 포함된 무관한 책(예: "제2의 한강의 기적", AI/로봇 서적)은 무조건 탈락시키고, 해당 작가가 직접 집필한 대표 명저(예: "소년이 온다", "작별하지 않는다", "채식주의자")를 최상위 1~3위에 배치하세요.
3. 목차의 커리큘럼 완결성: 목차가 [기초 원리 -> 구체적 실습/행동 -> 한계 극복/응용] 단계로 논리적으로 잘 짜여 있는가?
4. 최신 트렌드 및 검증도: 기술/IT 분야의 경우 최신 기술 스펙이나 실무 트렌드 키워드가 목차 소제목에 실제로 포함되어 있는가?
5. 목적과의 100% 매칭: 입문자에게는 진입장벽을 낮춰주는 책인가, 실무자에게는 군더더기 없는 실전 테크닉을 주는가?
6. 타깃 독자 투명성: 이 책이 정말 필요한 사람(타깃 페르소나)과 읽지 말아야 할 사람(비추천 대상)을 솔직하게 구분하여 학우들의 신뢰를 확보할 것.
7. 과제 해결력: 대학 학우들이 학업 과제, 팀 프로젝트, 혹은 취업 준비에서 당면한 구체적인 문제를 실제로 해결할 수 있는가?

[후보 도서 목록]:
${JSON.stringify(booksSummary, null, 2)}

반드시 다음 JSON 배열 형식으로만 응답하세요:
[
  {
    "index": number (선택한 후보 도서의 index),
    "rank": number (1~5),
    "badge": string (도서의 공인 특성. 예: "🌱 입문 최우수", "⚡ 실무 필독 1위", "⭐ 독자평점 9.8", "💡 2025 최신작". 가상의 'YES24 분야 베스트'나 'MIT 명강의' 같은 허위 수식어는 절대 금지),
    "recommendReason": string (목차 내용과 구성을 바탕으로 왜 이 책이 사용자 목적에 최적인지 2~3문장으로 설득력 있는 추천 사유),
    "targetChapter": string (목차 중 학생이 가장 먼저 30분 만에 읽어야 할 핵심 챕터명),
    "targetAudience": string (이 책이 꼭 필요한 학생 페르소나. 예: "비전공자이지만 IT/소프트웨어 전체 구조를 한 번에 잡고 싶은 1~2학년 학우"),
    "cautionAudience": string (이 책을 피해야 할 학생. 예: "이미 깊이 있는 실무 아키텍처나 코딩 실습을 원하는 분에게는 너무 기초적임"),
    "difficulty": string (체감 난이도. 예: "입문 초급 (사전 지식 불필요)", "실전 중급 (기초 지식 권장)"),
    "solvedProblems": string[] (이 책을 통해 대학 학우가 구체적으로 해결할 수 있는 학업/과제/실무 고민 2~3개. 예: ["비전공자 교양 코딩 과제에서 조건문/반복문 구현", "기초 데이터 구조 이해로 알고리즘 과제 제출"])
  }
]
`;
}

function mapAiResultsToCuratedItems(
  aiResults: any[],
  candidates: RawCandidateBook[]
): CuratedBookItem[] {
  const results: CuratedBookItem[] = [];
  const seenCanonicalKeys = new Set<string>();

  for (let i = 0; i < aiResults.length; i++) {
    const aiItem = aiResults[i];
    const candidate = candidates[aiItem.index] || candidates[i];
    if (!candidate) continue;

    const key = getBookCanonicalKey(candidate.cnu.title, candidate.cnu.author);
    if (seenCanonicalKeys.has(key)) continue;
    seenCanonicalKeys.add(key);

    results.push(formatCuratedItem(candidate, results.length + 1, {
      recommendReason: aiItem.recommendReason,
      targetChapter: aiItem.targetChapter,
      badge: aiItem.badge,
      targetAudience: aiItem.targetAudience,
      cautionAudience: aiItem.cautionAudience,
      difficulty: aiItem.difficulty,
      solvedProblems: Array.isArray(aiItem.solvedProblems) ? aiItem.solvedProblems : undefined,
    }));

    if (results.length >= 5) break;
  }

  return results;
}

/**
 * Intelligent deterministic heuristic curation fallback for arbitrary queries
 */
function fallbackHeuristicCuration(
  query: string,
  intent: 'beginner' | 'practical',
  candidates: RawCandidateBook[]
): CuratedBookItem[] {
  // Sort candidates by relevance and bestseller proof
  const scored = candidates.map((item) => {
    let score = (item.aladin.rating || 9.0) * 10;

    // YES24 SalesPoint weighting (Bestsellers & Steadysellers get massive boost)
    const salesPoint = item.aladin.salesPoint || 0;
    if (salesPoint >= 50000) score += 60; // Mega bestseller (e.g. 한강 소설)
    else if (salesPoint >= 20000) score += 40;
    else if (salesPoint >= 10000) score += 20;

    // Official Bestseller Ranking Badge bonus
    if (item.aladin.rankingBadge?.isBest) {
      score += 40;
    }

    // Author & Literature Disambiguation: Strongly prioritize books by the requested author
    const isLiteratureOrAuthor = /한강|김영하|유발|소설|문학|시|에세이|작가/i.test(query);
    const cleanQ = query.trim().toLowerCase();
    const itemAuthor = (item.cnu.author || '').toLowerCase();
    const itemTitle = (item.cnu.title || '').toLowerCase();

    if (isLiteratureOrAuthor) {
      if (itemAuthor.includes(cleanQ)) {
        score += 90; // Definite authorship match (e.g. 한강 저자)!
      } else if (itemTitle.includes(cleanQ) && !itemAuthor.includes(cleanQ)) {
        score -= 60; // Homonym penalty: Title mentions "한강" but written by someone else!
      }
    }

    // Balanced recency score (capped at 5, NOT unbounded 18 points)
    const year = parseInt(item.cnu.pubYear, 10) || 2020;
    if (year >= 2024) score += 5;

    const toc = (item.aladin.toc || '').toLowerCase();
    const title = (item.cnu.title || '').toLowerCase();

    if (intent === 'beginner') {
      if (toc.includes('기초') || toc.includes('입문') || toc.includes('시작') || title.includes('혼자') || title.includes('쉬운') || title.includes('이해')) {
        score += 25;
      }
    } else {
      if (toc.includes('실전') || toc.includes('고급') || toc.includes('아키텍처') || toc.includes('배포') || title.includes('실무') || title.includes('마스터')) {
        score += 25;
      }
    }

    if (item.cnu.isAvailable) {
      score += 15;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const distinctScored: { item: RawCandidateBook; score: number }[] = [];
  const seenCanonicalKeys = new Set<string>();
  const seenAuthors = new Set<string>();
  const isAuthorSpecificSearch = /한강|김영하|유발|소설|문학|시|에세이|작가/i.test(query);

  // Pass 1: Distinct works with diverse authors
  for (const entry of scored) {
    const key = getBookCanonicalKey(entry.item.cnu.title, entry.item.cnu.author);
    const authorKey = getAuthorCanonicalKey(entry.item.cnu.author, entry.item.cnu.title);

    if (seenCanonicalKeys.has(key)) continue;
    if (!isAuthorSpecificSearch && seenAuthors.has(authorKey)) continue;

    seenCanonicalKeys.add(key);
    seenAuthors.add(authorKey);
    distinctScored.push(entry);
    if (distinctScored.length >= 5) break;
  }

  // Pass 2: Fill remaining up to 5 with distinct canonical works if author cap was too strict
  if (distinctScored.length < 5) {
    for (const entry of scored) {
      const key = getBookCanonicalKey(entry.item.cnu.title, entry.item.cnu.author);
      if (!seenCanonicalKeys.has(key)) {
        seenCanonicalKeys.add(key);
        distinctScored.push(entry);
        if (distinctScored.length >= 5) break;
      }
    }
  }

  return distinctScored.map((entry, idx) => {
    const { item } = entry;
    const rank = idx + 1;

    let badge = '🏆 추천 도서';
    if (item.aladin.rankingBadge?.isBest) badge = item.aladin.rankingBadge.rankingText;
    else if (rank === 1) badge = intent === 'beginner' ? '🌱 입문 최우수' : '⚡ 실전 필독 1위';
    else if (item.aladin.rating >= 9.5) badge = `⭐ 평점 ${item.aladin.rating}점`;
    else if (item.cnu.isAvailable) badge = '✅ 즉시 대출가능';
    else badge = '📚 핵심 필독서';

    const lines = (item.aladin.toc || '').split('\n').filter(Boolean);
    const targetChapter = lines[Math.min(2, lines.length - 1)] || '제1장 핵심 기초와 적용 전략';

    let recommendReason = '';
    const isLiteratureOrAuthor = /한강|소설|문학|시|에세이|작가/i.test(query);
    if (isLiteratureOrAuthor) {
      recommendReason = `독자들의 깊은 공감과 찬사를 받은 검증된 작품으로, 섬세한 문장과 밀도 있는 서사를 통해 '${query}' 관련 추천 도서 중 가장 완성도 높은 독서 경험을 선사합니다. [${targetChapter}] 파트부터 읽어보시기를 추천합니다.`;
    } else if (intent === 'beginner') {
      recommendReason = `어려운 학술 전문 용어 대신 친숙한 비유와 직관적인 구성으로 개념을 풀어내어 '${query}' 주제를 처음 접하는 전남대 학우에게 최상의 출발점을 제공합니다. [${targetChapter}]를 먼저 읽으시면 흐름이 한눈에 잡힙니다.`;
    } else {
      recommendReason = `현업과 일상에서 맞닥뜨리는 실전 문제 해결 패턴과 테크닉을 상세 목차 전반에 걸쳐 밀도 있게 다룹니다. 특히 [${targetChapter}] 파트는 즉시 과제나 개인 프로젝트에 이식할 수 있어 강력 추천합니다.`;
    }

    const solvedProblems = intent === 'beginner'
      ? [
          `전공/교양 수업에서 '${query}' 기초 개념 이해 및 입문 과제 수행`,
          '기초 용어와 핵심 프로세스를 파악하여 전공 학습의 진입 장벽 극복',
        ]
      : [
          `실무 프로젝트 및 캡스톤 디자인에서 '${query}' 실전 에러 디버깅`,
          '현업 아키텍처와 최적화 베스트 프랙티스를 학업 과제에 직접 적용',
        ];

    return formatCuratedItem(item, rank, {
      recommendReason,
      targetChapter,
      badge,
      solvedProblems,
    });
  });
}

function formatCuratedItem(
  candidate: RawCandidateBook,
  rank: number,
  ai: {
    recommendReason: string;
    targetChapter: string;
    badge: string;
    targetAudience?: string;
    cautionAudience?: string;
    difficulty?: string;
    solvedProblems?: string[];
  }
): CuratedBookItem {
  const cnu = candidate.cnu;
  const aladin = candidate.aladin;
  const cleanIsbn = aladin.isbn || cnu.isbn || '9791100000000';
  const rankingBadge = (aladin as BookstoreMetadata).rankingBadge;
  const reviews = (aladin as BookstoreMetadata).reviews;

  return {
    rank,
    id: cnu.controlNo,
    isbn: cleanIsbn,
    title: cnu.title,
    author: cnu.author,
    publisher: cnu.publisher,
    pubYear: cnu.pubYear,
    coverUrl: aladin.coverUrl || cnu.coverUrl,
    rating: aladin.rating,
    salesPoint: aladin.salesPoint,
    rankingBadge,
    reviews,
    callNumber: cnu.callNumber || '005.1 C623',
    location: cnu.location || '중앙도서관[본관] 1자료실',
    status: cnu.isAvailable ? 'AVAILABLE' : 'CHECKED_OUT',
    returnDueDate: cnu.statusText.includes('반납예정') ? cnu.statusText : undefined,
    toc: aladin.toc,
    aiCuration: ai,
    links: {
      cnuDetailUrl: cnu.cnuDetailUrl,
      cnuPurchaseRequestUrl: `https://lib.jnu.ac.kr/service/purchase/request?title=${encodeURIComponent(cnu.title)}`,
      affiliateShopUrl: `https://www.yes24.com/Product/Search?domain=ALL&query=${encodeURIComponent(cleanIsbn || cnu.title)}`,
    },
  };
}
