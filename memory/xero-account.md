---
name: xero-account
description: Young Foods Xero 회사·Custom Connection App 보유 상태 (n8n 직접 호출 + Claude Code MCP 양쪽에서 사용)
metadata: 
  node_type: memory
  type: project
  originSessionId: 1095588e-1948-43dd-8dc3-3370909f18ab
---

Xero 본 운영 환경.

- **회사**: `Young Foods Pty Ltd` — 신규 Xero organisation 생성 (2026-05-28). 본 시스템이 인보이스 발행할 대상. 홈페이지 URL `https://go.xero.com/app/!0Y7V2/homepage`.
- **App name**: `claude-yflifecycle-v1` (Xero Custom Connection).
- **Client ID** (공개 OK): `3FD69845F1DA47A1A91B2A7D28D33EF2`
- **Tenant ID** (API 헤더 `Xero-tenant-id`에 박는 값, 공개 OK): `7888f054-c786-4c65-809e-4d5db2c01d4c`
- **Client Secret**: **별도 보관 (비밀번호 매니저)**. 채팅·파일·메모리·git에 평문 저장 금지. 1차 secret은 평문 전송돼 2026-05-28에 **rotate 완료**.
- **Scopes**: 현재 "전체" 부여. 우리 워크플로우 실사용 scope = `accounting.contacts` + `accounting.transactions` + `accounting.settings`. 운영 안정화 후 최소 권한으로 좁히는 게 좋음.
- **인증 방식**: OAuth2 **client credentials grant** — `POST https://identity.xero.com/connect/token`에 `grant_type=client_credentials` + `scope=…`. access_token TTL 30분. refresh_token 없음(client credentials 특성).
- **MCP 설치 상태**: **설치 완료** (2026-05-28, [[mcp-setup]] 참조). 같은 Custom Connection 키를 `@xeroapi/xero-mcp-server`에 주입 — Claude Code에서 `mcp__xero__*` 도구로 직접 조회/조작 가능. 운영 호출은 여전히 n8n이 담당, MCP는 디버깅·수동 조회·Item 등록 같은 1회성 액션용.

**Why:** Xero API 인증 방식이 정해져야 n8n 워크플로우 #2/#3/#2.5가 실제 호출 가능. Custom Connection은 가장 단순한 single-tenant 인증. Client Secret을 메모리에 남기지 않는 이유는 git 동기화·트랜스크립트 캐시 등 노출 경로가 다중이라 비밀번호 매니저 한 곳에만 두는 게 안전.

**How to apply:**
- n8n 워크플로우 설계 시 OAuth2 client credentials 패턴 가정. credential 이름 = `xero-custom-connection` (n8n credential ID `98R0oS6cSE9DtxYP`, generic type `oAuth2Api`). 워크플로우 HTTP Request 노드에서 이 credential 참조 + `Xero-tenant-id: 7888f054-c786-4c65-809e-4d5db2c01d4c` 헤더를 매 요청에 별도로 추가 (tenant ID는 OAuth2 credential에 포함 안 됨).
- Item 3개 등록 **완료** (2026-05-28): `KAT`/`GAR`/`TER`, sales price **$78 / $104 / $104** (GAR·TER는 1 box = 2 × 4kg bag = 8kg 반영), taxType `EXEMPTOUTPUT` (GST Free Income), accountCode `200` (Sales). Item ID = `eb8c66cd-…`(KAT) / `babcfa2f-…`(GAR) / `b7d4df18-…`(TER). description = 정식 영문명 + 박스 사이즈.
- n8n credential **생성됨** (2026-05-28, ID `98R0oS6cSE9DtxYP`). clientId / accessTokenUrl / scope / authentication=body / grantType=clientCredentials는 모두 채워짐. **clientSecret만 placeholder `REPLACE_IN_N8N_UI_FROM_PASSWORD_MANAGER`** — 사용자가 n8n UI에서 비밀번호 매니저의 실제 secret으로 직접 교체해야 워크플로우가 동작. 채팅·메모리에 평문 저장 금지 원칙 때문.
- 운영 액션 잔여: 사용자가 n8n UI에서 clientSecret 실제 값 입력.
