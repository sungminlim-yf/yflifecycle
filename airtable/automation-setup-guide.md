# Airtable Automation 설정 가이드

> **목적**: n8n 워크플로우 4건의 트리거를 Airtable Automation으로 연결. 사용자 손작업.
> **전제**: n8n 워크플로우 #2, #2.5, #5, #7b skeleton 빌드 완료. 본 가이드 작업 후 각 워크플로우를 Activate 토글 ON.
> **공통 패턴**: Airtable record 조건 변경 감지 → n8n webhook POST with `{record_id}` payload.

## 공통 단계 (모든 Automation 동일)

1. Airtable base `yflifecycle` (id `appag4IfzpTeQPS1X`) 열기
2. 상단 메뉴 **Automations** 클릭
3. **+ Create automation** → 이름 입력 (아래 각 섹션 참조)
4. **Trigger** 설정 (아래 각 섹션 참조)
5. **+ Add action** → **Send webhook** 선택
6. URL 입력 (아래 각 섹션 참조)
7. Method = `POST`, Headers = `Content-Type: application/json`
8. Body 입력 (모든 Automation 동일 형식):
   ```json
   {
     "record_id": "{{ trigger.Airtable record ID }}"
   }
   ```
   - `trigger.Airtable record ID`는 Airtable Automation의 dynamic token. UI에서 `+ Insert dynamic value` → trigger record → ID 선택.
9. **Test action** → n8n webhook 응답 확인 → 200이면 OK
10. **Turn on automation** 토글 ON

## Automation 1 — #2 dispatch → Xero invoice (DD/7-day)

**워크플로우**: `WF #2` (id `W1qYHJKHtPzKpbm4`)

**Trigger**: When record matches conditions
- Table: `오더` (`tbliaikQUIRawfMU7`)
- Conditions (모두 AND):
  - `출하 상태` = `출하완료`
  - `Payment term` is any of [`GoCardless DD`, `7-day credit`]
  - `Xero 인보이스 ID` is empty (멱등 — 이미 발행된 오더 재처리 방지)

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/dispatch-invoice-v1`

**테스트**: 출하 상태가 `출하완료`인 DD/7-day 주문 1건 골라 Xero 인보이스 ID 비우고 Test action.

---

## Automation 2 — #2.5 Prepay/COD → Xero invoice

**워크플로우**: `WF #2.5` (id `GuMEWpGQ4506RmHf`)

**Trigger**: When record created
- Table: `오더` (`tbliaikQUIRawfMU7`)
- Conditions (모두 AND, **created** trigger 후 filter):
  - `출하 상태` is any of [`접수`, `Hold`]
  - `Payment term` is any of [`Prepay`, `COD`]
  - `Xero 인보이스 ID` is empty

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/prepay-cod-invoice-v1`

**대안 Trigger** (record updated): Created가 너무 좁으면 "When record matches conditions" 사용 — 위 conditions에 부합하는 즉시 발화. 멱등은 `Xero 인보이스 ID is empty` 조건이 보장.

**테스트**: Prepay 또는 COD 주문 1건 새로 만들기 (또는 기존 주문의 인보이스 ID 비우기).

---

## Automation 3 — #5 고객 → HubSpot 재무 공유

**워크플로우**: `WF #5` (id `EM3FKoINCG3ytoNV`)

**Trigger**: When record updated
- Table: `고객` (`tbl1kAgO2ISkSS3O6`)
- Watched fields (any of 변경 시 발화):
  - `고객 Hold`
  - `hold reason`
  - `outstanding`

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/customer-finance-sync-v1`

**Note**: HubSpot 고객 ID가 비어있는 게스트는 #5 워크플로우가 silently skip. 한 번 발화될 때마다 HubSpot 1 API call (Company GET) + 변경 있으면 PATCH.

**테스트**: 임의 고객 1건의 `outstanding` 값을 임시 변경(예: 0 → 1) → Test action → 원복.

---

## Automation 4 — #7b 온보딩 승인 → propagate

**워크플로우**: `WF #7b` (id `pvvhhs5expWOfJce`)

**Trigger**: When record matches conditions
- Table: `Onboarding Submissions` (`tblWrkl7mDixzbpTK`)
- Conditions:
  - `status` = `approved`

**Body**:
```json
{
  "record_id": "{{ trigger.Airtable record ID }}",
  "submission_id": "{{ trigger.submission_id }}"
}
```
(both fields — #7b는 둘 다 받을 수 있음)

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/tally-approved-propagate-v1`

**테스트**: 기존 staging row의 status를 `under review` → `approved`로 바꾸기. #7b가 Xero Contact 생성·Airtable 고객 update·hold 오더 release·HubSpot Onboarding=approved sync·Soft match 검색까지 다 실행. **운영 시작 전 테스트 데이터 사용 권장**.

---

## (옵션) Automation 5 — #3 polling fallback 대체

#3 메인 트리거 = Xero webhook (INVOICE.UPDATE). Polling fallback은 별도 워크플로우 또는 Schedule trigger로 구현. Airtable Automation 불필요.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| 401 invalid_signature (#3 한정) | `XERO_WEBHOOK_KEY` env var 없음 | n8n 환경변수 설정. 없을 시 stub mode = 자동 통과. |
| 404 not found | n8n 워크플로우 inactive | n8n UI에서 워크플로우 Activate 토글 ON 후 다시 trigger. |
| 200이지만 status=aborted | Safety Check fail | n8n execution log 확인. skip_reason field 보고 데이터 정정 (예: payment_term mismatch, Xero ContactID 없음). |
| Airtable Automation이 발화 안 함 | 조건 mismatch 또는 trigger 빈도 한계 | Conditions 재확인. Airtable Free plan은 Automation 50/month 제한. |

---

## n8n 워크플로우 활성화 순서 (권장)

1. **#5** 먼저 활성화 (단순, side-effect 적음 — HubSpot Company 3-property PATCH만)
2. **#7b** (테스트 staging row 1건으로 검증 후)
3. **#2.5** (test 주문 1건 — Prepay/COD)
4. **#2** (test 주문 1건 — DD/7-day)
5. **#3** Xero webhook 등록 후 활성화

각 워크플로우 활성화 직후 1-2건 실 트리거 → n8n execution log 모니터링 권장.
