# 온보딩 — 고객 진입·신원 확정·승격 프로세스

> **도메인**: 고객이 처음 들어와서 "결제 가능한 정식 고객"이 되기까지의 전 과정.
> **상위 컨텍스트**: 루트 `../CLAUDE.md` (전체 원칙·시스템 역할 분담)
> **관련 폴더**: 진입 후 주문 UX는 `../order-site/`, 토큰으로 발급되는 매핑 키는 `../airtable/`, mandate 후 수금은 `../xero/`

---

## 이 폴더가 다루는 것

- 세 가지 진입 경로 (매직 링크 등록완료 / 매직 링크 pre-onboarding / 글로벌 게스트)
- 매직 토큰 = **HubSpot Company 생성 시점에 자동 발급** (#0 워크플로우)
- 정식 온보딩 = **admin team이 Airtable에서 review·approve** (영업 X)
- 게스트·pre-onboarding → 정식 고객 승격 절차
- 토큰(매직 링크) 수명주기 — 발급·폐기·재발급 정책
- 온보딩 폼 + GoCardless Billing Request Flow 연결

> 핵심 원칙 재확인: **주문은 신원보다 먼저** / **결제 가능 = 온보딩 완료** (payment term 보유 = 즉시 출하 자격) / **매직 토큰은 영업 진입 단계부터 발급** (정식 온보딩 전에도 주문 가능)

---

## 세 가지 진입 경로

### 정문 A — 매직 링크 (등록완료 고객)

- 정식 온보딩 끝난 고객. 매직 토큰이 담긴 링크로 진입
- 예: `order.example.com/o/a8f3k2x9` (토큰 = HubSpot Company 생성 시 #0이 발급한 랜덤값, 추측 불가능)
- 토큰이 비밀번호 역할. 내부에서 **Airtable 고객 레코드와 1:1 매핑** (랜덤 매핑형)
- 화면에 가게명·담당자명·기본 배송지·payment term prefill
- **보안**: URL에 내부 ID(HubSpot/Xero/레코드) 직접 노출 금지

### 정문 A' — 매직 링크 (pre-onboarding 고객)

- HubSpot Company는 등록됐지만 정식 온보딩(Tally form 완료·admin 승인) 아직 안 됨
- 같은 매직 토큰 사용. 영업이 현장에서 "지금 주문 가능"하라며 영업 이메일로 매직 링크 발송한 경우 등
- 화면에 가게명만 표시 (배송지·연락처·payment term은 아직 없으니 prefill 안 됨, 사용자가 매번 입력)
- 주문 시 **오더 자동 hold ON** (#1이 payment term 없음 감지) + Slack `#ops-onboarding` 알림 → admin이 온보딩 진행 후 hold release
- 정식 온보딩 완료 → 자동으로 정문 A 손님으로 승격 (토큰 동일, 화면 prefill 동작 시작)

### 정문 B — 글로벌 사이트 (게스트/셀프)

- 토큰 없음, 고객 레코드 미연결, HubSpot Company도 없음
- 최소 정보(상호·연락처·배송지)만 입력하는 간이 폼
- Airtable에 `고객 미배정`으로 저장 + 오더 자동 hold ON + Slack `#ops-onboarding`
- admin이 HubSpot Company 신규 생성 → #0이 발화 → 그 다음은 정문 A' 경로와 동일

---

## 게스트·pre-onboarding → 정식 고객 승격 (admin team 진행)

**케이스 1: pre-onboarding 손님 (매직링크 있음)**

1. 첫 주문 → Airtable 오더 행 hold ON → Slack `#ops-onboarding`
2. admin이 Tally 온보딩 폼 발송 (HubSpot 이메일 템플릿) — 이미 hubspot_id가 매직 토큰과 함께 알려져 있어 자동 prefill
3. 고객이 폼 작성 → #7a가 Airtable staging 행 생성 → admin Slack 알림
4. **admin이 Airtable staging review** → status=`approved` (Customer Group은 #0 단계에서 영업이 이미 지정)
5. **n8n #7b 발화** (Airtable status 변경 트리거): Xero Contact 생성(그룹별 discount %) → Airtable 고객 행에 payment term/배송지 update → **기존 hold 오더 자동 release** → 환영 이메일 (조건부 wording: hold 오더 있으면 "다음 오더부터 이 링크 사용" 추가)

**케이스 2: 게스트 손님 (매직링크 없음, 글로벌 링크로 진입)**

1. 게스트 주문 → Airtable 미배정 + 오더 hold ON → Slack `#ops-onboarding`
2. admin이 연락처로 컨택 → HubSpot Company 신규 생성 (이게 #0 발화 → Airtable 고객 행 생성 + 매직 토큰 발급)
3. 미배정 주문 → 신규 고객 레코드로 **수동 매칭** (admin이 상호·배송지 비교, Slack 알림 처리)
4. 그 후 케이스 1과 동일 (Tally 폼 발송 → admin review → approve → #7b 발화)

> 매칭·생성 워크플로우 노드 흐름은 `../n8n/` 참조 (#0, #7a, #7b). 발급된 키가 어디 저장되는지는 `../airtable/schema.md`(고객 테이블).

**선결제 예외**: DD 부담스럽거나, 신용계정 부여 곤란한 고객 → 선결제/COD 트랙 (결제 상세는 `../xero/`)

---

## 토큰(매직 링크) 수명주기

- **발급 시점**: **HubSpot Company 생성 직후 자동** (n8n #0). 영업이 잠재고객을 HubSpot에 등록만 하면 즉시 토큰 보유 → 정식 온보딩 전에도 매직 링크 발송 가능 (현장 즉석 주문 시나리오 대응)
- **모델: 영구 토큰 + 신고 시 폐기·재발급** (주기적 회전 안 함). 랜덤 매핑형 — Airtable 고객 행에 토큰 저장, HubSpot Company `magic_token` property에 미러
- 폐기·재발급 트리거: 분실/도난 신고, 직원 퇴사, 폰 분실 등
- **재발급 시 옛 토큰 즉시 무효화** (유효 토큰이 누적되지 않게). Airtable + HubSpot 양쪽 update
- QR 스티커도 같은 영구 토큰을 가리킴 → 토큰이 영구라 QR이 죽지 않음

> 토큰 **분실 시 재접근 UX(4겹 방어)** 와 재발급 보안 규칙은 고객이 직접 마주하는 화면이므로 `../order-site/`에서 다룬다. 여기서는 발급/폐기 **정책**만 소유.

---

## 온보딩 폼 + GoCardless 연결

- **플랫폼 = Tally** (운영용 폼 `Me75K8`, workspace `w4Pyvr`). MCP 이미 연결 → 폼 자동 관리 가능. 무료/저렴, conditional logic 강력. 폼 구조는 운영 중 진화 예정 ([[tally-onboarding-form]] 참조).
- **커스텀 도메인 = `https://onboarding.youngfoods.com.au` (2026-05-30 가동)**. Tally Pro custom domain, `onboarding` CNAME → `cname.tally.so`. 슬러그 없이 **루트에 폼 서빙** (이 서브도메인은 온보딩 폼 전용). 폼 접근·prefill은 `tally.so/r/Me75K8` 대신 이 도메인 사용: `https://onboarding.youngfoods.com.au/?<params>`.
- **단일 page 구조** (multi-page 안 함 — conditional + page navigation 충돌 회피). 섹션 시각 구분은 TEXT 라벨 + DIVIDER 사용.
- **고객 그룹은 폼에 노출하지 않음** — HubSpot Company 생성 시점에 영업이 지정 (default `일반고객`, 가맹점/자매사만 `내부고객`). admin review 단계에서는 변경 안 함.

### 폼 필드 명세 v2 (2026-05-29 결정)

**섹션 1 — 기본 정보 (모두 필수)**

- 가게명 (shop name)
- 가입 entity 이름 (entity name, optional — Pty Ltd 등 법인명이 다를 때)
- 배송지 (delivery address)
- 담당자 이름 (manager/owner name)
- 담당자 이메일·전화
- 회계팀 정보: "같음 / 다름" 분기 dropdown → "다름" 선택 시 회계팀 이름·이메일·전화 필드 표시
- **Hidden field** (URL prefill, 폼 UI 숨김):
  - `hubspot_id` — HubSpot Company ID. HubSpot 이메일 템플릿 personalization token으로 prefill.
  - `email_prefill` — 원래 발송 대상 이메일. forward 가드용.

**섹션 2 — 지불 방법** (dropdown, 3 옵션)

| 옵션 | 분기 필드 | 후속 처리 |
|---|---|---|
| **Direct Debit (default 권장)** | 없음 (필드 추가 X) | Tally 완료 → redirect page → 동적 BRT 생성 → GoCardless flow URL로 자동 redirect. mandate 동의 후 자동 수금. |
| **Credit Application** | Legal entity / ABN/ACN / Credit term (7 Days default · EOM) / Credit limit 요청액 (3 옵션) | admin이 Airtable staging review 시 credit term + credit limit 승인. 승인 후 #7b가 7일 또는 EOM 결제 조건 부여. |
| **COD** | 없음 | 환영 이메일에 회사 계좌 정보 안내. **출하 전 bank transfer 입금 증빙 필수** (#2.5로 인보이스 발행 후 결제 확인 → 출하). |

> *고객이 폼에서 선택한 payment term은 admin review 단계에서 override 가능 (Airtable staging에 그대로 저장 → admin 확정).*

### GoCardless Billing Request Flow 연결 패턴 (2026-05-29 결정)

- **Tally 폼 안에서 GoCardless 정적 임베드 = 불가능**. BRT URL은 single-use, 고객별 동적 생성 필요. 정적 URL을 여러 명이 쓰면 첫 사람 완료 후 expired 또는 데이터 오염.
- **운영 패턴 = Tally redirect on completion + 별도 redirect page**:
  1. Tally 폼 완료 → Tally가 정적 redirect URL로 이동 (`https://<our>/onboarding-redirect?response_id={tally_response_id}`)
  2. Redirect page가 #7a 결과 또는 Tally response를 fetch
  3. payment method가 DD면 → n8n endpoint 호출 → GoCardless API로 동적 BRT 생성 → 그 flow URL로 다시 redirect
  4. payment method가 Credit/COD면 → "Thank you, we'll contact you within 1 business day" 정적 메시지
- **Redirect page 구현은 별도 작업** (#7a 빌드 이후 turn). 현재는 폼 수정 + #7a (Tally → Airtable staging)까지만.
- mandate 동의 후 이후 수금은 Xero–GoCardless 네이티브 자동 (상세 `../xero/`)
- HubSpot/Xero/Airtable 매핑은 Tally → n8n webhook → 각 시스템에 propagate (상세 `../n8n/`)

### 폼 발송·매칭 패턴 (개정 2026-05-29)

영업사원·고객 셀프·어드민 누가 진행하든 동일한 진입점을 쓰는 단순 모델.

1. **발송 = HubSpot 이메일 템플릿**. 본문의 Tally 링크에 HubSpot personalization token으로 `hubspot_id` (Company ID), `email` 등을 URL 파라미터로 prefill.
   - 예 (커스텀 도메인, 2026-05-30~): `https://onboarding.youngfoods.com.au/?hubspot_id={{company.hs_object_id}}&email={{contact.email}}`
   - (구: `https://tally.so/r/Me75K8?...` — 호스트만 교체, 쿼리 파라미터·hidden field 매칭은 동일. _주의: hidden field 명세는 `hubspot_id`/`email_prefill`인데 URL 예시는 `email` — 현 HubSpot 템플릿이 쓰는 파라미터명을 그대로 유지하고 호스트만 바꿀 것._)
2. **Tally hidden field** 가 URL 파라미터를 받아 폼 UI에는 안 보이고 webhook payload에만 실림.
3. **n8n webhook(워크플로우 #7a)** 이 payload 받자마자 `hubspot_id`로 HubSpot Company를 직접 매칭 → 수동 매칭 0. Airtable `Onboarding Submissions` staging 행 생성.
4. **Forward 오염 가드**: hidden `hubspot_id` 있을 때, 폼 입력 `email` vs HubSpot Contact email cross-check. 불일치 → Slack `#ops-onboarding`, propagate 보류, **admin team이 판단**.
5. **ID 없이 진입 fallback** (영업이 Tally 링크를 직접 열어 같이 작성 등): `hubspot_id` 비어 있으면 폼 입력 email로 HubSpot Contact 검색 후 매칭. 없으면 신규 생성 큐로.
6. **Approval 트리거 (개정)**: admin team이 Airtable staging에서 review → status=`approved`로 변경 → **Airtable 자동화가 n8n #7b webhook** 호출. (개정 전: HubSpot workflow webhook이었음)

> 매칭·생성 워크플로우 노드 흐름은 `../n8n/` 워크플로우 #7a/#7b. 매직 토큰 발급은 별도 #0이 HubSpot Company 생성 시점에 처리.

---

## 확정된 결정 (이 도메인)

- 토큰: 영구 + 신고 시 폐기·재발급. **발급 시점 = HubSpot Company 생성 직후 #0이 자동** (정책은 본 폴더, 분실 UX는 `../order-site/`)
- 온보딩 폼: **Tally `Me75K8`** (단일 page, 섹션 2개 — 기본 정보 / 지불 방법) + GoCardless 동적 redirect (별도 redirect page)
- **고객 그룹 지정 시점 (개정 2026-05-29)**: HubSpot Company 생성 시 영업이 결정 (default `일반고객`, 가맹점/자매사만 `내부고객`). 온보딩 review 단계로 미루지 않음.
- **Onboarding 승인 주체 (개정 2026-05-29)**: **admin team** (영업 X). admin이 Airtable `Onboarding Submissions` staging 보고 status=approved로 변경 = #7b 트리거.
- **Pre-onboarding 주문**: 매직 토큰은 HubSpot 생성 시점부터 발급되므로 정식 온보딩 전 매직 링크 주문 가능. payment term 없으면 #1이 자동 오더 hold ON + Slack. 입력 정보(배송지·연락처)는 오더에만 저장 (고객 행은 admin이 Tally form 통해 채움).
- **폼 발송·매칭 = HubSpot 이메일 템플릿 + Tally hidden field로 `hubspot_id` 박아 보냄** (2026-05-28) — 영업·고객·어드민 어느 진입 경로든 단일 패턴. n8n #7a가 ID 우선 매칭, email cross-check로 forward 가드, ID 없으면 email fallback.
- **Payment term 옵션 (2026-05-29 결정)**: Direct Debit / Credit Application (7 Days·EOM × credit limit 3 tier) / COD 3종. COD는 출하 전 bank transfer 입금 증빙 필수. 고객 폼 선택값은 admin review에서 override 가능.
- **GoCardless 연결 (2026-05-29 결정)**: Tally 폼 안 정적 임베드 불가 → Tally redirect on completion + 별도 redirect page에서 동적 BRT 생성 후 GoCardless flow URL로 redirect. Redirect page 구현은 별도 작업.
