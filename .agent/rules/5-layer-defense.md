# 🛡️ 5-Layer Defense Rules (기능 소실 및 회귀 방지 절대 규칙)

이 저장소에서는 AI가 임의로 코드를 수정하면서 기존 정상 작동 기능을 훼손하거나 삭제하는 행위를 원천 차단하기 위해 다음 **5대 방어 시스템**을 필수로 준수해야 합니다.

## 1. Layer 1: Git 마이크로 커밋 (Rollback Safety Net)
- 작업 전후 반드시 `git status`로 변경 범위를 확인한다.
- 기존 코드를 파괴하지 않고 안전하게 복구할 수 있도록 작업 단위마다 커밋(`npm run snapshot`)을 생성한다.
- 예기치 않은 기능 소실 발생 시 즉시 `npm run rollback`(`git reset --hard HEAD`)으로 롤백한다.

## 2. Layer 2: 외부 API 동시성 제어 (Rate Limit & Silent Breakage 방지)
- YES24 및 CNU 도서관 등 외부 API 호출 시 대량 병렬 호출로 인한 429(Too Many Requests) 차단을 방지하기 위해 반드시 배치 큐(`batchProcess`, 동시 3개 이하)를 유지한다.
- 외부 API 실패 시 `rankingBadge`, `reviews` 등 신뢰도 객체가 조용히 유실(Silent Fallback)되지 않도록 명시적 기본 구조를 보존한다.

## 3. Layer 3: 정적 무결성 검사 (Integrity Checker)
- 코드를 수정한 후 반드시 `npm run integrity` (`node scripts/check-integrity.mjs`)를 실행하여 20대 핵심 앵커가 누락되지 않았는지 확인한다:
  - `rankingBadge` (YES24 공식 랭킹 뱃지)
  - `object-contain` (100% 무손실 원본 표지)
  - `HelpCircle` / 판매지수 산정 근거 툴팁
  - `solvedProblems` (목차 기반 해결 과제)
  - `회원들이 실제 쓴 후기` 아코디언 및 솔직한 빈 상태
  - `enforceAvailabilityRatio` (대출 가능 비율 3:2 보장)
  - `CampusType` 및 여수/광주 소장처 분리

## 4. Layer 4: 자동화 회귀 테스트 (Automated Regression Test)
- `npm run test:regression` (`node --test tests/regression.test.mjs`)를 실행하여 5대 핵심 비즈니스 계약이 100% 통과하는지 기계적으로 검증한다.

## 5. Layer 5: 원클릭 통합 검증 게이트 (Verification Gate)
- 작업 완료를 사용자에게 보고하기 전, 반드시 다음 명령어를 실행하여 3단계 모두 무결점 통과(0 FAIL) 증거를 확보해야 한다:
  ```bash
  npm run verify
  ```
- **"NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE"**: 검증 로그 증거 없이 작업을 완료했다고 주장하지 않는다.
