# 인증과 인가 집중하기

[← 학습 가이드 목차](./README.md) · [이전: 데이터베이스 집중하기](./05-database.md)

## 이 문서에서 답할 질문

> 여러 사람이 같은 앱을 사용할 때 서버는 요청을 보낸 사람이 누구인지 어떻게 확인하고, 그 사람의
> 기록만 돌려주는가?

앞 문서에서는 `members`, `weights`, `meals`가 `member_id`로 연결되는 구조를 살펴봤다. 이제 서버가
어떤 회원 ID를 사용해야 하는지 결정하는 과정을 한 개념씩 알아본다.

## 먼저 기억할 한 문장

> 이 프로젝트에서 로그인의 중심 목적은 JWT를 사용하는 것이 아니라, 사용자를 확인하고 각 회원의
> 식단과 체중을 안전하게 분리하는 것이다.

JWT는 이 목적을 구현하는 과정에서 Supabase access token이 선택한 **형식**이다. 인증 전체를 JWT
하나로 설명하면 로그인 상태, 쿠키, token 저장과 실제 권한 확인의 차이를 놓치기 쉽다.

## 전체 흐름에서 인증의 위치

```text
AuthGate가 로그인·세션 확인 요청
→ Python 인증 API가 입력을 검사
→ Supabase Auth가 계정 또는 token을 확인
→ Python API가 public.members 회원을 확인
→ 검증된 member_id로 식단·체중 query
→ 해당 회원의 결과만 응답
```

이제 이 흐름을 구성하는 개념을 필요한 순서대로 하나씩 살펴본다.

## 1. 인증은 “누구인가”를 확인한다

**인증** (Authentication)은 요청을 보낸 사람이 자신이 주장하는 계정의 실제 사용자임을 확인하는
과정이다.

로그인할 때는 Supabase Auth가 이메일과 비밀번호를 확인한다. 로그인 이후의 데이터 요청에서는
Supabase Auth가 access token이 유효한 사용자를 가리키는지 확인한다.

```text
로그인 시: 이메일 + 비밀번호 → Supabase Auth → 계정 사용자 확인
요청 시: access token → Supabase Auth → token의 사용자 확인
```

비밀번호를 아는지 또는 이미 발급된 자격 증명이 유효한지를 확인해 “누구인가”에 답하는 단계다.

## 2. 인가는 “무엇을 할 수 있는가”를 판단한다

**인가** (Authorization)는 인증된 사용자가 어떤 기능과 데이터에 접근할 수 있는지 판단하는 과정이다.

이 프로젝트에서는 access token의 사용자를 확인하는 것만으로 끝나지 않는다.

1. 같은 ID의 `public.members` 행이 있는지 확인한다.
2. 그 회원 ID를 체중·식단 query의 `member_id` 조건으로 사용한다.
3. 다른 회원의 ID를 요청 body나 URL에서 받아 신뢰하지 않는다.

즉, Supabase Auth 사용자이면서 이 앱의 회원이어야 하고 자신의 기록만 다룰 수 있다.

React의 [`AuthGate`](../../src/components/AuthGate.tsx)가 로그인 화면 대신 앱 화면을 보여주는 것은
사용자 경험을 위한 프론트엔드 판단이다. 화면을 숨겼다는 사실만으로 서버 권한이 생기지는 않는다.
Python API가 모든 보호된 요청에서 인증과 인가를 다시 수행해야 한다.

## 3. 로그인 상태가 계속 이어져야 한다

로그인 버튼을 누른 순간에만 사용자를 확인해서는 앱을 사용할 수 없다. 사용자가 달력으로 이동하고
체중을 저장할 때마다 이메일과 비밀번호를 다시 입력하게 할 수는 없기 때문이다.

앱은 다음 요청에서도 “앞에서 로그인한 같은 사용자”라는 상태를 이어갈 방법이 필요하다. 이 지속되는
로그인 상태를 이해한 뒤에 세션을 보면 쉽다.

## 4. 세션은 로그인 상태가 이어지는 관계다

**세션** (Session)은 사용자가 로그인한 뒤 로그아웃하거나 만료·폐기될 때까지 인증 상태가 이어지는
기간과 관계를 뜻한다. 쿠키 한 개나 JWT 한 개의 다른 이름이 아니다.

이 프로젝트는 애플리케이션 전용 `sessions` table이나 Python 메모리에 로그인 상태를 직접 저장하지
않는다. Supabase Auth의 세션을 사용한다. Supabase Auth는 `auth.sessions`를 관리하고 브라우저가
사용할 access token과 refresh token을 발급한다.

```text
로그인 성공
→ Supabase Auth session 생성
→ 앱이 access/refresh token을 보관
→ 이후 요청에서 사용자 확인
→ logout·만료·폐기까지 로그인 상태 유지
```

세션은 로그인 상태 전체를 가리키고, 다음에 설명할 쿠키와 token은 그 상태를 이어가는 수단이다.

## 5. 쿠키는 브라우저의 저장·전송 수단이다

**쿠키** (Cookie)는 서버가 HTTP 응답의 `Set-Cookie` 헤더로 브라우저에 저장시키는 작은 값이다.
브라우저는 이후 조건에 맞는 요청에 쿠키를 자동으로 포함한다.

```http
Set-Cookie: 이름=값; Path=/; HttpOnly; SameSite=Lax
```

쿠키 자체가 사용자의 신원을 증명하는 인증 방식은 아니다. 이 프로젝트는 Supabase가 발급한 token을
쿠키에 넣어 보관하고 전송한다.

현재 [`set_session_cookies()`](../../api/lib/auth.py)는 두 쿠키를 만든다.

| 쿠키 | 담는 값 | 현재 수명 |
| --- | --- | --- |
| `diet_access_token` | access token | Supabase session의 `expires_in`과 맞춤 |
| `diet_refresh_token` | refresh token | 최대 2,592,000초, 즉 30일 |

두 쿠키의 공통 속성은 다음과 같다.

- `Path=/`: 앱의 모든 경로 요청에 사용할 수 있다.
- `HttpOnly`: 브라우저 JavaScript가 `document.cookie`로 값을 읽지 못한다.
- `SameSite=Lax`: 대부분의 외부 사이트발 상태 변경 요청에는 쿠키 전송을 제한한다.
- `Secure`: `X-Forwarded-Proto`가 HTTPS일 때 붙어 HTTPS 연결에서만 전송한다.

운영 Vercel 요청은 HTTPS이므로 `Secure`를 사용하고, 로컬 HTTP 개발에서는 이 속성을 붙이지 않는다.
코드에 `Domain` 속성이 없으므로 기본적으로 쿠키를 설정한 host에 한정된다.

`HttpOnly`여도 브라우저가 쿠키를 전송하지 않는 것은 아니다. JavaScript가 token 문자열을 직접 읽지는
못하지만, [`fetchApi()`](../../src/services/apiClient.ts)의 `credentials: "same-origin"` 요청에는
브라우저가 같은 출처의 쿠키를 자동으로 포함한다.

## 6. 토큰은 서버가 발급한 자격 증명이다

**토큰** (Token)은 발급자가 만든 자격 증명이다. 사용자는 로그인할 때 비밀번호를 증명하고 token을
받은 뒤, 매 데이터 요청마다 비밀번호 대신 token으로 앞선 인증 결과를 이어간다.

```text
이메일·비밀번호로 한 번 로그인
→ 제한된 수명과 목적의 token 발급
→ 이후 요청은 token으로 사용자 확인
```

token을 가진 사람은 그 token의 권한을 행사할 수 있으므로 비밀번호처럼 노출되지 않도록 보호해야
한다. 쿠키 이름이 `diet_access_token`이라는 사실만으로 token이 유효해지는 것도 아니다. 서버는
token의 종류와 형식에 맞는 방법으로 발급자와 유효 기간 등을 확인해야 한다.

`token`은 역할을 설명하는 넓은 말이다. token의 내부 모양은 하나로 정해져 있지 않다. 단순한 임의의
문자열일 수도 있고, 다음에 살펴볼 JWT 형식일 수도 있다.

## 7. Access token과 Refresh token의 역할은 다르다

Supabase session은 목적이 다른 token 두 개를 앱에 전달한다. 먼저 두 token이 각각 언제 필요한지
구분하고, 그다음 Access token이 사용하는 JWT 형식을 살펴본다.

### Access token

**Access token**은 보호된 API가 현재 사용자를 확인할 때 쓰는 비교적 짧은 수명의 자격 증명이다.
Supabase Auth의 Access token은 JWT 형식이다. 이 프로젝트에서는 `diet_access_token` HttpOnly 쿠키에
들어간다.

### Refresh token

**Refresh token**은 Access token이 만료되었을 때 새로운 Access token과 Refresh token 쌍을 받는 데
사용한다. 더 오래 유지되며 이 프로젝트에서는 `diet_refresh_token` HttpOnly 쿠키에 들어간다.

Supabase Auth의 Refresh token은 JWT가 아니라 session 갱신을 위한 고유 문자열이다. 보호된 데이터
요청마다 사용하지 않고 session 갱신 endpoint에서만 꺼낸다.

| 구분 | Access token | Refresh token |
| --- | --- | --- |
| 주목적 | 보호된 API에서 사용자 확인 | 만료된 Access token 갱신 |
| 형식 | JWT | 고유 문자열 |
| 사용 빈도 | 보호된 데이터 요청마다 | 갱신이 필요할 때 |
| 프로젝트 쿠키 수명 | `expires_in` | 최대 30일 |

쿠키 수명과 Supabase session의 실제 유효성은 같은 개념이 아니다. 쿠키가 브라우저에 남아 있어도
token이 이미 사용되었거나 폐기되었거나 session이 유효하지 않으면 갱신에 실패할 수 있다.

## 8. JWT는 Access token을 표현하는 형식이다

### JWT를 왜 사용하는가?

아무 정보도 드러나지 않는 임의의 문자열 token은 그 문자열이 누구를 가리키고 언제까지 유효한지
서버의 저장소에서 따로 찾아야 한다. JWT는 사용자, 발급자, 만료 시각 같은 정보를 token 안에 담고
서명을 붙인다. JWT를 받은 쪽은 어떤 정보를 확인해야 하는지 알 수 있고, 신뢰하는 발급자의 서명을
검증해 내용이 바뀌었는지 확인할 수 있다.

JWT에 정보가 들어 있다는 사실만으로 로그인과 권한 확인이 모두 끝나는 것은 아니다. 이 프로젝트도
Supabase Auth의 확인과 `members` 조회를 추가로 수행한다.

### JWT라는 이름부터 이해하기

이 프로젝트에서 사용하는 **JWT** (JSON Web Token)는 정보를 담고 그 정보가 바뀌었는지 확인할 수
있도록 서명한 token 형식이다. 이름을 나누어 보면 다음과 같다.

- **JSON**: 이름과 값을 짝지어 정보를 표현하는 형식
- **Web**: URL과 HTTP header 같은 웹 통신에서 전달하기 쉽도록 간결한 문자로 표현한다는 뜻
- **Token**: 이후 요청에서 자격을 증명하는 값

JWT는 잠긴 비밀 상자보다 `내용을 볼 수 있는 출입증`에 가깝다. 출입증에는 사용자와 유효 기간 같은
정보가 적혀 있고, 서명은 그 정보가 발급 후 바뀌지 않았는지 확인하는 위조 방지 표시 역할을 한다.

### JWT는 점으로 구분된 세 부분이다

이 프로젝트의 Supabase Access token처럼 서명된 JWT는 점(`.`) 두 개로 구분된 긴 문자열이다. 실제
값은 훨씬 길지만 모양만 단순화하면 다음과 같다.

```text
aaaaa.bbbbb.ccccc
  ↑     ↑     ↑
header payload signature
```

- `header`: 머리말이다. JWT 종류와 서명에 사용할 방식 같은 정보를 담는다.
- `payload`: 전달할 내용이다. 사용자 ID, 발급자, 만료 시각 같은 Claim을 담는다.
- `signature`: 서명이다. 신뢰하는 발급자가 만들었는지, header와 payload가 발급 후 바뀌지 않았는지
  확인할 때 사용한다.

점 사이의 문자열은 사람이 읽기 편한 원래 JSON 모습이 아니다. JSON을 웹에서 전달하기 쉬운 문자로
바꾸는 **인코딩** (Encoding)을 거친 값이다. 인코딩은 정보의 표현 방법을 바꾸는 것이지 내용을 비밀로
숨기는 암호화가 아니다. 인코딩한 내용을 원래 형태로 되돌려 읽는 과정을 **디코딩** (Decoding)이라고
한다.

### Claim은 JWT가 전달하는 정보 항목이다

`Claim`은 영어로 주장이라는 뜻이다. JWT에서는 token 발급자가 사용자나 token에 관해 전달하는 정보
한 항목을 가리킨다. 다음은 개념을 보여 주기 위한 단순한 payload 예시이며 실제 token의 값은 로그인
사용자와 발급 시각에 따라 달라진다.

```json
{
  "sub": "사용자 UUID",
  "iss": "토큰을 발급한 Supabase Auth 주소",
  "exp": 1800000000
}
```

| Claim | 뜻 | 확인할 내용 |
| --- | --- | --- |
| `sub` | Subject, token이 가리키는 대상 | 어느 사용자의 token인가? |
| `iss` | Issuer, token을 발급한 곳 | 신뢰하는 Supabase Auth가 발급했는가? |
| `exp` | Expiration Time, 만료 시각 | 아직 사용할 수 있는가? |

Claim 이름과 숫자를 외울 필요는 없다. 지금은 payload에 `누구의 token인지`, `누가 발급했는지`, `언제
만료되는지` 같은 정보가 들어갈 수 있다는 점만 이해하면 된다.

### 읽을 수 있다는 것과 신뢰할 수 있다는 것은 다르다

JWT 문자열을 가진 사람은 header와 payload를 decode해 읽을 수 있다. 따라서 비밀번호나
`SUPABASE_SERVICE_ROLE_KEY` 같은 비밀값을 넣으면 안 된다.

하지만 payload를 읽었다고 해서 그 내용을 바로 믿을 수 있는 것은 아니다. 누군가 payload의 사용자
ID나 만료 시각을 바꿔 가짜 JWT 모양을 만들 수 있기 때문이다. 신뢰하려면 다음 확인이 필요하다.

1. 신뢰하는 발급자의 키로 signature가 올바른지 확인한다.
2. `iss`가 신뢰하는 발급자를 가리키는지 확인한다.
3. `exp`가 지나 token이 만료되지 않았는지 확인한다.

payload를 바꾸면 원래 signature와 맞지 않게 된다. 따라서 signature 검증은 `내용을 읽는 과정`이
아니라 `발급 후 내용이 바뀌지 않았는지 확인하는 과정`이다.

실제 Access token은 로그인 자격 증명이므로 임의의 온라인 decoder, 문서, 채팅이나 로그에 붙여 넣지
않는다.

### 이 프로젝트에서는 JWT를 어떻게 확인하는가?

이 프로젝트는 JWT를 직접 만들거나 브라우저에서 payload를 읽어 권한을 결정하지 않는다.

```text
1. 로그인에 성공하면 Supabase Auth가 JWT 형식의 Access token을 발급한다.
2. Python API가 전체 token 문자열을 diet_access_token HttpOnly 쿠키에 넣는다.
3. 브라우저가 다음 API 요청에 쿠키를 자동으로 함께 보낸다.
4. require_member()가 쿠키에서 Access token을 읽는다.
5. require_member()가 전체 token을 Supabase Auth의 get_user(token)에 전달한다.
6. Supabase Auth가 유효한 사용자를 확인해 결과를 돌려준다.
7. Python API가 같은 사용자 ID의 members 행까지 확인한다.
```

즉, Python API는 JWT를 점으로 나누어 payload만 읽고 사용자를 믿지 않는다.
[`require_member()`](../../api/lib/auth.py)는 Supabase Auth가 확인한 사용자와 이 앱의 `members` 행을
차례대로 확인한다. JWT가 유효해도 `members` 행이 없으면 이 앱의 회원으로 허용하지 않는다.

## 이제 개념의 관계를 한 번에 연결하기

각 개념을 따로 살펴본 뒤 연결하면 다음과 같다.

```text
인증: 누구인지 확인
인가: 확인된 사람이 무엇을 할 수 있는지 판단

세션: 로그인 상태가 이어지는 관계
└─ 쿠키: 브라우저가 자격 증명을 저장·자동 전송하는 수단
   ├─ access token: API 사용자 확인용 자격 증명
   │  └─ JWT: 이 access token의 표현 형식
   └─ refresh token: session 갱신용 고유 문자열
```

“쿠키 기반인가, JWT 기반인가?”를 반드시 둘 중 하나로만 고를 필요는 없다. 이 프로젝트는 JWT access
token을 HttpOnly 쿠키로 보관·전송하면서 Supabase Auth session을 사용한다.

## 회원가입과 이메일 확인 흐름

회원가입은 이메일을 실제로 소유한 사용자인지 확인한 뒤 앱 회원을 만든다.

```text
1. AuthGate
   이름·이메일·비밀번호 제출
   ↓ POST /api/authentication?action=signup
2. Python API
   Pydantic으로 이메일·비밀번호·이름 검증
   ↓
3. Supabase Auth sign_up()
   미확인 auth.users 생성, 확인 메일 발송
   ↓
4. reserve_member_signup DB 함수
   member_signup_claims에 표시 이름·이메일 임시 보관
   ↓
5. 사용자
   이메일의 6자리 번호 입력
   ↓ POST ...?action=verify_email
6. Supabase Auth verify_otp()
   이메일 확인, session과 token pair 발급
   ↓
7. complete_verified_member_signup DB 함수
   이메일 확인 상태 재검사, public.members 생성
   ↓
8. Python API
   두 token은 HttpOnly cookie로 설정
   안전한 회원 프로필만 JSON으로 반환
```

[`AuthGate`](../../src/components/AuthGate.tsx)는 인증 화면을 새로고침해도 이어갈 수 있도록 가입 대기
이메일만 `sessionStorage`에 저장한다. access token과 refresh token은 `sessionStorage`나
`localStorage`에 저장하지 않는다.

## 일반 로그인 흐름

1. `AuthGate`가 이메일과 비밀번호를 `POST ...?action=login`으로 보낸다.
2. [`CredentialsRequest`](../../api/models/auth.py)가 이메일 형식과 8~128자 비밀번호 길이를 검사한다.
3. Python API가 Supabase Auth의 `sign_in_with_password()`를 호출한다.
4. Supabase Auth가 계정을 확인하고 session의 access/refresh token을 돌려준다.
5. Python API가 같은 사용자 ID의 `members` 행을 확인한다.
6. 가입 대기 상태에서 이메일 확인을 마친 회원이라면 필요한 회원 완료 DB 함수를 실행할 수 있다.
7. Python API가 두 token을 HttpOnly cookie로 설정한다.
8. 응답 JSON에는 `id`, `email`, `displayName`만 담고 token은 넣지 않는다.
9. `AuthGate`가 회원 프로필을 React state에 저장하고 앱 화면을 보여준다.

잘못된 이메일과 잘못된 비밀번호에는 모두 `INVALID_CREDENTIALS`를 사용해 계정 존재 여부를 자세히
노출하지 않는다.

## 앱 진입과 세션 확인·갱신 흐름

앱을 열면 `AuthGate`는 먼저 `GET /api/authentication?action=session`을 호출한다.

```text
access cookie가 있는가?
└─ require_member()로 Auth 사용자와 members 확인
   ├─ 성공 → 현재 회원 프로필 반환
   └─ 실패 → refresh cookie 확인
              ├─ 없음 → 두 cookie 만료 + 401
              └─ 있음 → Supabase Auth refresh_session()
                         ├─ 성공 → 새 access로 회원 재확인
                         │          + 두 cookie 교체 + 회원 반환
                         └─ 실패 → 두 cookie 만료 + 401
```

현재 자동 갱신은 이 session endpoint를 호출할 때 수행한다. `/api/day`, `/api/weight` 같은 일반 데이터
API가 `401`을 반환했을 때 프론트엔드가 session을 갱신하고 원래 요청을 자동 재시도하는 기능은 없다.

## 인증된 데이터 요청 흐름

로그인 후 체중을 저장할 때는 다음 경계를 다시 통과한다.

```text
fetchApi("/api/weight", credentials="same-origin")
→ 브라우저가 diet_access_token cookie 자동 첨부
→ Python API의 require_member()
→ Supabase Auth get_user(access_token)
→ public.members에서 같은 ID 확인
→ 검증된 member.id를 weight payload의 member_id로 추가
→ Supabase PostgreSQL에 해당 회원 기록 저장
```

브라우저가 `member_id`를 골라 보내지 않는다. Python API가 검증된 사용자와 회원에서 ID를 결정한다.
cookie가 없거나 token·회원 확인에 실패하면 보호된 API는 HTTP `401`과 `AUTH_REQUIRED`를 반환한다.

## 이 프로젝트에서 인가는 어디에서 이루어지는가?

데이터 table에는 RLS가 켜져 있지만 Python API는 RLS를 우회할 수 있는 service role로 Supabase에
접근한다. 브라우저의 사용자 JWT를 table query에 직접 적용해 RLS 정책이 회원 행을 고르는 구조가
아니다.

따라서 현재 실제 인가 경계는 다음 두 가지가 함께 있어야 한다.

1. 모든 보호된 endpoint가 `require_member()`로 사용자와 앱 회원을 확인한다.
2. 모든 개인 데이터 query가 검증된 `member.id`를 조건이나 저장 payload에 사용한다.

service role key는 Python 서버의 환경 변수에만 두고 브라우저로 보내지 않는다.

## 로그아웃 흐름과 현재 범위

1. `AuthGate`가 `POST /api/authentication?action=logout`을 호출한다.
2. Python API가 두 cookie에 `Max-Age=0`을 설정한다.
3. 브라우저가 cookie를 제거한다.
4. `AuthGate`가 React state의 회원을 `null`로 바꾸고 로그인 화면을 표시한다.

현재 logout endpoint는 Supabase Auth의 server-side `sign_out()`이나 모든 기기의 session 폐기를
호출하지 않는다. 즉, **현재 기기의 브라우저가 보관한 token을 제거하는 로그아웃**이다. token이
별도로 유출되었다고 가정했을 때 그것까지 즉시 폐기하는 전역 로그아웃과는 범위가 다르다.

## 쿠키 보안 속성이 줄이는 위험

### HttpOnly

JavaScript가 cookie의 token 문자열을 직접 읽지 못하게 해 XSS가 발생했을 때 token을 그대로 훔치는
위험을 줄인다. 그러나 악성 JavaScript가 사용자의 브라우저에서 요청을 실행하는 것까지 모두 막는
설정은 아니므로 XSS 예방 자체도 필요하다.

### SameSite=Lax

대부분의 외부 사이트발 `POST`, `PUT`, `DELETE` 요청에 cookie가 붙는 것을 제한해 CSRF 위험을
줄인다. 모든 브라우저·요청 상황의 CSRF를 해결하는 단독 방어는 아니다. 현재 별도의 CSRF token이나
Origin 검증은 구현되어 있지 않다.

### Secure와 HTTPS

`Secure` cookie는 HTTPS 연결에서만 전송된다. HTTPS는 브라우저와 Vercel 사이를 이동하는 token이
네트워크에서 그대로 노출될 위험을 줄인다. `Secure`만으로 token 탈취 가능성이 모두 사라지는 것은
아니다.

## 자주 생기는 오해

### 로그인, 세션, 쿠키, 토큰, JWT는 같은 말인가?

아니다. 로그인은 인증 동작, 세션은 이어지는 로그인 상태, 쿠키는 브라우저 저장·전송 수단, token은
자격 증명, JWT는 token 형식 중 하나다.

### JWT를 쓰면 쿠키를 쓰지 않는가?

아니다. JWT를 어디에 보관하고 어떻게 보낼지는 별도 선택이다. 이 프로젝트는 JWT access token을
HttpOnly cookie에 넣는다.

### JWT payload는 암호화된 비밀 공간인가?

아니다. payload는 decode해 읽을 수 있다. 서명은 변조 여부를 검증하지만 내용을 숨기지 않는다.

### Refresh token도 JWT인가?

Supabase Auth에서는 아니다. access token은 JWT이고 refresh token은 session 갱신용 고유 문자열이다.

### HttpOnly면 모든 XSS와 CSRF가 해결되는가?

아니다. JavaScript의 token 문자열 접근을 막는 한 가지 보호다. XSS 예방과 CSRF 방어에는 다른
보호도 함께 필요하다.

### React state에 member가 있으면 서버 권한도 생기는가?

아니다. 프론트엔드 state는 바꿀 수 있다. 서버는 요청마다 token과 `members`를 확인하고 자신의
`member_id`에만 접근하도록 제한한다.

### 로그아웃하면 모든 기기의 Supabase session이 즉시 폐기되는가?

현재 구현에서는 아니다. 이 브라우저의 cookie를 만료할 뿐 Supabase server-side 전역 로그아웃을
호출하지 않는다.

## 이해 확인

1. 인증과 인가는 각각 어떤 질문에 답하는가?
2. 세션과 쿠키는 어떤 점에서 다른가?
3. Access token과 Refresh token의 목적과 형식은 어떻게 다른가?
4. token과 JWT는 어떤 관계인가?
5. JWT의 header, payload, signature는 각각 어떤 역할을 하는가?
6. JWT의 payload를 읽는 것만으로 사용자를 믿을 수 없는 이유는 무엇인가?
7. `require_member()`는 cookie 존재 확인 외에 무엇을 확인하는가?
8. 현재 로그아웃이 처리하는 범위와 처리하지 않는 범위는 무엇인가?

답하기 어렵다면 **인증 → 인가 → 세션 → 쿠키 → token → Access·Refresh token → JWT** 순서로 한
항목씩 다시 읽는다.

## 파일을 어디서부터 읽으면 될까?

1. [`src/components/AuthGate.tsx`](../../src/components/AuthGate.tsx): 인증 화면과 앱 진입 session 확인
2. [`api/authentication.py`](../../api/authentication.py): 가입·로그인·확인·갱신·로그아웃 처리 순서
3. [`api/models/auth.py`](../../api/models/auth.py): 인증 요청 입력 규칙
4. [`api/lib/auth.py`](../../api/lib/auth.py): cookie 발급·삭제와 `require_member()`
5. [`api/lib/supabase_client.py`](../../api/lib/supabase_client.py): 서버 전용 Supabase client
6. [`202608130003_enable_multi_member_signup.sql`](../../supabase/migrations/202608130003_enable_multi_member_signup.sql):
   현재 다중 회원 가입 DB 함수

## 공식 참고 자료

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase JSON Web Token](https://supabase.com/docs/guides/auth/jwts)
- [MDN: Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)

## 다음 문서

다음 [인프라와 배포 집중하기](./07-infrastructure-and-deployment.md)에서는 가비아에서 관리하는
도메인·DNS 레코드가 Vercel로 연결되는 과정, Vercel과 Supabase의 실행 역할, HTTPS와 환경 변수를
확대한다.
