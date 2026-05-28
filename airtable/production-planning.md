# 생산계획 · 재고예측 (Make-to-stock, 14일 rolling)

> **상태**: v1 설계 (2026-05-28). 운영 시작 후 보정 예정.
> **상위 컨텍스트**: `CLAUDE.md` (이 폴더), 루트 `../CLAUDE.md`
> **연결**: 제품 테이블의 Target/Safety/Default-dispatch 값 (`schema.md`·`products.md`)

---

## 모듈의 목적

Make-to-stock 시스템 — **재고는 출하를 막지 않는다.** 대신 생산 계획을 굴려 재고를 유지한다. 이 모듈은 **"어느 SKU를 언제 얼마나 생산할지"**를 14일 rolling forecast로 결정한다.

**의도적 단순화**: 주문/오더/dispatch 흐름과 생산 흐름을 의도적으로 끊는다. 박스 단위, 일마감 실측 SoT, 수동 schedule, historical 평균 — 초기 단계 시스템 복잡도를 최소화하고 운영 편의를 우선한다.

---

## 확정된 원칙

- **모든 단위 = 박스.** 재고·생산·dispatch forecast·target/safety stock 모두 박스 수로 표기 (주문 라인아이템 단위와 일치 → 환산 불요).
- **재고 SoT = Day 0 일마감 실측만.** D+1 ~ D+14는 formula 기반 rolling 계산 (자동 차감/증가 없음). 매일 마감 시 SKU 3개 실측치 입력 → 다음날 stock_open.
- **Dispatch forecast 모델**: 제품 테이블에 SKU별 `default_dispatch_per_day` 1값 + Plan 행의 일자별 `dispatch_override` (있으면 우선). 초기 = 감, 운영 1~2개월 후 historical 평균으로 default 갱신.
- **하루 1 SKU 생산.** Line setup 비용 때문에 연속 며칠 이어가는 게 효율적. 우선순위 순서 KAT → GAR → TER (KAT은 튀김+no cooling, GAR/TER는 라인 공유).
- **5영업일 cycle**: 월~금 5일을 KAT/GAR/TER에 **3/3/2 또는 2/2/1**로 분배. 토/일 휴무.
- **Schedule = 매주 1회 수동.** 담당자가 금/토에 다음 주 5일 일정 입력. Plan의 target_diff view를 보고 판단.
- **Forecast 구간**: D+1(확정주문) / D+2~D+14(historical) — 컷오프 닫힌 시점에 D+1 dispatch가 actual로 lock (연결은 `../n8n/` #1 흐름과 결합 예정 — 미결).

---

## 데이터 구조 — 2개 테이블

### Table A. `Production Plan` (forecast 테이블, 행 = SKU × 날짜)

14일 × 3 SKU = **42행 rolling**. 토/일 행 포함 (production=0, dispatch=0 default).

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `sku` | link → 제품 | SKU 식별 |
| `date` | date | 행의 날짜 (오늘 ~ +13일) |
| `weekday` | formula | `WEEKDAY({date})` — 토/일 식별용 |
| `is_business_day` | formula | weekday in 월~금 |
| `stock_open` | formula | D0: 일마감 실측 입력값 / D+1~: `{stock_close prev row of same SKU}` |
| `production_qty` | lookup or formula | `Production Schedule` 행 매칭 시 그 qty, 아니면 0 |
| `dispatch_override` | number | 일자별 수동 override (특정 일 큰 주문 등). 비워두면 default 적용 |
| `dispatch_forecast` | formula | `IF(dispatch_override, dispatch_override, IF(is_business_day, sku.default_dispatch_per_day, 0))` |
| `stock_close` | formula | `stock_open + production_qty − dispatch_forecast` |
| `target_stock` | lookup | 제품 테이블의 SKU별 target_stock |
| `safety_stock` | lookup | 제품 테이블의 SKU별 safety_stock |
| `target_diff` | formula | `stock_close − target_stock` (음수 = 부족) |
| `safety_diff` | formula | `stock_close − safety_stock` (음수 = 위험) |
| `notes` | text | 특이사항 (예: "다음주 신규 고객 100박스 예상") |

**Stock_open 처리**: Day 0 행만 입력 가능 (자동 fill 불가능한 행). D+1~D+14는 이전 행의 stock_close를 참조하는 formula. 일마감 시 실측값을 D0 행에 입력하면 자동으로 14일치가 재계산.

### Table B. `Production Schedule` (생산 일정, 행 = 날짜)

매주 1회 수동 입력. 1행 = 1영업일에 생산할 단일 SKU.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `date` | date (unique) | 영업일 (월~금). 토/일은 행 만들지 않음 |
| `sku` | link → 제품 | 그 날 생산할 SKU 1개 (link single) |
| `production_qty` | number | 박스 수 |
| `status` | single select | `planned` / `in_progress` / `done` / `skipped` |
| `notes` | text | 변경 사유, 작업자 메모 |

> Plan 테이블의 `production_qty`는 이 Schedule에 같은 (sku, date) 행이 있으면 그 qty를, 없으면 0을 lookup.

### 제품 테이블 추가 필드 (in `schema.md`)

`production-planning`에서 lookup하는 SKU별 상수:

- `default_dispatch_per_day` (number, 박스/일) — 초기 = 감, 운영 후 historical 평균으로 갱신
- `target_stock` (number, 박스) — 14일 forecast의 closing 목표
- `safety_stock` (number, 박스) — 절대 하한, 미만 시 알람

> 현재 `products.md` 표에 빈칸 → 운영 시작 전에 영업/생산 협의로 채워야 함 (미결).

---

## 운영 루틴

### 매일 마감 (담당자 ~5분)

1. 창고에서 SKU 3개 실측 stock 카운트
2. Plan 테이블의 Day 0 (오늘 날짜) 3행의 `stock_open`을 실측값으로 갱신 (덮어쓰기)
3. 14일치 close 자동 재계산 → target_diff·safety_diff view 흐름 변화 확인

### 매주 1회 (금/토, 담당자 ~15분)

1. Plan의 "다음 주 5일" view 확인 (target_diff·safety_diff)
2. 가장 부족한 SKU부터 영업일에 우선 배정 (3/3/2 default, 부족도에 따라 조정)
3. Production Schedule에 5행 추가 (월~금, sku, production_qty)
4. Plan은 lookup이라 자동 반영

### 일별 (작업장)

1. Schedule의 `status: planned` 행이 그 날 생산 지시
2. 생산 시작 → `in_progress`, 완료 → `done`
3. 실 생산량이 다르면 `production_qty` 수정 (그 행만) — Plan이 자동 반영

---

## 권장 View

| View | 위치 | 용도 |
| --- | --- | --- |
| **SKU별 14일 forecast** | Plan | SKU 필터 + date sort. 1 SKU의 14일 흐름 한눈에 |
| **target_diff < 0** | Plan | safety_diff/target_diff 음수만. 생산 부족 알람 |
| **다음 주 schedule** | Schedule | date >= 다음 월요일 sort. 주간 계획 검토용 |
| **금주 일별 작업지시** | Schedule | date = 오늘~+4일 + status filter. 작업장 화면 |
| **D0 stock-taking 입력** | Plan | date = 오늘 행만 (3행). 일마감 입력 폼 |

---

## Plan 흐름 예시 (KAT, 박스 단위)

```
Day    Stock_open  Prod  Disp_fc  Stock_close  target_diff  safety_diff
---    ----------  ----  -------  -----------  -----------  -----------
월 (D0)  80*        60    14       126          +26          +76          ← *실측
화      126         60    14       172          +72          +122
수      172          0    14       158          +58          +108
목      158         72    14       216          +116         +166
금      216         72    14       274          +174         +224
토      274          0     0       274          +174         +224
일      274          0     0       274          +174         +224
월      274          0    16       258          +158         +208
...
target=100, safety=50, default_dispatch=14박스/일
```

생산이 멈춰도 target 위에서 유지되는지 확인 → 부족하면 다음 schedule에서 KAT 비중↑.

---

## 미결 (운영 시작 전에 결정)

| 항목 | 소유 |
| --- | --- |
| Target/Safety stock 값 자체 (3 SKU × 2 = 6개 숫자) | 영업/생산 협의 |
| `default_dispatch_per_day` 초기값 (3개 숫자) | 영업 감 → 입력 |
| Historical 평균 산정 방식 (n일 이동평균? 요일 패턴?) | 운영 1~2개월 후 결정 |
| 컷오프 닫힌 후 D+1 dispatch lock 흐름 (Plan과 n8n #1 연결) | `../n8n/` 워크플로우 #1 설계 |
| 토/일 dispatch 가능 여부 (현재 0 가정) | `../order-site/` 컷오프 정의 |
| Schedule status 자동화 (Slack 알림, dispatch 시점 등) | 운영 시작 후 자동화 단계 |
