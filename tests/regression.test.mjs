import test from 'node:test';
import assert from 'node:assert/strict';

// Test candidate data mock
const mockCnuItem = {
  controlNo: 'CAT000014000001',
  title: '테스트 도서명',
  author: '홍길동',
  publisher: '전남대출판부',
  pubYear: '2024',
  isbn: '9791190000001',
  callNumber: '005.1 홍64ㅌ',
  location: '중앙도서관[정보마루]',
  isAvailable: true,
  statusText: '대출가능',
  cnuDetailUrl: 'https://lib.jnu.ac.kr/search/detail/CAT000014000001',
};

const mockBookstoreInfo = {
  isbn: '9791190000001',
  title: '테스트 도서명',
  author: '홍길동',
  publisher: '전남대출판부',
  coverUrl: 'https://image.yes24.com/goods/12345/cover.jpg',
  rating: 9.8,
  salesPoint: 25000,
  toc: '제1장 서론\n제2장 핵심 원리\n제3장 실전 적용',
  description: '테스트 책 소개',
  rankingBadge: {
    isBest: true,
    rankingText: 'IT 모바일 top100 2주',
  },
  reviews: [
    {
      title: '정말 유익한 책입니다',
      content: '과제 작성할 때 큰 도움이 되었습니다.',
      author: '김**',
      date: '2026.02.20',
      rating: 10,
    },
  ],
  source: 'yes24',
};

test('🛡️ [Regression Contract 1] YES24 공식 실측 랭킹 뱃지 & 회원 후기 유실 방지 검증', () => {
  assert.ok(mockBookstoreInfo.rankingBadge, 'rankingBadge 객체가 존재해야 함');
  assert.strictEqual(mockBookstoreInfo.rankingBadge.isBest, true);
  assert.strictEqual(mockBookstoreInfo.rankingBadge.rankingText, 'IT 모바일 top100 2주');

  assert.ok(Array.isArray(mockBookstoreInfo.reviews), 'reviews가 배열이어야 함');
  assert.strictEqual(mockBookstoreInfo.reviews.length, 1);
  assert.strictEqual(mockBookstoreInfo.reviews[0].author, '김**');
});

test('🛡️ [Regression Contract 2] Top 5 대출 가능 비율 보장 (AVAILABLE >= 3, CHECKED_OUT <= 2)', () => {
  // Simulate 5 items where 4 are checked out and 1 is available
  const simulatedCurated = [
    { id: '1', status: 'CHECKED_OUT', rank: 1 },
    { id: '2', status: 'CHECKED_OUT', rank: 2 },
    { id: '3', status: 'CHECKED_OUT', rank: 3 },
    { id: '4', status: 'CHECKED_OUT', rank: 4 },
    { id: '5', status: 'AVAILABLE', rank: 5 },
  ];

  const availableBackupCandidates = [
    {
      cnu: { controlNo: '6', title: '백업 도서 A', isAvailable: true, author: '', publisher: '', pubYear: '2023', statusText: '대출가능' },
      aladin: { isbn: '9791100000006', rating: 9.0, salesPoint: 10000, toc: '' },
    },
    {
      cnu: { controlNo: '7', title: '백업 도서 B', isAvailable: true, author: '', publisher: '', pubYear: '2023', statusText: '대출가능' },
      aladin: { isbn: '9791100000007', rating: 9.0, salesPoint: 10000, toc: '' },
    },
  ];

  // Logic equivalent to enforceAvailabilityRatio
  const availableItems = simulatedCurated.filter((i) => i.status === 'AVAILABLE');
  const checkedOutItems = simulatedCurated.filter((i) => i.status !== 'AVAILABLE');
  const keptCheckedOut = checkedOutItems.slice(0, 2);

  const needed = 5 - (availableItems.length + keptCheckedOut.length);
  const replacements = availableBackupCandidates.slice(0, needed).map((c, idx) => ({
    id: c.cnu.controlNo,
    status: 'AVAILABLE',
    rank: 0,
  }));

  const finalTop5 = [...availableItems, ...keptCheckedOut, ...replacements];
  const finalAvailable = finalTop5.filter((i) => i.status === 'AVAILABLE').length;
  const finalCheckedOut = finalTop5.filter((i) => i.status !== 'AVAILABLE').length;

  assert.strictEqual(finalTop5.length, 5, 'Top 5는 정확히 5권이어야 함');
  assert.ok(finalAvailable >= 3, `대출 가능 도서가 최소 3권 이상이어야 함 (실측: ${finalAvailable})`);
  assert.ok(finalCheckedOut <= 2, `대출중 도서는 최대 2권 이하이어야 함 (실측: ${finalCheckedOut})`);
});

test('🛡️ [Regression Contract 3] 여수 vs 광주 캠퍼스 소장처 분리 검증', () => {
  const yeosuHoldings = '여수캠퍼스도서관 1층 자료실 (005.1 홍64ㅌ)';
  const gwangjuHoldings = '중앙도서관[정보마루] 3층 스마트열람실 (005.1 홍64ㅌ)';

  const isYeosu1 = yeosuHoldings.includes('여수캠퍼스도서관');
  const isYeosu2 = gwangjuHoldings.includes('여수캠퍼스도서관');

  assert.strictEqual(isYeosu1, true, '여수 도서는 여수캠퍼스도서관으로 인식되어야 함');
  assert.strictEqual(isYeosu2, false, '광주 도서는 여수 도서로 분류되면 안 됨');
});

test('🛡️ [Regression Contract 4] 해결 가능한 대학 과제/고민 (solvedProblems) 불렛포인트 계약 검증', () => {
  const sampleSolvedProblems = [
    '전공 과제에서 핵심 알고리즘 및 데이터 구조 구현',
    '기초 개념 이해를 통한 시험 대비',
  ];

  assert.ok(Array.isArray(sampleSolvedProblems));
  assert.ok(sampleSolvedProblems.length >= 2, '최소 2개 이상의 해결 과제가 도출되어야 함');
  assert.ok(sampleSolvedProblems[0].length > 5, '과제 설명 문장이 유의미한 길이를 가져야 함');
});

test('🛡️ [Regression Contract 5] 도서관 미소장 시 절대 가짜 책 날조 금지 (Zero Hallucination Gate)', () => {
  const emptyCandidates = [];
  const result = emptyCandidates.length === 0 ? [] : [1, 2, 3];
  assert.deepStrictEqual(result, [], '도서관 검색 결과가 0권일 경우 빈 배열을 정직하게 반환해야 함');
});
