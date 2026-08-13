# 단일 회원 인증 및 데이터 마이그레이션 설계

## 목표

- Supabase Auth의 이메일·비밀번호 인증을 사용한다.
- 서비스에는 `public.members` 회원을 정확히 한 명만 생성할 수 있다.
- 기존 식단과 체중 기록을 보존하고 최초 회원에게 연결한다.
- 브라우저에는 service role key와 Supabase 세션 토큰을 노출하지 않는다.
- 모든 데이터 API가 인증된 회원의 행만 읽고 변경한다.

## 데이터 모델

`members.id`는 `auth.users.id`를 참조한다. `meals`와 `weights`에는 nullable `member_id`를
먼저 추가한다. nullable인 이유는 DB 마이그레이션과 최초 회원 생성 사이에도 기존 데이터를
보존하기 위해서다. 신규 API 쓰기는 항상 인증된 `member_id`를 넣는다.

- `members(id, email, display_name, created_at, updated_at)`
- `meals`: `(member_id, date, meal)` 유일 제약
- `weights`: `(member_id, date)` 유일 제약

## 최초 회원 생성

1. 서버가 입력값을 검증하고 현재 회원 존재 여부를 빠르게 확인한다.
2. Supabase Admin API로 이메일이 확인된 Auth 사용자를 생성한다.
3. `claim_single_member` RPC가 advisory transaction lock을 획득한다.
4. 잠금 안에서 회원이 이미 있으면 실패한다.
5. 회원 프로필을 만들고 `member_id is null`인 모든 기존 기록을 새 회원에게 연결한다.
6. RPC가 실패하면 서버가 방금 만든 Auth 사용자를 보상 삭제한다.
7. 로그인 세션을 만들고 access/refresh token을 HttpOnly, SameSite=Lax 쿠키로 보낸다.

애플리케이션의 사전 조회는 UX 최적화일 뿐이며, 동시 요청에 대한 실제 단일 회원 보장은 DB
잠금과 제약이 담당한다.

## 로그인과 세션

- `POST /api/auth/login`: 이메일·비밀번호 로그인
- `GET /api/auth/session`: 현재 회원 조회, 필요 시 refresh token으로 세션 갱신
- `POST /api/auth/logout`: 세션 쿠키 만료
- `GET /api/auth/signup`: 최초 회원 생성 가능 여부
- `POST /api/auth/signup`: 최초 회원 1명 생성

세션 쿠키는 JavaScript에서 읽을 수 없다. 기존 `/api/day`, `/api/calendar`, `/api/meal`,
`/api/weight`는 access token을 검증하고 `members` 행을 확인한 뒤 모든 쿼리에 `member_id`를
명시한다.

## 배포 순서와 복구

1. 변경 전 Supabase 논리 백업을 만든다.
2. `202608130001_add_single_member_auth.sql`을 적용한다.
3. 애플리케이션을 배포한다.
4. 신뢰할 수 있는 관리자 한 명이 첫 회원을 생성한다.
5. `members` 1행, `meals.member_id is null` 0행, `weights.member_id is null` 0행을 확인한다.
6. 로그인하지 않은 데이터 API 요청이 401인지 확인한다.

롤백 시에는 먼저 애플리케이션을 이전 버전으로 되돌린다. 스키마 롤백은 새 버전에서 생성된
사용자별 데이터가 있는지 확인한 뒤 별도 하향 마이그레이션으로 수행하며, 운영 DB에서 즉시 컬럼을
삭제하지 않는다.
