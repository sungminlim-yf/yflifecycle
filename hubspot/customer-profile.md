# 고객 프로파일 — HubSpot Company / Contact

> **소유**: `hubspot/` 도메인. SoT는 HubSpot.
> **상위**: `CLAUDE.md` (HubSpot 도메인 라우터)
> **연결**: 정식 고객 승격 시 HubSpot 고객 ID는 `../airtable/schema.md`(고객 테이블 매핑 칸)에 저장

---

## 이 문서가 다루는 것

- HubSpot **Company** (가게·법인 단위, 운영의 중심) / **Contact** (사람 단위, 이메일 수신자)에 어떤 properties를 두는가
- 각 property가 어느 단계에서 채워지고 누가 갱신하는가
- Contact 객체 생성 정책 (자동 생성 + 발송 게이트)
- 다른 시스템과 동기화되는 필드 (Airtable 매핑 키 등)

---

## 데이터 모델 — Company 중심, Deal 미사용

| 객체 | 단위 | 본 프로젝트 활용 |
| --- | --- | --- |
| **Company** | 가게/법인 1개 | **운영의 중심**. sales status·sample status·onboarding status·Account Hold 모든 핵심 property가 이 객체에 붙음 |
| **Contact** | 사람 1명 | 가게 담당자(사장·주문·총무 등). 주된 용도: **이메일 수신자**. Company와 N:1 |
| **Deal** | — | **사용 안 함** |
| **Activity** | 콜·미팅·이메일·노트·태스크 | Company/Contact에 연결되는 영업 활동 로그. 공유 인박스(Conversations) thread도 여기로 누적 |

**Deal을 안 쓰는 이유**: Deal은 프로젝트/수주 베이스 영업(시작-마감-금액이 명확한 1회성 거래)에 맞는 객체. 우리는 한 번 등록된 고객이 **반복적으로 주문**하는 모델이라, Deal의 라이프사이클(Open → Closed-Won/Lost)이 현실과 안 맞음. Company에 단계 property를 두는 편이 단순·정확하다 (스크린샷: Company 리스트 뷰에서 `Sales Pipeline` / `Sample` / `Onboarding` / `Account Hold` 한 줄로 한눈에 보임 — 2026-05-28 확인).

---

## Company Properties (확정)

스크린샷(2026-05-28) 기반. HubSpot 표준 + 우리가 정의한 custom property 4개:

| Property | 종류 | 값 | 갱신 주체 |
| --- | --- | --- | --- |
| Company name | 표준 | 가게 상호 (자유 텍스트) | 영업 (생성 시) |
| Company owner | 표준 | 담당 영업 | 영업·매니지먼트 |
| **Sales Pipeline** | custom | `new` / `contact` / `sample` / `onboard` / `first order` / `repeat order` | 영업 (단계별 수동 갱신) |
| **Sample** | custom | `requested` / `delivered` / `tested` / `feedback received` | 영업 (샘플 진행 시) |
| **Onboarding** | custom | `form sent` / `form submitted` / `form reviewed` / `pending information` / `approved` | **admin team** 수동 (영업 X — 개정 2026-05-29). `form submitted`는 n8n #7a 자동 갱신. **`approved` 상태는 Airtable `Onboarding Submissions.status=approved`와 동기** — admin이 Airtable에서 approved로 바꾸면 #7b가 발화하고 HubSpot도 sync. (개정 전: HubSpot `Onboarding=approved` 자체가 #7b 트리거였음) |
| **Customer Group** | custom | `내부고객` / `일반고객` | **영업** (HubSpot Company 생성 시점에 지정 — 개정 2026-05-29). default = `일반고객` (n8n #0이 비어 있으면 set), 가맹점/자매사만 영업이 `내부고객`으로 변경. Xero default discount % 자동 산정의 source. **온보딩 review 단계로 미루지 않음** (admin team review 단계에선 손대지 않음, 필요시 영업이 별도 수정). 미지정 상태로 #7b 발화하면 default `일반고객` 사용 |
| **Magic Token** | custom (신설 2026-05-29) | text (랜덤, 영구) | **n8n #0 자동** — HubSpot Company 생성 시 발급, Airtable 고객 행과 동기 sync. 이메일 템플릿에서 `{{company.magic_token}}` personalization token으로 매직 링크 URL prefill. 폐기·재발급 시 Airtable + HubSpot 양쪽 update |
| **Account Hold** | custom | `Yes` / `No` | **n8n #5 자동 동기** (Airtable 고객 `hold` ← Xero #3가 갱신). 영업 수동 override도 가능하지만 다음 #5 발화 시 덮어씌워짐 |
| **Hold Reason** | custom (신설) | single-line text (~100자) | n8n #5 자동 — `"overdue: 2건, $1,250"` 또는 `"credit limit: $5,000/$5,000"` 형식. hold=No면 빈 문자열 |
| **Outstanding (AUD)** | custom (신설) | number (currency format) | n8n #5 자동 — 고객 미수금 합계 (Xero `AUTHORISED`+`SUBMITTED` ACCREC AmountDue). 영업 대화 자료 |

> **`Sales Pipeline`** 은 라이프사이클 단계, **`Sample`·`Onboarding`** 은 해당 단계의 세부 진행 상태. Sales Pipeline이 `sample`/`onboard`로 들어와 있을 때만 의미 있음 (다른 단계에선 비워둠).
> **단계 전환 기준·트리거**는 `sales-pipeline.md`.

---

## Contact 생성 정책 (확정 2026-05-28)

영업 회피 행동 방지를 위해 **단계 게이트는 두지 않고**, 액션(이메일 발송) 시점에만 강제하는 방식.

1. **HubSpot 자동 생성 옵션 ON** — 인바운드 이메일이 들어오면 sender 이메일 기준으로 Contact 자동 생성됨. 공유 인박스(`accounts@`/`orders@`)가 받는 모든 외부 메일이 자동 누적되므로, 영업의 손이 거의 안 가도 Contact가 쌓임.
2. **수동 생성 가이드 (best practice)** — 영업이 이메일·전화번호를 입수하는 어느 단계에서든 즉시 Company에 Contact 1건 추가. strict rule 아님 (정보 없으면 그냥 다음 단계로 진행해도 됨).
3. **필수 게이트 — 온보딩 폼 발송 직전에만** — `Sales Pipeline = onboard`에서 폼 발송 워크플로우가 fire할 때, 워크플로우가 "이 Company에 email property가 채워진 Contact ≥ 1개 인가?" 확인. 없으면 발송 중단 + Slack 알림으로 영업에게 추가 요청 (`../n8n/` 워크플로우에서 구현 예정).

**왜 단계 강제가 아닌가**: `contact` 단계 진입 조건에 Contact 입력을 강제하면, 영업이 단계 자체를 안 올리는 회피 행동이 발생함 (현장 방문 후 명함을 못 받는 케이스가 흔하므로). 액션 게이트는 "실제 발송이 막힐 이유"가 있을 때만 동작하므로 회피할 동기가 없음.

### Contact properties (작성 예정)
영업 프로세스의 뒤쪽 단계(first order / repeat order) 설명 들으면서 추가 확정. 기본 후보:
- 이름, 직책, 이메일, 휴대전화, 선호 연락 시간
- HubSpot 표준 property를 그대로 쓸지 / custom property 추가가 필요한지

---

## 공유 인박스 (HubSpot Conversations) — Contact 무관

`accounts@` / `orders@` 회사 공유 메일 계정을 HubSpot Conversations에 연결. 다음 기능은 **Contact 유무와 무관**하게 동작:

- 인바운드 이메일이 thread로 자동 수신
- Thread에 담당자 assign
- Thread 상태 관리 (Open / Waiting / Closed)
- 회신 시 `From: accounts@...` 등 공유 메일 발송

→ Contact 정책과 인박스 운영은 **독립적**. 인박스는 처음부터 풀파워로 가동 가능. 인바운드가 일어나는 순간 위 1번(자동 생성)이 같이 발동되어 Contact가 자연 누적되는 부수 효과.

---

## Tally 온보딩 폼 입력 항목 (참고)

발송은 HubSpot 이메일 템플릿 + Tally 링크. **폼 자체의 운영·conditional logic·브랜딩**은 `../onboarding/CLAUDE.md`에 있음. 여기엔 어떤 데이터가 HubSpot으로 어떻게 돌아오는지만 적음.

폼 입력 항목 (초기 v1 다이어그램 기반, 2026-05-28):

**Business information**
- `hubspot id` (pre-filled & hidden — Company ID, 매핑 키)
- shop name
- entity name + ABN
- delivery address
- email
- phone
- (선택) account info if different to above — account contract name / email / phone

**Payment term**
- Credit Application (Tally 폼 내 작성) 또는
- Direct Debit (GoCardless Billing Request Flow 링크)

폼 제출 → HubSpot Onboarding property `form submitted` → **admin team review (Airtable staging)** → admin이 status=approved로 변경 → **Airtable 자동화가 #7b webhook 호출** → Airtable 고객 행/Xero Contact propagate + HubSpot Onboarding=approved sync.

---

## 다른 시스템과 동기화되는 필드

| 필드 | 방향 | 상대 |
| --- | --- | --- |
| HubSpot Company ID | → Airtable | **HubSpot Company 생성 시점에** 매핑 키로 저장 (개정 2026-05-29 — `정식 승격 후`가 아니라 생성 직후). `../airtable/schema.md` 고객 테이블 |
| HubSpot Contact ID | → Airtable | 〃 (Contact 추가될 때 same workflow가 sync) |
| Magic Token | ↔ Airtable | **n8n #0가 양방향** — Company 생성 시 #0이 랜덤 토큰 생성 → Airtable + HubSpot magic_token property 양쪽에 동기. 폐기·재발급 시 양쪽 update |
| Account Hold / Hold Reason / Outstanding (AUD) | ← Airtable (← Xero) | **n8n #5가 동기** — Airtable 고객 hold/reason/outstanding이 변하면 즉시 HubSpot Company 3개 property에 미러. 원천은 Xero(#3가 invoice update 받아 outstanding 재계산·hold 산출) → Airtable → HubSpot |
| Tally 폼 입력값 | → HubSpot → Xero → Airtable | 온보딩 승격 워크플로우가 각 시스템에 propagate |

---

## 미결 (이 문서)

- Contact의 custom properties 필요 여부 (현 시점은 HubSpot 표준만으로 충분해 보임 — first order 단계 들으며 재검토)
- `first order` / `repeat order` 진입 시점에 추가로 갱신해야 할 Company property가 있는지
- **#5 확장 항목** 신설 여부: `Overdue Count` / `Overdue Amount (AUD)` / `Credit Limit (AUD)` / `Last Payment Date` — 영업이 (Account Hold + Hold Reason + Outstanding) 3개로 부족하다고 피드백하면 추가. 데이터 source는 이미 Xero(#3)가 계산
