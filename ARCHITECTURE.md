# Young Foods — 시스템 아키텍처 & 스케일업 로드맵

> **상태**: 방향 확정 v1 — 2026-06-01
> **이 문서의 역할**: "왜 지금 이렇게 짓는가 / 언제 무엇으로 옮기는가 / 무엇은 사서 쓰고 무엇은 만드는가"의 단일 근거.
> **상위 컨텍스트**: 운영 설계·도메인 상세는 루트 `CLAUDE.md` 및 각 도메인 폴더.

---

## 핵심 결론 (TL;DR)

1. **지금 구축물은 대부분 이식 가능하다** — 데이터 모델·비즈니스 규칙·연동·문서는 자산으로 그대로 넘어가고, 버려지는 건 Airtable UI 껍데기와 Airtable 문법뿐이다.
2. **1 → 2단계 로드맵은 옳다.** 특히 2단계(Supabase + Next.js, Claude Code 자체 구축)는 현실적이며 권장 그림이다.
3. **자체 CRM(3단계)은 만들지 않는다.** HubSpot·Xero는 끝까지 산다.

---

## 3단계 로드맵

### 1단계 — 현재 (사업 초기 운영 체계)

| 시스템 | 역할 |
| --- | --- |
| HubSpot | CRM |
| Web (Next.js/Vercel) | Order intake |
| **Airtable** | 고객·오더·라인아이템·생산계획(make-to-stock)·재고예측(일일 stock take)·dispatch |
| Xero | 회계 |
| n8n | 워크플로우 오케스트레이션 |

- **장점**: 비전공자가 Claude Code로 빠르게 구축·운영. Airtable이 **공짜로 딸려오는 운영 UI**(그리드·인터페이스·Page Designer)를 제공 → 팀원이 CRUD 화면 없이 데이터 편집.
- **단점(흔한 오해 포함)**: 스케일업 한계. 단, "API limit 곧 도달"은 과대평가 — 아래 참조.

### 2단계 — 다음 (자체 ERP) ✅ 권장

| 시스템 | 역할 |
| --- | --- |
| HubSpot | CRM (유지) |
| **Supabase** (Postgres) | 백엔드 DB — 고객·오더·라인아이템 등 |
| **Next.js (web)** | 프론트 — order intake + ops(고객·오더·생산·dispatch) 관리 화면 |
| Xero | 회계 (유지) |
| n8n / webhook / 코드 | 워크플로우 |

- **Next.js + Supabase + Vercel = Claude Code 자체 구축에 가장 잘 맞는 스택.** Airtable 테이블이 SQL 테이블로 거의 1:1 이식.
- 이미 있는 주문 사이트(Next.js/Vercel)가 프론트의 출발점. ops 화면을 페이지로 증축.
- Supabase = Postgres + 인증 + 자동 REST/실시간 + 스토리지 + edge function.
- n8n은 유지하거나 일부 로직을 Next.js API route / Supabase function으로 흡수.

### 3단계 — ⚠️ 자체 CRM은 만들지 않는다

- CRM 자체제작은 거대하고 유지비가 HubSpot 구독료를 능가. **CRM은 경쟁우위가 아님 — 냉동식품 운영이 경쟁우위.**
- HubSpot·Xero는 **끝까지 구매·유지** (회계·CRM은 사서 쓰는 영역).
- 3단계를 다시 정의한다면: **ERP 심화 + BI/분석 + 기사용 모바일앱**(수령 사인·사진 = 배송완료) 쪽이 ROI가 높다.

---

## 무엇이 이식되고 무엇이 버려지나

| 자산 — 그대로 이식 ✅ | 폐기/재작성 — Airtable 종속 ♻️ |
| --- | --- |
| **데이터 모델/스키마** (고객·오더·라인아이템·제품, 매핑허브, 외부 ID 보관, payment term, hold gate, status model) → Supabase SQL 테이블 거의 1:1 | Airtable formula/rollup/lookup (출하 가능·박스 단가·subtotal·배송 품목) → SQL view/computed column |
| **비즈니스 규칙** (가격·MOQ·할인%·배송비·due date·인보이스 택소노미·hold 산출) — n8n Code 노드에 존재 | Airtable Interface / Page Designer → 웹 UI로 재구축 |
| **연동 계약** (HubSpot/Xero/GoCardless/ClickSend/Tally webhook·필드매핑) — 중간이 뭐든 동일 | Airtable Automation → 이미 n8n으로 외부화됨 (잘함) |
| **도메인 문서** (CLAUDE.md 일체) = 마이그레이션 설계도이자 사내 지식 | n8n의 Airtable REST 노드 → Supabase 호출로 교체 |

---

## 이식성을 극대화하는 단 하나의 규율

> **로직은 Airtable이 아니라 n8n/코드에 둔다. Airtable은 "데이터 저장소 + 가벼운 파생"까지만.**

- 현재 대체로 준수 중 — 가격·인보이스·hold 로직이 n8n Code 노드에 있음.
- Airtable formula는 얇은 파생(출하 가능, 배송 품목, subtotal)으로 제한. 단순 표시용은 OK.
- **복잡한 비즈니스 규칙을 Airtable formula/automation으로 끌어들이지 말 것** — 끌어들이는 만큼 이식성이 깨진다.

---

## "Airtable API limit 곧 도달" — 사실 점검

- Airtable API 한도 = **base당 초당 5요청(버스트)**. 일일 총량 아님. 초당 5 ≈ 시간당 18,000건.
- 오더 1건의 생애주기 Airtable 호출 ≈ 10–20회. 하루 100건이어도 분산되면 여유.
- **실제로 한도를 당기는 것** = 주문량이 아니라 ① 폴링 워크플로우 상시 드립(#3-poll 5분, #8 5분 — webhook-first로 완화) ② 동시 자동화 버스트.
- **진짜 천장(스케일)** = API 속도가 아니라:
  1. **base당 레코드 상한** (오더·라인아이템 영구 누적 → 수년 뒤 도달)
  2. **ops seat 비용**
  3. **formula/automation 경직성** (트랜잭션·복잡 로직 한계)
- 결론: 초기 1~3년은 충분. 위생 관리로 버틴다 — 폴링 빈도↓, **webhook 우선**(Xero 실시간 가동 완료), **배치 읽기**(라인아이템 한 번에 fetch).

---

## 1 → 2단계 전환 트리거 (언제 옮기나)

지금 옮기지 말고, 아래 신호가 오면 이전:

- Airtable 레코드 상한 근접
- formula/automation으로 처리 불가능한 로직 필요
- ops seat 비용 부담
- 트랜잭션 정합성(동시성·원자성) 필요

그 전까지는 1단계 유지. 과설계는 초기 사업에 독.

---

## 관련 문서
- 운영 설계 전반: `CLAUDE.md`
- 주문 사이트(2단계 프론트 출발점): `order-site/`
- 워크플로우(2단계에 대부분 잔존): `n8n/`
