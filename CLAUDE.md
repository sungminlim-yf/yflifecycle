# Young Foods — B2B 주문 시스템 (프로젝트 루트)

> **상태**: 설계 초안 v0.4 — 매직 토큰 = HubSpot 생성 시 발급 모델로 개정
> **마지막 업데이트**: 2026-05-29
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

- 토큰: **영구 + 신고 시 폐기·재발급**. **발급 시점 = HubSpot Company 생성 직후 (#0이 자동 발급, Airtable 고객 행 + HubSpot magic_token property 동기 sync)**. 온보딩 완료 전에도 토큰 보유 → pre-onboarding 주문 가능. QR은 영구 토큰 지시 (→ `onboarding/`)
- 인보이스: **dispatch 시 발행**, payment term별 분기 (선결제/COD만 dispatch 전) (→ `xero/`)
- DD: **Xero–GoCardless 네이티브 자동 수금**, due date = **매주 화요일**(월·화 dispatch 인보이스는 다음 주 화요일로 밀림), mandate는 온보딩 1회
- 키 구조: **Airtable 고객 테이블이 매핑 허브**
- Hold: **2단위 gate** (고객 Hold / 오더 Hold) — **오더 상태와 분리** (2026-05-31). 오더 lifecycle은 `오더 상태`(접수/출하완료/취소), 출하 허용 여부는 `출하 가능` formula로 파생. 상세는 아래 "오더 상태·출하 프로세스" 결정.
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
- **주문 사이트 가동 (2026-05-30)**: Next.js 15 앱(`order-site/`)을 **Vercel 배포 → `https://order.youngfoods.com.au` 라이브** (단수 order, A 레코드 `76.76.21.21`). 재배포 = `order-site/`에서 `vercel deploy --prod`. 6개 언어(EN/KO/ZH/JA/TH/ES). 분실복구는 ClickSend 가입 전이라 **이메일(#6c) 먼저 가동** (게스트 화면 "Lost your link?" → `/api/recover`). 도메인 구성 방침 = **서비스별 서브도메인** (order=Vercel, www/홈=Squarespace, onboarding=Tally, customer/supplier/staff 포털=별도). 상세는 `order-site/README.md`.
- **온보딩 폼**: **Tally `Me75K8`** (단일 page, 섹션 2개) + GoCardless 동적 redirect. **Payment term 3종** (2026-05-30 확정·EOM 폐기): **`Direct Debit (default)`**(GoCardless mandate→#2 dispatch 인보이스, due 다음 화요일) / **`Credit - 7 days`**(+`credit_limit`; #2 dispatch 인보이스 due +7일; admin 심사·credit limit 관리) / **`COD`**(게스트·1회성→#2.5 주문 시 인보이스+hold, 출하 전 결제: 수동입금 or Xero Stripe pay-now). _EOM·companion `credit_term` 필드 폐기 — Credit은 7일로만 통일 (단순·cash flow)._ 폼 라벨은 #7a가 정식값 3종으로 매핑. 전 시스템(Airtable 옵션·#7a/#7b/#2/#2.5) 일관 적용 완료. 고객 그룹은 HubSpot Company 생성 시 영업이 지정 (폼에 노출 X) → Xero Contact default discount % 자동 입력. **GoCardless 연결**: Tally 폼 안 정적 임베드 불가 (BRT single-use) → Tally redirect on completion + 별도 redirect page에서 동적 BRT 생성. 상세는 `onboarding/CLAUDE.md` "폼 필드 명세 v2". **폼 URL = `https://onboarding.youngfoods.com.au` (Tally Pro 커스텀 도메인, 2026-05-30 가동, `onboarding` CNAME→`cname.tally.so`, 슬러그 없이 루트). HubSpot 이메일 템플릿 링크를 이 도메인으로 교체 (호스트만, prefill 파라미터 유지).**
- **고객 선호 언어 + 이중 언어 이메일 (2026-05-31)**: Airtable 고객테이블 `선호 언어` single-select 신설(en/ko/zh/ja/th/es, default en; staging도 `preferred_language`). 캡처 = Tally 폼 "Preferred language" dropdown(#7a 라벨→코드 매핑) → #7b가 고객행 저장 + 주문사이트 수정 패널(#R2). 모든 고객 이메일(환영 #7b·복구 #6c)은 **영어 본문 + 선호≠en이면 모국어 블록 추가** 이중 언어. #R resolve가 `preferred_language` 반환. 상세는 `order-site/CLAUDE.md`·`onboarding/CLAUDE.md`.
- **n8n 워크플로우 #1 (주문 제출 → Airtable)**: webhook 직행, 통합 endpoint(`mode` 분기), 서버 가격 산출, UUID v4 멱등키, 중복 의심 = 같은 배송일 + 동일 sku 조합. SMS는 sub-workflow fire-and-forget.
- **n8n 워크플로우 #2 (dispatch → Xero 인보이스)**: DD/7-day 한정. Airtable `오더 상태=출하완료` 변경 트리거, 즉시 발행. 박스 단가 line(tax=`EXEMPTOUTPUT`) + 조건부 배송비 line(`<$300 → UnitAmount=5, tax=OUTPUT, DiscountRate=0 override` → 총 $5.50). 인보이스 `LineAmountTypes=Exclusive`. Xero Item Code = `KAT`/`GAR`/`TER`. Contact discount % 자동(내부 5%/일반 0%, 배송비 제외). Due date = 다음 화요일(DD)/+7일(7-day). PDF 자동 발송. 멱등은 `Xero 인보이스 ID` 필드 사전 체크 + reference로 부분실패 복구. 선결제·COD는 #2.5 별도.
- **n8n 워크플로우 #3 (Xero → Airtable 결제·Hold 동기화)**: INVOICE.UPDATE webhook + polling 폴백 이중 구조. **실시간 webhook 가동(2026-05-31)**: Xero dev console에 Invoices webhook 등록 + signing key를 #3 `Verify HMAC` 노드에 하드코딩(HMAC-SHA256 over **raw body**·base64 비교, ITR 통과 = valid 200/invalid 401 검증됨). 결제→hold해제 초 단위 반영. **폴링은 5분/7분 윈도우 폴백으로 잔존**(`entropy='poll-fallback'`은 #3 Verify HMAC에서 서명 없이 통과시키는 내부 우회). 오더 매칭은 `Xero 인보이스 ID`로 정확. 멱등은 "현 값과 같으면 skip" 가드. invoice fetch → 오더 매칭 → 결제 상태/오더 Hold(선결제·COD 한정) update. 그 후 고객 contact의 outstanding 재계산 + credit limit·overdue 대비로 고객 hold 산출(`outstanding ≥ credit_limit OR overdue ≥ 1`). hold_reason은 overdue 우선. webhook HMAC-SHA256 서명 검증. 멱등은 "현 값과 같으면 skip" 가드 + last_sync_at 성공 시만 갱신. **#4(credit limit 비교)는 #3에 통합.**
- **온보딩 폼 매칭 패턴 (2026-05-28)**: HubSpot 이메일 템플릿 personalization token으로 Tally URL에 `hubspot_id={{company.hs_object_id}}&email={{contact.email}}` prefill → Tally hidden field가 webhook payload에 실어 보내줌 → n8n #7이 ID로 자동 매칭 (수동 매칭 0). forward 오염 대비 email cross-check, ID 없이 진입 시 email fallback 매칭. 영업·고객·어드민 모든 진입 경로 단일 패턴. 상세는 `onboarding/CLAUDE.md` "폼 발송·매칭 패턴".
- **온보딩 모델 v2 (2026-05-29 개정)**: ① 매직 토큰은 **HubSpot Company 생성 시점에 #0이 자동 발급** (랜덤 매핑형). 영업은 profile만 만들면 즉시 매직 링크 발송 가능. ② 정식 온보딩 승인 주체는 **admin team** (영업 X). admin이 Airtable `Onboarding Submissions` staging을 보고 review → status=approved로 변경하는 것이 **트리거**. ③ 고객 그룹(`내부고객`/`일반고객`) 지정 시점은 **HubSpot Company 생성 직후 영업이 결정** (default `일반고객`, 가맹점/자매사만 영업이 `내부고객`으로 변경) — 온보딩 review 단계로 미루지 않음. ④ Pre-onboarding 주문(payment term 없는 매직링크 고객) = derive only (필드 추가 X): 고객 link 있음 + Payment term 비어있음 → #1이 자동으로 오더 hold ON + Slack 알림. ⑤ pre-onboarding 고객의 입력 정보(배송지·연락처)는 **오더에만 저장** (고객 행은 admin이 Tally form 처리 시 채움). ⑥ #7b 환영 이메일은 분기 — 기존 hold 오더 있으면 "다음 오더부터 이 링크 사용" wording 추가 + 기존 hold 오더 자동 release.
- **n8n 워크플로우 #0 (HubSpot Company create → Airtable 사전 생성 + 매직 토큰 발급)** — **2026-05-29 신설**: HubSpot Company create webhook(또는 polling) → 랜덤 매직 토큰 생성(UUID v4) → Airtable 고객 행 사전 생성(`HubSpot 고객 ID` + `매직 토큰` + `상호`만, payment term 비어있음) → HubSpot Company `magic_token` property PATCH 동기 → (`customer_group` 비어있으면 default `일반고객` set). 영업이 profile만 만들면 바로 매직 링크 이메일 발송 가능(HubSpot 이메일 템플릿이 `{{company.magic_token}}` personalization token으로 prefill).
- **n8n 워크플로우 #7 (온보딩 폼 propagate) — 2026-05-29 개정**: **#7a/#7b 분할**. #7a = Tally webhook → HubSpot 매칭(+forward 가드) → Airtable `Onboarding Submissions` staging 행 생성 → HubSpot `Onboarding=form submitted` → Slack `#ops-onboarding`. **admin team 수동 review** (영업 X): Airtable에서 staging 확인 후 status=`approved`로 변경 (Customer Group은 #0 단계에서 이미 지정됨, 변경 필요시 영업이 수정). #7b = **Airtable Onboarding Submissions status=approved 트리거** (개정 전: HubSpot workflow webhook) → 안전 체크 → Xero Contact 생성(discount % 그룹 기반) → Airtable 고객 행 update(이미 #0이 생성한 행에 payment term·배송지 등 채움) → **기존 hold 오더 자동 release** → 환영 이메일(조건부 wording — 기존 hold 오더 있으면 "다음 오더부터 이 링크 사용" 안내). **신설 운영 액션**: Airtable staging 테이블, HubSpot `Customer Group` property, **Airtable 자동화 `Onboarding Submissions.status=approved` → n8n webhook** (개정 전: HubSpot workflow), Tally signing secret.
- **온보딩 status 모델 v3 (2026-05-31 개정) + #7c 신설**: 고객 table `Onboarding Status`는 **사람이 직접 수정하지 않고 HubSpot `onboarding`에서 #8이 읽어오는 read-only 미러** (Sales Pipeline·Sample Status와 동일 일관 패턴). 상태 출처 단일화: `form sent`=영업이 **HubSpot**에서 / `form submitted`=#7a 자동(Tally 도착) / `pending information`·`approved`=admin이 **Airtable Onboarding Submissions `form status`**에서. **Onboarding Submissions `status` → `form status`로 rename** (옵션 3종: form submitted/pending information/approved, form reviewed 폐기). **#7c 신설** (id `HyAA29msWiAHIxkz`, active): Airtable `form status` 변경 → HubSpot `onboarding` PATCH (generic, pending information 갭 메움) → #8이 고객 table로 미러. **#7b 개정**: 고객 table `Onboarding Status` 직접 write 제거(→ #8 위임) + staging `propagated` write 제거(멱등은 Xero ContactID 가드). **#7a 개정**: staging 생성값 `under review`→`form submitted`. **신설 운영 액션**: Airtable Automation `Onboarding Submissions.form status 변경 → #7c webhook (onboarding-formstatus-sync-v1)`.
- **명칭 통일 (2026-05-31)**: prefill 없는 진입 = **global link → Guest page(손님 페이지)** / prefill 있는 진입 = **magic link + magic token → Customer page(고객전용 페이지)**. magic 용어는 기존 `magic_token` 필드·property·#0/#R/#6c에 박혀 있어 유지(churn 0). HubSpot 이메일 템플릿 2종(사용자 세팅): Global = `https://order.youngfoods.com.au` / Customer = `https://order.youngfoods.com.au/?token={{company.magic_token}}`.
- **n8n 워크플로우 #6 (분실복구·확인 발송)**: **#6a/#6b(SMS) 분할 설계 완료** (2026-05-28) + **#6c(이메일) 신설·가동** (2026-05-30, id `eM3uEPPqueopOH9p`). #6a = sub-workflow, #1이 fire-and-forget 호출, 주문 1건당 SMS 1건(매직링크 동봉), 멱등은 `order_no` 기준, ClickSend(`YoungFoods` sender ID) 호출. #6b = webhook, order-site 글로벌 페이지가 호출, 보안 게이트(등록·미등록 동일 응답 = enumeration 차단 / 등록된 번호로만 발송 / **rate limit = 전화번호 기준 시간당 3·일 10, silent absorb**) + Airtable 고객 `링크 재요청 횟수`+1 ⇒ ≥2면 QR 추천 플래그·Slack. 전화번호 정규화 E.164 AU. **#6c = 이메일 복구 webhook** (ClickSend 가입 전 대체로 먼저 가동): order-site `/api/recover` → 이메일로 고객 조회 → 등록 이메일로 매직링크 발송(Gmail OAuth2, #7b와 동일 credential) → `링크 재요청 횟수`+1, ≥2면 QR·Slack. enumeration 차단(항상 `{ok:true}`). 잔여: 이메일 시간창 rate limit(로그 테이블 도입 시). **신설 운영 액션**: (#6a/#6b) Airtable `SMS Log` 테이블, ClickSend 계정·sender ID 등록, n8n `clicksend-creds` credential. (#6c) 추가 신설 없음(Gmail credential 재사용).
- **n8n 워크플로우 #2.5 (선결제·COD 인보이스 발행)**: **설계 완료** (2026-05-28). 모델 재확인 = "COD = 주문 후 빠른 선결제 변형" (호주 일반 현장 결제 모델 아님). Airtable 오더 trigger + payment term ∈ {Prepay, COD} 필터 → 안전 체크 5종 → #2와 동일 line 구성(KAT/GAR/TER + 그룹 할인 + 배송비 line) → Xero invoice(`Date = DueDate = 오늘`, **`Reference = Order No`**(고객노출 코드 F60531xxx), **`InvoiceNumber = Y+YMMDD(Brisbane)+랜덤3글자`**, Description=풀 제품명, `LineAmountTypes = Exclusive`) → 자동 이메일(Branding theme footer에 회사 계좌) → Airtable `Xero 인보이스 ID` + `오더 Hold = true` + `결제 상태 = 미결제`. 결제 채널 = **Manual bank transfer** (Stripe·GoCardless one-off는 운영 안정화 후). 결제 확인 → #3가 INVOICE.UPDATE 수신 → hold 해제 → dispatch 가능. #1과 결합 X (Airtable trigger 패턴, #2와 일관). **번호 스킴 (2026-05-31 수정)**: #2.5가 옛 `YF+YYMMDD+랜덤4`를 InvoiceNumber·Reference 양쪽에 쓰던 버그 → **#2와 동일 스킴으로 통일**(Reference=Order No, InvoiceNumber=Y형식). **신설 운영 액션**: Xero Branding theme footer/payment instructions에 회사 계좌(BSB·계좌번호) 등록.
- **n8n 워크플로우 #5 (재무 → HubSpot 공유)**: **설계 완료** (2026-05-28). Airtable 고객 테이블 change trigger (`hold` OR `hold_reason` OR `outstanding` 변경) → HubSpot Company 3개 property (`Account Hold` / `Hold Reason` / `Outstanding (AUD)`) PATCH. **멱등** = HubSpot 현 값과 비교 후 동일하면 skip. 게스트(`HubSpot 고객 ID` 없음) silently skip. `hold=false`면 `hold_reason` 강제 공백. 확장 항목(Overdue·Credit Limit·Last Payment) 보류 — 운영 가동 후 영업 피드백 보고 추가. **신설 운영 액션**: HubSpot Company custom property `Hold Reason`(text) + `Outstanding (AUD)`(currency) 추가.
- **오더 상태·출하(픽/배송) 프로세스 (2026-05-31)**: ① `출하 상태`→**`오더 상태`** 리네임(field ID 유지 → Airtable 자동화 안 깨짐), 값 **3종**(접수/출하완료/취소). **lifecycle(단계)와 gate(출하 허용)를 분리** — "Hold" 상태값 폐기(오더 Hold 체크박스와 중복이었음). ② 출하 허용 = **`출하 가능` formula** = `AND({오더 상태}='접수', NOT({오더 Hold}), {고객 Hold (from 고객)}!=1)` (오더 Hold 체크박스 + 고객 Hold lookup 둘 다 고려). ⚠️ **체크박스 lookup은 꺼져도 `[null]` 배열 → `NOT()`이 truthy로 오판하므로 `!=1` 비교 사용**. 픽/드라이버/SKU합계는 전부 `출하 가능` 기준 필터. ③ **출하완료 = 트럭 출발(dispatch) = #2 인보이스 트리거** (드라이버가 Interface/앱에서 토글). ④ 픽업 흐름: 출하가능 오더의 라인아이템 SKU별 합계 → 일괄 픽 → staging 재확인 → 일괄 로딩 → 고객별 배송. ⑤ **Delivery Slip = 가격 제외**(배송지·상호·품목·수량·배송일), 고객별 2부(1부 사인=배송증거), **Airtable Page Designer** 인쇄. 가격은 Xero 이메일 인보이스로만(가격차별 컴플레인 방지). ⑥ 코드 반영 완료: #1=`오더 상태` 항상 `접수`+`오더 Hold`=needsHold, #2/#2.5 Safety 참조 교체. ⑦ **묶음(c) 2026-06-01 진행**: `오더 상태` 'Hold' 옵션 **제거 확인 완료**(현재 접수/출하완료/취소 3종). **#2/#2.5 자동화 트리거 점검 완료** — n8n Safety Checks 정합 검증(#2 `validPayment=['Direct Debit (default)','Credit - 7 days']`·`오더 상태='출하완료'` / #2.5 `validPayment=['COD']`·`오더 상태='접수'`) + 두 webhook 노드 stale notes 수정 + `automation-setup-guide.md` Automation 1·2 트리거 조건 현행화(옛 출하상태/GoCardless DD/7-day credit/Prepay/Hold→오더상태/3종 payment). **빌드 가이드 신설 = `airtable/dispatch-delivery-build.md`** (픽 1a SKU합계·1b 고객별 / 드라이버 출하완료 토글 / Page Designer 슬립). **UI 잔여(사용자)**: 라인아이템 lookup 3개 추가(`출하 가능 (from 오더)`·`배송일 (from 오더)`·`상호 (from 오더)`) → 픽/드라이버 Interface + Page Designer 슬립 빌드. 신설 필드: 오더 `고객 Hold (from 고객)` lookup(fld8N5ijkJdYpHZkD) + `출하 가능` formula(fldeJ55Vgc1N8qufE).
- **Xero 회사**: `Young Foods Pty Ltd` 신규 생성. **Custom Connection App** 생성·client key 보유 → n8n OAuth2 client credentials로 직접 호출 가능 (2026-05-28).

---

## 미결 사항 (도메인별 — 상세는 각 폴더)

| 항목                                              | 소유 폴더    |
| ------------------------------------------------- | ------------ |
| 남은 워크플로우 후보                                 | **#0·#1·#2·#2.5·#3·#5·#6(a/b)·#6c·#7(a/b) 설계 완료** (#6c 이메일 복구 가동 2026-05-30). #8(DD redirect)는 GoCardless credential 후 빌드 |
| #2.5·#5·#6·#7 가동 전 운영 액션 (테이블/property/계정/credential/Branding theme) | `airtable/`·`hubspot/`·ClickSend·Tally·Xero — 위 결정 항목 참조 |
| Target/Safety/default_dispatch 초기값 (3 SKU × 3 = 9개) | `airtable/` (영업·생산 협의) |
| `first order` / `repeat order` 진입 기준 + 영업 활동 로깅 규칙 + 이탈 고객 처리 | `hubspot/` (앞 단계 new/contact/sample/onboard 닫힘 — 2026-05-28) |
| **출하/배송 UI** (사용자 손작업만 잔존) — 라인아이템 lookup 3개 추가 · 픽 합계/드라이버 Interface · Page Designer 슬립(가격 제외). _Hold 옵션 제거·자동화 트리거 점검은 2026-06-01 완료_ | `airtable/dispatch-delivery-build.md` (빌드 가이드) |

> `onboarding/` · `order-site/` · `xero/` 도메인 미결은 모두 해소 — 각 폴더 "확정된 결정" 섹션 참조.

---

## 다음 대화에서 이어갈 내용

> **가동 단계 진입** — 핵심 설계·빌드 완료. 사용자 UI 작업(B트랙)은 **`GO-LIVE-CHECKLIST.md`**에 Phase 0~5 순서로 정리됨 (Airtable Automation → 외부 webhook → 워크플로우 Activate → 주문사이트 연결).

1. **`GO-LIVE-CHECKLIST.md` 따라 가동** (사용자 UI 작업)
2. 워크플로우 manual test (#5 → #7a → #7b → #2.5 → #2 → #3 → #1 순 1건씩)
3. ClickSend 승인 후 #6a/#6b 빌드, GoCardless 후 #8 빌드
4. Target/Safety/default_dispatch 초기값 입력 (영업·생산 협의 후) → Production Plan 운영 시작
5. 남은 미결: `first order`/`repeat order` 기준·영업 로깅 규칙 (`hubspot/`)
6. **출하/배송 묶음 (c)** — Hold 옵션 제거·#2/#2.5 자동화 트리거 점검 **완료(2026-06-01)**. 잔여 = **사용자 UI**: `airtable/dispatch-delivery-build.md` 따라 라인아이템 lookup 3개 추가 → 픽(1a SKU합계·1b 고객별)/드라이버 Interface + Page Designer 슬립 빌드.
