---
name: order-site-deploy
description: 주문 사이트 Vercel 배포·커스텀 도메인 order.youngfoods.com.au 라이브 (2026-05-30)
metadata: 
  node_type: memory
  type: project
  originSessionId: 11e1fb7f-dcae-47fe-ab6e-336b7b21fc18
---

주문 사이트(`order-site/`, Next.js 15 App Router)를 **Vercel에 배포**해 라이브 운영 중 (2026-05-30 확정).

- **라이브 도메인**: `https://order.youngfoods.com.au` (단수 order — orders 아님)
- **Vercel 프로젝트**: `sungminlim-yfs-projects/order-site` (team `team_dSV5MfXLWqcpiTLFpkM8MCix`)
- **기본 alias**: `order-site-phi.vercel.app`
- **재배포**: `order-site/`에서 `vercel deploy --prod` 한 줄 (env·도메인 유지). Vercel CLI는 `~/.npm-global/bin/vercel`에 설치(전역 prefix를 사용자 디렉터리로 바꿔 sudo 회피), PATH는 `.zshrc`에 추가됨. CLI는 git 연동 아님 → push 자동배포 X, 수동 `--prod`.
- **환경변수**: `N8N_BASE_URL`/`N8N_ORDER_INTAKE_PATH`/`N8N_ORDER_INTAKE_HEADER_NAME`/`N8N_ORDER_INTAKE_HEADER_VALUE`/`N8N_RESOLVE_PATH` — production·development에 주입 완료(preview는 CLI quirk로 미입력, 필요시 대시보드에서).

**DNS**: 도메인 youngfoods.com.au는 Google 네임서버(`googledomains.com`)·Squarespace 이관 상태, 이메일=Google Workspace(MX=google), apex/www=Squarespace 홈페이지. `order` 서브도메인만 **A 레코드 `76.76.21.21`**로 Vercel 연결 (MX·apex·www 무손상). DNS 편집은 Squarespace Domains(또는 Google Workspace Admin).

**도메인 구성 방침** (2026-05-30 결정): 서비스마다 호스팅이 달라 **서브도메인 방식** 채택 (path 방식은 단일 앱일 때만). order=Vercel, 향후 www/홈페이지=Squarespace, onboarding=Tally, customer/supplier/staff 포털=별도 서브도메인(또는 한 앱이면 app. 아래 path).

**onboarding.youngfoods.com.au 가동** (2026-05-30): Tally Pro 커스텀 도메인. `onboarding` CNAME → `cname.tally.so` (Squarespace DNS), Tally 자동 SSL 🟢. 슬러그 없이 **루트에 폼 `Me75K8` 서빙** (전용 서브도메인). prefill: `…/?hubspot_id=…&email=…`. **남은 후속**: HubSpot 온보딩 이메일 템플릿 링크를 `tally.so/r/Me75K8` → `onboarding.youngfoods.com.au`로 교체(호스트만, HubSpot UI 수동). DNS는 Vercel `order`와 동일하게 Squarespace에서 관리.

#7b 환영메일 매직링크 base URL = `https://order.youngfoods.com.au` 로 확정 (CLAUDE.md·README와 일치). [[yf-design-progress]]

**2026-05-30 후속 (E2E 테스트 + 개선):**
- E2E 완주: 라이브 사이트→#1→Airtable 주문 생성, 멱등성·MOQ 거부·#2 dispatch→Xero 인보이스 전부 검증.
- **MOQ 422 버그 수정**: #1의 Respond 노드들이 `responseCode`를 top-level에 둬 무시됨(200) → `options.responseCode`로 이동 (MOQ 422·Invalid 422·Token 401). n8n respondToWebhook는 항상 `options.responseCode` 사용할 것.
- **다국어 6종**: EN/KO/ZH + 日本語/ไทย/Español 추가.
- **#6c 이메일 분실복구 가동** (id `eM3uEPPqueopOH9p`): order-site `/api/recover` → 이메일로 고객 조회 → Gmail(#7b와 동일 credential `SycEHwXNU8mv9tYf`)로 매직링크 발송. ClickSend(SMS #6a/#6b) 가입 전 대체. Gmail credential 작동 확인됨(= #7b 환영메일도 발송 가능).
- 미완(수동): 오더 테이블 Payment term 중복 옵션 `Credit - 7 days `(공백) 삭제(Airtable UI), Xero 테스트 인보이스 void.
