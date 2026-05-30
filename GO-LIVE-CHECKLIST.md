# Young Foods 주문 시스템 — 가동(Go-Live) 체크리스트

> **목적**: 설계·빌드는 끝났고, **사용자가 직접 해야 하는 UI 작업(B트랙)**을 가동 순서대로 정리. 각 항목을 위→아래로 처리하면 실제 런칭이 된다.
> **마지막 갱신**: 2026-05-30
> **전제**: n8n 워크플로우 #0~#7b skeleton 빌드 완료. 상세 트리거 설정은 `airtable/automation-setup-guide.md` 참조.
> **표기**: `[ ]` = 미완 / `[x]` = 완료 / ⏳ = 추후(의존성 대기)

---

## 현재 상태 스냅샷 (2026-05-30)

| 워크플로우 | id | 노드 | 상태 | 트리거 |
| --- | --- | --- | --- | --- |
| #0 HubSpot Company → Airtable + 토큰 | `lNABcJuKPABoqQf0` | 6 | ✅ **active** (5min cron) | Schedule polling |
| #1 주문 제출 → Airtable | `twZw1wv3Fc1iJdeO` | 25 | ⬜ inactive | webhook `yf-order-intake-v1` (header auth) |
| #2 dispatch → Xero (DD/7-day) | `W1qYHJKHtPzKpbm4` | 14 | ⬜ inactive | webhook `dispatch-invoice-v1` (Airtable Automation) |
| #2.5 Prepay/COD → Xero | `GuMEWpGQ4506RmHf` | 14 | ⬜ inactive | webhook `prepay-cod-invoice-v1` (Airtable Automation) |
| #3 Xero → Airtable 결제·Hold | `YqkAw7AJKw5uPBpv` | 18 | ⬜ inactive | webhook `xero-invoice-update-v1` (Xero) |
| #3-poll 폴링 폴백 | `atQNwPt7B3QUBLBi` | 5 | ⬜ inactive | Schedule `5 * * * *` |
| #5 고객 → HubSpot 재무 공유 | `EM3FKoINCG3ytoNV` | 11 | ⬜ inactive | webhook `customer-finance-sync-v1` (Airtable Automation) |
| #7a Tally → Airtable staging | `ylRJHUCFQ9RmCa6R` | 25 | ⬜ inactive | webhook `tally-onboarding-intake-v1` (Tally) |
| #7b 승인 → Xero/Airtable propagate | `pvvhhs5expWOfJce` | 26 | ⬜ inactive | webhook `tally-approved-propagate-v1` (Airtable Automation) |
| #6a/#6b SMS | — | — | ⏳ **미빌드** | ClickSend 알파태그 승인 후 |
| #8 DD redirect handler | — | — | ⏳ **미빌드** | GoCardless credential 후 |

- n8n 인스턴스: `https://youngfoods.app.n8n.cloud` → webhook 전체 URL = `https://youngfoods.app.n8n.cloud/webhook/<path>`
- 무관한 기존 워크플로우(`_test_xero_credential`, `Platter Order Intake` 등 active)는 이 시스템과 별개 — 나중에 정리.

---

## Phase 0 — 사전 점검 (언제든 먼저, 의존성 없음)

- [ ] **0-1. HubSpot Private App scope 확인** — `Settings → Integrations → Private Apps → (companies read App)`
  - `crm.objects.companies.write` (✅ #0 가동 시 추가됨)
  - **`crm.objects.contacts.write`** ← #7b의 "Log Email to HubSpot"(email engagement 생성)에 필요할 수 있음. 없으면 추가.
- [ ] **0-2. Gmail 발신 주소 = `hello@youngfoods.com.au`로 재인증** — n8n credential `Gmail OAuth2 API` (`SycEHwXNU8mv9tYf`)를 **hello@ 계정으로 Reconnect**. 이 credential은 **#6c(분실복구)·#7b(환영) 둘 다 공유** → 한 번 재인증하면 둘 다 hello@ 발신. Gmail 노드는 From 입력 없음(인증 계정=발신 주소). OAuth 동의화면이 "테스트" 모드면 hello@를 테스트 사용자로 추가. _(2026-05-31 결정: 둘 다 hello@ 통일.)_
- [ ] **0-3. Xero Branding theme 회사 계좌** — Xero `Settings → Invoice settings → Branding theme` footer/payment instructions에 **BSB·계좌번호** 입력. #2.5(Prepay/COD) 인보이스 PDF에 자동 노출 (manual bank transfer 안내).
- [ ] **0-4. Xero Item Code 3종 확인** — `KAT`/`GAR`/`TER` 등록됨 (✅ 완료). 변동 없으면 skip.

---

## Phase 1 — Airtable Automation 4건 설정

> 상세 단계는 **`airtable/automation-setup-guide.md`**. 공통 패턴: record 조건 변경 → n8n webhook POST `{record_id}`.

- [ ] **1-1. #5 트리거** — 고객 테이블 `{고객 Hold, hold reason, outstanding}` 변경 → `customer-finance-sync-v1`
- [ ] **1-2. #7b 트리거** — `Onboarding Submissions.status = approved` → `tally-approved-propagate-v1` (body에 `submission_id`도)
- [ ] **1-3. #2.5 트리거** — 오더 생성 + `출하 상태 ∈ {접수, Hold}` AND `Payment term ∈ {Prepay, COD}` AND `Xero 인보이스 ID` empty → `prepay-cod-invoice-v1`
- [ ] **1-4. #2 트리거** — 오더 `출하 상태 = 출하완료` AND `Payment term ∈ {GoCardless DD, 7-day credit}` AND `Xero 인보이스 ID` empty → `dispatch-invoice-v1`

> ⚠️ 각 Automation은 만들되 **n8n 워크플로우가 inactive면 404**가 정상 — Phase 3에서 Activate 후 동작. Test action은 Phase 3 이후 권장.

---

## Phase 2 — 외부 시스템 webhook 등록

- [ ] **2-1. Tally webhook** — Tally 폼 `Me75K8 → Integrations → Webhooks`
  - URL: `https://youngfoods.app.n8n.cloud/webhook/tally-onboarding-intake-v1`
  - **signing secret 발급** → (다음 iter) #7a HMAC 검증 노드 추가 시 n8n credential `tally-webhook-secret`에 등록. 지금은 미설정이어도 #7a 동작(HMAC 미구현).
- [ ] **2-2. Xero INVOICE.UPDATE webhook** — Xero developer console (`developer.xero.com → My Apps → Webhooks`)
  - URL: `https://youngfoods.app.n8n.cloud/webhook/xero-invoice-update-v1`
  - **signing key 발급** → n8n 환경변수 **`XERO_WEBHOOK_KEY`** 설정 (Settings → Variables 또는 인스턴스 env).
  - ⚠️ Xero "Intent to Receive" 검증: webhook 등록 시 Xero가 즉시 핑을 보냄 → #3이 **active**여야 200 응답 (Phase 3에서 #3 켠 직후 등록 권장).
  - env 미설정 시 #3은 stub mode(자동 통과)로 동작 — 테스트엔 OK, 운영은 키 설정 권장.

---

## Phase 3 — 워크플로우 Activate (순서 중요)

> 각 워크플로우 n8n UI에서 Activate 토글 ON. side-effect 적은 것부터.

- [ ] **3-1. #5** Activate → Phase 1-1 Automation Test action (고객 `outstanding` 임시 변경 → 원복). HubSpot Company 3-property 반영 확인.
- [ ] **3-2. #7a** Activate → Tally 폼에 `?hubspot_id=<test>&email_prefill=foo@bar.com` prefill 후 제출 → Airtable `Onboarding Submissions` staging 행 + Slack `#ops-onboarding` 알림 확인.
- [ ] **3-3. #7b** Activate → 테스트 staging 행 `status = approved`로 변경 → Xero Contact 생성·Airtable 고객 update·hold 오더 release·HubSpot `onboarding=approved`·**환영 이메일 발송 + HubSpot 타임라인 email engagement** 확인. (⚠️ 실 고객 아닌 테스트 데이터로)
- [ ] **3-4. #2.5** Activate → Prepay/COD 테스트 주문 1건 → Xero invoice 발행 + 오더 Hold ON 확인.
- [ ] **3-5. #2** Activate → DD/7-day 테스트 주문 `출하 상태 = 출하완료` → Xero invoice 발행 + PDF 이메일 확인.
- [ ] **3-6. #3** Activate → (Phase 2-2 Xero webhook 등록) → 테스트 인보이스 결제 처리 → Airtable 오더 `결제 상태=Paid`·hold 해제·고객 outstanding 재계산 확인.
- [ ] **3-7. #3-poll** Activate → 매시간 :05 자동 실행. 수동 "Execute Workflow"로 1회 검증 (변경 인보이스 0건이면 0 처리 정상). #3이 active여야 재투입 성공.

---

## Phase 4 — 주문 사이트 연결 (#1)

- [ ] **4-1. #1** Activate.
- [ ] **4-2. 주문 사이트에 webhook 박기**
  - URL: `https://youngfoods.app.n8n.cloud/webhook/yf-order-intake-v1`
  - 인증: **header auth**, n8n credential `order-intake-token` (`dY4EiGLUEsseUd4h`)의 헤더명/값을 주문 사이트 요청 헤더에 설정.
  - payload: `{ mode, client_idempotency_key(UUID v4), lines:[{sku, quantity_boxes}], requested_delivery_date, ... }` (상세 `n8n/CLAUDE.md` 워크플로우 #1).
- [ ] **4-3. 컷오프 실측** — 배송 전날 12pm Sydney 경계로 주문 테스트 (DST 정확성 — AEST/AEDT 둘 다 확인하면 베스트).
- [ ] **4-4. MOQ 실측** — subtotal < $150 주문 → `422 below_moq` 응답 확인.

---

## Phase 5 — 추후 unlock (의존성 대기)

- [ ] ⏳ **5-1. ClickSend 알파태그 `YoungFoods` 승인 확인** (~2026-05-30) → 승인 후 **#6a/#6b 빌드** (SMS 주문확인·분실복구). credential `clicksend-creds`(`WZGjzqhfPeU4PL4i`) 이미 등록됨.
- [ ] ⏳ **5-2. GoCardless 계정 + API key** → n8n credential `gocardless-api-key` 등록 → **#8 DD redirect handler 빌드** + Tally `Me75K8` redirectOnCompletionUrl 설정.
- [ ] ⏳ **5-3. (옵션) #1 SMS 연동** — #6a 빌드 후 #1의 SMS sub-workflow 호출 노드 추가.

---

## 정리 작업 (가동과 무관, 틈날 때)

- [ ] **HubSpot 테스트 Company `266741551606` archive** (#0 테스트 데이터, MCP delete 미지원 → UI에서).
- [ ] **n8n 레거시 워크플로우 정리** — `_test_xero_credential`, `Platter Order Intake`, archived 다수. 이 시스템과 무관, deactivate/삭제 검토.
- [ ] **Airtable UI 잔여 작업** — Production Plan/Schedule lookup convert, `Table 1` 삭제 등 (`memory/airtable-base.md` 참조).

---

## 빠른 레퍼런스

**webhook URL** (base `https://youngfoods.app.n8n.cloud/webhook/`)
`yf-order-intake-v1`(#1) · `dispatch-invoice-v1`(#2) · `prepay-cod-invoice-v1`(#2.5) · `xero-invoice-update-v1`(#3) · `customer-finance-sync-v1`(#5) · `tally-onboarding-intake-v1`(#7a) · `tally-approved-propagate-v1`(#7b)

**n8n credentials** (상세 `n8n/CLAUDE.md`): Airtable `B2hRHQungck3WMoE` · Xero `98R0oS6cSE9DtxYP` · HubSpot `o9u31xvDKlsBJcZO` · Slack `NAh6hd7VFXGqksqK` · Gmail `SycEHwXNU8mv9tYf` · ClickSend `WZGjzqhfPeU4PL4i` · 주문토큰 `dY4EiGLUEsseUd4h`

**Slack ops 채널**: `#ops-orders`(C0B3WQ6EPQW) · `#ops-onboarding`(C0B42FWL8VA) · `#ops-accounts` 등 (`n8n/CLAUDE.md` 매핑표)

**환경변수**: `XERO_WEBHOOK_KEY`(#3 HMAC) · `ORDER_SITE_BASE_URL`(#7b 매직링크, 미설정 시 `https://order.youngfoods.com.au`) · (옵션)`XERO_TENANT_ID`(#3-poll)
