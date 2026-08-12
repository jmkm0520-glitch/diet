# 오늘도 가볍게

Next.js App Router와 TypeScript로 구현하는 다이어트 식단 기록 웹사이트입니다.

## 로컬 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

## 주요 명령어

- `pnpm dev`: 개발 서버 실행
- `pnpm build`: 프로덕션 빌드
- `pnpm start`: 프로덕션 서버 실행
- `pnpm lint`: ESLint 검사
- `pnpm security:check`: 브라우저 결과물·로그·Git 이력의 서버 비밀키 노출 검사

## 데모 이용 시 주의사항

현재 버전에는 회원가입과 로그인이 없습니다. 인터넷에 공개하면 사이트 주소를 아는 사람이 같은
식단과 체중 기록을 조회하거나 변경할 수 있습니다. 실제 개인정보를 입력하는 공개 서비스로
사용하면 안 됩니다.

현재 결정은 **로그인 또는 배포 접근 제한을 적용하기 전에는 외부에 공개하지 않는 것**입니다.
내부 시연은 Vercel Deployment Protection 같은 접근 제한을 사용하고, 실제 사용자에게 공개하기
전에는 Supabase Auth 기반 로그인을 추가해야 합니다.

데이터베이스 접근 제한, 비밀키 관리, 공개 전 확인사항과 백업·복구 방법은
[보안 및 백업·복구 안내](./docs/SECURITY_AND_RECOVERY.md)에 정리되어 있습니다.
