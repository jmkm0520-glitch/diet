# Diet Record 개선 작업리스트 (subject.md 기준)

작성일: 2026-08-20
기준 문서: [portfolio subject.md](<./portfolio subject.md>)

> 모든 항목에 번호를 붙였습니다. `[x]`는 현재 코드 기준으로 이미 되어 있다고 확인된 항목, `[ ]`는 이번 개선 프로젝트에서 해야 할 항목입니다.
> 기존 `TASK_CHECKLIST.md`는 "로그인 없는 1인 데모" 기준으로 작성된 문서라 subject.md(회원가입/로그인/사용자 분리 포함)와 전제가 다릅니다. 이 문서가 subject.md 기준의 최신 작업리스트입니다.

## 현재 코드 상태 요약 (확인된 사실)

- 배포 URL: **https://www.food-broccoli.shop** — Vercel에 GitHub(`main`) 연동 완료, push할 때마다 자동 배포됨. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 환경변수 등록 완료.
- 회원가입/로그인/이메일 인증/세션 확인이 `AuthGate.tsx` + `api/authentication.py`로 이미 구현되어 있음 (멀티 유저 지원, `202608130003_enable_multi_member_signup.sql`)
- 식단 기록(아침/점심/저녁/간식, clean/free), 체중 기록, 캘린더(`/calendar`)가 이미 구현되어 있음
- clean/free 캐릭터 이미지(`clean.png`/`free.png`)와 저장 성공 메시지("○○ 식단이 저장되었습니다.")가 이미 있음
- **최근 7일 통계, 차트, 주간 식단 요약 기능은 아직 없음** → 이번 프로젝트의 핵심 신규 작업
- `TabNav`에는 "오늘 기록"/"캘린더" 탭만 있고 "통계" 탭은 없음

---

## 1. 기존 서비스 분석 (문서화)

- [x] 1. 서비스 목적 정리 (식단 기록 + 패턴 확인, 칼로리 계산/진단 아님) → `docs/portfolio service-review.md` 1장
- [x] 2. 타겟 사용자 정의 문장 작성 (subject.md 4.2 예시 기반) → `docs/portfolio service-review.md` 2장
- [x] 3. 주요 페이지 목록 정리 (`/`, `/calendar`, `/import`) → `docs/portfolio service-review.md` 3장
- [x] 4. 기존 기능 목록 정리 (회원가입/로그인/식단기록/체중기록/캘린더) → `docs/portfolio service-review.md` 4장
- [x] 5. 데이터 구조 정리 (`meals`, `weights`, `members` 테이블과 주요 컬럼) → `docs/portfolio service-review.md` 5장
- [x] 6. 사용 기술 정리 (Next.js App Router, TypeScript, Python Vercel Functions, Supabase) → `docs/portfolio service-review.md` 6장
- [x] 7. 배포 구조 정리 (Vercel + Supabase, `vercel.json` 기준) → `docs/portfolio service-review.md` 7장
- [x] 8. 위 1~7번을 "서비스 개선 문서"([`docs/portfolio service-review.md`](<./docs/portfolio service-review.md>))로 통합 작성

## 2. 사용자 흐름 점검

- [x] 9. Flow 1(로그인) 흐름 정리 → `portfolio.md` 6장 (로그인 필요 화면이라 자동 클릭 테스트 대신 코드·캡쳐 대조)
- [x] 10. Flow 2(식단 기록) 흐름 정리 → `portfolio.md` 6장
- [x] 11. Flow 3(기록 확인/캘린더) 흐름 정리 → `portfolio.md` 6장
- [x] 12. 세 Flow 삽입 — 본문은 `portfolio.md` 6장, 서비스 개선 문서 9장에서 연결

## 3. UX 문제 정의 & 우선순위

- [x] 13. UX 문제 **7건** 도출 → `portfolio.md` 7장
- [x] 14. HIGH 3 / MEDIUM 2 / LOW 2 로 태깅 (판단 기준 3축 명시)
- [x] 15. HIGH 3건(통계 부재 / 하루 판정이 미기록 무시 / 회원가입 문구)을 개선 대상으로 확정
- [x] 16. Before/After 3항목 선정 = 15번의 HIGH 3건 → `portfolio.md` 8장

## 4. UI/UX 개선 (핵심 기능 개선)

- [x] 17. 클린식/자유식 카드에 라벨 + 캐릭터 + 카드 스타일 3중 구분 적용됨 (`MealCard.tsx`, `clean.png`/`free.png`)
- [x] 18. `TabNav`에 "통계" 탭 추가 (오늘 기록 / 캘린더 / 통계). 활성 탭 판정도 경로 목록 기반으로 일반화
- [x] 19. 캘린더 상태 규칙 확인 — `api/calendar.py`의 `meal_status()`가 이미 이 규칙대로 동작함(코드 확인 완료). 다만 미기록 끼니를 판정에서 제외하는 점은 개선 대상 2번으로 별도 관리
- [x] 20. 캘린더 셀에 🥦/🍄 이모지 + 체중이 표시되는 것 확인 (`before-02-calendar.png`)
- [x] 21. 미로그인 시 "식단과 체중 기록을 보려면 로그인해 주세요." 안내 확인 (`before-04-login.png`). `/calendar`·`/import` 직접 접근 시에도 동일하게 차단됨

## 5. 식단 통계 (신규 기능 — 백엔드)

- [x] 22. `GET /api/stats` 설계·구현 (`api/stats.py`, `api/models/stats.py`) — 회원별·최근 N일(기본 7일, Asia/Seoul 기준 오늘 포함) 집계
- [x] 23. 총 기록 수 `total`
- [x] 24. 클린식 수 `clean`
- [x] 25. 자유식 수 `free`
- [x] 26. 클린식 비율 `cleanRatio` (정수 %, 0건이면 0). 기록률 파악용 `recordedDays`도 함께 반환 — UX 문제 2번 대응
- [x] 27. 예외 처리 — 기록 0건은 오류가 아닌 0으로 채운 정상 응답, `type`이 이상한 행은 건너뛰고 계속, DB/설정 실패만 500. 통계 실패가 다른 화면에 영향 없음
- [x] 28. `api/stats_test.py` **19개 테스트** (전체 105개 통과)

## 6. 식단 통계 (신규 기능 — 프론트엔드)

- [x] 29. `/stats` 라우트 생성 (`src/app/stats/page.tsx` + `src/components/StatsView.tsx`)
- [x] 30. 4개 카드 UI (총 기록 / 클린식 / 자유식 / 클린식 비율). 자유식 카드만 빨강 강조
- [x] 31. 로딩 상태 "통계를 불러오고 있습니다..." (`aria-busy` + `role="status"`)
- [x] 32. Empty State "아직 통계를 만들기 위한 기록이 부족합니다. / 식단을 조금 더 기록해보세요."
- [x] 33. `GET /api/stats` 연동 + 실패 시 "식단 기록을 불러오지 못했습니다." (`role="alert"`). 브라우저에서 재계산하는 폴백은 두지 않음 — 집계 규칙의 단일 출처를 서버로 유지

## 7. 식단 통계 시각화 (차트)

- [x] 34. 차트 방식 결정 — **라이브러리 없이 SVG/CSS로 직접 구현**. 그릴 것이 도넛 1개와 막대 7개뿐이라 Chart.js(200KB+)를 넣을 이유가 없고, 웜 팔레트에 정확히 맞출 수 있음. 번들 증가 0
- [x] 35. 도넛 차트 — 가운데 클린식 비율 %, 아래 범례. `role="img"` + 설명 라벨
- [x] 36. 날짜별 누적 막대 차트 — 기록 없는 날도 빈 칸으로 남겨 **기록률이 눈에 보이게** 함
- [x] 37. 모바일에서 두 차트를 세로 1열로 전환, 도넛·막대 크기 축소 (760px 이하 미디어 쿼리)

## 8. 주간 식단 요약

- [x] 38. `top_meal()` — 가장 많이 기록한 끼니. 동점이면 하루 순서(아침→간식)로 결정해 DB 반환 순서에 좌우되지 않게 함
- [x] 39. 직전 7일 창을 함께 조회해 `previous`와 `cleanRatioDelta` 반환 (보너스 1 동시 충족)
- [x] 40. `src/components/weeklySummary.ts` — subject.md 4.11 형식의 문장 템플릿. 테스트 9개
- [x] 41. 통계 페이지 차트 아래에 "이번 주 식단 요약" 카드 배치
- [x] 42. **AI를 쓰지 않기로 결정.** 고정 템플릿은 문장마다 테스트로 검증되고 진단성 표현이 섞일 여지가 없음. 판단 근거는 `weeklySummary.ts` 주석과 서비스 개선 문서 2부에 기록

## 9. UX 안정성 점검 (기존 기능 보강)

- [x] 43. 식단/체중 저장 성공 메시지 존재 확인 ("○○ 식단이 저장되었습니다.", "체중이 저장되었습니다.")
- [x] 44. 저장 실패 문구를 기준과 일치시킴 — 식단 카드와 체중 카드 양쪽. 전 화면 문구 전수 점검 완료
- [x] 45. 입력 누락 정책 확정 — 빈 값은 "공복 + 클린식"으로 자동 저장한다. subject.md의 "먹은 음식을 입력해주세요." 차단 요구와는 다른, 의도된 차이임
- [x] 46. 중복 클릭 방지 확인 — 식단 저장/분류, 체중 저장, 식단 초기화, 날짜 초기화, 로그인·회원가입, CSV 가져오기 **전부 처리되어 있었음**. 코드 변경 없음
- [x] 47. Empty State 추가 — 오늘은 "아직 오늘 기록한 식단이 없어요. 첫 식단을 기록해보세요.", 과거 날짜는 "이 날짜에는 기록된 식단이 없습니다."
- [x] 48. 조회 실패 문구 적용 — 오늘 기록 화면은 **안내가 아예 없었어서 추가**, 캘린더 상세는 문구를 기준에 맞춤

## 10. 모바일 반응형 점검

- [ ] 49. 1440px 데스크톱 화면에서 전체 기능 점검
- [ ] 50. 390px 모바일 화면에서 메뉴/카드/입력창/버튼 점검
- [ ] 51. 390px에서 캘린더 점검
- [ ] 52. 390px에서 통계/차트 점검 (신규 기능이라 별도 확인 필요)
- [x] 53. 긴 음식명 점검 — 카드는 `<input>`이라 넘치지 않고, 캘린더 상세는 `overflow-wrap: anywhere` + `flex-wrap`으로 이미 줄바꿈됨. 코드 변경 없음

## 11. 테스트

- [ ] 54. Test 1 — 회원가입 정상 동작 확인
- [ ] 55. Test 2 — 로그인 정상 동작 확인
- [ ] 56. Test 3 — 점심/연어 포케/clean 저장 확인
- [ ] 57. Test 4 — 음식 미입력 저장 시도 및 에러 확인 (45번 정책 확정 후 진행)
- [ ] 58. Test 5 — 저녁/햄버거/free 저장 및 FREE 표시 확인
- [ ] 59. Test 6 — 캘린더 clean/free 규칙 표시 확인
- [ ] 60. Test 7 — 사용자 A/B 데이터 분리 확인
- [ ] 61. Test 8 — 통계 수치와 DB 실제 값 일치 확인
- [ ] 62. Test 9 — 신규 사용자 Empty State 확인
- [ ] 63. Test 10 — 390px 모바일 전체 기능 확인
- [ ] 64. Test 11 — Production 배포 주소에서 로그인→기록→캘린더→통계 전체 플로우 확인

## 12. 배포

- [x] 65-a. Vercel ↔ GitHub(`main`) 연동 완료, 환경 변수(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) 등록 완료, 배포 URL 확보(https://www.food-broccoli.shop) — 인프라 자체는 준비 끝
- [ ] 65. 통계/차트/주간요약 관련 신규 환경 변수(있다면) `.env.example`에 추가
- [ ] 66. Vercel 재배포 (통계 기능 구현 후 push하면 자동 배포됨)
- [ ] 67. 배포 후 Test 11 재확인

## 13. 문서화 (포트폴리오 산출물)

- [ ] 68. Before/After 사례 3개 이상 작성 (16번에서 선정한 항목 기준)
- [ ] 69. Trouble Shooting 3개 이상 작성 (개발 중 실제 발생한 문제 기준)
- [ ] 70. README.md를 subject.md 13번 구조(프로젝트 소개~향후 개선 사항)로 재작성
- [ ] 71. 데이터 구조 섹션에 실제 테이블/컬럼 반영 (`meals`, `weights`, `members`)
- [ ] 72. 배포 URL, 환경 변수 안내 최신화
- [ ] 73. Before/After 스크린샷(데스크톱/모바일/통계 화면) 캡처 및 삽입
- [ ] 74. 포트폴리오용 요약 자료 정리 (아이디어→구현→사용→문제발견→개선→데이터활용→테스트→재배포 흐름)

## 14. Git/GitHub

- [ ] 75. 기능 단위 커밋 (`feat: add weekly diet statistics` 등 subject.md 12번 컨벤션 사용)
- [ ] 76. 통계/차트/요약 기능은 각각 별도 커밋으로 분리
- [ ] 77. 문서(README, Before/After) 변경은 `docs:` 커밋으로 분리

## 15. 보너스 (선택, 필수 완료 후)

- [x] 78. 보너스 1 — 지난주 대비 클린식 비율 비교 (39번에서 함께 구현)
- [x] 79. 보너스 2 — 날짜별 체중 기록 (이미 구현되어 있음, 요구사항 충족 확인 완료)
- [x] 80. 보너스 3 — 체중 변화 꺾은선 차트. 기록 없는 날은 건너뛰고, 세로 축은 기간 최소·최대에 맞춰 작은 변화도 보이게 함
- [x] 81. 보너스 4 — **하지 않기로 결정** (42번과 동일한 근거)
