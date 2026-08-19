# 다중 회원 이메일 인증 및 데이터 마이그레이션 설계

JWT, 쿠키, 로그인, 토큰 갱신 등 인증 개념과 요청별 상세 흐름은
[로그인 흐름과 인증 개념](./LOGIN_FLOW_AND_CONCEPTS.md)을 참고한다.

## 목표

- Supabase Auth의 이메일·비밀번호 인증을 사용한다.
- 이메일을 인증한 일반 사용자는 각자 `public.members` 회원을 만들 수 있다.
- 식단과 체중 기록을 `member_id`로 분리한다.
- 브라우저에는 service role key와 Supabase 세션 토큰을 노출하지 않는다.
- 모든 데이터 API가 인증된 회원의 행만 읽고 변경한다.

## 데이터 모델

`members.id`는 `auth.users.id`를 참조한다. `meals`와 `weights`에는 nullable `member_id`를
먼저 추가한다. nullable인 이유는 기존 데이터를 삭제하지 않고 보존하기 위해서다. 신규 API 쓰기는
항상 인증된 `member_id`를 넣으며, 새 회원은 빈 기록으로 시작한다.

- `members(id, email, display_name, created_at, updated_at)`
- `meals`: `(member_id, date, meal)` 유일 제약
- `weights`: `(member_id, date)` 유일 제약

## 이메일 인증 회원가입

1. 서버가 이름·이메일·비밀번호를 검증한다.
2. Supabase Auth `sign_up`이 미확인 사용자를 만들고 6자리 인증번호 이메일을 전송한다.
3. `reserve_member_signup` RPC가 사용자별 가입 대기 정보를 저장한다.
4. 사용자가 이메일의 인증번호를 입력하면 서버가 `verify_otp`로 검증한다.
5. `complete_verified_member_signup` RPC가 `auth.users.email_confirmed_at`을 다시 확인한다.
6. 확인된 사용자만 회원 프로필을 만든다.
7. 검증 응답의 access/refresh token을 HttpOnly, SameSite=Lax 쿠키로 보낸다.

이메일과 Auth 사용자 ID의 유일 제약이 중복 회원 및 가입 대기 생성을 방지한다. 서로 다른 사용자의
가입은 독립적으로 진행된다.

## 로그인과 세션

- `POST /api/authentication?action=login`: 이메일·비밀번호 로그인
- `GET /api/authentication?action=session`: 현재 회원 조회 및 토큰 갱신
- `POST /api/authentication?action=logout`: 세션 쿠키 만료
- `POST /api/authentication?action=signup`: 인증번호 이메일 발송 및 가입 대기 저장
- `POST /api/authentication?action=verify_email`: 이메일 인증 후 회원 생성 완료
- `POST /api/authentication?action=resend_verification`: 인증번호 이메일 재전송

인증 작업은 Vercel Hobby 플랜의 함수 개수 제한을 피하기 위해 `api/authentication.py` 하나에서
`action` 값으로 분기한다.

세션 쿠키는 JavaScript에서 읽을 수 없다. 기존 `/api/day`, `/api/calendar`, `/api/meal`,
`/api/weight`는 access token을 검증하고 `members` 행을 확인한 뒤 모든 쿼리에 `member_id`를
명시한다.

## Supabase 이메일 설정

Hosted Supabase의 `Authentication > Providers > Email`에서 **Confirm email**을 활성화한다.
`Authentication > Email Templates > Confirm signup` 템플릿에는 사용자가 앱에 입력할 수 있도록
`{{ .Token }}`을 포함한다.

```html
<h2>오늘도 가볍게 이메일 인증</h2>
<p>아래 6자리 인증번호를 앱에 입력해 주세요.</p>
<p style="font-size: 28px; font-weight: 700">{{ .Token }}</p>
```

Supabase 기본 메일 서비스는 개발용 전송 제한이 있으므로 운영에서는 Custom SMTP를 설정한다.
가입 대기 이메일을 변경해야 하는 복구 상황에서는 해당 사용자의 `member_signup_claims` 행과 미확인
`auth.users` 사용자를 확인한 후 삭제하고 다시 가입한다.

### Google SMTP 설정

Google 계정의 일반 비밀번호를 SMTP에 입력하지 않는다. 발송 전용 Google 계정에
2단계 인증을 켜고 [Google 앱 비밀번호](https://myaccount.google.com/apppasswords)에서
`Supabase Auth` 용도의 16자리 앱 비밀번호를 발급한다. 이 비밀번호는 다시 표시되지 않으며
저장소나 `.env` 파일에 커밋하지 않는다.

Supabase Dashboard의 `Authentication > Emails > SMTP Settings`에서 Custom SMTP를 켜고
다음과 같이 입력한다.

| 항목         | 입력값                                           |
| ------------ | ------------------------------------------------ |
| Sender email | Google 계정 전체 이메일 주소                     |
| Sender name  | `오늘도 가볍게`                                  |
| Host         | `smtp.gmail.com`                                 |
| Port         | `465`                                            |
| Username     | Sender email과 같은 Google 계정 전체 이메일 주소 |
| Password     | Google에서 발급한 16자리 앱 비밀번호             |

`smtp.gmail.com:465`는 SSL 연결을 사용한다. 587 포트도 TLS/STARTTLS로 사용할 수
있지만, Supabase와 Google SMTP 조합에서는 위 설정을 기본값으로 사용한다. Google
Workspace를 사용하면 Sender email과 Username을 Workspace 관리자 계정으로 맞춘다.

저장 후 다음을 확인한다.

1. `Authentication > Sign In / Providers > Email`에서 Confirm email이 켜져 있는지 확인한다.
2. Confirm signup 템플릿에 `{{ .Token }}`이 있는지 확인한다.
3. 실제 수신 가능한 새 이메일로 가입해 6자리 번호가 수신되는지 확인한다.
4. 메일이 오지 않으면 Supabase Auth Logs의 SMTP 오류와 스팸함을 확인한다.
5. Google 계정 비밀번호를 바꾸면 앱 비밀번호가 폐기되므로 새로 발급해 SMTP
   설정을 갱신한다.

Gmail SMTP는 개발·소규모 운영에는 적합하지만 대규모 트랜잭션 메일에는 발송 한도와
도메인 인증 제어가 있는 전용 발송 서비스를 사용한다.

## 배포 순서와 복구

1. 변경 전 Supabase 논리 백업을 만든다.
2. `202608130001_add_single_member_auth.sql`과
   `202608130002_add_email_verified_signup.sql`,
   `202608130003_enable_multi_member_signup.sql`을 순서대로 적용한다.
3. 애플리케이션을 배포한다.
4. 테스트 사용자 두 명이 각각 가입하고 이메일을 인증한다.
5. 각 사용자가 상대방의 식단과 체중 기록을 조회할 수 없는지 확인한다.
6. 로그인하지 않은 데이터 API 요청이 401인지 확인한다.

롤백 시에는 먼저 애플리케이션을 이전 버전으로 되돌린다. 스키마 롤백은 새 버전에서 생성된
사용자별 데이터가 있는지 확인한 뒤 별도 하향 마이그레이션으로 수행하며, 운영 DB에서 즉시 컬럼을
삭제하지 않는다.
