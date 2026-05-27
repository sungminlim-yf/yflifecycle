# Young Foods — 품목(제품) 정보

> **Source of Truth = Airtable 제품 테이블**입니다.
> 이 문서는 사람이 읽는 참조용 스냅샷입니다. 운영 중 가격/재고 기준값이 바뀌면
> **Airtable 제품 테이블을 먼저 고치고**, 이 문서는 사후에 맞춰 갱신하세요.
> 생산·재고 예측(`production-planning.md`)은 safety/target stock을 Airtable 제품 테이블에서 lookup으로 끌어옵니다.

---

## 품목 목록 (냉동 제품 3종)

| SKU (= 바코드)       | 약칭     | 품목명                      | 단위(박스 순중량) | 박스당 수량            | 단가(ex-GST) | MOQ | Xero Item Code |
| -------------------- | -------- | --------------------------- | ----------------- | ---------------------- | ------------ | --- | -------------- |
| `KATSNCP1P2MKBRBKV1` | KATSU    | Golden Panko Chicken Cutlet | 6kg / 박스        | 약 30조각 (개당 ~200g) |              |     |                |
| `GARSNCP1P2MGTHBKV1` | KARAAGE  | Crispy Chicken Bites        | 2.5kg / 박스      | — (25 servings)        |              |     |                |
| `TERSNCP300MTTHBKV1` | TERIYAKI | Pre-Cooked Chicken Thigh    | 2.5kg / 박스      | — (25 servings)        |              |     |                |

> **SKU = 바코드 전체 문자열**(회사 공식 SKU). 약칭은 화면 표시·대화용 별칭일 뿐 키 아님.
> **SKU 3종 모두 공식 바코드 PDF로 글자 단위 검증 완료** (2026-05-27).
> 출처: Dropbox `…/20. Recipe SKU Label/01. Recipe Label SKU/` 의 라벨 이미지(`1/2/3.png`) + 바코드 PDF(`SKU KATSU/KARAAGE/TERI BARCODE.pdf`, Code 128).
> 남은 칸: **단가 · MOQ · Xero Item Code** (라벨에 없음 — 별도 입력 필요).

---

## 품목 상세 (라벨 기준)

### 1. KATSU — Golden Panko Chicken Cutlet `KATSNCP1P2MKBRBKV1`

- **부제**: Crumbed Chicken Breast (Katsu Style)
- **순중량 / 박스당**: 6kg (30 × 약 200g)
- **보관**: 냉동 -18°C 이하
- **유통기한(Best Before)**: 생산일로부터 6개월 (-18°C 이하 보관 시)
- **조리 상태**: 생것(raw) — 조리 후 섭취 (Cook thoroughly before consumption)
- **조리법**: 냉동 상태로 조리. 180°C에서 내부 온도 ≥75°C까지 deep fry. 해동 후 재냉동 금지.
- **알레르겐**: **Wheat, Soy, Celery** 함유 (may contain **Sesame**)
- **원재료**: Chicken, Water, Coating (Wheat flour, starches), Breadcrumbs (Wheat flour, yeast, salt), Seasoning, Sugar, Salt, Dextrose, Yeast extract, Flavour enhancer (450, 500), Thickener (415), Phosphate (451, 452), Spices

### 2. KARAAGE — Crispy Chicken Bites `GARSNCP1P2MGTHBKV1`

- **부제**: Karaage-Style Seasoned & Coated Chicken Pieces
- **순중량 / 박스당**: 2.5kg (25 servings)
- **보관**: 냉동 -18°C 이하
- **유통기한(Best Before)**: 생산일로부터 6개월 (-18°C 이하 보관 시)
- **조리 상태**: 반조리(partially cooked) — 조리 후 섭취
- **조리법**: 냉동 상태로 조리. 180°C에서 황금색·내부 온도 ≥75°C까지 deep fry. 해동 후 재냉동 금지.
- **알레르겐**: **Wheat, Soy, Sesame** 함유
- **원재료**: Chicken, Water, Seasoning (including Soy, Wheat), Coating (Wheat flour, starches), Sugar, Vegetable powders, Spices, Vegetable oil (Sesame), Salt, Raising agents (450, 500), Thickener (415), Flavour enhancer (635)

### 3. TERIYAKI — Pre-Cooked Chicken Thigh `TERSNCP300MTTHBKV1`

- **부제**: Lightly Coated — Ideal for Stir-fry, Sauces & Teriyaki
- **순중량 / 박스당**: 2.5kg (25 servings)
- **보관**: 냉동 -18°C 이하
- **유통기한(Best Before)**: 생산일로부터 6개월 (-18°C 이하 보관 시)
- **조리 상태**: 반조리(partially cooked) — 바로 먹을 수 없음, 가열 후 섭취
- **조리법**: 냉장 해동 → 필요 시 슬라이스 → 중불 pan fry(예: teriyaki 소스) 또는 180°C deep fry로 가열. 충분히 가열 후 섭취. 해동 후 재냉동 금지.
- **알레르겐**: 선언된 알레르겐 없음. may contain **Wheat, Soy, Sesame**
- **원재료**: Chicken, Water, Coating (starches), Sugar, Salt, Maltodextrin, Phosphate (451, 452), Thickener (415)

### 영양 정보 (Serving size 100g 기준)

| 항목                 | KATSU             | KARAAGE           | TERIYAKI          |
| -------------------- | ----------------- | ----------------- | ----------------- |
| Servings per package | 60                | 25                | 25                |
| Energy (per 100g)    | 750 kJ (180 kcal) | 950 kJ (227 kcal) | 900 kJ (215 kcal) |
| Protein              | 16.0 g            | 13.5 g            | 14.0 g            |
| Fat, total           | 4.0 g             | 12.0 g            | 11.0 g            |
| — Saturated          | 1.0 g             | 2.5 g             | 2.5 g             |
| Carbohydrate         | 18.0 g            | 15.0 g            | 13.0 g            |
| — Sugars             | 1.5 g             | 2.5 g             | 2.5 g             |
| Sodium               | 400 mg            | 520 mg            | 360 mg            |

- 원산지: 3종 모두 **Made in Australia from local and imported ingredients**
- 제조사: **Young Foods Pty Ltd** — U1/526 Maroochydore Rd, Kunda Park QLD 4556, Australia (ABN 43 695 554 799 · customer@youngfoods.com.au)

---

## 재고 기준값 (생산·예측용)

> 아래 값도 실제로는 **Airtable 제품 테이블에서 관리**합니다. 여기엔 참조용으로만 적어두세요.

| SKU                  | Target stock | Safety stock | 비고 |
| -------------------- | ------------ | ------------ | ---- |
| `KATSNCP1P2MKBRBKV1` |              |              |      |
| `GARSNCP1P2MGTHBKV1` |              |              |      |
| `TERSNCP300MTTHBKV1` |              |              |      |

---

## 가격 관련 메모

- 인보이스 금액 산출: 오더 → Xero 인보이스 생성 시 **단가는 Airtable 제품 테이블 값**을 line item에 실어 보냄.
- 고객별 차등가가 있는가? (있다면 별도 가격 테이블/필드 설계 필요) — **미정, 채워주세요**
- 가격 표기는 GST 포함인가 별도인가? — **미정, 채워주세요**
- 단가·MOQ·Xero Item Code는 라벨에 없는 정보 → 영업/재무 기준으로 별도 입력 필요.
