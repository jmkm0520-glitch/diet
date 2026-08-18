# 오늘도 가볍게

Next.js App Router와 TypeScript로 구현하는 다이어트 식단 기록 웹사이트입니다.

## 로컬 개발 환경

다음 도구가 필요합니다.

- Node.js와 pnpm
- `python3.12` 명령으로 실행할 수 있는 Python 3.12
- Vercel CLI

Vercel CLI가 없다면 먼저 설치합니다.

```bash
pnpm add --global vercel
```

### 전체 애플리케이션 실행

Next.js와 Python API를 함께 실행하려면 다음 명령을 사용합니다.

```bash
pnpm install
pnpm dev:vercel
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

`pnpm dev:vercel`은 [`scripts/vercel-dev.sh`](./scripts/vercel-dev.sh)를 실행하여 다음
과정을 자동으로 처리합니다.

1. 새 환경이라면 `vercel link`를 실행하여 기존 Vercel 프로젝트를 연결합니다.
2. `vercel pull --yes --environment=development`로 Vercel의 최신 Development
   환경변수와 프로젝트 설정을 가져옵니다.
3. `python3.12`로 프로젝트 루트의 `.venv`를 생성합니다.
4. `.venv`의 Python 버전이 3.12인지 확인합니다.
5. `requirements.txt`가 변경된 경우 Python 의존성을 설치합니다.
6. `.venv`를 사용하는 `vercel dev`를 실행합니다.

Python 버전은 [`.python-version`](./.python-version)에도 `3.12`로 고정되어 있습니다.
별도로 `.venv`를 활성화할 필요는 없습니다.

첫 실행에서는 CLI 안내에 따라 Vercel에 로그인하고 이미 개발 키를 등록한 기존 프로젝트를
선택합니다. Development 환경변수와 프로젝트 연결 정보가 저장되는 `.vercel` 디렉터리는
Git에서 제외되므로 개발 키를 저장소에 커밋하지 않아도 됩니다.

Vercel 연결과 원격 환경변수 없이 실행하려면 `--local` 옵션을 사용할 수 있습니다. 이 경우
API에 필요한 환경변수는 직접 준비해야 합니다.

```bash
pnpm dev:vercel --local
```

다른 포트에서 실행하려면 Vercel 옵션을 명령에 직접 전달합니다.

```bash
pnpm dev:vercel --listen 127.0.0.1:4000
```

### Next.js만 실행

Python API 없이 프론트엔드 개발 서버만 필요하다면 다음 명령을 사용합니다.

```bash
pnpm dev
```

## 주요 명령어

- `pnpm dev`: Next.js 개발 서버만 실행
- `pnpm dev:vercel`: Python 3.12 `.venv`를 준비하고 Vercel 개발 서버 실행
- `pnpm build`: 프로덕션 빌드
- `pnpm start`: 프로덕션 서버 실행
- `pnpm lint`: ESLint 검사
- `pnpm security:check`: 브라우저 결과물·로그·Git 이력의 서버 비밀키 노출 검사

## 회원가입과 이메일 인증

현재 버전은 Supabase Auth의 이메일·비밀번호 회원가입과 6자리 이메일 인증을 사용합니다.
실제 사용자에게 메일을 보내려면 Supabase 기본 발송 서비스 대신 Custom SMTP를 설정해야
합니다. Google SMTP의 정확한 입력값과 앱 비밀번호 발급 절차는
[회원 인증 설계](./docs/MEMBER_AUTH_DESIGN.md#google-smtp-설정)를 참고하세요.

외부 공개 전에는 DB 마이그레이션, Confirm email, Google SMTP를 모두 적용하고 두 개의 테스트
계정으로 데이터 격리를 확인해야 합니다.

데이터베이스 접근 제한, 비밀키 관리, 공개 전 확인사항과 백업·복구 방법은
[보안 및 백업·복구 안내](./docs/SECURITY_AND_RECOVERY.md)에 정리되어 있습니다.

프론트엔드에서 시작한 사용자 요청이 Python 백엔드와 Supabase를 거쳐 다시 화면에
표시되는 과정은 [사용자 요청 흐름 안내](./docs/USER_REQUEST_FLOW.md)에서 초보자 눈높이로
확인할 수 있습니다.
