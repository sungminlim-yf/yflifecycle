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
   - ⚠️ Airtable AI/auto-builder가 트리거만 만들고 "Send webhook 액션은 자동 생성 불가"라고 하면 → 액션은 **직접 추가**해야 함. Send webhook 액션이 플랜에 없으면 **옵션 B(Run a script)** 사용.
6. URL 입력 (아래 각 섹션 참조)
7. Method = `POST`, Headers = `Content-Type: application/json`
8. Body 입력 (모든 Automation 동일 형식):
   ```json
   {
     "record_id": "{{ trigger.Airtable record ID }}"
   }
   ```
   - `trigger.Airtable record ID`는 Airtable Automation의 dynamic token. UI에서 `+ Insert dynamic value` → trigger record → ID 선택.

### 옵션 B — Run a script (Send webhook 액션이 없을 때, 모든 플랜 가능)

**+ Add action → Run a script** → 우측 **Input variables**에 필요한 필드 추가(예: `submission_id` 또는 `record_id` = trigger record의 해당 필드) → 스크립트:
```js
let cfg = input.config();
const res = await fetch("https://youngfoods.app.n8n.cloud/webhook/<path>", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(cfg),   // cfg = { submission_id } 또는 { record_id }
});
console.log(res.status, await res.text());
```
`<path>`는 각 섹션의 webhook path. Test 시 200 + n8n 응답 JSON 확인.
9. **Test action** → n8n webhook 응답 확인 → 200이면 OK
10. **Turn on automation** 토글 ON

## Automation 1 — #2 dispatch → Xero invoice (DD/7-day)

**워크플로우**: `WF #2` (id `W1qYHJKHtPzKpbm4`)

**Trigger**: When record matches conditions
- Table: `오더` (`tbliaikQUIRawfMU7`)
- Conditions (모두 AND):
  - `오더 상태` = `출하완료`  _(2026-05-31: `출하 상태`→`오더 상태` 리네임)_
  - `Payment term` is any of [`Direct Debit (default)`, `Credit - 7 days`]  _(2026-05-30: payment term 3종 확정. 옛 `GoCardless DD`/`7-day credit` 폐기)_
  - `Xero 인보이스 ID` is empty (멱등 — 이미 발행된 오더 재처리 방지)

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/dispatch-invoice-v1`

**테스트**: 오더 상태가 `출하완료`인 DD/Credit-7days 주문 1건 골라 Xero 인보이스 ID 비우고 Test action. (#2 Safety Checks가 `오더 상태='출하완료'` + payment ∈ {Direct Debit (default), Credit - 7 days} 재확인 — 트리거와 정합)

---

## Automation 2 — #2.5 Prepay/COD → Xero invoice

**워크플로우**: `WF #2.5` (id `GuMEWpGQ4506RmHf`)

**Trigger**: When record matches conditions (권장 — created보다 견고, COD로 편집된 기존 오더도 포착)
- Table: `오더` (`tbliaikQUIRawfMU7`)
- Conditions (모두 AND):
  - `오더 상태` = `접수`  _(2026-05-31: `출하 상태`→`오더 상태` 리네임 + `Hold` 옵션 폐기. COD 오더는 #1이 생성 시 `오더 상태=접수` + `오더 Hold=true`로 만듦)_
  - `Payment term` = `COD`  _(2026-05-30: Prepay 폐기, COD only. #2.5 Safety Checks `validPayment=['COD']`와 정합)_
  - `Xero 인보이스 ID` is empty (멱등)

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/prepay-cod-invoice-v1`

**테스트**: COD 주문 1건 새로 만들기 (또는 기존 COD 주문의 인보이스 ID 비우기). #2.5가 인보이스 발행 + `오더 Hold=true` + `결제 상태=미결제` set → 입금 확인 시 #3가 hold 해제.

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
  - `form status` = `approved`  _(2026-05-31: `status` 필드 → `form status`로 rename됨)_

**Body**:
```json
{
  "record_id": "{{ trigger.Airtable record ID }}",
  "submission_id": "{{ trigger.submission_id }}"
}
```
(both fields — #7b는 둘 다 받을 수 있음)

**Webhook URL**: `https://youngfoods.app.n8n.cloud/webhook/tally-approved-propagate-v1`

**테스트**: 기존 staging row의 `form status`를 `form submitted` → `approved`로 바꾸기. #7b가 Xero Contact 생성·Airtable 고객 update·hold 오더 release·HubSpot Onboarding=approved sync·Soft match 검색까지 다 실행. **운영 시작 전 테스트 데이터 사용 권장**.

---

## Automation 6 — #7c form status → HubSpot onboarding 동기 (2026-05-31 신설)

**워크플로우**: `WF #7c` (id `HyAA29msWiAHIxkz`, active)

**역할**: 고객 table `Onboarding Status`를 사람이 직접 안 건드리고 HubSpot에서만 흐르게 하는 모델(v3)의 핵심. admin이 Airtable Submissions `form status`를 바꾸면 → HubSpot `onboarding` PATCH → #8(폴링)이 고객 table로 미러. 특히 `pending information` 경로를 메움 (`form submitted`=#7a 자동, `approved`=#7b가 별도 처리하지만 #7c가 HubSpot 동기를 일원화/재확인).

**Trigger**: When record updated
- Table: `Onboarding Submissions` (`tblWrkl7mDixzbpTK`)
- Watch fields: `form status` (이 필드만)

**Action**: Send webhook
- URL: `https://youngfoods.app.n8n.cloud/webhook/onboarding-formstatus-sync-v1`
- Method `POST`, Header `Content-Type: application/json`
- Body:
  ```json
  { "submission_id": "{{ trigger.submission_id }}" }
  ```

**응답**: `{status:"synced", onboarding:"<form status값>"}` (company id 있고 valid값일 때) / `{status:"skipped", skip_reason:...}` (게스트·미지원 값).

**테스트**: staging row의 `form status`를 `pending information`으로 변경 → HubSpot Company `onboarding=pending information` 반영 확인 → 10분 내 #8이 고객 table `Onboarding Status` 미러.

> ⚠️ `approved`로 바꾸면 이 #7c와 #4(#7b)가 **둘 다** 발화 (#7c=HubSpot onboarding 동기 / #7b=전체 propagate). 둘 다 멱등이라 충돌 없음.

---

## Automation 7 — #11 account contact → Xero Contact sync (2026-05-31 신설)

**워크플로우**: `WF #11` (id `E0qUVBH6MilEbJ6d`, active)

**역할**: 고객 table의 **회계 담당자 정보**(회계 담당자 First/Last Name·회계 이메일)가 바뀌면 → Xero Contact의 FirstName/LastName/EmailAddress를 갱신. 인보이스가 항상 올바른 회계 이메일로 가도록 유지. (account contact SoT = Airtable, Xero는 따라옴)

**Trigger**: When record updated
- Table: `고객` (`tbl1kAgO2ISkSS3O6`)
- Watch fields: `회계 담당자 First Name`, `회계 담당자 Last Name`, `회계 이메일` (셋 중 하나 변경 시 발화)

**Action**: Send webhook (또는 옵션 B Run a script)
- URL: `https://youngfoods.app.n8n.cloud/webhook/account-contact-xero-sync-v1`
- Method `POST`, Header `Content-Type: application/json`
- Body: `{ "record_id": "{{ trigger.Airtable record ID }}" }`

**응답**: `{status:"synced"}` (Xero ContactID 있을 때) / `{status:"aborted", skip_reason:"no_xero_contact"}` (아직 Xero Contact 없음 = 온보딩 미완 고객, skip 정상).

**테스트**: 온보딩 완료된(Xero ContactID 보유) 고객 1건의 `회계 이메일`을 임시 변경 → Test → Xero Contact 이메일 반영 확인 → 원복.

---

## #10 (main contact mismatch alert) — Airtable Automation 불필요

#10(`fWVioW3ib89TOens`)은 **#R2(셀프 수정)·#7b(온보딩 승인)가 fire-and-forget로 직접 호출**한다. Airtable Automation 설정 없음. 단, 가동 전 사용자 손작업 3건:
1. HubSpot Private App에 scope 추가: `crm.objects.contacts.read` + `crm.objects.owners.read` (primary contact·owner 조회용).
2. Slack credential에 `users:read.email` scope (owner email→Slack ID @-mention용). 없으면 @-mention 대신 이름만 표기(degraded, 알림은 정상).
3. n8n Slack account가 `#ops-mismatch`(`C0B76NKUC3Y`) 채널 멤버인지 확인 (user account token이면 그 사용자가 채널 멤버면 OK).

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
