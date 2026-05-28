# HubSpot — CRM (영업·고객 관계 관리)

> **도메인**: 잠재고객 발굴부터 정식 고객 등록까지 **영업 활동의 중심축**.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 정식 고객 승격 절차는 `../onboarding/`, 매핑 키 저장은 `../airtable/`, 시스템 간 propagate는 `../n8n/`

---

## 이 폴더가 다루는 것

- HubSpot 데이터 모델 + 고객 프로파일에 들어갈 핵심 properties → **`customer-profile.md`**
- 영업 파이프라인 stages + 잠재고객 → 정식 고객 진행 프로세스 → **`sales-pipeline.md`**

> Operations의 핵심은 HubSpot. 고객 발굴 여정이 이곳에서 시작되고(잠재고객 등록), 영업 진행 현황이 갱신되며, 정식 고객 승격 시점에 `../onboarding/`으로 넘긴다.

---

## HubSpot의 역할 (재확인)

루트 CLAUDE.md "시스템 역할 분담" 표 발췌:

> **CRM 전용** — 고객 관계 관리, 영업 파이프라인, 온보딩, 신규 고객 발굴. **주문 데이터 저장 안 함.**

---

## 데이터 소유권 (HubSpot 관점)

- **HubSpot이 소유**: "누가 우리 (잠재)고객인가" — 잠재고객 정보, 영업 활동 히스토리(콜·미팅·이메일·노트), Deal/Pipeline stage, 영업 태스크.
- **HubSpot이 내보내는 것**: 정식 고객 승격 시 **HubSpot 고객 ID(Contact ID + Company ID)** → Airtable 고객 레코드 매핑 키 칸에 저장 (`../airtable/schema.md`).
- **HubSpot이 받지 않는 것**: 주문·결제·dispatch·재고 데이터. 이들은 각각 Airtable·Xero가 SoT.

---

## 시스템 간 연결 요약 (HubSpot 기준)

| 상대 | 방향 | 내용 |
| --- | --- | --- |
| 영업 (수동) | → HubSpot | 잠재고객 등록, 영업 활동·노트·태스크 갱신, Deal stage 이동 |
| Tally 온보딩 폼 | → HubSpot | (승격 시) 신규 Contact + Company 생성, 기본 정보 채움 |
| HubSpot | → Airtable | 정식 고객 승격 시 HubSpot ID 매핑 키로 propagate |
| HubSpot | → Slack | (예정) 영업 단계 변화·핸드오프 알림 |

> 트리거·노드·동기화 방식은 모두 **`../n8n/`** 영역.

---

## 이 폴더의 문서

| 파일 | 내용 |
| --- | --- |
| `customer-profile.md` | Contact / Company properties — 영업이 고객 프로파일에서 관리할 핵심 필드 |
| `sales-pipeline.md` | Deal stages + 잠재고객 → 정식 고객 진행 프로세스, 핸드오프 시점 |

---

## 확정된 결정 (이 도메인) — 2026-05-28

- **데이터 모델**: Company 중심. **Deal 객체 미사용** (반복 주문 모델이라 부적합)
- **Company custom properties 4개**: `Sales Pipeline` / `Sample` / `Onboarding` / `Account Hold`
- **단계**: `new → contact → sample → onboard → first order → repeat order` (마지막 2개 진입 기준 TBD)
- **Sample / Onboarding** = 해당 단계 내 세부 status 표현하는 별도 Company property
- **Contact 생성 정책**: HubSpot 자동 생성 ON + 단계 게이트 없음 + 온보딩 폼 발송 액션 시점에만 검증(없으면 Slack 알림). 영업 회피 행동 방지가 목적
- **공유 인박스 운영**: `accounts@` / `orders@` → HubSpot Conversations 연결. Contact 정책과 독립적으로 풀파워 가동
- **온보딩 폼 발송**: HubSpot 이메일 템플릿 + Tally 링크. 폼 자체 운영은 `../onboarding/`
- **Tally 링크에 ID 박기**: 이메일 템플릿이 personalization token으로 Tally URL에 `hubspot_id={{company.hs_object_id}}&email={{contact.email}}` prefill → Tally hidden field로 webhook payload에 실림 → n8n #7이 자동 매칭(수동 매칭 0). 영업·고객·어드민 어느 진입 경로든 동일 패턴. 상세 `../onboarding/CLAUDE.md` "폼 발송·매칭 패턴".
- **핸드오프 트리거**: `Onboarding = approved` 도달 → Xero/Airtable propagate

## 미결 사항 (이 도메인)

- `first order` / `repeat order` 진입 기준 (Airtable 주문 데이터와의 동기화 방식 포함)
- 영업 활동 로깅 규칙 (필수 활동 타입, 단계 전환 시 기록 의무)
- 부정 피드백·이탈 고객(`sample` → 진행 중단 / `repeat order` 후 휴면) 처리 방식
- Contact custom properties 필요 여부 (현 시점 표준만으로 충분해 보임)
- HubSpot → Airtable 매핑 propagate 워크플로우 (`../n8n/`에서 워크플로우 **#7** — 패턴 확정, 노드 흐름 미설계)
