/**
 * scripts/prewarm-cache.mjs
 * 
 * VibeLib Nightly Pre-warmer Script
 * Runs via GitHub Actions every morning at 04:00 KST (19:00 UTC)
 * or manually via `node scripts/prewarm-cache.mjs`
 * 
 * Pre-computes Top 5 curations for the 30 most searched academic/general subjects
 * and stores them in Supabase `books_cache` so day-time student searches take <50ms!
 */

const BASE_URL = process.env.VIBELIB_BASE_URL || 'http://localhost:3000';

// 30 Most Frequent University Keywords across Majors & Interests
const TARGET_KEYWORDS = [
  // 1. 문학 및 예술
  { q: '한강', intent: 'beginner' },
  { q: '한국소설', intent: 'beginner' },
  { q: '세계문학', intent: 'beginner' },
  
  // 2. 상경대학 & 경제
  { q: '경영학', intent: 'beginner' },
  { q: '마케팅', intent: 'practical' },
  { q: '회계원리', intent: 'beginner' },
  { q: '경제학', intent: 'beginner' },
  { q: '재무관리', intent: 'practical' },
  
  // 3. 공학 & IT / AI
  { q: '파이썬', intent: 'beginner' },
  { q: '자료구조', intent: 'practical' },
  { q: '인공지능', intent: 'beginner' },
  { q: '바이브코딩', intent: 'practical' },
  { q: '데이터분석', intent: 'practical' },
  { q: '클라우드', intent: 'practical' },
  { q: 'SQL', intent: 'practical' },
  
  // 4. 인문 & 사회과학
  { q: '글쓰기', intent: 'beginner' },
  { q: '논리적글쓰기', intent: 'practical' },
  { q: '심리학', intent: 'beginner' },
  { q: '행동경제학', intent: 'beginner' },
  { q: '말하기', intent: 'practical' },
  
  // 5. 어학 & 취업 / 수험
  { q: '토익', intent: 'practical' },
  { q: '오픽', intent: 'practical' },
  
  // 6. 법학 & 의약학 / 보건
  { q: '헌법', intent: 'beginner' },
  { q: '민법', intent: 'beginner' },
  { q: '생리학', intent: 'beginner' },
  { q: '간호학', intent: 'beginner' },
  { q: '약리학', intent: 'beginner' },
  
  // 7. 생산성 & 자기계발
  { q: '시간관리', intent: 'practical' },
  { q: '몰입', intent: 'practical' },
  { q: '역행자', intent: 'beginner' },
];

const CAMPUSES = ['gwangju', 'yeosu'];

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPrewarm() {
  console.log('🚀 [VibeLib Pre-warmer] Starting cache pre-warming process...');
  console.log(`📡 Target Base URL: ${BASE_URL}`);
  console.log(`📚 Total Keywords: ${TARGET_KEYWORDS.length} queries across ${CAMPUSES.length} campuses`);

  let successCount = 0;
  let failCount = 0;

  for (const item of TARGET_KEYWORDS) {
    for (const campus of CAMPUSES) {
      const url = `${BASE_URL}/api/curate?q=${encodeURIComponent(item.q)}&intent=${item.intent}&campus=${campus}`;
      console.log(`\n⏳ Fetching: "${item.q}" (${item.intent}, ${campus})...`);

      try {
        const startTime = Date.now();
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'VibeLib-Nightly-Prewarmer/1.0',
          },
          signal: AbortSignal.timeout(45000), // 45s safety timeout
        });

        const duration = Date.now() - startTime;

        if (res.ok) {
          const json = await res.json();
          const bookCount = json.books?.length || 0;
          const cached = json.searchMeta?.cached ? '(from-cache)' : '(freshly-computed)';
          console.log(`  ✅ [SUCCESS] ${bookCount} books curated in ${duration}ms ${cached}`);
          successCount++;
        } else {
          console.error(`  ❌ [FAIL] HTTP ${res.status}: ${res.statusText}`);
          failCount++;
        }
      } catch (err) {
        console.error(`  ❌ [ERROR] Request failed:`, err.message);
        failCount++;
      }

      // Polite 500ms delay between requests to protect CNU / Yes24 servers
      await delay(500);
    }
  }

  console.log('\n==================================================');
  console.log(`🎉 [Pre-warming Finished] Success: ${successCount}, Failed: ${failCount}`);
  console.log('==================================================');
}

runPrewarm().catch((err) => {
  console.error('Fatal pre-warming error:', err);
  process.exit(1);
});
