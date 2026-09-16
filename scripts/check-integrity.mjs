import fs from 'fs';
import path from 'path';

console.log('🔍 [Layer 3: Integrity Checker] Running static integrity check on critical project anchors...');

const ROOT = process.cwd();

const CRITICAL_CHECKS = [
  {
    filePath: 'src/components/book-card.tsx',
    label: 'BookCard Component (UI & Trust Anchors)',
    anchors: [
      { name: 'YES24 Official Ranking Badge', pattern: /rankingBadge/ },
      { name: '100% Uncropped Cover (object-contain)', pattern: /object-contain/ },
      { name: 'Sales Point Tooltip & HelpCircle', pattern: /HelpCircle/ },
      { name: 'Solved Academic Problems Section', pattern: /solvedProblems/ },
      { name: 'Real Reviews Accordion', pattern: /회원들이\s*실제\s*쓴\s*후기/ },
      { name: 'Honest No-Review Empty State', pattern: /구매자\s*후기\s*없음/ },
    ],
  },
  {
    filePath: 'src/lib/ai-curator.ts',
    label: 'AI Curator Module (Business Logic & Guarantees)',
    anchors: [
      { name: 'Availability Ratio Enforcer (>=3 Available, <=2 CheckedOut)', pattern: /function\s+enforceAvailabilityRatio/ },
      { name: 'Candidate Pool Screener', pattern: /function\s+screenCandidatePool/ },
      { name: 'Call Number Classification Prediction', pattern: /callNumberPrefixes/ },
      { name: 'Prohibition of Fake Badges in AI Prompt', pattern: /가상의\s*'YES24\s*분야\s*베스트'/ },
      { name: 'Solved Academic Problems Derivation', pattern: /solvedProblems/ },
    ],
  },
  {
    filePath: 'src/lib/yes24.ts',
    label: 'YES24 Official API Module',
    anchors: [
      { name: 'Official Ranking Fetcher', pattern: /fetchYes24Ranking/ },
      { name: 'Community Reviews Fetcher', pattern: /fetchYes24Reviews/ },
      { name: 'BestSellerRank_Book API Module', pattern: /BestSellerRank_Book/ },
      { name: 'GoodsReviewList API Module', pattern: /GoodsReviewList/ },
    ],
  },
  {
    filePath: 'src/lib/cnu-library.ts',
    label: 'CNU Library Module (Campus & Shelf Harvesting)',
    anchors: [
      { name: 'Call Number Shelf Harvesting', pattern: /searchCnuLibraryByCallNo/ },
      { name: 'Campus Scope Type Definition', pattern: /CampusType/ },
      { name: 'Yeosu Campus Distinction', pattern: /여수캠퍼스도서관/ },
    ],
  },
  {
    filePath: 'src/app/api/curate/route.ts',
    label: 'Curate Route Handler (Pipeline Orchestration)',
    anchors: [
      { name: 'Campus Query Parameter', pattern: /campus/ },
      { name: 'Availability Ratio Enforcement Call', pattern: /enforceAvailabilityRatio/ },
    ],
  },
];

let totalChecks = 0;
let failedChecks = 0;

for (const check of CRITICAL_CHECKS) {
  const fullPath = path.join(ROOT, check.filePath);
  console.log(`\n📄 Checking: ${check.label} (${check.filePath})`);

  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ CRITICAL ERROR: File not found! -> ${check.filePath}`);
    failedChecks += check.anchors.length;
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  for (const anchor of check.anchors) {
    totalChecks++;
    if (anchor.pattern.test(content)) {
      console.log(`  ✅ [PASS] ${anchor.name}`);
    } else {
      console.error(`  ❌ [FAIL] Missing required anchor: "${anchor.name}"!`);
      failedChecks++;
    }
  }
}

console.log('\n--------------------------------------------------');
if (failedChecks === 0) {
  console.log(`🎉 [Integrity Check Passed] All ${totalChecks} critical anchors are intact! No regression detected.`);
  process.exit(0);
} else {
  console.error(`🚨 [Integrity Check FAILED] ${failedChecks} out of ${totalChecks} anchors were missing or deleted!`);
  console.error('Do NOT commit or deploy until all anchors are restored!');
  process.exit(1);
}
