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
| 주문 사이트 | Airtable | 주문 제출 → 오더 + 라인아이템 행 생성 | 폼/웹훅 |
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
- 핵심: webhook 직행, 통합 endpoint(mode 분기), 서버 가격 산출, UUID 멱등키, 같은 배송일+동일 sku 조합 = 중복 의심.

### 2. dispatch → Xero 인보이스 생성 ✅ 설계 완료
- 상세는 아래 "워크플로우 #2 상세" 섹션.
- **scope**: DD / 7-day credit 한정. 선결제·COD는 #2.5(주문 직후) 별도.

### 3. Xero → Airtable 결제·Hold 동기화
- **Xero webhook 실시간 + 주기적 reconciliation 폴백** (webhook 유실 대비).
- Paid → 결제 상태/Hold 해제. 고객 hold·hold reason·outstanding 반영.

### 4. credit limit 비교 계산 (별도 로직) ⚠️
- Xero는 credit limit 초과를 push로 주지 않음 → **outstanding 합계 vs credit limit 비교를 n8n(또는 Airtable)에서 직접 계산** → 고객 hold 산출.

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
6. **중복 의심 체크**: 같은 고객(또는 게스트면 `store_name + contact_phone`) + 같은 `requested_delivery_date` + sku 조합 일치(수량 무관)? → Slack `#orders-watch` 알림. 새 오더는 정상 저장 (블로킹 X).
7. **오더 행 생성** (Airtable): 주문번호 Auto number, 멱등키, 고객/게스트 정보, 배송지 3필드, payment term lookup, 출하 상태 = `접수`
8. **라인아이템 행 생성** (Airtable): line별 행 — sku link, quantity_boxes, 박스 단가, subtotal
9. **게스트 분기 → Slack 알림** (`#orders-unassigned`, 영업 액션 대기 — `../onboarding/` 승격 큐)
10. **SMS sub-workflow 호출** (fire-and-forget, 워크플로우 #6): 주문번호·예상 배송일·매직링크
11. **응답 반환** (200)

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
- **동작**: Slack `#orders-watch` 알림. 새 오더는 정상 저장. admin이 둘 다 진행할지 하나 취소할지 판단.

### 에러 처리

| 에러 | 상태 | 동작 |
| --- | --- | --- |
| 검증 실패 | 4xx + code | 클라이언트가 표시 |
| 토큰 무효 | 401/410 | "링크 재발급 안내" 응답 |
| 컷오프 초과 | 422 | 다음 가능일 안내 |
| Airtable API 5xx | n8n 자동 재시도 | 멱등키 덕에 안전 |
| SMS 실패 | non-blocking | 주문은 성공, SMS 워크플로우 자체에서 재시도/로깅 |
| 그 외 catastrophic | 500 + Slack `#orders-alert` | admin 확인 |

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
   - `ItemCode`: 제품 테이블의 Xero Item Code lookup
   - `Description`: 제품명 + sku
   - `Quantity`: quantity_boxes
   - `UnitAmount`: 박스 단가
   - `TaxType`: `EXEMPTOUTPUT` (GST Free Income)
   - `DiscountRate`: **미설정** → Xero가 Contact default discount % 자동 적용 (내부 5% / 일반 0%)
5. **subtotal 계산**: Σ(UnitAmount × Quantity) — 할인 적용 전 기준
6. **배송비 line 조건부 추가**:
   - `subtotal < AUD 300`: line 추가 — Description="Delivery fee", Quantity=1, UnitAmount=10, TaxType=`EXEMPTOUTPUT`(임시), **`DiscountRate=0` 명시 override** (그룹 할인 제외)
   - `subtotal ≥ AUD 300`: 배송비 line 없음
7. **Due date 산정**:
   - DD: 다음 화요일 (단 발행일이 월·화면 다음 주 화요일)
   - 7-day credit: `dispatch_date + 7일`
8. **Xero invoice 생성** (`POST /Invoices`):
   - `Type`: `ACCREC`, `Contact`: Xero ContactID, `Date`: dispatch 시각, `DueDate`: 위 산정, `LineItems`: 위 구성, `Status`: `AUTHORISED`, `Reference`: 주문번호
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
| payment term이 DD/7-day 아님 | skip + Slack `#orders-alert` |
| 게스트(미배정) dispatch 시도 | skip + Slack `#orders-alert` (정책 위반) |
| Xero Item Code 없음 | 인보이스 실패 → Slack `#orders-alert` → admin이 등록 후 재시도 |
| Xero ContactID 없음 | skip + Slack `#orders-alert` (온보딩 누락) |
| Xero API 5xx | n8n 자동 재시도 (멱등 체크로 안전) |
| 부분 실패 | reference로 invoice search → ID 동기화 |

### 관련 미결

- **Xero Item Code 등록** — `../airtable/products.md`의 빈 칸. 3 SKU 모두 Xero 측 매핑 필수.
- **배송비 GST 처리** — 회계사 확인 후 `TaxType` 수정 가능 (현재 임시 `EXEMPTOUTPUT`).
- **선결제·COD 인보이스 발행 시점** — #2.5 워크플로우 별도 설계 (주문 직후 자동 발행 가정).

---

## 예외 처리 (모두 Slack 알림 → 수동 조치)

- **중복 주문 의심**: 같은 고객 + 같은 배송일 + 동일 sku 조합 (수량 무관) → Slack `#orders-watch` → admin 확인. 멱등키로 진짜 재제출은 1차 차단.
- **게스트 소급 매칭** (상호+주소) → Slack → 영업 수동 매칭.
- **주문 취소** → Slack → Xero 수동 조치.
  - dispatch 전 취소: 인보이스 아직 없음 → Airtable 상태만 "취소". Xero 조치 불필요.
  - dispatch 후 취소/반품: 인보이스 발행됨 → 수동 **credit note**.
- **QR 추천**: 링크 재요청 2회+ → Slack 알림 + Airtable 플래그.

---

## 미결 사항 (이 도메인)

| 항목 | 메모 |
| --- | --- |
| 워크플로우 #3~#6 트리거·노드 설계 | #1·#2 완료. 다음 후보: #6(SMS) / #3(Xero→Airtable 결제 동기화) / #2.5(선결제·COD 인보이스) |
| Xero Item Code 등록 | `../airtable/products.md` 빈 칸 — 3 SKU에 대해 Xero 측 매핑 필수 |
| Slack 채널 분리 | `#orders-watch`(중복 의심)·`#orders-unassigned`(게스트 신규)·`#orders-alert`(에러)·`#orders-suspect-cancel`(취소)·`#orders-qr`(QR 추천) — 채널 ID 확정 필요 |
