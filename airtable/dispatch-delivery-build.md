# 출하·배송 UI 빌드 가이드 (픽 / 드라이버 / Delivery Slip)

> **목적**: 루트 `../CLAUDE.md` "오더 상태·출하 프로세스" 결정을 Airtable UI로 구현. **전부 사용자 손작업** (Interface·Page Designer·lookup 필드는 API로 생성 불가).
> **전제**: `오더 상태`(접수/출하완료/취소) + `출하 가능` formula(fldeJ55Vgc1N8qufE) 이미 존재. Airtable Pro (Page Designer·Interface는 Pro).
> **핵심 원칙**: 픽·드라이버 화면의 출하 대상 = **`출하 가능`=checked** 오더만 (오더 상태=접수 AND 오더 Hold OFF AND 고객 Hold OFF). 가격은 Delivery Slip에 **절대 노출 안 함** (가격차별 컴플레인 방지 — 가격은 Xero 이메일 인보이스로만).

---

## 0. 선행 작업 — 라인아이템 lookup 3개 추가 ✅ 완료 (2026-06-01)

픽 리스트는 **라인아이템**을 SKU별로 합산·고객별로 묶는다. 그런데 라인아이템엔 부모 오더의 `출하 가능`·배송일·상호가 없어 필터·그룹을 못 건다. → 라인아이템 테이블(`tblVXVQzT1q8U0HJQ`)에 lookup 3개 추가 **완료**:

| 필드명 (실제) | field ID | source 필드 |
|---|---|---|
| `출하 가능 (from 오더)` | `fld8MNbXVEtCAC4kw` | `출하 가능` (fldeJ55Vgc1N8qufE, checkbox) |
| `requested_delivery_date (from 오더)` | `fldewkc2G1NLdPhAn` | `requested_delivery_date` (fldnOqAz5R0NE8Dpu, date) |
| `상호 (from 오더)` | `fldIxmt5Lb0ThJCE8` | `상호` (fld3LqaFvwXTdZx8V, text) |

이미 있는 라인아이템 lookup: `Order No (from 오더)`, `품목명 (from 제품)`.

> ⚠️ **인터페이스 필터 팁**: `출하 가능 (from 오더)`는 checkbox를 lookup한 값이라 배열이다. 인터페이스 필터에서 `is checked`(또는 `is any of → checked`)로 거른다. 만약 옵션이 애매하면 `출하 가능 (from 오더)` **is not empty** 가 아니라 반드시 **checked 값** 기준으로 필터할 것 (꺼진 오더도 `[unchecked]`로 not-empty라 오판 가능 — lookup NOT() 함정과 동류).

---

## 1. 픽 인터페이스 (Pick) — 공장 작업자용

**Interface** → 새 page 2개 (또는 1 page에 2 섹션). 둘 다 source = **라인아이템**.

### 1a. SKU 합계 (일괄 픽)
- **Page type**: List (또는 Grid) on 라인아이템
- **Filter**: `출하 가능 (from 오더)` is checked
- **(권장 추가 filter)**: `requested_delivery_date (from 오더)` is `today`(또는 내일) — 그날 출하분만
- **Group by**: `품목명 (from 제품)`
- **표시 / 집계**: 그룹 footer에 `수량` **Sum** → "KATSU 총 38박스" 식으로 픽 수량이 한눈에.
- 작업자는 SKU별 총 박스 수만 보고 냉동고에서 일괄 픽.

### 1b. 고객별 staging 재확인
- **Page type**: List on 라인아이템
- **Filter**: `출하 가능 (from 오더)` is checked (+ 같은 배송일 filter)
- **Group by**: `상호 (from 오더)` (또는 `Order No (from 오더)`)
- **표시**: `품목명 (from 제품)`, `수량`
- 일괄 픽한 재고를 고객별로 나눠 담을 때 체크리스트로 사용. (가격 컬럼 넣지 말 것)

> 흐름: 1a로 총량 픽 → 1b로 고객별 분배·재확인 → 로딩 → 드라이버.

---

## 2. 드라이버 인터페이스 (Dispatch) — 출하완료 토글

**Interface** → 새 page. source = **오더**.

- **Page type**: List → record 클릭 시 detail, 또는 Record review layout
- **Filter**: `출하 가능` is checked (+ 배송일 = today 권장)
- **카드/리스트 표시**: `상호`, `실제 배송지`(fldhd9peNop1qrQwt formula), `연락처`, `requested_delivery_date`, `Order No`
- **inline 편집 필드**: `오더 상태` (single select) 를 editable로 추가
  - 드라이버가 트럭 출발 시 해당 오더 `오더 상태`를 **`출하완료`**로 토글
  - → Airtable Automation #2/#2.5 트리거 발화 → Xero 인보이스(#2 DD/Credit, COD는 #2.5가 이미 주문 시 발행) → `출하 가능`이 자동으로 false가 되어 리스트에서 사라짐
- (옵션) 라인아이템 관련 레코드 블록으로 `품목명`+`수량` 표시 — 드라이버가 적재 확인용. 가격 제외.

> `출하완료`=트럭 출발=dispatch=#2 인보이스 트리거 (루트 CLAUDE.md 결정). 별도 `배송완료`(수령 사인·사진)는 드라이버 모바일앱 도입 시 future workstream — 이 묶음 범위 밖.

---

## 3. Delivery Slip (Page Designer) — 고객 전달용, 가격 제외

**Page Designer** 익스텐션 (그리드 뷰 → Extensions → Page Designer). source record = **오더** 1건.

### 레이아웃 (가격 필드 절대 금지)
- **헤더**: Young Foods 로고/상호, "Delivery Slip"
- **고객 블록**: `상호`(fld3LqaFvwXTdZx8V), `실제 배송지`(fldhd9peNop1qrQwt), `연락처`(fldanpEelyeT0y340), `requested_delivery_date`, `Order No`(fldA1PtkMf6P4Zdln)
- **품목 테이블** (라인아이템 관련 레코드 블록): 컬럼 = `품목명 (from 제품)`, `수량`(박스) — **단가·subtotal·주문 총액 컬럼 넣지 말 것**
- **하단**: 받는사람 서명란 (1부는 사인 = 배송 증거로 회수) + 비고/오더노트

### 출력
- **고객별 2부** 인쇄: 1부 고객 보관, 1부 서명 후 회수(배송 증거).
- Page Designer는 한 번에 1 레코드. 그날 출하 오더를 그리드에서 `출하 가능=checked` 뷰로 필터 후, 각 오더 레코드에서 Page Designer로 PDF/print.
- 가격은 **Xero 이메일 인보이스**로만 별도 전달 (Delivery Slip엔 없음).

---

## 4. 점검 체크리스트 (가동 전)

- [x] 라인아이템 lookup 3개 추가 (`출하 가능 (from 오더)`/`requested_delivery_date (from 오더)`/`상호 (from 오더)`) — 2026-06-01 완료
- [ ] 픽 인터페이스 1a(SKU 합계)·1b(고객별) 빌드
- [ ] 드라이버 인터페이스 빌드 + `오더 상태` editable
- [ ] Delivery Slip Page Designer 레이아웃 (가격 필드 0개 재확인)
- [ ] #2 Automation 트리거 = `오더 상태=출하완료` + payment ∈ {Direct Debit (default), Credit - 7 days} (→ `automation-setup-guide.md` Automation 1)
- [ ] #2.5 Automation 트리거 = `오더 상태=접수` + payment=COD (→ `automation-setup-guide.md` Automation 2)
- [ ] E2E: `출하 가능` 오더 1건 → 드라이버 `출하완료` 토글 → #2 인보이스 발행 → 리스트에서 사라짐 확인

---

## 관련 문서
- 트리거 조건·webhook URL: `automation-setup-guide.md` (Automation 1·2)
- 오더 상태·출하 프로세스 결정 원본: `../CLAUDE.md` "오더 상태·출하(픽/배송) 프로세스"
- 스키마(필드 ID): `schema.md`
