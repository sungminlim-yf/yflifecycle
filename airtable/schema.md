# Airtable 스키마 — 테이블·필드·관계

> **상위 컨텍스트**: `CLAUDE.md` (이 폴더), 루트 `../CLAUDE.md`
> 초안 단계. 운영 중 변경 시 이 문서와 실제 Airtable 베이스를 함께 맞춘다.

---

## 베이스 + 테이블 ID (n8n·MCP 참조용)

- **base 이름**: `yflifecycle`
- **base ID**: `appag4IfzpTeQPS1X`

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

> 다른 base들(`young foods`·`youngfoodsnew`·`Sushi Ari`)은 이 프로젝트의 운영 source가 아님 — 헷갈리지 말 것.

---

## 테이블 관계도 (개요)

```
고객(1) ──< 오더(*) ──< 라인아이템(*) >── 제품(1) ──< 생산계획 행(SKU×Date)
              │                                 └──< 생산일정 행(Date→SKU)
              └── (게스트는 고객 미연결 = 미배정)
```

- **고객 1 : 오더 N** — 한 고객이 여러 오더.
- **오더 1 : 라인아이템 N** — 품목별 수량은 자식(라인아이템) 테이블에서 관리.
- **라인아이템 N : 제품 1** — 라인아이템이 제품 테이블을 link, 단가 등은 lookup.

---

## 오더 테이블 — `tbliaikQUIRawfMU7`

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| 주문번호 | Auto number | ORD-1001 형식 |
| 고객 | Link | Airtable 고객 레코드 연결 (비어 있으면 미배정/게스트) |
| 고객 상태 | Single select | 등록완료 / 미배정 (pre-onboarding은 별도 enum 추가 안 함 — 고객 link 있음 + 고객의 Payment term blank로 derive) |
| Payment term | Single select | 7-day credit / GoCardless DD / 선결제·COD / (없음) |
| 상호 | Text | 게스트는 직접 입력 |
| 연락처 | Phone | 분실 복구·매칭에 사용 |
| 라인아이템 | Link | 라인아이템 테이블 연결 (품목별 수량은 자식 테이블에서 관리) |
| 기본 배송지 | Text | 등록 주소(불변) |
| 이번 주문 배송지 | Text | 이번 건만 다를 때 |
| 실제 배송지 | Formula | 이번 주문 배송지 우선, 없으면 기본 배송지 |
| 출하 상태 | Single select | 접수 / Hold / 출하완료 등 |
| 오더 Hold | Checkbox | 오더/인보이스 단위 hold (COD·선결제) |
| 결제 상태 | Single select | 미결제 / Paid (Xero에서 동기화) |
| Xero 인보이스 ID | Text | Xero 인보이스 연결 (dispatch 시 생성) |

> 배송지 3필드(기본/이번주문/실제)의 화면 UX는 `../order-site/`. Hold·결제 상태가 어떻게 동기화되는지는 `../xero/`.

---

## 라인아이템 테이블 — `tblVXVQzT1q8U0HJQ`

- 오더(1) ──< 라인아이템(*) 구조. picking(피킹 리스트)·Xero 인보이스 line 매핑에 사용.
- 필드: 오더(link), 제품(link → 제품 테이블), **수량(박스 수)**, **단가(박스 단가, 제품 lookup)**, **subtotal(formula = 박스 단가 × 수량)**
- 주문 단위는 **박스**. kg는 제품 테이블의 기준값(box 중량 × kg 단가)에서 derived.

---

## 제품 테이블 (SoT) — `tblaFB9HuIuocCV9s`

- SKU / 품목명 / 단위 / **박스당 수량 (kg)** / **kg 단가 (현재 통일 $13)** / **박스 단가 (formula = kg 단가 × 박스 kg)** / MOQ / Xero Item Code
- **생산계획 lookup 필드** (number, 박스 단위 — 상세 `production-planning.md`):
  - `default_dispatch_per_day` — Dispatch forecast 기본값. 초기=감 입력, 운영 1~2개월 후 historical 평균으로 갱신
  - `target_stock` — 14일 forecast closing 목표
  - `safety_stock` — 절대 하한, 미만 시 알람
- 사람용 스냅샷: `products.md`
- 가격 규칙·할인·GST 상세는 `../xero/`. 단가는 단일·할인은 Xero Contact 단계에서 적용.

---

## 생산계획 테이블 — `Production Plan` (forecast) — `tblnDrv6ssyDgNufF`

- 행 = (SKU × 날짜) — 14일 × 3 SKU = **42행 rolling**. 토/일 포함 (production=0, dispatch=0).
- 매일 마감 시 D0 행의 `stock_open` 실측 입력 → D+1~D+13는 formula로 자동 재계산.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `sku` | Link → 제품 | SKU 식별 |
| `date` | Date | 행의 날짜 (오늘 ~ +13일) |
| `weekday` | Formula | `WEEKDAY({date})` |
| `is_business_day` | Formula | weekday 월~금 |
| `stock_open` | Number / Formula | **D0: 일마감 실측 입력값** / D+1~: 이전 행(같은 SKU)의 `stock_close` |
| `production_qty` | Lookup | `Production Schedule`의 (sku, date) 매칭 qty, 없으면 0 |
| `dispatch_override` | Number | 일자별 수동 override. 비우면 default 적용 |
| `dispatch_forecast` | Formula | `IF(dispatch_override, dispatch_override, IF(is_business_day, sku.default_dispatch_per_day, 0))` |
| `stock_close` | Formula | `stock_open + production_qty − dispatch_forecast` |
| `target_stock` | Lookup → 제품 | |
| `safety_stock` | Lookup → 제품 | |
| `target_diff` | Formula | `stock_close − target_stock` (음수 = 부족) |
| `safety_diff` | Formula | `stock_close − safety_stock` (음수 = 위험) |
| `notes` | Text | |

---

## 생산일정 테이블 — `Production Schedule` — `tblaEhgO4A20iFIge`

- 행 = 영업일 1개 (월~금). 매주 1회 수동 입력 (담당자 ~15분).
- 하루 1 SKU 제약을 구조적으로 강제.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `date` | Date (unique) | 영업일. 토/일은 행 만들지 않음 |
| `sku` | Link → 제품 (single) | 그 날 생산할 SKU 1개 |
| `production_qty` | Number | 박스 수 |
| `status` | Single select | `planned` / `in_progress` / `done` / `skipped` |
| `notes` | Text | 변경 사유·작업자 메모 |

> Plan의 `production_qty`는 Schedule을 lookup. Schedule의 qty 수정 → Plan 자동 반영.

---

## 고객 테이블 (매핑 허브) — `tbl1kAgO2ISkSS3O6`

- **HubSpot 고객 ID + Xero ContactID + 매직/복구 토큰** (매핑 허브 키)
- 상호 / 담당자 / 이메일 / 연락처 / 기본 배송지 / payment term
- **고객 그룹 (single select): `내부고객` / `일반고객`** — Xero Contact의 default discount % 결정 (내부 5% / 일반 0%). 그룹 변경 시 n8n이 Xero 동기 갱신. **default = `일반고객`** (#0이 HubSpot Company 생성 시 set), 가맹점/자매사만 영업이 HubSpot에서 `내부고객`으로 변경.
- 고객 Hold (Xero에서 동기화: credit limit 초과·outstanding 문제) + hold reason + `outstanding` (currency)
- `credit_limit` (currency, AUD — `fldmZiwCKyybPcSCI`, 신설 2026-05-30) — #3이 `outstanding ≥ credit_limit` 비교로 hold 산출. 비어있으면 overdue만으로 판단. 온보딩 Credit Application tier에 따라 영업/admin 입력.
- 링크 재요청 횟수 (QR 스티커 트리거용)
- QR 스티커 추천 플래그 / 발급 여부

> **매직 토큰 발급 시점 (개정 2026-05-29)**: HubSpot Company 생성 직후 **n8n #0이 자동 발급**. 영업이 잠재고객을 HubSpot에 등록만 하면 즉시 토큰 보유 → 정식 온보딩 전에도 매직 링크 발송 가능. 따라서 고객 테이블 행은 두 가지 상태로 존재 가능: ① 완전(#7b가 payment term·배송지 등 채움) ② **pre-onboarding** (HubSpot ID + 매직 토큰 + 상호만 있음, 나머지 비어있음). Pre-onboarding 행은 derive 식별 — 별도 status 필드 없음 (Payment term blank로 판별).

---

## SMS 로그 테이블 — `SMS Log` — `tbljXGJsa4Wa7PCA6`

> **역할**: ClickSend로 발송한 모든 SMS 기록. #6a(주문 확인) 멱등 키, #6b(분실 복구) rate limit 카운트 source, 운영 감사·디버깅. 영구 보관.

| 필드 | 타입 | 비고 |
| --- | --- | --- |
| `sms_id` | autonumber | primary |
| `type` | single select | `order_confirmation` / `recovery` / `recovery_miss` / `recovery_blocked` |
| `phone` | text | E.164 정규화 (`+614XXXXXXXX`) |
| `body` | long text | 실제 발송 본문 (`recovery_miss`·`recovery_blocked`는 비움) |
| `order_no` | link → 오더 | #6a 한정 — 멱등 기준 |
| `customer` | link → 고객 | 매칭됐을 때 (#6a 옵션, #6b 매칭 시) |
| `clicksend_message_id` | text | ClickSend 응답 |
| `clicksend_status` | single select | `Success` / `Failed` / `Queued` |
| `cost_aud` | number | ClickSend `message_price` (segment·국가별 변동) |
| `error_message` | text | 실패 시 |
| `sent_at` | datetime | rate limit 윈도우 기준 — index 권장 |

뷰 후보: **최근 24h** (sent_at sort), **Failed 큐** (status=Failed, Slack 알림 follow-up), **type별 통계** (월별 group by), **rate-limited** (type=recovery_blocked, 남용 패턴 분석).

> 워크플로우 노드 흐름은 `../n8n/CLAUDE.md` #6a/#6b 상세. rate limit 정책: 전화번호 기준 시간당 3건·일 10건 (silent absorb).

---

## 온보딩 신청 테이블 — `Onboarding Submissions` (staging) — `tblWrkl7mDixzbpTK`

> **역할 (개정 2026-05-29)**: Tally 폼 제출 ~ **admin team 승인** 사이의 staging. n8n #7a가 생성, **admin이 Airtable에서 직접 review** (영업 X), **status=approved로 변경하는 것이 #7b 트리거** (개정 전: HubSpot Onboarding=approved가 트리거였음). 운영 가시화 + 멱등 키 보관 + 매칭 실패·forward 오염 케이스 처리 흔적.
>
> **Airtable 자동화 필요**: `status` 필드가 `under review → approved`로 변경되면 → n8n #7b webhook 호출. (운영 액션 신설)

| 필드 | 타입 | 비고 |
| --- | --- | --- |
| `submission_id` | text (unique) | Tally `submissionId` — #7a 멱등키 |
| `tally_form_id` | text | 다중 폼 운영 시 구분 |
| `submitted_at` | datetime | Tally 제출 시각 |
| `hubspot_company_id` | text | 매칭된 HubSpot Company ID (매칭 실패 시 비움) |
| `matched_via` | single select | `hubspot_id` / `hubspot_id_disputed` / `email` / `unmatched` / `invalid_id` |
| `forward_guard_flag` | checkbox | hidden ID 있으나 form email ≠ HubSpot Contact email |
| `shop_name`, `entity_name`, `abn`, `delivery_address` | text | 폼 입력값 |
| `form_email`, `form_phone` | text | 폼 입력 연락처 |
| `account_contact_name`, `account_contact_email`, `account_contact_phone` | text | (선택) 회계 담당 별도 |
| `payment_term_selection` | single select | `GoCardless DD` / `7-day credit` / `Prepay` / `COD` |
| `gocardless_mandate_id` | text | DD 완료 시 |
| `raw_payload_json` | long text | Tally raw payload 보관 (포렌식) |
| `status` | single select | `under review` / `propagated` / `rejected` / `archived` |
| `linked_customer` | link → 고객 | #7b가 propagate 후 채움 |
| `slack_thread_ts` | text | `#ops-onboarding` 알림 thread 회신용 |
| `created_at`, `updated_at` | datetime | |

뷰 후보: **review 큐** (status=under review), **forward guard 큐** (flag=true), **매칭 실패 큐** (matched_via=unmatched), **archived**.

> 워크플로우 노드 흐름은 `../n8n/CLAUDE.md` #7a/#7b 상세.

---

## 유용한 뷰

- **미배정 큐**: 고객 미배정 → 영업 신규 리드 전환 대기열
- **Hold 큐**: Hold 걸린 주문 → 결제/신용 대기
- **QR 추천 큐**: QR 스티커 추천 플래그 = true → 영업 전달 대기
- **SKU별 14일 forecast** (Plan): SKU 필터 + date sort
- **target_diff < 0** (Plan): 생산 부족 알람
- **다음 주 schedule** (Schedule): date ≥ 다음 월요일 sort
- **금주 작업지시** (Schedule): date = 오늘~+4 + status filter
- **D0 stock-taking 입력** (Plan): date = 오늘 3행 — 일마감 입력 폼
