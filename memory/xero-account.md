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
- **Scopes**: ⚠️ 이 Custom Connection은 Xero **세분화 scope** 사용 — umbrella `accounting.transactions`는 **존재하지 않음**. 인보이스는 `accounting.invoices`를 써야 함. **n8n credential Scope 필드 정답 = `accounting.contacts accounting.invoices accounting.settings`** (공백 구분). `accounting.transactions` 넣으면 "scope invalid/malformed"로 토큰 발급 실패. (2026-05-30 확정, `_test_xero_credential`로 Items 반환 검증 완료)
- **인증 방식**: OAuth2 **client credentials grant** — `POST https://identity.xero.com/connect/token`에 `grant_type=client_credentials` + `scope=…`. access_token TTL 30분. refresh_token 없음(client credentials 특성).
- **MCP 설치 상태**: **설치 완료** (2026-05-28, [[mcp-setup]] 참조). 같은 Custom Connection 키를 `@xeroapi/xero-mcp-server`에 주입 — Claude Code에서 `mcp__xero__*` 도구로 직접 조회/조작 가능. 운영 호출은 여전히 n8n이 담당, MCP는 디버깅·수동 조회·Item 등록 같은 1회성 액션용.

**Why:** Xero API 인증 방식이 정해져야 n8n 워크플로우 #2/#3/#2.5가 실제 호출 가능. Custom Connection은 가장 단순한 single-tenant 인증. Client Secret을 메모리에 남기지 않는 이유는 git 동기화·트랜스크립트 캐시 등 노출 경로가 다중이라 비밀번호 매니저 한 곳에만 두는 게 안전.

**How to apply:**
- n8n 워크플로우 설계 시 OAuth2 client credentials 패턴 가정. credential 이름 = `xero-custom-connection` (n8n credential ID `98R0oS6cSE9DtxYP`, generic type `oAuth2Api`). 워크플로우 HTTP Request 노드에서 이 credential 참조 + `Xero-tenant-id: 7888f054-c786-4c65-809e-4d5db2c01d4c` 헤더를 매 요청에 별도로 추가 (tenant ID는 OAuth2 credential에 포함 안 됨).
- Item 3개 등록 **완료** (2026-05-28): `KAT`/`GAR`/`TER`, sales price **$78 / $104 / $104** (GAR·TER는 1 box = 2 × 4kg bag = 8kg 반영), taxType `EXEMPTOUTPUT` (GST Free Income), accountCode `200` (Sales). Item ID = `eb8c66cd-…`(KAT) / `babcfa2f-…`(GAR) / `b7d4df18-…`(TER). description = 정식 영문명 + 박스 사이즈.
- n8n credential ID `98R0oS6cSE9DtxYP`. **clientSecret 실제 값 입력 완료 + scope `accounting.contacts accounting.invoices accounting.settings`로 교정 → n8n→Xero 호출 검증 완료 (2026-05-30).** 
- ⚠️ **Xero HTTP 노드는 `Xero-tenant-id: 7888f054-c786-4c65-809e-4d5db2c01d4c` 헤더 필수** (credential엔 tenant 없음). #7b Xero Create Contact엔 추가 완료(2026-05-30). **#2·#2.5·#3·#3-poll의 Xero HTTP 노드엔 아직 미추가 → 가동 전 추가 필요.**
