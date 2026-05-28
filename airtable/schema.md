# Airtable 스키마 — 테이블·필드·관계

> **상위 컨텍스트**: `CLAUDE.md` (이 폴더), 루트 `../CLAUDE.md`
> 초안 단계. 운영 중 변경 시 이 문서와 실제 Airtable 베이스를 함께 맞춘다.

---

## 테이블 관계도 (개요)

```
고객(1) ──< 오더(*) ──< 라인아이템(*) >── 제품(1)
              │
              └── (게스트는 고객 미연결 = 미배정)
```

- **고객 1 : 오더 N** — 한 고객이 여러 오더.
- **오더 1 : 라인아이템 N** — 품목별 수량은 자식(라인아이템) 테이블에서 관리.
- **라인아이템 N : 제품 1** — 라인아이템이 제품 테이블을 link, 단가 등은 lookup.

---

## 오더 테이블

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| 주문번호 | Auto number | ORD-1001 형식 |
| 고객 | Link | Airtable 고객 레코드 연결 (비어 있으면 미배정/게스트) |
| 고객 상태 | Single select | 등록완료 / 미배정 |
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

## 라인아이템 테이블

- 오더(1) ──< 라인아이템(*) 구조. picking(피킹 리스트)·Xero 인보이스 line 매핑에 사용.
- 필드: 오더(link), 제품(link → 제품 테이블), **수량(박스 수)**, **단가(박스 단가, 제품 lookup)**, **subtotal(formula = 박스 단가 × 수량)**
- 주문 단위는 **박스**. kg는 제품 테이블의 기준값(box 중량 × kg 단가)에서 derived.

---

## 제품 테이블 (SoT)

- SKU / 품목명 / 단위 / **박스당 수량 (kg)** / **kg 단가 (현재 통일 $13)** / **박스 단가 (formula = kg 단가 × 박스 kg)** / MOQ / Xero Item Code
- **Target stock / Safety stock** (생산·예측 모듈이 lookup으로 사용 → `production-planning.md`)
- 사람용 스냅샷: `products.md`
- 가격 규칙·할인·GST 상세는 `../xero/`. 단가는 단일·할인은 Xero Contact 단계에서 적용.

---

## 고객 테이블 (매핑 허브)

- **HubSpot 고객 ID + Xero ContactID + 매직/복구 토큰** (매핑 허브 키)
- 상호 / 담당자 / 이메일 / 연락처 / 기본 배송지 / payment term
- **고객 그룹 (single select): `내부고객` / `일반고객`** — Xero Contact의 default discount % 결정 (내부 5% / 일반 0%). 그룹 변경 시 n8n이 Xero 동기 갱신.
- 고객 Hold (Xero에서 동기화: credit limit 초과·outstanding 문제) + hold reason
- 링크 재요청 횟수 (QR 스티커 트리거용)
- QR 스티커 추천 플래그 / 발급 여부

---

## 유용한 뷰

- **미배정 큐**: 고객 미배정 → 영업 신규 리드 전환 대기열
- **Hold 큐**: Hold 걸린 주문 → 결제/신용 대기
- **QR 추천 큐**: QR 스티커 추천 플래그 = true → 영업 전달 대기
