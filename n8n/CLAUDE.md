# n8n — 워크플로우 / 시스템 연동

> **도메인**: 시스템 간 데이터가 **어떻게 오가는지** — 트리거·노드·동기화·예외 알림의 소유자.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 데이터 스키마는 `../airtable/`, 결제 규칙은 `../xero/`, 진입/승격은 `../onboarding/`
> **MCP**: n8n MCP 연결됨 (워크플로우 생성·검증 가능)

---

## 이 폴더가 다루는 것

각 폴더가 "무엇을/어떤 규칙으로"를 소유한다면, n8n은 **"어떻게 연결하고 흐르게 하는가"**를 소유한다. 트리거 설계, 노드 구성, webhook/폴링, 예외 알림 워크플로우가 여기 모인다.

> **구현 방식**: n8n으로 새로 구성 예정. 세부 미결 — 아래 흐름을 워크플로우로 설계해 나간다.

---

## 전체 연동 지점 (flow 현황)

| 출발 | 도착 | 내용 | 트리거(안) |
| --- | --- | --- | --- |
| 주문 사이트 | Airtable | 주문 제출 → 오더 + 라인아이템 행 생성 (서버 가격 산출 + MOQ $150 검증) | 폼/웹훅 |
| Airtable | Xero | **dispatch 시** 인보이스 생성 (DD / 7-day) | dispatch 상태 변경 (#2) |
| Airtable | Xero | **주문 직후** 인보이스 생성 (Prepay / COD) + 오더 hold ON | 오더 생성 + payment term 필터 (#2.5) |
| Xero | Airtable | 인보이스 Paid → 결제 Paid + Hold 해제 / 고객 hold·hold reason·outstanding 동기화 | Xero webhook + 폴링 폴백 |
| GoCardless | Xero | DD 수금 결과 자동 반영·대사 | (Xero 네이티브, n8n 불필요) |
| HubSpot/Xero | Airtable | 신규 고객 → ID 매핑·토큰 발급 (승격 시) | 온보딩 완료 |
| Airtable | HubSpot | 영업용 재무 상태 공유 (hold/overdue/outstanding) | Airtable 변경 |
| Airtable | 영업(Slack) | 미배정·소급 매칭·중복·취소·QR 추천 알림 | Airtable 자동화/n8n |
| 주문 사이트 | 문자 발송 서비스 | 분실 복구 링크 문자, 주문 확인 문자 | 주문/재발급 이벤트 |

---

## 설계할 핵심 워크플로우

### 1. 주문 제출 → Airtable ✅ 설계 완료
- 상세는 아래 "워크플로우 #1 상세" 섹션 참조.
- 핵심: webhook 직행, 통합 endpoint(mode 분기), 서버 가격 산출, **MOQ $150 검증**(할인 전 subtotal), UUID 멱등키, 같은 배송일+동일 sku 조합 = 중복 의심.

### 2. dispatch → Xero 인보이스 생성 ✅ 설계 완료
- 상세는 아래 "워크플로우 #2 상세" 섹션.
- **scope**: DD / 7-day credit 한정. 선결제·COD는 #2.5(주문 직후) 별도.

### 2.5. 선결제·COD 주문 → Xero 인보이스 생성 ✅ 설계 완료 (2026-05-28)
- 상세는 아래 "워크플로우 #2.5 상세" 섹션.
- **scope**: Prepay / COD 한정. Airtable 오더 생성 trigger + payment term 필터. 인보이스 발행 + 오더 hold ON → #3가 결제 감지 시 hold 해제.
- 결제 채널: Manual bank transfer (Xero PDF에 회사 계좌 명시) — `../xero/CLAUDE.md`.

### 3. Xero → Airtable 결제·Hold 동기화 ✅ 설계 완료
- 상세는 아래 "워크플로우 #3 상세" 섹션.
- 핵심: INVOICE.UPDATE webhook + 매시간 polling 폴백, 결제 상태 + 오더 Hold 동기화, 고객 hold 산출(outstanding ≥ credit_limit OR overdue ≥ 1).

### 4. credit limit 비교 → **#3에 통합** (2026-05-28)
- Xero는 credit limit 초과를 push로 주지 않음 → 별도 워크플로우 분리하지 않고, **#3 처리 중 매번 outstanding 합계를 재계산해 credit_limit·overdue와 비교**해 고객 hold 산출. 단일 워크플로우 관리.

### 5. 재무 상태 → HubSpot 공유 ✅ 설계 완료 (2026-05-28)
- 상세는 아래 "워크플로우 #5 상세".
- **scope**: Airtable 고객 테이블의 `고객 hold` / `hold_reason` / `outstanding` 3개 필드 변화를 HubSpot Company의 3개 property로 동기. #3가 Airtable에 commit한 직후 자연 발화.
- **신설 필수**: HubSpot Company custom property `Hold Reason` (text) + `Outstanding (AUD)` (currency). `Account Hold`는 기존.

### 6. 주문 확인·분실 복구 SMS ✅ 설계 완료 (2026-05-28)
- 상세는 아래 "워크플로우 #6a/#6b 상세".
- **#6a (주문 확인 sub-workflow)**: #1이 fire-and-forget 호출. 호 1건 = SMS 1건. 멱등은 `order_no` 기준.
- **#6b (분실 복구 webhook)**: order-site 글로벌 페이지 호출. 등록된 번호로만 발송, enumeration 차단(동일 응답), rate limit(시간당 3회·일 10회/번호), 재요청 ≥2 → QR 추천 플래그.
- **신설 필수**: Airtable `SMS Log` 테이블, ClickSend credential `clicksend-creds`(Basic auth).

### 7. 온보딩 폼 제출 → HubSpot/Xero/Airtable propagate ✅ 설계 완료 (2026-05-28)
- 상세는 아래 "워크플로우 #7a/#7b 상세" 섹션.
- **#7a (Tally webhook → intake)**: 매칭(ID→email→none) + forward 가드 + Airtable staging 행 생성 + HubSpot Onboarding=form submitted + Slack
- **#7b (HubSpot `Onboarding=approved` → propagate)**: Xero Contact 생성 + Airtable 고객 행 생성 + 토큰 발급 + 미배정 주문 소급매칭 + 환영 이메일
- **신설 필수**: Airtable `Onboarding Submissions` 테이블 + HubSpot Company custom property `Customer Group` (single select: 내부고객/일반고객)

---

---

## 워크플로우 #1 상세: 주문 제출 → Airtable

### 트리거
- **n8n webhook** (HTTPS POST). 주문 사이트가 직행 호출.
- **단일 endpoint**, payload의 `mode` 필드로 매직링크/게스트 분기.

### Payload 구조

공통:
- `mode`: `"magic_link" | "guest"`
- `client_idempotency_key`: UUID v4 (클라이언트 생성, 필수)
- `lines`: `[{ sku, quantity_boxes }]` — **가격은 보내지 않음, 서버가 제품 테이블에서 lookup**
- `delivery_override_address?`: string (이번 주문만 다른 배송지)
- `note?`: string
- `requested_delivery_date`: ISO date (컷오프 기준 검증 대상)

`magic_link` 한정:
- `token`: 매직 링크 토큰

`guest` 한정:
- `store_name`, `contact_phone`, `contact_email?`, `delivery_address`, `contact_name?`

### 노드 흐름

1. **Webhook 수신** → JSON 파싱
2. **입력 검증**: 필수 필드, `lines.length ≥ 1`, `requested_delivery_date`가 컷오프(배송 전날 12pm) 이전인지
3. **멱등 dedupe lookup**: Airtable 오더 테이블에 `client_idempotency_key`가 이미 있으면 → 기존 오더 응답 후 종료
4. **mode 분기**:
   - `magic_link`: 토큰으로 Airtable 고객 lookup → 고객 ID 확정. 유효 X → `401`/`410`
   - `guest`: 고객 미배정 (Airtable 오더 행에 고객 link 비움)
5. **가격 산출**: 각 line의 sku로 제품 테이블 lookup → 박스 단가 × `quantity_boxes` → line subtotal
6. **MOQ 검증**: Σ(line subtotal) **(할인 적용 전)** < `AUD 150` → `422 below_moq` + `{minimum: 150, current: <subtotal>}` 응답 후 종료. 사이트 인라인 안내용.
7. **중복 의심 체크**: 같은 고객(또는 게스트면 `store_name + contact_phone`) + 같은 `requested_delivery_date` + sku 조합 일치(수량 무관)? → Slack `#ops-orders` 알림. 새 오더는 정상 저장 (블로킹 X).
8. **오더 행 생성** (Airtable): 주문번호 Auto number, 멱등키, 고객/게스트 정보, 배송지 3필드, payment term lookup, 출하 상태 = `접수`
9. **라인아이템 행 생성** (Airtable): line별 행 — sku link, quantity_boxes, 박스 단가, subtotal
10. **게스트 분기 → Slack 알림** (`#ops-orders`, 영업 액션 대기 — `../onboarding/` 승격 큐)
11. **SMS sub-workflow 호출** (fire-and-forget, 워크플로우 #6a): 주문번호·예상 배송일·매직링크
12. **응답 반환** (200)

> **후속 자동 처리** (#1 응답 후 비동기 — sub-call 아닌 Airtable trigger): payment term이 `Prepay`/`COD`면 #2.5가 즉시 인보이스 발행 + 오더 hold ON. DD/7-day는 dispatch 시 #2가 발행. #1은 알 필요 없음 (각 워크플로우가 자기 trigger로 자기 책임).

### 응답 형식 (200)

```json
{
  "order_no": "ORD-1001",
  "status": "received",
  "requested_delivery_date": "2026-06-03",
  "subtotal": 312.50,
  "delivery_fee_preview": 0,
  "lines": [
    { "sku": "KATSNCP1P2MKBRBKV1", "quantity_boxes": 4, "unit_price": 78, "line_subtotal": 312 }
  ]
}
```

> `delivery_fee_preview`는 참고값(할인 전 subtotal 기준). 최종 청구는 dispatch 시 워크플로우 #2가 인보이스에 반영 (`../xero/`).

### 멱등성

- `client_idempotency_key`는 Airtable 오더 테이블의 **unique** field. 동일 키 재요청 시 step 3에서 기존 응답 재현.
- 키 보존: 오더 행과 함께 영구 — 무한 dedupe.

### 중복 주문 의심 (D 결정)

- **기준**: 같은 고객 + 같은 `requested_delivery_date` + sku 조합 일치 (수량 무관).
- **동작**: Slack `#ops-orders` 알림. 새 오더는 정상 저장. admin이 둘 다 진행할지 하나 취소할지 판단.

### 에러 처리

| 에러 | 상태 | 동작 |
| --- | --- | --- |
| 검증 실패 | 4xx + code | 클라이언트가 표시 |
| 토큰 무효 | 401/410 | "링크 재발급 안내" 응답 |
| 컷오프 초과 | 422 `cutoff_exceeded` | 다음 가능일 안내 |
| **MOQ 미달** | **422 `below_moq`** | 사이트가 "최소 주문 금액 $150" 인라인 안내 |
| Airtable API 5xx | n8n 자동 재시도 | 멱등키 덕에 안전 |
| SMS 실패 | non-blocking | 주문은 성공, SMS 워크플로우 자체에서 재시도/로깅 |
| 그 외 catastrophic | 500 + Slack `#ops-orders` | admin 확인 |

---

## 워크플로우 #2 상세: dispatch → Xero 인보이스 생성

> **scope**: payment term이 `GoCardless DD` 또는 `7-day credit`인 주문 한정. 선결제·COD는 별도 워크플로우 #2.5(주문 직후 발행)로 분리.

### 트리거
- **Airtable change trigger**: 오더 행의 `출하 상태`가 `출하완료`로 변경되면 호출.
- **즉시 발행** (revert 버퍼 없음). 실수 시 credit note로 후속 대응.

### 안전 체크 (인보이스 생성 전)

1. payment term이 `GoCardless DD` 또는 `7-day credit`인지. 아니면 skip + Slack `#orders-alert`
2. 고객 link가 있는지 (게스트 미배정이면 dispatch 자체가 정책 위반 → skip + alert)
3. `Xero 인보이스 ID` 필드가 비어 있는지 (이미 있으면 멱등 skip)

### 노드 흐름

1. **트리거 수신**: dispatch된 오더 행 ID 전달
2. **오더 + 라인아이템 + 고객 fetch** (Airtable)
3. **안전 체크** (위 3가지). 실패 → 종료
4. **Line item 구성** (라인아이템별):
   - `ItemCode`: 제품 테이블의 Xero Item Code lookup (`KAT`/`GAR`/`TER`)
   - `Description`: 제품명 + sku
   - `Quantity`: quantity_boxes
   - `UnitAmount`: 박스 단가
   - `TaxType`: `EXEMPTOUTPUT` (GST Free Income)
   - `DiscountRate`: **미설정** → Xero가 Contact default discount % 자동 적용 (내부 5% / 일반 0%)
5. **subtotal 계산**: Σ(UnitAmount × Quantity) — 할인 적용 전 기준
6. **배송비 line 조건부 추가**:
   - `subtotal < AUD 300`: line 추가 — Description="Delivery fee", Quantity=1, **UnitAmount=5**, **TaxType=`OUTPUT`** (GST on Income 10%), **`DiscountRate=0` 명시 override** (그룹 할인 제외) → 인보이스에 GST $0.50 별도 표기, 고객 부담 $5.50
   - `subtotal ≥ AUD 300`: 배송비 line 없음
7. **Due date 산정**:
   - DD: 다음 화요일 (단 발행일이 월·화면 다음 주 화요일)
   - 7-day credit: `dispatch_date + 7일`
8. **Xero invoice 생성** (`POST /Invoices`):
   - `Type`: `ACCREC`, `Contact`: Xero ContactID, `Date`: dispatch 시각, `DueDate`: 위 산정, `LineItems`: 위 구성, `Status`: `AUTHORISED`, `Reference`: 주문번호, **`LineAmountTypes`: `Exclusive`** (배송비 GST 별도 표기)
9. **Invoice 자동 발송** (`POST /Invoices/{id}/Email`): PDF email 즉시
10. **Airtable update**: 오더 행의 `Xero 인보이스 ID`에 invoice ID 저장. `결제 상태` = `미결제` 유지
11. **GoCardless DD**의 경우: Xero–GoCardless 네이티브가 due date에 자동 collection 제출. n8n 추가 작업 없음.

### 멱등성

- `Xero 인보이스 ID` 필드 사전 체크 → 이미 있으면 step 8 skip
- Xero API는 멱등 보장 안 함 → 우리 쪽 dedupe로 보호
- 부분 실패 복구 (Xero 성공 + Airtable update 실패): reference(주문번호)로 Xero invoice search → ID를 Airtable에 박기

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| payment term이 DD/7-day 아님 | skip + Slack `#ops-accounts` |
| 게스트(미배정) dispatch 시도 | skip + Slack `#ops-delivery` (정책 위반) |
| Xero Item Code 없음 | 인보이스 실패 → Slack `#ops-accounts` → admin이 등록 후 재시도 |
| Xero ContactID 없음 | skip + Slack `#ops-onboarding` (온보딩 누락) |
| Xero API 5xx | n8n 자동 재시도 (멱등 체크로 안전) |
| 부분 실패 | reference로 invoice search → ID 동기화 |

### 관련 미결

- 없음 — #2.5 설계 완료로 선결제·COD 분기 확정.

---

## 워크플로우 #3 상세: Xero → Airtable 결제·Hold 동기화

> **scope**: 인보이스 결제 상태 + 고객 hold(credit limit·overdue) 동기화. credit note·invoice void는 수동 처리(`../xero/` 정책).

### 트리거 (이중 구조)

- **Xero webhook** (`INVOICE.UPDATE`) — 절대 다수 처리, 실시간
- **n8n cron 매시간 :05** — webhook 유실 대비 폴링 폴백
- 두 트리거 모두 동일한 메인 처리 노드로 합류

### Webhook 검증

- 헤더 `x-xero-signature` HMAC-SHA256 검증 (webhook key는 n8n credential `xero-webhook-key`에 보관)
- 검증 실패 → `401` + 로그
- payload: `{ events: [{ resourceId: invoiceId, tenantId, eventCategory: "INVOICE", eventType: "UPDATE" }] }`

### Polling 흐름

1. cron 매시간 :05 트리거
2. `GET /Invoices?ModifiedAfter={last_sync_at}` (Xero header `If-Modified-Since`도 같이)
3. 응답의 invoice 목록을 webhook 처리 흐름과 동일하게 합류
4. 성공 시 `last_sync_at = now` 갱신 (n8n datatable 또는 Airtable settings 테이블)

### 메인 처리 흐름 (invoice 1건 단위)

1. **Invoice fetch**: `GET /Invoices/{invoiceId}` — `Status`, `AmountDue`, `Contact.ContactID`, `DueDate`, `FullyPaidOnDate`, `Type` 확보
2. **Airtable 오더 매칭**: 오더 테이블에서 `Xero 인보이스 ID = {invoiceId}` lookup
   - 매칭 실패: Slack `#ops-accounts` 알림 ("Xero invoice가 Airtable 오더에 매칭 안됨"). 처리 종료
3. **오더 update** (Airtable):
   - `결제 상태`: `Status == "PAID"` 또는 `AmountDue == 0` → `Paid`, 그 외 `미결제`
   - `오더 Hold`: 선결제·COD payment term 한정 — Paid면 hold 해제 (`false`)
   - 멱등: 현 값과 같으면 skip
4. **Contact 매칭**: 고객 테이블에서 `Xero ContactID = Invoice.Contact.ContactID` lookup
   - 매칭 실패: Slack `#ops-accounts` 알림. invoice 단위 update는 step 3에서 완료, 고객 hold 재계산은 skip
5. **Outstanding 재계산**: `GET /Invoices?ContactID={contactId}&Statuses=AUTHORISED,SUBMITTED&Type=ACCREC`
   - `outstanding = Σ AmountDue`
   - `overdue_count = COUNT(WHERE due_date < today)`
   - `overdue_amount = Σ AmountDue WHERE due_date < today`
6. **Credit limit fetch**: `GET /Contacts/{contactId}` → Xero Contact의 credit limit 필드
7. **Hold 산출**:
   - `hold = (outstanding ≥ credit_limit) OR (overdue_count ≥ 1)`
   - `hold_reason` (우선순위):
     - `overdue_count ≥ 1` → `"overdue: {n}건, ${overdue_amount}"`
     - 그 외 `outstanding ≥ credit_limit` → `"credit limit: ${outstanding}/${credit_limit}"`
   - `overdue` 정의: `due_date < today AND Status ≠ PAID`
8. **Airtable 고객 update**:
   - `고객 hold` = boolean
   - `hold_reason` = 문자열 (hold면)
   - `outstanding` = 합계 (영업·Admin 표시용)
   - 멱등: 모두 같으면 skip

### Hold 상태 후속

- 고객 hold = false로 풀림 → 진행 중 오더는 다음 dispatch 시도 시 자동으로 가능 (출하 가능 = NOT(고객 hold) AND NOT(오더 hold))
- 고객 hold = true로 걸림 → 미dispatch 오더는 다음 dispatch 시도 시 차단 (워크플로우 #2가 안전 체크에서 거름)
- 오더 hold 해제는 결제 단위 — 고객 hold 풀려도 오더 hold는 그대로 (별 트리거)

### 멱등성

- Webhook 중복 수신: 동일 invoice update가 여러 번 와도 step 3·8의 "현 값과 같으면 skip" 가드로 no-op
- Polling 부분 실패: `last_sync_at`은 성공 시에만 갱신. 다음 polling이 미처리 invoice 재처리 (멱등이라 안전)
- Webhook + polling 동시 처리: 동일 결과로 수렴

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| Webhook 서명 검증 실패 | `401` + 로그 |
| Xero API 5xx | n8n 자동 재시도. 누락분은 다음 polling이 잡음 |
| invoice 매칭 실패 (Xero 있음 / Airtable 없음) | Slack `#ops-accounts` (수동 등록 또는 무시 판단) |
| contact 매칭 실패 | Slack `#ops-accounts`. invoice update는 그대로, 고객 hold 재계산만 skip |
| Airtable API 실패 | n8n 자동 재시도. polling이 보험 |

### 관련 미결

- credit_limit이 Xero Contact에 미설정인 경우 default: **`∞`로 간주(hold 안 걸림)** 권장 (Slack 경고만). 운영 시작 시점 재검토.
- `last_sync_at` 보관 위치: 기본 **n8n datatable**. Airtable settings 테이블로 옮길지는 운영 안정화 후 결정.

---

## 워크플로우 #7a 상세: Tally 폼 제출 → intake

> **scope**: Tally 폼 제출 즉시 자동. 매칭 + staging 저장 + 영업 review 요청까지. **Xero/Airtable 고객 생성 안 함** (그건 #7b).

### 사전 준비 (운영 액션)

- **Airtable**: `Onboarding Submissions` staging 테이블 신설 (스키마는 `../airtable/schema.md`)
- **HubSpot**: Company custom property `Customer Group` (single select: `내부고객`/`일반고객`) 추가 — #7b 트리거 전 영업이 채움
- **HubSpot**: Workflow on Company "`Onboarding` property changed to `approved`" → webhook to n8n #7b URL
- **Tally**: 폼 webhook destination을 n8n #7a URL로 + signing secret 발급 → n8n credential `tally-webhook-secret`

### 트리거

- **n8n webhook** (HTTPS POST) — Tally가 폼 제출 시 호출
- 헤더 `tally-signature` HMAC-SHA256 검증 (signing secret)

### Payload (Tally 표준)

```json
{
  "eventId": "...", "eventType": "FORM_RESPONSE",
  "data": {
    "submissionId": "<unique>", "responseId": "...", "formId": "...",
    "fields": [
      { "label": "hubspot_id", "type": "HIDDEN_FIELDS", "value": "12345" },
      { "label": "email_prefill", "type": "HIDDEN_FIELDS", "value": "..." },
      { "label": "shop name", "value": "..." },
      { "label": "entity name", "value": "..." },
      { "label": "ABN", "value": "..." },
      { "label": "delivery address", "value": "..." },
      { "label": "email", "value": "..." },
      { "label": "phone", "value": "..." },
      { "label": "payment term", "value": "GoCardless DD | 7-day credit | Prepay | COD" },
      { "label": "gocardless_mandate_id", "type": "HIDDEN_FIELDS", "value": "..." },
      ...
    ]
  }
}
```

### 노드 흐름

1. **Webhook 수신** → HMAC 검증 → JSON 파싱 → fields를 `{label: value}` map으로 정규화
2. **멱등 체크**: Airtable `Onboarding Submissions` lookup by `submission_id` → 존재 시 200 + 기존 row 반환 후 종료
3. **HubSpot Company 매칭**:
   - hidden `hubspot_id` 있음: `GET /crm/v3/objects/companies/{id}` (404면 → `matched_via=invalid_id`, Slack `#ops-onboarding`)
     - **Forward 가드**: `GET /crm/v3/objects/companies/{id}/associations/contacts` → 각 contact의 email fetch → 폼 `email` 과 일치하는 contact 0건이면 `forward_guard_flag=true`, `matched_via=hubspot_id_disputed`. 일치 ≥1 → `matched_via=hubspot_id`
   - hidden `hubspot_id` 비어있음: `POST /crm/v3/objects/contacts/search` body `email = <폼 email>` → hit 시 첫 contact의 associated company → `matched_via=email`. miss → `matched_via=unmatched`
4. **Staging 행 생성** (Airtable `Onboarding Submissions`):
   - `submission_id`(unique), `tally_form_id`, `submitted_at`
   - `hubspot_company_id` (매칭됐으면), `matched_via`, `forward_guard_flag`
   - 폼 필드 전부 (`shop_name`, `entity_name`, `abn`, `delivery_address`, `form_email`, `form_phone`, `account_contact_*`)
   - `payment_term_selection`, `gocardless_mandate_id` (DD면)
   - `raw_payload_json` (Tally raw payload — 포렌식용)
   - `status` = `under review` (matched / forward guard / unmatched 무관, 영업이 다 봄)
5. **HubSpot Company update** (matched + no forward guard일 때만):
   - `Onboarding = form submitted`
   - `PATCH /crm/v3/objects/companies/{id}` body `{ properties: { onboarding: "form submitted" } }`
6. **Slack `#ops-onboarding` 알림**:
   - 메시지: 가게명, payment term, matched 상태 (`매칭 OK` / `⚠️ forward guard 의심 — email 불일치` / `❓ HubSpot 매칭 실패 — 영업 판단 필요`), DD mandate 완료 여부
   - 링크: Airtable staging row + HubSpot Company (matched 시)
   - Slack `ts` 응답을 staging row `slack_thread_ts`에 저장 (후속 메시지 thread 회신용)
7. **응답 200 반환** (Tally는 빠른 ACK 필요)

### 응답 형식

```json
{ "status": "received", "submission_id": "...", "matched_via": "hubspot_id" }
```

### 멱등성

- `submission_id`는 Airtable staging의 unique field. 재요청 시 step 2에서 기존 응답 재현
- HubSpot/Airtable 부분 실패: n8n 자동 재시도. staging 저장 후 HubSpot 갱신 실패해도 staging은 남음 → 운영 가시화 우선

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| HMAC 서명 검증 실패 | `401` + 로그 |
| HubSpot Company 404 (invalid hidden ID) | staging 저장 + Slack `#ops-onboarding` |
| HubSpot/Airtable API 5xx | n8n 자동 재시도 (멱등키로 안전) |
| DD mandate 완료(`gocardless_mandate_id` 있음) + `matched_via=unmatched` | Slack 알림 시 🚨 강조 — mandate가 미연결 고객에 떠있음, 영업 긴급 처리 |
| Slack 발송 실패 | non-blocking, 다음 재시도 |

---

## 워크플로우 #7b 상세: 영업 승인 → HubSpot/Xero/Airtable propagate

> **scope**: 영업이 HubSpot Company에서 `Customer Group` 지정 + `Onboarding = approved`로 변경하면 자동 propagate. 신규 고객 레코드 + Xero Contact + 토큰 + 환영 이메일까지.

### 트리거

- **HubSpot workflow webhook**: Company `Onboarding` property가 `approved`로 변경 → n8n #7b URL로 POST
- payload: `{ vid: companyId, propertyName: "onboarding", newValue: "approved" }`

### 안전 체크 (Xero/Airtable 생성 전)

1. HubSpot Company의 `Customer Group` 설정됨? (`내부고객`/`일반고객`) — 없으면 abort + Slack `#ops-onboarding` ("승인 전 그룹 지정 필요")
2. 매칭된 staging 행 (`hubspot_company_id = {companyId} AND status = under review`) 존재? — 없으면 abort + Slack
3. Airtable 고객 테이블에 이미 동일 `HubSpot 고객 ID`로 행 존재? — 있으면 멱등 skip (이미 propagate 됨)
4. staging의 `payment_term_selection` 유효? (DD/7-day/Prepay/COD 중 하나)
5. DD인 경우 `gocardless_mandate_id` 있음? — 없으면 abort + Slack ("mandate 미완료 — 고객에게 재안내")

### 노드 흐름

1. **Webhook 수신** → companyId 추출
2. **HubSpot Company fetch** (`GET /crm/v3/objects/companies/{id}?properties=name,customer_group,onboarding,hubspot_owner_id`)
3. **Staging row fetch** (Airtable): `hubspot_company_id = {companyId} AND status = under review` → 최신 1건
4. **안전 체크 5가지** (위) → 실패 시 종료
5. **Xero Contact 생성** (`POST /Contacts`):
   - `Name` = `entity_name` (없으면 `shop_name`)
   - `EmailAddress` = staging `form_email`
   - `Phones`, `Addresses` (POBOX/STREET = `delivery_address`)
   - `Discounts` = `5` (내부) / `0` (일반) — Customer Group 기반
   - `PaymentTerms` = payment_term_selection 매핑 (DD/7-day → 7-day net, Prepay/COD → Due on receipt)
   - 응답에서 `ContactID` 확보
6. **토큰 생성** (n8n Code 노드, `crypto.randomBytes(16).toString('base64url')`):
   - `magic_link_token` (16-byte URL-safe)
   - `recovery_token` (16-byte URL-safe)
7. **Airtable 고객 행 생성**:
   - 상호 = `shop_name`, HubSpot Company ID = `{companyId}`, Xero ContactID = step 5 응답
   - 담당자·연락처·기본 배송지 = staging 값
   - payment term, 고객 그룹 = HubSpot Customer Group
   - `매직 링크 토큰`, `복구 토큰`, `created_at`
   - `gocardless_mandate_id` (DD 시)
8. **Staging update**: `status = propagated`, link to new 고객 row
9. **HubSpot Company update**:
   - `PATCH /crm/v3/objects/companies/{id}` body 추가 property — `xero_contact_id`, `airtable_customer_id` (신설 권장 — 디버깅·운영 가시화용)
   - `Sales Pipeline` 변경 X (영업 판단 영역, `first order` 진입 기준은 추후 결정)
10. **미배정 게스트 주문 소급매칭 시도**:
    - Airtable 오더 lookup: `고객 link` 비어있고 `(상호 == shop_name OR 배송주소 == delivery_address)` 후보 검색
    - 후보 0건 → skip
    - 후보 1건 이상 → **자동 link 금지**, Slack `#ops-orders` 알림 ("소급매칭 후보 N건 — admin 확인")
11. **환영 이메일 발송**:
    - HubSpot Single-send transactional API (`POST /marketing/v3/transactional/single-email/send`)
    - Template: 사전 등록된 "Welcome + 매직링크" 템플릿
    - personalization: `magic_link_url = order.example.com/o/{magic_link_token}`, `shop_name`, `recovery_token` 등
    - 실패 시 non-blocking → Slack `#ops-onboarding` 으로 admin 수동 발송 요청
12. **응답 200 반환**

### 멱등성

- step 3 (Airtable 고객 테이블에 HubSpot Company ID 중복 체크)로 1차 차단 — 이미 propagate된 Company는 즉시 skip
- 부분 실패 (Xero 성공 + Airtable 실패): Xero Contact가 떠 있을 수 있음 → 재시도 시 Xero에서 `Name`/`EmailAddress`로 search → 기존 ContactID 재사용
- 토큰은 멱등성과 무관 (Airtable 행이 없을 때만 새로 생성)

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| `Customer Group` 미설정 | abort + Slack `#ops-onboarding` ("승인 전 그룹 지정 필요") |
| Staging row 없음 | abort + Slack `#ops-onboarding` ("폼 제출 기록 없음 — 직접 입력 케이스?") |
| DD인데 mandate 없음 | abort + Slack `#ops-onboarding` ("mandate 미완료") |
| Xero Contact 생성 실패 (필수 필드 누락 등) | abort + Slack `#ops-accounts` + staging은 그대로 (재승인 시 재시도) |
| Airtable 5xx | n8n 자동 재시도. Xero 재사용 로직으로 안전 |
| 환영 이메일 실패 | non-blocking, Slack `#ops-onboarding` |

### 관련 미결

- 환영 이메일을 n8n 직접 발송 vs HubSpot workflow 분리: 현재는 n8n 직접 (single-send API). 향후 HubSpot 템플릿 운영 안정화 시 HubSpot workflow로 옮기는 것도 옵션
- `airtable_customer_id` / `xero_contact_id` HubSpot custom property 신설 여부 — 운영 디버깅에 유용하지만 필수 아님. 보류 가능

---

## 워크플로우 #6a 상세: 주문 확인 SMS (sub-workflow)

> **scope**: 신규 주문 1건당 SMS 1건. 보안 게이트 없음. #1이 fire-and-forget 호출. 실패해도 주문은 성공 — Slack 알림만.

### 사전 준비

- **ClickSend**: 계정 생성 + sender ID 등록 ("YoungFoods" alpha sender, 호주 alphanumeric sender 사전 등록 필수). API key 발급
- **n8n credential**: `clicksend-creds` (Basic auth — username = ClickSend username, password = API key)
- **Airtable**: `SMS Log` 테이블 생성 (스키마는 `../airtable/schema.md`)

### 트리거

- **n8n sub-workflow trigger** (Execute Workflow 노드로 호출). #1이 fire-and-forget.
- 입력 payload: `{ phone, order_no, requested_delivery_date, magic_link_token, customer_id? }`

### 노드 흐름

1. **입력 수신**
2. **멱등 체크**: Airtable `SMS Log` lookup `(type = order_confirmation AND order_no = {x})` → hit 시 종료 (이미 발송됨)
3. **전화번호 정규화** (Code 노드, E.164 AU):
   ```js
   const digits = phone.replace(/\D/g, '');
   if (digits.startsWith('61')) return '+' + digits;
   if (digits.startsWith('0')) return '+61' + digits.slice(1);
   if (digits.length === 9) return '+61' + digits;
   throw new Error('invalid_au_phone');
   ```
   - 실패 → `SMS Log`에 status=`Failed`, error=`invalid_phone` 기록 + Slack `#ops-orders` 알림 + 종료
4. **메시지 본문 구성** (템플릿):
   - `Young Foods 주문 접수 #{order_no}, 배송 {requested_delivery_date}. 매직링크: order.example.com/o/{magic_link_token}`
   - 한글 = UCS-2 (segment 70자) → 본문은 가능한 짧게. multi-segment 허용 (요금만 늘어남)
5. **ClickSend 발송** (`POST https://rest.clicksend.com/v3/sms/send`):
   ```json
   { "messages": [{
     "source": "YoungFoods",
     "from": "YoungFoods",
     "body": "<step 4>",
     "to": "<E.164 phone>",
     "custom_string": "<order_no>"
   }]}
   ```
   - 응답에서 `message_id`, `status`, `message_price` 확보
6. **SMS Log 행 생성** (Airtable):
   - `type` = `order_confirmation`
   - `phone`, `body`, `order_no` link, `clicksend_message_id`, `clicksend_status`, `cost_aud`, `sent_at`
7. **종료** (fire-and-forget — 호출자에게 응답값 없음)

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| 전화번호 누락/무효 | `SMS Log` Failed 기록 + Slack `#ops-orders` |
| ClickSend 5xx | n8n 자동 재시도 (멱등 체크로 안전) |
| ClickSend 거절 (invalid number 등) | `SMS Log` Failed + Slack `#ops-orders` |
| sender ID 미등록 (호주는 사전 승인 필요) | 가동 전 ClickSend 콘솔에서 등록 — 운영 액션 |

---

## 워크플로우 #6b 상세: 분실 복구 SMS (webhook)

> **scope**: order-site 글로벌 페이지 "전화번호로 링크 받기" 클릭 시. 보안 게이트(enumeration 차단, rate limit, 등록된 번호로만 발송) 필수. `../order-site/CLAUDE.md` "재발급 보안 규칙" 정책 구현체.

### 트리거

- **n8n webhook** (HTTPS POST) — order-site 글로벌 페이지가 호출
- 입력 payload: `{ phone }` (사용자가 입력한 번호 그대로)

### 핵심 보안 원칙 (재확인)

- **등록·미등록 동일 응답**: 어느 케이스든 200 + `{ "status": "sent_if_registered" }` 동일 반환
- **등록된 번호로만 발송**: 사용자 입력 번호가 아니라 Airtable 고객 레코드의 `연락처` 필드로 발송 (이번 케이스엔 같지만 정책상 명시)
- **rate limit silent absorb**: 초과해도 응답은 동일 (차단됐다는 신호 안 줌)

### 노드 흐름

1. **Webhook 수신** → JSON 파싱
2. **전화번호 정규화** (Code, E.164 AU — #6a와 동일 함수):
   - 실패 → 200 generic 응답 + 종료 (enumeration 차단 — "유효한 번호 형식 아님"도 노출 X)
3. **Rate limit 체크** (Airtable `SMS Log` query):
   - `(type = recovery AND phone = {x} AND sent_at > now-1h)` count ≥ 3 → 차단 분기로
   - `(type = recovery AND phone = {x} AND sent_at > now-24h)` count ≥ 10 → 차단 분기로
   - 차단 분기: `SMS Log`에 `type=recovery_blocked` 행 1건 기록 (감사용) → 200 generic + 종료
4. **고객 lookup** (Airtable 고객 테이블, `연락처 = {정규화된 phone}` exact match):
   - 미매칭: `SMS Log`에 `type=recovery_miss` 기록 (rate limit 카운트엔 포함) → 200 generic + 종료
   - 매칭: 고객 레코드 + `매직 링크 토큰` 확보
5. **메시지 본문**:
   - `Young Foods 매직링크: order.example.com/o/{token}. 본인 요청이 아니면 무시.`
6. **ClickSend 발송** — 발송 번호는 **고객 레코드의 `연락처`** (정책: 등록된 번호로만)
7. **SMS Log 행 생성**:
   - `type` = `recovery`, `phone`, `body`, `customer` link, `clicksend_message_id`, `clicksend_status`, `cost_aud`, `sent_at`
8. **재요청 카운트 +1** (Airtable 고객 `링크 재요청 횟수`):
   - 갱신 후 값 ≥ 2 → `QR 추천 플래그` = true + Slack `#ops-orders` 알림 (가게명·번호·재요청 횟수)
9. **200 generic 응답 반환**

### 응답 형식 (등록·미등록·차단 모두 동일)

```json
{ "status": "sent_if_registered" }
```

### 멱등성

- 별도 멱등키 없음. rate limit이 사실상 dedupe 역할 — 같은 번호로 1분 내 5번 클릭해도 시간당 3건만 발송됨
- 동일 sent_at 충돌 우려 없음 (Airtable autonumber로 row 분리)

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| ClickSend 5xx | n8n 자동 재시도. 영구 실패 시 `SMS Log` Failed + Slack `#ops-orders`. 응답은 그래도 generic (enumeration 차단 우선) |
| Airtable 5xx | n8n 자동 재시도. rate limit 카운트가 잠시 불완전할 수 있음 — 운영상 허용 |
| 정규화 실패 (잘못된 형식 입력) | step 2에서 generic 응답 |

### 관련 미결

- **이메일 복구 채널**: order-site 정책엔 "전화 또는 이메일"로 조회 가능하다고 적혀있음. 현재 #6b는 SMS 전용. 이메일 복구는 별도 워크플로우(예: #6c) 또는 HubSpot single-send 활용 — 추후 설계
- **고객 `연락처` 다중 보관**: 현재 schema는 단일 필드. 가게 사장·총무 등 여러 번호 등록 필요 시 별도 contact 테이블화 검토 (현재는 단일로 유지)

---

## 워크플로우 #2.5 상세: 선결제·COD 주문 → Xero 인보이스 (주문 직후)

> **scope**: payment term이 `Prepay` 또는 `COD`인 주문 한정. 주문 직후 인보이스 발행 + 오더 hold ON → 결제 확인(#3) → hold 해제 → dispatch 가능. **DD/7-day는 #2(dispatch 시)와 완전 분리**.

### 모델 재확인

루트 결정: **"COD = 주문 후 빠른 선결제 변형"** (호주 일반 "배달 시 현장 결제" 모델 아님). 둘 다 결제 완료가 dispatch의 전제 조건. 결제 채널은 **Manual bank transfer (Xero PDF에 회사 계좌 명시)** — `../xero/CLAUDE.md`.

### 트리거 (Airtable change trigger — #1 sub-call 패턴 대신)

- **Airtable change trigger**: 오더 행 생성 + (`출하 상태 = 접수` AND `payment term ∈ {Prepay, COD}`) → 호출
- **왜 sub-workflow 호출 대신 trigger**: #2와 일관 (dispatch 시 vs 주문 시, 둘 다 Airtable 상태 변화가 트리거). #1과 결합 감소 — #1은 오더 생성만, payment term별 후속은 각 워크플로우가 자기 책임으로 trigger.

### 사전 준비 (운영 액션)

- **Xero Branding theme**: 회사 계좌 정보(BSB·계좌번호)를 invoice footer/payment instructions에 사전 등록 (Prepay/COD 인보이스에 자동 노출됨). DD/7-day와 같은 theme 공유 가능 — DD는 계좌 안내 무시됨.
- **Airtable**: 오더 테이블의 `payment term` 필드가 `Prepay`/`COD` 값을 지원하는지 확인 (현재 schema 정의에 따라).

### 안전 체크 (인보이스 생성 전)

1. payment term이 `Prepay` 또는 `COD` (트리거 필터 통과 후 defensive 재확인)
2. 고객 link가 있는지 — 게스트(미배정)는 정책상 선결제·COD 불가 → abort + Slack `#ops-orders` ("게스트는 선결제·COD 불가, 영업 contact 필요")
3. `Xero 인보이스 ID` 필드가 비어 있는지 — 있으면 멱등 skip
4. Xero ContactID 있는지 — 없으면 abort + Slack `#ops-onboarding`
5. 모든 라인아이템에 Xero Item Code(KAT/GAR/TER) 있는지

### 노드 흐름

1. **트리거 수신**: 오더 행 ID
2. **오더 + 라인아이템 + 고객 fetch** (Airtable)
3. **안전 체크 5가지** → 실패 시 종료
4. **Line item 구성** (`#2`와 동일):
   - `ItemCode` = 제품 테이블 lookup (`KAT`/`GAR`/`TER`)
   - `Description` = 제품명 + sku
   - `Quantity` = `quantity_boxes`
   - `UnitAmount` = 박스 단가
   - `TaxType` = `EXEMPTOUTPUT`
   - `DiscountRate` 미설정 → Contact default discount % 자동 (내부 5% / 일반 0%)
5. **subtotal 계산** (할인 적용 전)
6. **배송비 line 조건부 추가** (`#2`와 동일):
   - `subtotal < $300`: line 추가 — UnitAmount=5, TaxType=`OUTPUT`, DiscountRate=0 override
   - `subtotal ≥ $300`: 배송비 line 없음
7. **Due date 산정**: **발행일 그날** (Xero "Due on receipt" — Prepay/COD는 결제 완료가 dispatch 전제, due date 의미상 즉시)
8. **Xero invoice 생성** (`POST /Invoices`):
   - `Type` = `ACCREC`, `Contact` = Xero ContactID
   - `Date` = 오늘, `DueDate` = 오늘
   - `LineItems` = 위 구성, `Status` = `AUTHORISED`
   - `Reference` = 주문번호 (`ORD-1001` 형식), `LineAmountTypes` = `Exclusive`
9. **Invoice 자동 이메일 발송** (`POST /Invoices/{id}/Email`):
   - Xero가 Branding theme의 footer(계좌 정보) 포함 PDF 첨부
   - 이메일 본문 카피: "결제 확인 후 dispatch 진행됩니다" (Xero invoice 템플릿 message에 사전 설정)
10. **Airtable 오더 update** (멱등 보호 + dispatch 차단):
    - `Xero 인보이스 ID` = 발행 ID
    - `오더 Hold` = `true` ← **dispatch 막는 핵심**
    - `결제 상태` = `미결제`
11. 종료 (#1 응답엔 영향 없음 — 비동기 trigger)

### 결제 확인 흐름 (#3와의 연결)

- 고객 bank transfer → Xero bank feed 자동 매칭 (또는 admin 수동) → Xero invoice `PAID`
- #3가 `INVOICE.UPDATE` webhook 수신 → Airtable 오더 update:
  - `결제 상태` = `Paid`
  - `오더 Hold` = `false` (#3 상세 step 3 — payment term이 Prepay/COD인 경우 hold 해제 룰, 이미 정의됨)
- 출하 가능 (`NOT(고객 hold) AND NOT(오더 hold)`)

### 멱등성

- step 3 (`Xero 인보이스 ID` 사전 체크) → 이미 있으면 즉시 종료
- 부분 실패 (Xero 성공 + Airtable update 실패): `Reference`(주문번호)로 Xero invoice search → ID 동기화 후 hold 설정 재시도
- **위험 케이스**: Xero 인보이스 발행 + 오더 hold 미설정 → dispatch 차단 안 됨. **안전망**: `결제 상태 = 미결제` 디폴트로 들어가니까 #3가 아직 paid 처리 안 함. dispatch 워크플로우(#2)는 payment term 필터로 Prepay/COD를 자기 책임 외로 분기 → 사실상 dispatch는 사람이 누름. 그래도 hold 누락 시 **Slack `#ops-orders` 우선순위 ↑** 알림 필수.

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| payment term이 Prepay/COD 아님 | trigger 필터 통과 자체가 안 되어야 함. 통과 시 skip + Slack `#ops-accounts` (필터 버그 신호) |
| 게스트(미배정) | abort + Slack `#ops-orders` |
| Xero ContactID 없음 | abort + Slack `#ops-onboarding` |
| Xero Item Code 없음 | abort + Slack `#ops-accounts` |
| Xero API 5xx | n8n 자동 재시도 (멱등 체크로 안전) |
| 부분 실패 | reference로 invoice search → ID 동기화 + hold 재시도 |
| Hold 설정 실패 (Xero 발행 후 Airtable update 실패) | n8n 재시도 + Slack `#ops-orders` **우선순위 ↑** (dispatch 차단 누락 위험) |

### 관련 미결

- **선결제 미결제 자동 만료 정책**: 발행 후 N일 결제 안 되면? 영업 알림? 자동 취소? 운영 시작 후 결정
- **게스트 선결제·COD 일시 허용 여부**: 현 정책 = 정식 고객만. 운영 시작 후 신규 고객 첫 주문 한시적 허용 검토 가치
- **Xero "Online invoice payment"** (Stripe 카드, GoCardless one-off): 운영 안정화 후 채택 검토. 현 출발은 manual bank transfer 단일 채널

---

## 워크플로우 #5 상세: Airtable 재무 상태 → HubSpot Company 동기

> **scope**: #3가 Airtable 고객 테이블의 `고객 hold` / `hold_reason` / `outstanding`을 갱신한 뒤 자동 발화. HubSpot Company 3개 property로 미러링 — 영업이 HubSpot에서 "지금 hold인가? 왜? 얼마 미수금?"을 즉시 본다.

### 사전 준비 (운영 액션)

- **HubSpot Company custom properties 신설** (기존 `Account Hold` 외에 2개 추가):
  - `Hold Reason` — single-line text (max ~100자). 비어있으면 hold 아님.
  - `Outstanding (AUD)` — number, currency format. 0 default.
- `Account Hold`는 이미 single select (`Yes`/`No`) 존재 — 신설 불필요.
- **Airtable change trigger** 셋업: 고객 테이블에서 `고객 hold` OR `hold_reason` OR `outstanding` 변경 감지.

### 트리거

- **Airtable change trigger** (n8n Airtable trigger 노드, polling 5s 또는 webhook). watched fields: 위 3개.
- payload: 변경된 고객 row ID + 현재 값 snapshot

### 안전 체크

1. Airtable 고객 row의 `HubSpot 고객 ID` 비어있지 않은지 — 비었으면 silently skip (게스트·미배정 고객은 HubSpot에 없음)
2. HubSpot Company 존재 — 404면 Slack `#ops-accounts` + 종료 (Company가 삭제됐거나 ID 오염)

### 노드 흐름

1. **트리거 수신**: 고객 row ID + 현재 값
2. **Airtable 고객 fetch**: (`hold`, `hold_reason`, `outstanding`, `HubSpot 고객 ID`)
3. **안전 체크 1**: `HubSpot 고객 ID` 비어있으면 종료 (silently)
4. **HubSpot Company fetch** (`GET /crm/v3/objects/companies/{id}?properties=account_hold,hold_reason,outstanding_aud`):
   - 404 → Slack `#ops-accounts` + 종료
5. **멱등 비교**: Airtable 값 ↔ HubSpot 현 값 — 모두 같으면 종료 (noise 흡수)
6. **HubSpot Company PATCH** (`PATCH /crm/v3/objects/companies/{id}`):
   ```json
   {
     "properties": {
       "account_hold": "Yes" | "No",
       "hold_reason": "<text>" | "",
       "outstanding_aud": <number>
     }
   }
   ```
   - `hold` = false면 `hold_reason` 빈 문자열로 강제 (잘못된 컨텍스트 잔존 방지)
7. 종료

### 멱등성

- step 5 (값 비교 → skip) → Airtable trigger 중복 발화 안전
- partial update 안전 (HubSpot PATCH는 변경분만 처리)
- 부분 실패 (PATCH 도중 일부 property만 commit) — 다음 trigger에서 재시도, 최종 일관성 보장

### 에러 처리

| 에러 | 동작 |
| --- | --- |
| HubSpot 고객 ID 없음 | silently skip (정상 케이스 — 게스트) |
| HubSpot Company 404 | Slack `#ops-accounts` + 종료 ("Company 매핑 오염") |
| HubSpot property 존재 안 함 (`hold_reason`/`outstanding_aud`) | Slack `#ops-accounts` ("운영 액션 누락 — property 신설 필요") |
| HubSpot API 5xx | n8n 자동 재시도 (멱등 비교로 안전) |
| Airtable API 5xx | n8n 자동 재시도 |

### 관련 미결

- **확장 항목 (B 옵션 보류)**: `Overdue Count` / `Overdue Amount (AUD)` / `Credit Limit (AUD)` — 운영 시작 후 영업이 (A) 3개로 부족하면 추가. 추가 시 #3가 outstanding과 함께 계산하니 소스는 이미 있음, Airtable 고객 테이블에 필드 추가 + #5에 patch field 확장만 하면 됨.
- **`Last Payment Date`**: 영업이 "최근 결제 언제?" 묻는 빈도 보고 결정. Xero 데이터로 #3에서 같이 산출 가능.
- **`Airtable Customer URL`**: HubSpot에서 Airtable 원본으로 drill-down 링크. 디버깅·운영 가시화에 유용하지만 필수 아님 (#7b 관련 미결과 동일 라인).

---

## Slack 채널 매핑 (ops-*)

Workspace는 `action-required` 카테고리에 ops-* 채널 8개 + 별도 `#ops-accounts` (재무 알림용). 채널 ID는 워크플로우 자격증명 등록 시 입력.

| 채널 | 다루는 알림 |
| --- | --- |
| `#ops-orders` | 미배정 게스트 주문, 소급매칭 후보, 중복 의심, 주문 취소 요청, QR 추천, catastrophic 500 |
| `#ops-onboarding` | 온보딩 폼 제출, 매직링크 분실 재발급, 신원 확정 실패, Xero ContactID 누락 |
| `#ops-delivery` | dispatch 실패, 컷오프 미준수, 배송지 누락, 게스트 dispatch 시도(정책 위반) |
| `#ops-accounts` | Xero 인보이스 발행 실패, GoCardless mandate 실패, 결제 실패, payment term 누락 |
| `#ops-inventory` | 재고 부족 임박 (Make-to-stock 예측), safety stock 하향 알림 |
| `#ops-production` | 생산 라인 지연, 생산 계획 vs 실적 갭 |
| `#ops-qa` | 내부 QA 이슈 (라벨·바코드·중량 불일치 등) |
| `#ops-complaints` | 고객 클레임 (품질·이물질·배송 손상 등) |

> 채널 ID는 n8n 자격증명/`channel-map` Airtable 테이블에 보관 권장(코드 하드코딩 X). 채널 변경에 대응 쉬워짐.

---

## 예외 처리 (모두 Slack 알림 → 수동 조치)

- **중복 주문 의심**: 같은 고객 + 같은 배송일 + 동일 sku 조합 (수량 무관) → Slack `#ops-orders` → admin 확인. 멱등키로 진짜 재제출은 1차 차단.
- **게스트 소급 매칭** (상호+주소) → Slack `#ops-orders` → 영업 수동 매칭.
- **주문 취소** → Slack `#ops-orders` → Xero 수동 조치.
  - dispatch 전 취소: 인보이스 아직 없음 → Airtable 상태만 "취소". Xero 조치 불필요.
  - dispatch 후 취소/반품: 인보이스 발행됨 → 수동 **credit note** (`#ops-accounts` 병행 알림).
- **QR 추천**: 링크 재요청 2회+ → Slack `#ops-orders` 알림 + Airtable 플래그.

---

## 미결 사항 (이 도메인)

| 항목 | 메모 |
| --- | --- |
| 남은 워크플로우 후보 | **모든 핵심 #1~#7 설계 완료** (2026-05-28). 추가 후보: #6c(이메일 복구 — order-site 정책상 phone OR email 모두 허용) — 운영 가동 후 수요 보고 결정 |
| 신설 운영 액션 (#2.5·#5·#6·#7 가동 전) | (#7) Airtable `Onboarding Submissions` 테이블, HubSpot Company `Customer Group` property, HubSpot workflow on `Onboarding=approved` → webhook, Tally signing secret. (#6) Airtable `SMS Log` 테이블, ClickSend 계정·sender ID(YoungFoods) 등록, n8n `clicksend-creds` credential. (#2.5) Xero Branding theme에 회사 계좌(BSB·계좌번호) invoice footer/payment instructions 등록. (#5) HubSpot Company custom property `Hold Reason`·`Outstanding (AUD)` 신설 |
| 각 ops-* 채널 ID 등록 | 채널은 만들어졌고 매핑 확정 — 워크플로우 구현 시점에 ID를 n8n 자격증명에 입력 |
