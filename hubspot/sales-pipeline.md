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

> 진입 장벽을 의도적으로 낮춤. 가게 이름만 알아도 일단 등록 → 영업 파이프라인에 올라옴.

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

  | 값 | 의미 |
  | --- | --- |
  | `form sent` | HubSpot 이메일 템플릿으로 Tally 폼 링크 발송 완료 |
  | `form submitted` | 고객이 Tally 폼 제출 |
  | `form reviewed` | 영업·Admin이 제출 내용 검토 완료 |
  | `pending information` | 정보 누락·추가 필요 → 고객에게 재요청 |
  | `approved` | 모든 정보 OK, 정식 고객 승격 결정 |

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

## 핸드오프 — HubSpot → onboarding/airtable/xero

`Onboarding` property = `approved` 도달이 정식 승격 트리거.

워크플로우 처리(`../n8n/` 영역, 번호는 추후 부여):
1. HubSpot Company / Contact에 "정식 고객" 마킹
2. 영업이 결정한 **고객 그룹**(`내부고객` / `일반고객`) — 폼이 아닌 영업 판단으로 입력 (`../onboarding/CLAUDE.md` 참조)
3. Xero Contact 생성 (default discount % = 그룹 기반 5%/0% 자동 입력)
4. Airtable 고객 테이블에 신규 레코드 + HubSpot ID + Xero ContactID + 매직 토큰 발급
5. 매직 링크 이메일 발송 → 고객이 정문 A로 진입 가능

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
- 핸드오프 트리거: `Onboarding = approved`
