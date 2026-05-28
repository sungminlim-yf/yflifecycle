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
| **GoCardless DD** | **dispatch 시** | 인보이스 due date = **매주 화요일**, Xero–GoCardless 네이티브 자동 수금 |
| **7-day credit** | **dispatch 시** | 고객이 직접 결제 (7일 신용) |
| **선결제 / COD** | **dispatch 전** | 결제 확인 후 출하 (Hold) |

- **오더 1개 = Xero 인보이스 1개** (1:1). DD 고객은 한 주간 발생한 인보이스들이 그 주 화요일에 묶여 자동 수금. 정산은 BECS 리드타임(2~3 영업일) 후 통장 입금.
- DD 수금은 **due date 기준 자동** → 파일 업로드/수동 입력 불필요. mandate(BECS DDR)는 **온보딩 시 1회 동의** (`../onboarding/`).
- **due date 산정 규칙(운영 룰)**: dispatch 시점에 인보이스 due date를 "**다음 화요일**"로 자동 설정. 단 BECS 사전 통지 리드타임 때문에 **월·화요일 dispatch 인보이스는 그 주가 아니라 다음 주 화요일로 밀어 설정** (당일·익일 collection 불가). n8n 워크플로우가 이 규칙으로 due date를 자동 계산.

### 선결제/COD 고객 (dispatch 전 결제)

- 출하 상태 = **Hold** → 결제 확인 후 출하
- 결제 경로 ①: 직접 계좌이체 → 입금 확인 후 Xero 인보이스 Paid 처리
- 결제 경로 ②: Xero 인보이스 "Pay now" 링크 → 온라인 결제 → 자동 Paid (운영 권장)

---

## 가격·할인·배송비 (Xero 인보이스 가산·감산)

Airtable에서 넘어오는 line item subtotal은 **base 청구가**(박스 단가 × 수량 합). Xero 인보이스 생성 시 두 가지 조정이 들어간다.

### 가격 자체는 통일가 (GST-free)

- 모든 SKU 단일가 **AUD 13 / kg** (박스 단가 = 13 × 박스 kg). SoT는 Airtable 제품 테이블 → `../airtable/products.md`.
- **GST-free** (호주 기본식품) — Xero 인보이스 line tax rate = `GST Free Income`.
- 차등가는 "단가"가 아니라 "할인"으로 표현 → 아래 ①.

### ① 고객 그룹별 할인 — Xero Contact default discount %

- **고객 그룹** (Airtable 고객 테이블, 2개): `내부고객`(가맹점·자매사, 로열티 납부) / `일반고객`(그 외)
- **적용 방식**: 각 Xero Contact의 **default discount %** 필드에 그룹 값을 저장 — 내부고객 = **5%**, 일반고객 = **0%**. Xero가 인보이스 발행 시 모든 line에 자동 적용.
- **세팅 시점**: 신규 고객 승격 시 Xero Contact 생성 단계에서 그룹에 맞춰 입력 (`../onboarding/`, `../n8n/`).
- 그룹 변경 시: Airtable 그룹 필드 + Xero default discount %를 동기로 갱신해야 함 (n8n 책임).

### ② 배송비 — 2단계 무료선

- **임계값 (할인 전 subtotal 기준)**:
  - `subtotal < AUD 300` → **배송비 AUD 10**
  - `subtotal ≥ AUD 300` → **배송비 무료**
- **할인 전 subtotal**: Airtable 라인아이템 subtotal 합(박스 단가 × 수량). 그룹 할인 적용 **전** 금액 — 일반/내부고객 동일 기준이라 안내·화면 표시 일관 ("$300 주문 시 무료"가 둘 다 맞음).
- **그룹 할인 미적용**: n8n이 배송비 라인 추가 시 **line discount % = 0**으로 명시 override. 배송비는 원가 회수 성격이라 5% 그룹 할인 대상 아님.
- **적용 시점**: n8n이 인보이스 생성 시 배송비 라인을 별도로 추가 (`../n8n/`). Xero 네이티브 자동화가 아님.
- ⚠️ **배송비의 GST 취급**: 본 품목은 GST-free지만 배송비 자체의 세금은 별도 — 본품 공급의 부수 운임이면 GST-free, 그렇지 않으면 GST 10%. 회계사 확인 필요 (미결).

### 최종 인보이스 금액 (한눈에)

```
S = Σ(박스 단가 × 박스 수)              ← Airtable 라인아이템 subtotal (할인 전)

인보이스 금액
  = S
  − S × Xero Contact discount %         ← 내부 5% / 일반 0% (배송비엔 미적용)
  + (S < $300 ? $10 : $0)               ← n8n이 배송비 라인 별도 추가
```

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
| 배송비 GST 처리 | 본품 GST-free 부수 운임의 GST-free 여부 — 회계사 확인 후 Xero item config 확정 |
