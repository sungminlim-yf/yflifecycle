# Young Foods — B2B 주문 시스템 (프로젝트 루트)

> **상태**: 설계 초안 v0.3 — 도메인별 폴더 구조로 재편
> **마지막 업데이트**: 2026-05-28
> **이 문서의 역할**: 전체 개요·핵심 원칙·시스템 역할 분담 + **각 도메인 폴더 안내(라우터)**.
> 상세 설계는 각 폴더의 `CLAUDE.md`에 있다 (해당 폴더에서 작업하면 자동으로 함께 읽힌다).

---

## 프로젝트 개요

냉동식품 B2B 주문 시스템. 식당·급식업체 등을 대상으로 온라인 주문 사이트를 운영.

- 생산 방식: Make-to-stock — 재고는 출하를 막지 않음. 대신 생산 계획을 굴려 재고 유지 (→ `airtable/production-planning.md`)
- 품목: 냉동 제품 3종 — SoT는 **Airtable 제품 테이블**, 사람용 스냅샷은 `airtable/products.md`
- 결제: Invoice 기반 (payment term 부여 후 사후 정산). 인보이스는 **dispatch 시점** 발행 (→ `xero/`)
- 사업 지역: 호주 (.au) — DD는 BECS 스킴, 개인정보는 Australian Privacy Act(APPs) 적용

---

## 📁 도메인 폴더 안내

| 폴더              | 무엇을 소유하는가                                   | 들어가서 볼 것                                                         |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------- |
| **`hubspot/`**    | CRM — 잠재고객 발굴부터 정식 고객 등록까지 영업 활동 | `customer-profile.md`(Contact/Company properties), `sales-pipeline.md`(Deal stages·핸드오프) |
| **`onboarding/`** | 고객 진입·신원 확정·승격, 토큰 발급 정책, 온보딩 폼 | 두 진입 경로, 게스트 승격 절차, 토큰 수명주기                          |
| **`order-site/`** | 고객용 주문 웹 화면·UX                              | 주문 페이지, 컷오프, 매직링크 분실 대응(4겹)                           |
| **`airtable/`**   | 운영의 중심축 + 매핑 허브                           | `schema.md`(테이블·필드·관계), `production-planning.md`, `products.md` |
| **`xero/`**       | 재무 진실(SoT) + 영업/Admin 공유 데이터             | 인보이스 발행, Hold 모델, 결제 동기화, GoCardless                      |
| **`n8n/`**        | 시스템 연동 **워크플로우** (어떻게 흐르는가)        | 전체 flow 현황, 6개 핵심 워크플로우, 예외 알림                         |

> **소유권 분리 원칙**: airtable=무엇을 담는가(스키마), xero=무엇이 재무 진실인가(규칙), n8n=어떻게 흐르게 하는가(워크플로우). 같은 주제가 여러 폴더에 걸치면 위 기준으로 한 곳이 소유하고 나머지는 링크.

---

## 핵심 설계 원칙

1. **로그인 없는 주문**: ID/비밀번호 없음. 고유 매직 링크(랜덤 토큰)가 인증 대신
2. **주문은 신원보다 먼저**: 등록 전 게스트도 주문 가능. 신원 확정은 사후 처리
3. **시스템별 단일 책임**: 각 시스템은 가장 잘하는 일만. 데이터 소유권 명확히 분리
4. **결제 가능 = 온보딩 완료**: Payment term 보유 = 즉시 출하 자격
5. **분실 전제 설계**: 매직 링크 분실을 전제로 여러 겹의 재접근 수단 구비

---

## 시스템 역할 분담

| 시스템         | 역할                  | 책임 범위                                                                              |
| -------------- | --------------------- | -------------------------------------------------------------------------------------- |
| **HubSpot**    | CRM 전용              | 고객 관계 관리, 영업 파이프라인, 온보딩, 신규 고객 발굴. 주문 데이터 저장 안 함        |
| **Airtable**   | 주문 운영 + 통합 허브 | 오더/라인아이템/제품/고객 테이블, 주문 상태 관리, **시스템 간 ID 매핑 허브**           |
| **Xero**       | 재무 진실             | 인보이스 발행, 결제 상태 SoT, 미수금·은행정보·statement·payroll·GST·bank rec           |
| **GoCardless** | 자동 수금             | BECS Direct Debit 기반 자동 수금. Xero 네이티브 연동으로 인보이스 due date에 자동 수금 |

### 매핑 허브 — Airtable 고객 테이블이 모든 키를 보관

각 시스템의 외부 ID를 사슬로 엮지 않고, **Airtable 고객 레코드가 모든 키를 나란히 보관**한다 (HubSpot 고객 ID + Xero ContactID + 매직/복구 토큰 + 상호·연락처·기본 배송지·payment term). 상세는 `airtable/CLAUDE.md`.

### 데이터 소유권 요약

- "누가 우리 고객인가" → HubSpot
- "무엇을 주문했는가" → Airtable
- "제품/가격/재고 기준값은" → Airtable 제품 테이블
- "돈을 냈는가 / 어떻게 수금하는가" → Xero / GoCardless

---

## 확정된 주요 결정 (프로젝트 대시보드)

- 토큰: **영구 + 신고 시 폐기·재발급** / QR은 영구 토큰 지시 (→ `onboarding/`)
- 인보이스: **dispatch 시 발행**, payment term별 분기 (선결제/COD만 dispatch 전) (→ `xero/`)
- DD: **Xero–GoCardless 네이티브 자동 수금**, due date = **매주 화요일**(월·화 dispatch 인보이스는 다음 주 화요일로 밀림), mandate는 온보딩 1회
- 키 구조: **Airtable 고객 테이블이 매핑 허브**
- Hold: **2단위** (고객 / 오더), 출하 = NOT(고객) AND NOT(오더)
- 라인아이템: **자식 테이블**로 관리 (품목 3컬럼 방식 폐기)
- 제품/재고 기준값 SoT: **Airtable 제품 테이블**
- forecast: **D+1 확정 주문 / D+2~14 historical 추정** (컷오프 = 배송 전날 12pm)
- 예외(중복·소급매칭·취소): Slack 알림 → 수동 처리
- **가격**: 모든 SKU **단일가 AUD 13/kg, GST-free**. 박스 단가는 박스 중량 환산 — KATSU $78 (6kg/박스), KARAAGE $104 (8kg/박스 = 2 × 4kg bag), TERIYAKI $104 (8kg/박스 = 2 × 4kg bag). _박스 단위 = 2 bag 확정 2026-05-28._
- **주문 단위**: **박스** (라인아이템 수량 = 박스 수, 단가 = 박스 단가).
- **고객 그룹 = 2개**: `내부고객` (가맹점·자매사, 5% 할인) / `일반고객` (0%). 차등은 **Xero Contact의 default discount %**로 자동 적용. 그룹은 Airtable 고객 테이블 single select.
- **배송비**: 할인 전 subtotal `< $300 → $5 + GST` (총 $5.50), `≥ $300 → 무료`. 배송비 라인엔 그룹 할인 미적용 (n8n이 line discount % = 0으로 override). 인보이스 line tax = `OUTPUT` (GST on Income 10%, exclusive). 제품 라인은 그대로 `EXEMPTOUTPUT` (GST Free Income). _GST exclusive 결정 2026-05-28._
- **MOQ**: 오더 전체 grand subtotal **AUD 150** (그룹 할인 적용 **전**). SKU별 MOQ 없음. 미달 = 주문 거부 (n8n #1 서버 측 검증, `422`).
- **주문 사이트 UX**: 인라인 확인 + 즉시 제출 (별도 검토 페이지 없음, 멱등키 필수) / 매직링크 진입 시 정보 전체 노출 / 선결제는 결제 전 배송지·메모만 셀프 수정 / QR 카운트는 재발송 요청만 / SMS = ClickSend.
- **온보딩 폼**: **Tally** + GoCardless Billing Request Flow. 4단계에서 영업이 고객 그룹 지정 → Xero Contact default discount % 자동 입력.
- **n8n 워크플로우 #1 (주문 제출 → Airtable)**: webhook 직행, 통합 endpoint(`mode` 분기), 서버 가격 산출, UUID v4 멱등키, 중복 의심 = 같은 배송일 + 동일 sku 조합. SMS는 sub-workflow fire-and-forget.
- **n8n 워크플로우 #2 (dispatch → Xero 인보이스)**: DD/7-day 한정. Airtable 출하 상태 변경 트리거, 즉시 발행. 박스 단가 line(tax=`EXEMPTOUTPUT`) + 조건부 배송비 line(`<$300 → UnitAmount=5, tax=OUTPUT, DiscountRate=0 override` → 총 $5.50). 인보이스 `LineAmountTypes=Exclusive`. Xero Item Code = `KAT`/`GAR`/`TER`. Contact discount % 자동(내부 5%/일반 0%, 배송비 제외). Due date = 다음 화요일(DD)/+7일(7-day). PDF 자동 발송. 멱등은 `Xero 인보이스 ID` 필드 사전 체크 + reference로 부분실패 복구. 선결제·COD는 #2.5 별도.
- **n8n 워크플로우 #3 (Xero → Airtable 결제·Hold 동기화)**: INVOICE.UPDATE webhook + 매시간 polling 폴백 이중 구조. invoice fetch → 오더 매칭 → 결제 상태/오더 Hold(선결제·COD 한정) update. 그 후 고객 contact의 outstanding 재계산 + credit limit·overdue 대비로 고객 hold 산출(`outstanding ≥ credit_limit OR overdue ≥ 1`). hold_reason은 overdue 우선. webhook HMAC-SHA256 서명 검증. 멱등은 "현 값과 같으면 skip" 가드 + last_sync_at 성공 시만 갱신. **#4(credit limit 비교)는 #3에 통합.**
- **온보딩 폼 매칭 패턴 (2026-05-28)**: HubSpot 이메일 템플릿 personalization token으로 Tally URL에 `hubspot_id={{company.hs_object_id}}&email={{contact.email}}` prefill → Tally hidden field가 webhook payload에 실어 보내줌 → n8n #7이 ID로 자동 매칭 (수동 매칭 0). forward 오염 대비 email cross-check, ID 없이 진입 시 email fallback 매칭. 영업·고객·어드민 모든 진입 경로 단일 패턴. 상세는 `onboarding/CLAUDE.md` "폼 발송·매칭 패턴".
- **n8n 워크플로우 #7 (온보딩 폼 propagate)**: **#7a/#7b 분할 설계 완료**. #7a = Tally webhook → HubSpot 매칭(+forward 가드) → Airtable `Onboarding Submissions` staging 행 생성 → HubSpot `Onboarding=form submitted` → Slack `#ops-onboarding`. **영업 수동 review**: `Customer Group` 지정(내부/일반) + `Onboarding=approved`. #7b = HubSpot workflow webhook → 안전 체크 5종 → Xero Contact 생성(discount % 그룹 기반) → Airtable 고객 행 생성(토큰 발급) → 미배정 주문 소급매칭 후보 Slack → 환영 이메일(HubSpot single-send). **신설 운영 액션**: Airtable staging 테이블, HubSpot `Customer Group` property, HubSpot workflow `Onboarding=approved`→webhook, Tally signing secret.
- **n8n 워크플로우 #6 (SMS)**: **#6a/#6b 분할 설계 완료** (2026-05-28). #6a = sub-workflow, #1이 fire-and-forget 호출, 주문 1건당 SMS 1건(매직링크 동봉), 멱등은 `order_no` 기준, ClickSend(`YoungFoods` sender ID) 호출. #6b = webhook, order-site 글로벌 페이지가 호출, 보안 게이트(등록·미등록 동일 응답 = enumeration 차단 / 등록된 번호로만 발송 / **rate limit = 전화번호 기준 시간당 3·일 10, silent absorb**) + Airtable 고객 `링크 재요청 횟수`+1 ⇒ ≥2면 QR 추천 플래그·Slack. 전화번호 정규화 E.164 AU. **신설 운영 액션**: Airtable `SMS Log` 테이블, ClickSend 계정·sender ID 등록, n8n `clicksend-creds` credential.
- **n8n 워크플로우 #2.5 (선결제·COD 인보이스 발행)**: **설계 완료** (2026-05-28). 모델 재확인 = "COD = 주문 후 빠른 선결제 변형" (호주 일반 현장 결제 모델 아님). Airtable 오더 trigger + payment term ∈ {Prepay, COD} 필터 → 안전 체크 5종 → #2와 동일 line 구성(KAT/GAR/TER + 그룹 할인 + 배송비 line) → Xero invoice(`Date = DueDate = 오늘`, `Reference = 주문번호`, `LineAmountTypes = Exclusive`) → 자동 이메일(Branding theme footer에 회사 계좌) → Airtable `Xero 인보이스 ID` + `오더 Hold = true` + `결제 상태 = 미결제`. 결제 채널 = **Manual bank transfer** (Stripe·GoCardless one-off는 운영 안정화 후). 결제 확인 → #3가 INVOICE.UPDATE 수신 → hold 해제 → dispatch 가능. #1과 결합 X (Airtable trigger 패턴, #2와 일관). **신설 운영 액션**: Xero Branding theme footer/payment instructions에 회사 계좌(BSB·계좌번호) 등록.
- **n8n 워크플로우 #5 (재무 → HubSpot 공유)**: **설계 완료** (2026-05-28). Airtable 고객 테이블 change trigger (`hold` OR `hold_reason` OR `outstanding` 변경) → HubSpot Company 3개 property (`Account Hold` / `Hold Reason` / `Outstanding (AUD)`) PATCH. **멱등** = HubSpot 현 값과 비교 후 동일하면 skip. 게스트(`HubSpot 고객 ID` 없음) silently skip. `hold=false`면 `hold_reason` 강제 공백. 확장 항목(Overdue·Credit Limit·Last Payment) 보류 — 운영 가동 후 영업 피드백 보고 추가. **신설 운영 액션**: HubSpot Company custom property `Hold Reason`(text) + `Outstanding (AUD)`(currency) 추가.
- **Xero 회사**: `Young Foods Pty Ltd` 신규 생성. **Custom Connection App** 생성·client key 보유 → n8n OAuth2 client credentials로 직접 호출 가능 (2026-05-28).

---

## 미결 사항 (도메인별 — 상세는 각 폴더)

| 항목                                              | 소유 폴더    |
| ------------------------------------------------- | ------------ |
| 남은 워크플로우 후보                                 | **#1·#2·#2.5·#3·#5·#6(a/b)·#7(a/b) 전부 설계 완료**. 추가 후보: #6c(이메일 복구) — 운영 가동 후 수요 보고 결정 |
| #2.5·#5·#6·#7 가동 전 운영 액션 (테이블/property/계정/credential/Branding theme) | `airtable/`·`hubspot/`·ClickSend·Tally·Xero — 위 결정 항목 참조 |
| Target/Safety/default_dispatch 초기값 (3 SKU × 3 = 9개) | `airtable/` (영업·생산 협의) |
| `first order` / `repeat order` 진입 기준 + 영업 활동 로깅 규칙 + 이탈 고객 처리 | `hubspot/` (앞 단계 new/contact/sample/onboard 닫힘 — 2026-05-28) |

> `onboarding/` · `order-site/` · `xero/` 도메인 미결은 모두 해소 — 각 폴더 "확정된 결정" 섹션 참조.

---

## 다음 대화에서 이어갈 내용

1. 남은 미결 사항 확정 (위 표 — 각 폴더에서)
2. n8n 워크플로우 #3~#6 + #2.5 설계 → `n8n/`
3. Target/Safety/default_dispatch 초기값 입력 (영업·생산 협의 후)
4. 개발 요구사항 명세로 전환
