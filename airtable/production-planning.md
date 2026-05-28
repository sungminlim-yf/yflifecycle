# 생산계획 · 재고예측 (Make-to-stock)

> **상태**: 설계 예정 (스텁). 다음 작업 후보 — 루트 `../CLAUDE.md`의 "다음 대화에서 이어갈 내용" 참조.
> **상위 컨텍스트**: `CLAUDE.md` (이 폴더), 루트 `../CLAUDE.md`
> **기준값 출처**: 제품 테이블의 Target/Safety stock을 lookup (`products.md`, `schema.md`)

---

## 모듈의 목적

Make-to-stock 시스템 — **재고는 출하를 막지 않는다.** 대신 생산 계획을 굴려 재고를 유지한다. 이 모듈은 "무엇을 얼마나 언제 생산할지"를 결정한다.

---

## 확정된 원칙

- **Forecast 구간**:
  - **D+1**: 확정 주문 (컷오프 닫힌 익일 dispatch 수량)
  - **D+2 ~ D+14**: historical 기반 추정
- **컷오프**: 배송 전날 12pm → 닫히면 D+1 dispatch 수량 확정 (오더 컷오프 정의는 `../order-site/`)
- 재고 기준값(Target/Safety stock)은 제품별로 **Airtable 제품 테이블에서 관리** → 예측 로직이 lookup.

---

## 설계할 항목 (TODO)

- [ ] 수요 예측 입력: 확정 주문(D+1) + historical(D+2~14)을 어떻게 합산/가중할지
- [ ] 생산 지시(production order) 산출 로직: target stock − 현재고 − 입고예정 + 예측수요
- [ ] 재고 차감 시점: dispatch 시 차감 vs picking 시 차감
- [ ] 생산·입고 기록을 담을 테이블 설계 (현 `schema.md`에 미포함)
- [ ] 리드타임·생산 배치(MOQ) 반영
