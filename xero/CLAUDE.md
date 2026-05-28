# Xero — 재무 진실 (Source of Truth)

> **도메인**: 인보이스·결제·미수금·급여·GST·bank rec의 **재무 SoT**. 그리고 그 진실 중 **무엇을 영업(HubSpot)·Admin(Airtable)에게 공유할지**.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 수금 자동화는 GoCardless(아래), 동기화 워크플로우는 `../n8n/`, 결제 상태가 꽂히는 테이블은 `../airtable/schema.md`

---

## 이 폴더가 다루는 것

- payment term별 인보이스 발행 시점·수금 방식
- Hold 모델 (고객 단위 / 오더 단위) — 출하를 좌우하는 재무 조건
- Xero ↔ Airtable 결제 동기화 규칙
- **영업/Admin에게 공유해야 할 재무 데이터** (이 폴더의 핵심 책임)

> Xero가 재무/회계/급여의 주된 업무 영역이자 **돈에 관한 단일 진실**. "돈을 냈는가/어떻게 수금하는가"의 소유자.

---

## Payment term별 인보이스 발행 시점

출하를 좌우하는 변수 = **payment term 유무 + hold 여부**

| 고객 유형 | 인보이스 발행 시점 | 수금 방식 |
| --- | --- | --- |
| **GoCardless DD** | **dispatch 시** | 인보이스 due date를 주간 수금 요일로 맞춰 Xero–GoCardless 네이티브 자동 수금 |
| **7-day credit** | **dispatch 시** | 고객이 직접 결제 (7일 신용) |
| **선결제 / COD** | **dispatch 전** | 결제 확인 후 출하 (Hold) |

- **오더 1개 = Xero 인보이스 1개** (1:1). DD 고객은 인보이스들이 주중 쌓였다가 수금 요일에 자동 수금.
- DD 수금은 **due date 기준 자동** → 파일 업로드/수동 입력 불필요. mandate(BECS DDR)는 **온보딩 시 1회 동의** (`../onboarding/`).
- **주의(BECS)**: DD는 제출 후 약 2~3 영업일 뒤 정산. 수금 요일 직전 발행 인보이스는 다음 사이클로 밀릴 수 있음 → 수금 요일은 이 리드타임 감안.

### 선결제/COD 고객 (dispatch 전 결제)

- 출하 상태 = **Hold** → 결제 확인 후 출하
- 결제 경로 ①: 직접 계좌이체 → 입금 확인 후 Xero 인보이스 Paid 처리
- 결제 경로 ②: Xero 인보이스 "Pay now" 링크 → 온라인 결제 → 자동 Paid (운영 권장)

---

## Hold 모델 (2단위)

| Hold 종류 | 발생 원인 | 단위 | 해제 |
| --- | --- | --- | --- |
| **고객 단위 hold** | credit limit 초과, outstanding invoice 문제 | 고객 전체 | Xero 상태 해소 시 |
| **오더/인보이스 단위 hold** | 일부 COD 고객, 선결제 | 개별 오더 | 결제 확인 시 |

**출하 가능 = NOT(고객 hold) AND NOT(오더 hold)** — Hold 플래그가 사는 곳은 `../airtable/schema.md`.

- ⚠️ "credit limit 초과"는 Xero가 push 이벤트로 주지 않음 → **outstanding 합계 vs credit limit 비교 계산을 별도 로직에서 직접** 수행해야 함 (구현 위치: `../n8n/`).

---

## Xero ↔ Airtable 결제 동기화

- `Airtable → Xero`: **dispatch 시** Xero 인보이스 생성 (선결제/COD는 dispatch 전). line item 동반.
- `Xero → Airtable`: 인보이스 Paid → 결제 상태 Paid + (선결제/COD면) Hold 해제. 고객 hold 상태도 동기화.
- **핵심**: Xero webhook으로 실시간 감지 + **주기적 reconciliation 폴백** (webhook 유실 대비)
- 취소/반품으로 인보이스 무효화 시 → 수동 **credit note** (예외 흐름은 `../n8n/`).

> 동기화의 트리거·노드·폴백 스케줄 등 구현은 `../n8n/`. 여기서는 **무엇이 진실이고 어떤 규칙으로 반영되는지**만 소유.

---

## 영업·Admin에게 공유할 재무 데이터 ★

Xero는 SoT지만, 영업사원(주로 HubSpot)과 Admin팀(주로 Airtable)도 **일부 재무 상태를 봐야 한다.** 모든 재무 정보가 아니라, **업무 판단에 필요한 최소 항목**만 내보낸다. 이 데이터는 dispatch 가능 여부에도 직접 영향을 준다.

| 공유 항목 | 받는 쪽 | 왜 필요한가 |
| --- | --- | --- |
| **account hold status** | HubSpot(영업) + Airtable(Admin) | 출하 가능 여부 판단, 고객 응대 |
| **hold reason** | HubSpot + Airtable | 왜 막혔는지 → 영업이 고객에게 설명·해소 유도 |
| **overdue 여부** | HubSpot + Airtable | 연체 고객 식별, 추가 주문/출하 보류 판단 |
| **outstanding invoice amount** | HubSpot + Airtable | 미수금 규모 파악, credit limit 대비 여력 |
| **credit limit (대비 여력)** | Airtable(계산용) | outstanding과 비교해 고객 hold 산출 |

- **원칙**: 영업이 알아야 하는 점 위주. payroll·GST·bank rec 같은 내부 회계 디테일은 공유하지 않음.
- 공유 경로: Xero → Airtable 동기화 → (필요분) Airtable → HubSpot. 트리거·매핑은 `../n8n/`.

---

## GoCardless (BECS Direct Debit)

- **역할**: BECS Direct Debit 기반 자동 수금. **Xero 네이티브 연동**으로 인보이스 due date에 자동 수금.
- mandate는 온보딩 시 Billing Request Flow로 1회 동의 (`../onboarding/`).
- DD 수금 결과는 GoCardless → Xero로 자동 반영·대사.

---

## 미결 사항 (이 도메인)

| 항목 | 선택지 / 메모 |
| --- | --- |
| 고객별 차등가 / GST 표기 | `../airtable/products.md` 참조 — 단일가 vs 고객별가, GST 포함/별도 |
| DD 주간 수금 요일 | BECS 리드타임(2~3영업일) 감안해 확정 |
