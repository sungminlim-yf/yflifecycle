---
name: airtable-base
description: Young Foods 운영 Airtable base = yflifecycle (id appag4IfzpTeQPS1X). HubSpot portal/지역/통화도 같이 메모
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5969740d-81ca-4ecf-b918-ea062d154955
---

## Airtable base

- **base 이름**: `yflifecycle`
- **base ID**: `appag4IfzpTeQPS1X`
- **권한**: create
- 다른 base들(`young foods`·`youngfoodsnew`·`Sushi Ari`)은 이 프로젝트의 운영 source가 아님 — 작업할 때 base ID 헷갈리지 말 것

### 테이블 ID (2026-05-28 생성)

| 테이블 | tableId | 주요 link |
| --- | --- | --- |
| 고객 | `tbl1kAgO2ISkSS3O6` | — |
| 제품 | `tblaFB9HuIuocCV9s` | — |
| 오더 | `tbliaikQUIRawfMU7` | → 고객 |
| 라인아이템 | `tblVXVQzT1q8U0HJQ` | → 오더, → 제품 |
| Production Schedule | `tblaEhgO4A20iFIge` | → 제품 |
| Production Plan | `tblnDrv6ssyDgNufF` | → 제품 |
| Onboarding Submissions | `tblWrkl7mDixzbpTK` | → 고객 |
| SMS Log | `tbljXGJsa4Wa7PCA6` | → 오더, → 고객 |

> 스키마 출처: `airtable/schema.md` (2026-05-29부터 base/tableId 인라인 포함, 섹션 헤딩에도 박힘). `n8n/CLAUDE.md` "외부 리소스 ID 참조" 섹션에도 동일 표 + n8n credential ID 함께 정리. 이 메모리는 새 PC/세션 첫 진입 시 빠른 lookup용.

### MCP 한계로 UI 수동 작업 필요한 항목

- **Production Plan**: `production_qty` lookup ← Production Schedule (sku+date 매칭), `target_stock`·`safety_stock` lookup ← 제품, `dispatch_forecast` formula (default_dispatch_per_day lookup 후 추가), `stock_close` formula 교체 (현재 단순 버전)
- **Production Schedule**: `sku` 필드를 single record link로 convert (하루 1 SKU 제약)
- **(옵션)** 주문번호·sms_id를 autonumber로 convert (n8n이 텍스트로 쓸 수 있어 필수 X)
- **Table 1** (default Airtable template) 삭제 — MCP에 delete_table 없음

## HubSpot portal

- **portal ID**: `443192961` (host `app-ap1.hubspot.com`, region ap1)
- **currency**: AUD (2026-05-28 USD에서 변경됨)
- timezone은 여전히 US/Eastern일 수 있음 — 영업 일자 표시에 차이 가능, 필요 시 별도 결정

## 관련 메모

- 진행도: [[yf-design-progress]]
- Xero 회사: [[xero-account]]
