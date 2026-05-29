# 영업 파이프라인 — Sales Pipeline + 진행 프로세스

> **소유**: `hubspot/` 도메인. SoT는 **HubSpot Company의 `Sales Pipeline` property** (Deal 객체 미사용 — 이유는 `customer-profile.md`).
> **상위**: `CLAUDE.md` (HubSpot 도메인 라우터)
> **핸드오프**: `Onboarding` property = `approved` 도달 시 → `../onboarding/` 절차 완료 + `../airtable/` 매핑 키 propagate (`../n8n/`)

---

## 이 문서가 다루는 것

- Company의 `Sales Pipeline` property가 거치는 **단계 정의** + 각 단계 의미
- 단계 전환 **트리거 / 갱신 주체**
- 세부 진행 status(`Sample` / `Onboarding` property)의 변화 흐름
- `../onboarding/` 으로의 핸드오프 시점
- 영업 활동 로깅 규칙

---

## Pipeline 구조 (단일 — Company 1개에 1 라이프사이클)

Deal 미사용. **단일 Sales Pipeline**이고 Company가 직접 단계를 들고 있음. 한 가게는 한 라이프사이클을 따른다.

```
new → contact → sample → onboard → first order → repeat order
```

---

## 단계별 정의

### 1. `new` — 잠재고객 등록

- **누가**: 영업사원 또는 회사 매니지먼트
- **언제**: 잠재고객을 발굴(검색·추천·노출)했을 때
- **입력 정보**: **가게 이름(Company name)만** — 그 외는 비워둠
- **자동**: HubSpot Company ID 생성
- **Sales Pipeline 값**: `new`
- **Contact 객체**: 없음
- **영업이 함께 결정**: `Customer Group` (default `일반고객`, 가맹점/자매사면 `내부고객`으로 변경) — 비워두면 #0이 default 일반고객 set
- **자동 (n8n #0 — 개정 2026-05-29)**: HubSpot Company create webhook → 매직 토큰 생성 → Airtable 고객 행 사전 생성 → HubSpot `magic_token` property 동기. **이 시점부터 영업이 매직 링크 이메일 발송 가능** (HubSpot 이메일 템플릿에 `{{company.magic_token}}` personalization). Pre-onboarding 손님이 현장에서 즉석 주문 가능.

> 진입 장벽을 의도적으로 낮춤. 가게 이름만 알아도 일단 등록 → 영업 파이프라인에 올라옴. 매직 링크는 이 단계부터 보낼 수 있어 영업 유연성 ↑.

---

### 2. `contact` — 접촉 완료

- **트리거**: 영업이 해당 지점을 **방문, 전화, 이메일 중 하나로 접촉**
- **갱신**: 영업이 수동으로 `Sales Pipeline = contact` 설정
- **목적**: "한 번이라도 컨택한 가게" 필터링 (Companies 뷰에서 `contact` 이상만 보기)
- **Contact 객체**: 정보가 들어왔다면 추가(권장, 강제 아님 — 정책은 `customer-profile.md`)

---

### 3. `sample` — 샘플 진행

- **트리거**: 가게로부터 **샘플 요청** 발생
- **갱신**: 영업이 수동으로 `Sales Pipeline = sample` + `Sample` property를 진행에 맞춰 갱신
- **세부 status (`Sample` property)**:

  | 값 | 의미 |
  | --- | --- |
  | `requested` | 샘플 요청 접수 |
  | `delivered` | 샘플 전달 완료 |
  | `tested` | 가게에서 시식·테스트 완료 |
  | `feedback received` | 피드백 수령 (긍·부정 무관) |

- **다음 단계 분기**:
  - 긍정 피드백 + 등록 의사 → `onboard`
  - 부정 피드백 / 무관심 → (TBD: Closed-Lost 처리 방식 미정)

---

### 4. `onboard` — 정식 고객 등록 진행

- **트리거**: "happy customer wants to get onboard" — 고객이 정식 등록 의사 표명
- **갱신**: 영업이 `Sales Pipeline = onboard`로 변경 + 온보딩 폼 발송 액션 수행
- **세부 status (`Onboarding` property)**:

  | 값 | 의미 | 갱신 주체 |
  | --- | --- | --- |
  | `form sent` | HubSpot 이메일 템플릿으로 Tally 폼 링크 발송 완료 | admin (수동) |
  | `form submitted` | 고객이 Tally 폼 제출 | n8n #7a (자동) |
  | `form reviewed` | admin team이 Airtable staging 검토 완료 | admin (Airtable에서, sync는 manual or 별도 workflow) |
  | `pending information` | 정보 누락·추가 필요 → 고객에게 재요청 | admin |
  | `approved` | 모든 정보 OK, 정식 고객 승격 결정 | **Airtable에서 status=approved 변경 → #7b sync** (HubSpot에서 직접 수동 X — 개정 2026-05-29) |

- **이 단계의 액션 게이트 — Contact 필수** (`customer-profile.md`의 Contact 정책 참조). 폼 발송 워크플로우가 `Sales Pipeline = onboard` 진입 시 Company에 email 있는 Contact ≥ 1개 검증. 없으면 발송 중단 + Slack 알림.

---

### 5. `first order` — 첫 주문 (TBD)

- (영업 프로세스 설명 진행 후 채움)
- 후보: `Onboarding = approved` 후 첫 인보이스 발행 또는 첫 dispatch 완료 시점?
- Airtable 주문 데이터와의 동기화 방식 정의 필요

---

### 6. `repeat order` — 반복 주문 (TBD)

- (영업 프로세스 설명 진행 후 채움)
- 후보: 2번째 주문 시? 일정 주기(예: 30일) 내 반복 주문이 확인됐을 때?
- 이탈 고객(반복 안 함) 처리 정책도 함께 정의 필요

---

## 핸드오프 — Airtable → onboarding/xero (개정 2026-05-29)

**개정 전**: HubSpot `Onboarding=approved` 도달 = 트리거
**개정 후**: **Airtable `Onboarding Submissions.status=approved` 도달 = 트리거** (admin team이 Airtable에서 review·승인)

워크플로우 처리(`../n8n/` 영역, #7b):
1. **이미 완료된 것** (#0이 Company 생성 시 처리): Airtable 고객 행 + HubSpot 고객 ID + 매직 토큰 + Customer Group default
2. (Sample/Onboarding 진행 중) 영업이 가맹점/자매사면 Customer Group을 `내부고객`으로 수정 (선택)
3. #7b 발화: Xero Contact 생성 (default discount % = 그룹 기반 5%/0% 자동 입력)
4. Airtable 고객 테이블 기존 행 update — Xero ContactID, payment term, 기본 배송지 등 채움
5. **기존 hold 오더 자동 release** — pre-onboarding 시기에 매직 링크로 들어온 오더는 hold 상태였음, 이를 admin이 dispatch할 수 있게 풀어줌
6. HubSpot Onboarding=approved 미러 sync
7. 환영 이메일 발송 (HubSpot single-send, **조건부 wording** — 기존 hold 오더 있으면 "다음 오더부터 이 링크 사용" 안내)

---

## 영업 활동 로깅 규칙 (TBD)

- 콜·미팅·이메일·노트·태스크 중 **필수로 남길 활동 타입** — TBD
- 공유 인박스 thread는 자동 누적 (별도 입력 X — `customer-profile.md` Conversations 섹션)
- 단계 전환 시 활동 기록 의무 여부 — TBD

---

## 확정된 결정 (이 문서)

- **단일 Sales Pipeline + 단계는 Company property**로 관리. Deal 객체 미사용
- 단계: `new → contact → sample → onboard → first order → repeat order` (마지막 2개는 진입 기준 TBD)
- `Sample` / `Onboarding`은 단계 내 세부 status를 표현하는 별도 Company property
- 단계 전환은 **영업 수동** (자동화 안 함). 단, **온보딩 폼 발송 액션은 Contact 검증 게이트** 거침
- 핸드오프 트리거 (개정 2026-05-29): **Airtable `Onboarding Submissions.status = approved`** (admin team이 변경). HubSpot Onboarding property는 sync용 미러로만 동작
- 매직 토큰 발급 시점 (개정 2026-05-29): **Company 생성 시 #0이 자동** (영업 단계 `new` 진입과 동시)
