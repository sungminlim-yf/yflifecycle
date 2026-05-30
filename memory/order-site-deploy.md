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

**onboarding.youngfoods.com.au 가동** (2026-05-30): Tally Pro 커스텀 도메인. `onboarding` CNAME → `cname.tally.so` (Squarespace DNS), Tally 자동 SSL 🟢. 슬러그 없이 **루트에 폼 `Me75K8` 서빙** (전용 서브도메인). DNS는 Vercel `order`와 동일하게 Squarespace에서 관리.

**프리필 검증 완료 + param명 확정** (2026-05-30): 새 도메인 루트에서 URL 파라미터 정상 주입 확인. 폼 hidden field = **`hubspot_id` + `email_prefill`** (NOT `email`). 따라서 prefill URL = `https://onboarding.youngfoods.com.au/?hubspot_id={{company.hs_object_id}}&email_prefill={{contact.email}}`. ⚠️ #7a 매칭 코드가 `email` vs `email_prefill` 어느 걸 읽는지 점검 필요(기존 템플릿이 `email`만 썼다면 forward 가드 안 잡혔을 수 있음).

**세션2 order-site 개선 (2026-05-30, 전부 배포·푸시 ~`8df7f89`)**:
- 컷오프: `Australia/Brisbane` 정오 기준 + **place-order 클릭 시점** 평가(지났으면 자동 보정+안내). #1 Validate도 Sydney→Brisbane.
- MOQ 거부 응답 422 정상화 (#1 respond 노드 `options.responseCode`로 수정).
- 다국어 6종(EN/KO/ZH/JA/TH/ES), 제출완료 버튼+추가주문, 모바일 date fix, 할인 워딩 일반화.
- 배너: 게스트 `[손님으로 주문]` / 매직 `[등록된 가게]` pill + 「가게명」 전용 페이지 + "내 가게 아닌가요? 손님으로 주문→"(작게). "영업 연락" 문구 제거.
- 접근성 줌: 🔍+작은A/↺/큰A, 배율 0.9~1.6, localStorage 저장.
- 분실복구 "Lost your link?" collapse(기본 접힘) + (tap to open) + "이메일도 기억 안나면 게스트로" 안내.
- **연락처·담당자 인라인 self-update (#R2 `eKAS9xqfHzvwliZj` active)**: magic 카드 '수정' → 담당자/연락처만 PATCH, 오더 무관. /api/update-contact 프록시. E2E 검증.
- **#6c 이메일 분실복구 (`eM3uEPPqueopOH9p` active)**: /api/recover → Gmail 발송.

**🔴 다음 세션 픽업 (미완)**:
1. **HubSpot 온보딩 이메일 템플릿 URL 교체** — `tally.so/r/Me75K8?...` → `https://onboarding.youngfoods.com.au/?hubspot_id={{ company.hs_object_id }}&email_prefill={{ contact.email }}`. 사용자가 HubSpot 링크칸에 직접 타이핑 시 "invalid characters {{ }}" 에러 만남 → 해결책: 리치텍스트 **소스코드 `</>`** 에디터에서 `<a href="...">` 직접 작성(중괄호 안 공백, 필요시 `&`→`&amp;`), 또는 링크 대화상자의 토큰 삽입 아이콘 사용. **이게 자러 가기 직전 멈춘 지점.**
2. 교체 후 실제 온보딩 1건 E2E(#7a staging에 hubspot_id 잡히는지).
3. #7a hidden field param명(email vs email_prefill) 정합성 점검.

#7b 환영메일 매직링크 base URL = `https://order.youngfoods.com.au` 로 확정 (CLAUDE.md·README와 일치). [[yf-design-progress]]

**2026-05-30 후속 (E2E 테스트 + 개선):**
- E2E 완주: 라이브 사이트→#1→Airtable 주문 생성, 멱등성·MOQ 거부·#2 dispatch→Xero 인보이스 전부 검증.
- **MOQ 422 버그 수정**: #1의 Respond 노드들이 `responseCode`를 top-level에 둬 무시됨(200) → `options.responseCode`로 이동 (MOQ 422·Invalid 422·Token 401). n8n respondToWebhook는 항상 `options.responseCode` 사용할 것.
- **다국어 6종**: EN/KO/ZH + 日本語/ไทย/Español 추가.
- **#6c 이메일 분실복구 가동** (id `eM3uEPPqueopOH9p`): order-site `/api/recover` → 이메일로 고객 조회 → Gmail(#7b와 동일 credential `SycEHwXNU8mv9tYf`)로 매직링크 발송. ClickSend(SMS #6a/#6b) 가입 전 대체. Gmail credential 작동 확인됨(= #7b 환영메일도 발송 가능).
- 미완(수동): 오더 테이블 Payment term 중복 옵션 `Credit - 7 days `(공백) 삭제(Airtable UI), Xero 테스트 인보이스 void.
