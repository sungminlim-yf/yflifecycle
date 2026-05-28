# Airtable — 운영의 중심축 (Operation Hub)

> **도메인**: 공장의 production·dispatch·order를 굴리는 운영 OS이자, **시스템 간 ID 매핑 허브**.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 데이터가 오가는 워크플로우는 `../n8n/`, 재무 진실은 `../xero/`, 진입/승격은 `../onboarding/`

---

## 이 폴더가 다루는 것

- **Airtable이 무엇을 소유하는가** (운영 데이터 + 매핑 허브)
- 테이블·필드·관계 상세 → **`schema.md`**
- 생산계획·재고예측 (Make-to-stock) → **`production-planning.md`**
- 제품 스냅샷 (SoT는 제품 테이블) → **`products.md`**

> Airtable의 주된 활용 = **Operation**. Make-to-stock 시스템이라 재고는 출하를 막지 않고, 생산 계획을 굴려 재고를 유지한다. 핵심 업무: 생산계획·재고예측 / 주문 관리 / dispatch 관리.

---

## Airtable의 두 가지 역할

### 1. 주문 운영 (Operation)

오더·라인아이템·제품·고객 테이블로 주문 접수부터 dispatch까지 상태를 관리. picking 리스트, 컷오프 기반 수량 확정, Hold 큐·미배정 큐 등 운영 뷰가 여기서 나온다.

### 2. 통합 허브 (매핑 허브)

각 시스템의 외부 ID를 사슬로 엮지 않고, **Airtable 고객 레코드가 모든 키를 나란히 보관**한다.

```
Airtable 고객 레코드 (내부 단일 진실)
  ├── HubSpot 고객 ID   (영업/CRM)
  ├── Xero ContactID    (재무)
  ├── 매직/복구 토큰     (주문 인증)
  └── 상호·담당자·연락처·기본 배송지·payment term
```

- 모든 오더 행은 Airtable 고객 레코드에 연결됨. 게스트는 미연결(미배정) 상태.

---

## 데이터 소유권 (Airtable 관점)

- **Airtable이 소유**: "무엇을 주문했는가"(오더/라인아이템), "제품/가격/재고 기준값"(제품 테이블 = SoT), 시스템 간 ID 매핑, 운영 상태(출하/Hold/컷오프).
- **Airtable이 받아오는 것**: 결제 상태·고객 Hold·hold reason·outstanding 등 재무 데이터(← Xero, `../xero/` 참조), 신규 고객 ID·토큰(← 승격 시).
- **Airtable이 내보내는 것**: dispatch 시 인보이스 생성 트리거(→ Xero), 미배정/예외 알림(→ Slack).

> 실제 "주고받는 방식·세팅·트리거"는 모두 **워크플로우 영역 → `../n8n/`**. 여기서는 Airtable이 어떤 데이터를 들고 어디에 연결되는지(소유권·스키마)만 소유.

---

## 시스템 간 연결 요약 (Airtable 기준)

| 상대 | 방향 | 내용 |
| --- | --- | --- |
| 주문 사이트 | → Airtable | 주문 제출 → 오더 + 라인아이템 행 생성 |
| Airtable → Xero | → | **dispatch 시** 인보이스 생성 (payment term별 분기) |
| Xero → Airtable | ← | 인보이스 Paid → 결제 Paid + Hold 해제 / 고객 hold·hold reason·outstanding 동기화 |
| HubSpot/Xero → Airtable | ← | 신규 고객 → ID 매핑·토큰 발급 (승격 시) |
| Airtable → 영업(Slack) | → | 미배정·소급 매칭·중복·취소·QR 추천 알림 |

> 세부 트리거·노드·동기화 방식은 `../n8n/`. 결제 동기화 규칙·공유 데이터는 `../xero/`.

---

## 이 폴더의 문서

| 파일 | 내용 |
| --- | --- |
| `schema.md` | 오더·라인아이템·제품·고객 테이블의 필드·관계(link)·뷰 |
| `production-planning.md` | 생산계획·재고예측 모듈 (Make-to-stock) |
| `products.md` | 사람용 제품 스냅샷 (SoT = 제품 테이블) |
