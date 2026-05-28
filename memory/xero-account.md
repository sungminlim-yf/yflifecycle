---
name: xero-account
description: Young Foods Xero 회사·Custom Connection App 보유 상태 (n8n 직접 호출용)
metadata: 
  node_type: memory
  type: project
  originSessionId: 1095588e-1948-43dd-8dc3-3370909f18ab
---

Xero 본 운영 환경.

- **회사**: `Young Foods Pty Ltd` — 신규 Xero organisation 생성 (2026-05-28). 본 시스템이 인보이스 발행할 대상.
- **인증**: **Custom Connection App** 생성, client_id/secret(=key) 확보. OAuth2 **client credentials grant**로 사용자 대화 없이 직접 호출 가능 (single-tenant 전용).
- **다음 단계**: n8n 자격증명에 Custom Connection 키 등록 → 워크플로우 #2 발행 노드가 그대로 동작. 키 자체는 user가 안전한 곳에 별도 보관 중.
- **Xero Item 등록 작업**: 3개 SKU를 Xero Items에 만들어야 함. Code = `KAT`/`GAR`/`TER`, Sales price = $78/$52/$52, TaxType = `EXEMPTOUTPUT`(GST Free Income). 등록 후 n8n #2가 ItemCode 참조.

**Why:** Xero API 인증 방식이 정해져야 n8n 워크플로우 #2(인보이스 발행)·#3(결제 동기화)이 실제 호출 가능. Custom Connection은 가장 단순한 single-tenant 인증.
**How to apply:** n8n 워크플로우 설계할 때 OAuth2 client credentials 패턴 가정. Xero MCP는 아직 설치 안 됨([[mcp-setup]]) — 워크플로우 자체에서 직접 REST 호출.
