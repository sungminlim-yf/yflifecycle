# n8n — 워크플로우 / 시스템 연동

> **도메인**: 시스템 간 데이터가 **어떻게 오가는지** — 트리거·노드·동기화·예외 알림의 소유자.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 데이터 스키마는 `../airtable/`, 결제 규칙은 `../xero/`, 진입/승격은 `../onboarding/`
> **MCP**: n8n MCP 연결됨 (워크플로우 생성·검증 가능)

---

## 이 폴더가 다루는 것

각 폴더가 "무엇을/어떤 규칙으로"를 소유한다면, n8n은 **"어떻게 연결하고 흐르게 하는가"**를 소유한다. 트리거 설계, 노드 구성, webhook/폴링, 예외 알림 워크플로우가 여기 모인다.

> **구현 방식**: n8n으로 새로 구성 예정. 세부 미결 — 아래 흐름을 워크플로우로 설계해 나간다.

---

## 전체 연동 지점 (flow 현황)

| 출발 | 도착 | 내용 | 트리거(안) |
| --- | --- | --- | --- |
| 주문 사이트 | Airtable | 주문 제출 → 오더 + 라인아이템 행 생성 | 폼/웹훅 |
| Airtable | Xero | **dispatch 시** 인보이스 생성 (payment term별 분기) | dispatch 상태 변경 |
| Xero | Airtable | 인보이스 Paid → 결제 Paid + Hold 해제 / 고객 hold·hold reason·outstanding 동기화 | Xero webhook + 폴링 폴백 |
| GoCardless | Xero | DD 수금 결과 자동 반영·대사 | (Xero 네이티브, n8n 불필요) |
| HubSpot/Xero | Airtable | 신규 고객 → ID 매핑·토큰 발급 (승격 시) | 온보딩 완료 |
| Airtable | HubSpot | 영업용 재무 상태 공유 (hold/overdue/outstanding) | Airtable 변경 |
| Airtable | 영업(Slack) | 미배정·소급 매칭·중복·취소·QR 추천 알림 | Airtable 자동화/n8n |
| 주문 사이트 | 문자 발송 서비스 | 분실 복구 링크 문자, 주문 확인 문자 | 주문/재발급 이벤트 |

---

## 설계할 핵심 워크플로우

### 1. 주문 제출 → Airtable
- 멱등키로 중복 주문 1차 예방.

### 2. dispatch → Xero 인보이스 생성
- payment term별 분기 (DD/7-day = dispatch 시, 선결제·COD = dispatch 전).
- 오더 1개 = 인보이스 1개. line item 동반.

### 3. Xero → Airtable 결제·Hold 동기화
- **Xero webhook 실시간 + 주기적 reconciliation 폴백** (webhook 유실 대비).
- Paid → 결제 상태/Hold 해제. 고객 hold·hold reason·outstanding 반영.

### 4. credit limit 비교 계산 (별도 로직) ⚠️
- Xero는 credit limit 초과를 push로 주지 않음 → **outstanding 합계 vs credit limit 비교를 n8n(또는 Airtable)에서 직접 계산** → 고객 hold 산출.

### 5. 재무 상태 → HubSpot 공유
- 영업이 볼 hold status/reason·overdue·outstanding을 Airtable에서 HubSpot으로 (공유 항목 정의는 `../xero/`).

### 6. 분실 복구·주문 확인 문자
- 재발급 보안 규칙(등록 연락처로만, rate limit, enumeration 차단) 준수 (`../order-site/`).

---

## 예외 처리 (모두 Slack 알림 → 수동 조치)

- **중복 주문 의심** (같은 고객 + 동일 라인아이템 + N분 이내) → Slack → admin 확인. 멱등키로 1차 예방.
- **게스트 소급 매칭** (상호+주소) → Slack → 영업 수동 매칭.
- **주문 취소** → Slack → Xero 수동 조치.
  - dispatch 전 취소: 인보이스 아직 없음 → Airtable 상태만 "취소". Xero 조치 불필요.
  - dispatch 후 취소/반품: 인보이스 발행됨 → 수동 **credit note**.
- **QR 추천**: 링크 재요청 2회+ → Slack 알림 + Airtable 플래그.

---

## 미결 사항 (이 도메인)

| 항목 | 메모 |
| --- | --- |
| 연동 구현 방식 세부 | n8n 워크플로우 구성 (트리거·노드 설계) — 위 6개 워크플로우부터 |
