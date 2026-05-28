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
| Airtable | Xero | **dispatch 시** 인보이스 생성 (payment term별 분기) | dispatch 상태 변경 |
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

### 3. Xero → Airtable 결제·Hold 동기화 ✅ 설계 완료
- 상세는 아래 "워크플로우 #3 상세" 섹션.
- 핵심: INVOICE.UPDATE webhook + 매시간 polling 폴백, 결제 상태 + 오더 Hold 동기화, 고객 hold 산출(outstanding ≥ credit_limit OR overdue ≥ 1).

### 4. credit limit 비교 → **#3에 통합** (2026-05-28)
- Xero는 credit limit 초과를 push로 주지 않음 → 별도 워크플로우 분리하지 않고, **#3 처리 중 매번 outstanding 합계를 재계산해 credit_limit·overdue와 비교**해 고객 hold 산출. 단일 워크플로우 관리.

### 5. 재무 상태 → HubSpot 공유
- 영업이 볼 hold status/reason·overdue·outstanding을 Airtable에서 HubSpot으로 (공유 항목 정의는 `../xero/`).

### 6. 분실 복구·주문 확인 문자
- 재발급 보안 규칙(등록 연락처로만, rate limit, enumeration 차단) 준수 (`../order-site/`).

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
11. **SMS sub-workflow 호출** (fire-and-forget, 워크플로우 #6): 주문번호·예상 배송일·매직링크
12. **응답 반환** (200)

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

- **선결제·COD 인보이스 발행 시점** — #2.5 워크플로우 별도 설계 (주문 직후 자동 발행 가정).

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
| 워크플로우 #5·#6 + #2.5 트리거·노드 설계 | #1·#2·#3 완료. 다음 후보: #6(SMS) / #2.5(선결제·COD 인보이스) / #5(재무→HubSpot 공유) |
| 각 ops-* 채널 ID 등록 | 채널은 만들어졌고 매핑 확정 — 워크플로우 구현 시점에 ID를 n8n 자격증명에 입력 |
