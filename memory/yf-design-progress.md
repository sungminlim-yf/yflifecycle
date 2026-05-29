---
name: yf-design-progress
description: "Young Foods B2B 시스템 설계 phase 포인터 — 현재 v0.4, 다음 작업 후보 위치"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d30d126-8bcb-491b-b40d-e1e58d82e7aa
---

설계 단계 v0.4+ (2026-05-28 갱신). 도메인별 폴더 + 각 폴더 CLAUDE.md 구조 (`onboarding/`, `order-site/`, `airtable/`, `xero/`, `n8n/`). 루트 `CLAUDE.md`가 라우터·대시보드 — 잠긴 결정·미결은 거기에 정리되어 있어 그쪽을 single source로 참조.

**현재 phase = 운영 액션 집행 중 + 온보딩 폼 v2 + #7a 빌드 (2026-05-29 저녁)**. **n8n 워크플로우 #0·#1·#7a skeleton 빌드 완료** (#0 활성화됨 / #1·#7a inactive). **온보딩 폼 v2 publish 완료**: Tally `Me75K8` 단일 page, GoCardless EMBED 제거, COD 옵션 추가, Hidden field (hubspot_id·email_prefill), Legal entity·ABN 신규. **GoCardless 연결 패턴**: Tally redirect on completion + 별도 redirect page에서 동적 BRT 생성 (별도 작업). 자세한 진행상황은 아래 "운영 액션 진행 현황" 섹션.

설계 닫힌 영역: order-site UX, 가격/할인/배송비/DD, 온보딩 폼, **n8n 워크플로우 #1~#7 전부 (#2.5·#5 포함)**, **MOQ($150 grand subtotal), 배송비($5+GST, OUTPUT 10%), Xero Item Code(KAT/GAR/TER), Slack ops-* 매핑** (2026-05-28 추가 closure). #2.5는 Airtable trigger + payment term 필터 패턴(#1 결합 X), 결제 채널 = manual bank transfer, COD는 "주문 후 빠른 선결제 변형". **#5 (재무→HubSpot 공유)**: Airtable 고객 change trigger → HubSpot 3-property(Account Hold·Hold Reason·Outstanding) PATCH, 멱등 비교 skip, 확장 항목(overdue·credit limit·last payment)은 운영 시작 후 보강. `xero/` 도메인 미결 모두 해소. **`airtable/production-planning.md` v1 작성 + `schema.md`에 Production Plan/Schedule 2 테이블 + 제품 lookup 3필드 반영** (2026-05-28 추가). #3는 INVOICE.UPDATE webhook + 매시간 polling, #4(credit limit) #3에 통합. **온보딩 폼 #7 a/b 분할 설계 완료 (2026-05-28)**: #7a Tally webhook → 매칭(+forward 가드) → Airtable `Onboarding Submissions` staging → HubSpot Onboarding=form submitted → Slack. 영업 review에서 `Customer Group`(신설 HubSpot Company property) 지정 + Onboarding=approved. #7b HubSpot workflow webhook → Xero Contact 생성(discount % 그룹 기반) → Airtable 고객 행 + 토큰 발급 → 미배정 소급매칭 후보 Slack → 환영 이메일. 영업·고객·어드민 단일 진입 패턴 유지.

라벨·박스 단위 갱신 반영 완료: KARAAGE·TERIYAKI 라벨(=bag) 2.5kg→4kg + **박스 = 2 bag = 8kg 확정**, 박스 단가 $32.50→$52→**$104** ([[product-source-files]]).
Xero 환경 확보 + Item 3개 등록 완료 ($78/$104/$104, EXEMPTOUTPUT) ([[xero-account]]).

## 운영 액션 진행 현황 (2026-05-28 밤 기준)

### ✅ 완료 (Claude가 MCP로 진행)
1. Airtable `yflifecycle` base에 운영 테이블 **8개 신설** — 고객·제품·오더·라인아이템·Production Schedule·Production Plan·Onboarding Submissions·SMS Log. 모든 tableId·필드 ID·formula/lookup UI 작업 목록은 [[airtable-base]] 참조.
2. HubSpot Company custom property **3개 신설** (companyinformation 그룹):
   - `customer_group` (enumeration: 내부고객/일반고객) — #7b가 Xero discount % 산정 source
   - `hold_reason` (text) — #5가 동기
   - `outstanding_aud` (number, AUD) — #5가 동기
3. **ClickSend 계정 + API key 발급 + 알파태그 `YoungFoods` 신청** (2026-05-29 아침, 사용자). 승인 ~24h 대기 중 (목표 2026-05-30).
4. **n8n `clicksend-creds` (httpBasicAuth) 등록 완료** — id `WZGjzqhfPeU4PL4i`, user = sungmin.lim@youngfoods.com.au, 도메인 제한 `rest.clicksend.com`. API key 본문은 n8n에만 보관 (git 메모리엔 미저장).
5. **schema.md + n8n/CLAUDE.md에 base/tableId 인라인 박기 완료** (2026-05-29). schema.md = top 표 + 각 섹션 헤딩 인라인. n8n/CLAUDE.md = "외부 리소스 ID 참조" 섹션에 Airtable + n8n credential ID 7개. 워크플로우 빌드 lookup 단일화.
6. **제품 3 SKU 행 Airtable 입력 완료** (2026-05-29). record ID: KAT `recKAV446g9hwsymE` ($78), GAR `recSpIZqWHvFkXM8l` ($104), TER `recBEjmZvvNB040Ao` ($104). 박스 단가 formula 검증 통과. lookup 3필드(target/safety/default_dispatch)는 미결 blank.
7. **n8n 워크플로우 #1 skeleton 빌드 완료 (+ Slack Hold Alert 추가 2026-05-29 저녁)**. id `twZw1wv3Fc1iJdeO`, **21 노드** (Slack Hold Alert + IF Needs Admin Alert 추가), **inactive**. Webhook(headerAuth=`order-intake-token` id `dY4EiGLUEsseUd4h`) → Validate Input → IF → Search Order Dedupe → IF → Search Products → Compute & MOQ → IF → Search Customer → Prepare Order → IF → Create Order → Prepare Line Items → Create Line Items → Respond Success. 4개 error response 노드(Invalid/Existing/MOQ/Token Invalid). Airtable는 HTTP Request 노드로 API 직접 호출(resourceMapper 회피). 워크플로우 JSON 원본은 `n8n/workflow-1-skeleton.json`. **stub/미구현**: 컷오프 검증, 중복 의심 Slack, **pre-onboarding/게스트 Slack 알림(다음 이터레이션 — 자동 hold 로직은 추가됨)**, SMS sub-workflow(#6a 미존재), 부분 실패 복구. n8n validate runtime profile: 0 errors / 16 warnings(false positive 위주).
8. **온보딩 모델 v2 개정 + #1 보강** (2026-05-29 오후). 매직 토큰 발급 시점 = HubSpot Company 생성 직후 (#0 신설 설계), 승인 주체 = admin team (영업 X), 승인 트리거 위치 = Airtable `Onboarding Submissions.status=approved` (HubSpot workflow → Airtable 자동화로 변경), 고객 그룹 지정 = HubSpot Company 생성 시 영업 (default 일반고객), pre-onboarding 주문 = derive only (필드 추가 X). HubSpot Company `magic_token` property 신설(MCP 완료). #1 Prepare Order 코드 갱신: 매직링크+payment term blank → 오더 hold ON 자동 + alert flag; 게스트도 동일. 문서 일괄 개정: 루트 CLAUDE.md, onboarding/CLAUDE.md, hubspot/customer-profile.md + sales-pipeline.md, n8n/CLAUDE.md(#0 detail + #7b 개정), airtable/schema.md.
9. **n8n 워크플로우 #0 skeleton 빌드 완료** (2026-05-29 오후). id `lNABcJuKPABoqQf0`, 6 노드, **inactive**, **옵션 B (polling 5min)** 채택. Schedule Trigger (5분) → HTTP Search HubSpot companies (createdate > now-10min) → Code Extract Companies (results array → N items) → Code Process Each (runOnceForEachItem, UUID v4 토큰 생성, payload 빌드) → HTTP Airtable Upsert (PATCH `performUpsert.fieldsToMergeOn = HubSpot 고객 ID`) → HTTP HubSpot PATCH magic_token (customer_group default 보완). 멱등 = HubSpot 고객 ID upsert + 기존 magic_token 보존. 워크플로우 JSON 원본 `n8n/workflow-0-skeleton.json`. **주의/limitations**: ① HubSpot Private App credential 이름이 "(companies read)" — Company PATCH 실패 시 scope `crm.objects.companies.write` 추가 필요. ② createdate filter 기반이라 이미 존재하는 기존 Company는 처리 안 됨 (bootstrap 시 수동 fire 또는 임시 lookback 확장 필요). ③ 5min latency.

10. **#0 수동 테스트 + 멱등성 검증 + 활성화 완료** (2026-05-29 저녁). HubSpot scope `crm.objects.companies.write` 확인됨. 테스트 Company `266741551606` 생성 → manual exec 6 노드 모두 통과 → Airtable 행 `recLnAuI2bsBBtsI8` + 매직 토큰 `663bb76f-...` + HubSpot magic_token 양쪽 동기화. **멱등 재실행**: record id·createdTime·토큰·HubSpot lastmodifieddate 모두 변동 없음 (HubSpot이 동일 값 PATCH를 no-op 처리). Airtable 테스트 행 삭제 + 워크플로우 Activate 토글 ON (5min cron 시작). HubSpot 테스트 Company는 MCP delete 미지원 → 사용자가 UI에서 archive 필요.

11. **Tally 폼 Me75K8 v2 publish 완료** (2026-05-29 저녁). 변경: GoCardless EMBED + DD Request TITLE 제거, Hidden field 2개(`hubspot_id`, `email_prefill`) 추가, COD dropdown 옵션 추가, Credit Application 분기에 Legal entity / ABN/ACN 추가, conditional logic 갱신 (Credit Application 선택 시 4개 필드 표시). **GoCardless 모델 결정**: Tally 정적 임베드 불가 (BRT single-use) → Tally redirect on completion + 별도 redirect page에서 동적 BRT 생성 패턴. Redirect page 구현은 별도 작업. Tally signing secret 발급은 사용자 손작업 (Integrations > Webhooks).

19. **n8n 워크플로우 #5 skeleton 빌드 완료** (2026-05-29 밤). id `EM3FKoINCG3ytoNV`, **11 노드**, **inactive**, validate `valid: true`. **트리거 = Webhook** (path `customer-finance-sync-v1`, Airtable Automation 호출). Webhook → Validate → Fetch Customer → Extract HubSpot ID → IF Has HubSpot ID → [Fetch HubSpot Company(현 값) → Compute Diff(멱등 가드 — 현 값과 동일하면 skip) → IF Needs Update → [Patch HubSpot account_hold/hold_reason/outstanding_aud / skip] → Respond Success] / Respond Skipped Guest]. 게스트(HubSpot 고객 ID 없음) silently skip. hold=false면 hold_reason 강제 공백. JSON 원본 `n8n/workflow-5-skeleton.json` (lightweight pointer). **사용자 손작업**: Airtable Automation 설정 — 고객 테이블 {고객 Hold, hold reason, outstanding} 변경 시 → n8n webhook POST `https://youngfoods.app.n8n.cloud/webhook/customer-finance-sync-v1` with `{record_id}`.

24. **n8n 워크플로우 #3 Phase 1: HMAC 검증 추가** (2026-05-29 밤). 15→**18 노드**, validate `valid: true`. 새 노드 3개: Verify HMAC (Code, env `XERO_WEBHOOK_KEY` 있으면 SHA256 검증, 없으면 stub valid=true로 fallback), IF Valid Signature (IF), Respond Unauthorized (401). 흐름: Webhook → Verify HMAC → IF Valid → [true: Parse Webhook Payload → ... 기존 흐름 / false: Respond Unauthorized]. **사용자 손작업**: Xero developer console에서 webhook signing key 발급 → n8n 환경변수 `XERO_WEBHOOK_KEY` 설정 (또는 credential로 변환). 설정 전까지는 stub mode (valid=true)로 자동 통과 — 테스트 편의. **Phase 2 (Polling fallback) 보류**: trigger 2개 합류 복잡도 (Schedule trigger 추가 시 Parse Webhook Payload reference하는 노드들이 polling branch에서 fail) → 별도 워크플로우로 분리하는 게 깔끔. next iter 또는 별도 turn.

18. **n8n 워크플로우 #3 skeleton 빌드 완료** (2026-05-29 밤). id `YqkAw7AJKw5uPBpv`, **15 노드**, **inactive**, validate `valid: true`. **트리거 = Webhook** (path `xero-invoice-update-v1`, Xero INVOICE.UPDATE; polling fallback은 stub TODO). Webhook → Parse Webhook Payload → IF Should Process → [Fetch Xero Invoice → Find Airtable Order(filterByFormula by Xero 인보이스 ID) → Compute Order Update(멱등 가드: 현 값과 같으면 skip / Prepay·COD + Paid면 오더 Hold 해제) → IF Order Needs Update → [Update Order / skip] → Find Airtable Customer(filterByFormula by Xero ContactID) → Fetch AR Invoices(GET /Invoices?ContactIDs=&Statuses=AUTHORISED,SUBMITTED → outstanding 재계산) → Compute Customer Hold(overdue ≥1 OR outstanding ≥ credit_limit 시 hold ON, hold_reason 산출; 멱등 가드) → IF Customer Needs Update → [Update Customer / skip] → Respond Success] / Respond Skipped]. JSON 원본 `n8n/workflow-3-skeleton.json` (lightweight pointer). **stub/미구현 (다음 iter)**: ① HMAC-SHA256 검증 (Xero webhook key), ② polling fallback (매시간 :05) 별도 트리거, ③ Airtable 고객에 credit_limit 필드 (현재 없음 → overdue만으로 hold 결정), ④ 매칭 실패 Slack 알림. **사용자 손작업**: Xero developer console에서 webhook 등록 (URL `https://youngfoods.app.n8n.cloud/webhook/xero-invoice-update-v1`) + Xero webhook signing key 발급 → n8n credential `xero-webhook-key` 등록 + (옵션) Airtable 고객 테이블에 `credit_limit` (currency) 필드 추가.

17. **n8n 워크플로우 #2.5 skeleton 빌드 완료** (2026-05-29 밤). id `GuMEWpGQ4506RmHf`, **14 노드**, **inactive**, validate `valid: true`. **#2와 거의 동일 구조**, 차이: ① webhook path `prepay-cod-invoice-v1`, ② Safety Checks validPayment=`['Prepay', 'COD']` + dispatchStatus in `['접수', 'Hold']`, ③ Build Invoice Date=DueDate=today (DD/7-day 산정 로직 없음), ④ Update Airtable에 `오더 Hold=true` 추가. PDF Branding theme footer에 회사 계좌 표기 (사용자 손작업). 결제 확인은 #3가 INVOICE.UPDATE 수신 시 hold 해제. JSON 원본 `n8n/workflow-2-5-skeleton.json` (lightweight pointer, 본체는 n8n에서 fetch). **사용자 손작업**: Airtable Automation 설정 (오더 생성 + 출하 상태=접수 AND payment term ∈ {Prepay, COD} → n8n webhook POST `{record_id}`).

23. **Xero discount % 메커니즘 확정 + #2/#2.5 line DiscountRate 적용** (2026-05-29 밤). **확인 결과**: Xero Contact `Discount` field는 GET response에는 있지만 POST/PUT optional field list에 없음 → API로 Contact-level discount set **불가능**. Xero UI에서만 수동 설정 가능. **결정 = Option B (invoice line 명시)**: #2/#2.5 Build Invoice Body에서 customer_group 기반 line DiscountRate 매번 명시. 내부고객 → 제품 line DiscountRate=5, 일반고객 → 미설정(default 0). 배송비 line은 기존 DiscountRate=0 유지 (그룹 할인 제외). #7b Xero Create Contact body는 변경 X (Discount field 못 받음). **#2/#2.5 둘 다 valid: true**. **Why**: Contact UI 작업 의존 X, 매번 자동, robust. Xero docs scrape 결과 https://developer.xero.com/documentation/api/accounting/contacts POST optional field list 검증 완료.

16. **n8n 워크플로우 #2 skeleton 빌드 완료** (2026-05-29 밤). id `W1qYHJKHtPzKpbm4`, **14 노드**, **inactive**, validate `valid: true`. **트리거 = Airtable Automation webhook** (path `dispatch-invoice-v1`) — Airtable Trigger 노드의 triggerField가 lastModifiedTime을 요구하는데 MCP create_field 미지원 → 일관성+robust 위해 #7b처럼 webhook 채택. Webhook → Validate Payload → Fetch Order → Fetch Customer → Fetch Line Items(filterByFormula `FIND(record_id, ARRAYJOIN({오더}))`) → Safety Checks(dispatch 상태/payment term DD·7-day/Xero ContactID/멱등) → IF Pass Safety → Build Invoice Body(line items + 조건부 배송비 line($5+GST OUTPUT) + Due Date 산정[DD=다음 화요일 / 7-day=+7일]) → Xero POST /Invoices(LineAmountTypes=Exclusive) → Xero POST /Invoices/{id}/Email(PDF 자동 발송) → Update Airtable(Xero 인보이스 ID + 결제 상태=미결제) → Slack `#ops-accounts` 알림 → Respond Success / Aborted with skip_reason. JSON 원본 `n8n/workflow-2-skeleton.json`. **stub/미구현 (다음 iter)**: ① Xero Item Code·품목명 lookup을 라인아이템 제품 fetch로 강화 (현재는 label에서 sku 추출), ② 고객 그룹 discount % 자동 적용 메커니즘 확인 후 라인에 DiscountRate, ③ skip 분기 Slack 알림. **사용자 손작업**: Airtable Automation 설정 (오더.출하 상태=출하완료 AND payment term ∈ {GoCardless DD, 7-day credit} → n8n webhook POST body `{record_id: <record id>}`).

22. **n8n 워크플로우 #1 보강: 컷오프 검증 + 중복 의심 Slack** (2026-05-29 밤). 21→**25 노드**, validate `valid: false` (1 false-positive error). **Validate Input 코드 갱신**: `requested_delivery_date`가 ISO date 형식이면 cutoff (전날 12pm Sydney 시간 ~ 전날 02:00 UTC) 비교 후 초과 시 `cutoff_exceeded` push. **새 노드 4개**: Search Duplicate Orders (filterByFormula: customer_id 있으면 같은 고객+배송일 매칭, 게스트면 FALSE() → 0건 자동 skip), Duplicate Decision (Code, has_duplicate flag + Slack text 빌드), IF Has Duplicate, Slack Duplicate Alert (`#ops-orders` C0B3WQ6EPQW). 분기: IF Customer OK [true] → Search Duplicate Orders → ... → IF Has Duplicate → [Slack / skip] → Create Order. blocking 안 함 (admin 판단). **n8n validator false-positive**: Duplicate Decision Code 노드 "Cannot return primitive values directly" error — 외부 변수 추출 패턴 사용했음에도 트리거 (#7b Soft Match Decision은 동일 패턴인데 통과). runtime은 정상 작동 예상. **stub TODOs**: sku 조합 일치 검증 (현재는 customer+date 매칭만), timezone-aware cutoff (현재 UTC 기준 단순 계산).

14. **n8n 워크플로우 #1 보강: Slack Hold Alert 노드 추가** (2026-05-29 저녁). 21 노드. Create Line Items → IF Needs Admin Alert → [true: Slack Post Hold Alert(#ops-onboarding) → Respond Success / false: Respond Success]. Prepare Order 노드의 `needs_admin_alert`/`alert_reason` flag 활용. pre-onboarding 또는 게스트 주문 시 알림.

15. **n8n 워크플로우 #8 (DD Redirect handler) 설계 완료, 빌드 보류** (2026-05-29 저녁). n8n/CLAUDE.md에 명세 추가. Tally 폼 완료 → redirect URL 도착 → payment method 분기 → DD면 GoCardless API로 동적 BRT 생성 후 302 redirect, Credit/COD는 정적 HTML 응답. 빌드는 GoCardless credential 등록(사용자 손작업) 후 별도 turn.

20. **n8n 워크플로우 #7b 보강 Phase 1+2 완료** (2026-05-29 밤). id `pvvhhs5expWOfJce`, **22 노드** (13→22), validate `valid: true`. **Phase 1**: Update Customer Row → Search Hold Orders(filterByFormula 고객+Hold+미결제) → Prepare Release Body → IF Has Holds → [Release Hold Orders batch PATCH / skip] → HubSpot PATCH Onboarding=approved → Update Staging. **Phase 2**: HubSpot PATCH Onboarding Approved → Search Soft Match(filterByFormula 고객 빈 link + (상호==shop_name OR 배송지==delivery_address)) → Soft Match Decision(Slack 메시지 빌드, Code 노드의 inline object literal validator 까다로움 → 외부 변수 추출 패턴 발견) → IF Has Soft Match → [Slack Soft Match Alert / skip] → Update Staging. Slack Post Success 메시지에 released_count 정보 추가. **Phase 3 (stub TODO)**: 환영 이메일 — HubSpot single-send transactional API (Marketing Hub paid plan 필요 확인) 또는 Gmail OAuth2 직접 발송. 조건부 wording (released_count > 0 시 "기존 hold 오더 dispatch 진행, 다음 오더부터 매직 링크 사용" / == 0 시 일반 환영). **n8n Code 노드 validator 발견사항**: inline object literal `return [{json: {...}}]`은 "primitive values directly" error 트리거 — 외부 변수로 추출하면 통과 (다른 동일 패턴 노드는 통과해서 false positive로 의심하나 일관성 위해 외부 추출 권장).

13. **n8n 워크플로우 #7b skeleton 빌드 완료** (2026-05-29 저녁). id `pvvhhs5expWOfJce`, **13 노드**, **inactive**, validate `valid: true`. Webhook(path `tally-approved-propagate-v1`, Airtable Automation 트리거) → Validate Payload → Fetch Staging Row(by submission_id) → Fetch HubSpot Company(customer_group 등) → Fetch Customer Row(by HubSpot 고객 ID) → Safety Checks(staging found+approved, customer row found, payment_term valid, 멱등 — Xero ContactID 이미 있나) → IF Should Proceed → [Xero Create Contact(genericCredentialType oAuth2Api `xero-custom-connection`, PaymentTerms by group, TaxNumber=ABN) → Update Customer Row(Xero ContactID + 담당자/배송지/payment term/그룹) → Update Staging Row(status=propagated, linked_customer) → Slack Post Success(#ops-onboarding) → Respond Success / Respond Aborted with skip_reason]. JSON 원본 `n8n/workflow-7b-skeleton.json`. **stub/미구현 (다음 iter)**: ① Hold orders 자동 release, ② HubSpot Company Onboarding=approved sync, ③ 환영 이메일(조건부 wording — hold 오더 있으면 "다음 오더부터 이 링크 사용"), ④ 미배정 게스트 주문 소급매칭 후보 Slack, ⑤ Xero Contact discount % 자동 적용 메커니즘 확인 (현재는 Airtable 고객 그룹만 저장, #2가 invoice line에서 적용).

21. **n8n 워크플로우 #7a Contact email fallback 추가** (2026-05-29 밤). 24→**25 노드**, validate `valid: true`. **Matching 3-tier 완성**: Tier 1 hidden hubspot_id (Forward 가드 포함) / Tier 2 form_email로 HubSpot Contact 검색 → associatedcompanyid로 Company 추출 / Tier 3 unmatched. **새 노드**: HubSpot Search Contact by Email (POST /crm/v3/objects/contacts/search with email filter + associatedcompanyid property). **기존 Decide Match (unmatched) Code 갱신**: matched_via 결정 ('email' / 'email_no_company' / 'unmatched'). **Build Slack Message matchEmoji map 확장** ('email'·'email_no_company'). **IF Should PATCH HubSpot 조건 변경**: matched_via='hubspot_id' → `hubspot_company_id NOT EMPTY AND !forward_guard_flag` (email 매칭도 PATCH 가능).

12. **n8n 워크플로우 #7a skeleton 빌드 + 보강 완료** (2026-05-29 저녁). id `ylRJHUCFQ9RmCa6R`, **24 노드**, **inactive**, validate `valid: true`. Webhook(path `tally-onboarding-intake-v1`, responseNode) → Validate & Normalize → Search Existing Submission(멱등) → IF Already Exists → [respond already / continue] → IF Has HubSpot ID → [HubSpot Get Company → IF Company Found → [Get Associations → Extract Contact IDs → IF Has Contacts → [Batch Read Contacts → Forward Guard Check / No Contacts Set] / Set Invalid ID] / Decide Match (unmatched)] → Prepare Airtable Body(staging row fields + matched_via 통과) → Create Airtable Submission → Build Slack Message → Slack Post(`#ops-onboarding` C0B42FWL8VA) → Update Submission Slack ts(Airtable PATCH) → IF Should PATCH HubSpot(matched_via=hubspot_id AND !forward_guard_flag) → [HubSpot PATCH Onboarding=form submitted / skip] → Respond Success. **HubSpot Company `onboarding` property 확인됨** (enum: form sent / form submitted / form reviewed / pending information / approved). JSON 원본 `n8n/workflow-7a-skeleton.json`. **stub/미구현 (다음 iter)**: ① HMAC 검증 (Tally signing secret 후), ② Contact search by email fallback (hubspot_id 없을 때), ③ gocardless_mandate_id 저장 (DD redirect 페이지 구현 후).

### ⏳ 남음 (사용자 UI 작업)
- ~~**HubSpot Workflow `Onboarding=approved → webhook`**: 2026-05-29 모델 개정으로 **불필요해짐** (트리거 위치 변경: Airtable로). 대신 ↓~~
- 🆕 **Airtable 자동화**: `Onboarding Submissions` 테이블에 자동화 추가 — `status` 필드가 `approved`로 변경되면 → n8n #7b webhook POST (#7b 빌드 후 URL 박기). Airtable UI Automations에서 설정.
- 🆕 **HubSpot Workflow `Company create → webhook` (옵션 A)**: Company 생성 시 → n8n #0 webhook POST. HubSpot Pro/Enterprise tier 필요. tier 안 되면 n8n cron polling 옵션 B로 대체.
- **Tally**: 온보딩 폼 Integrations → Webhooks → signing secret 활성화·복사. (폼 자체가 아직 없으면 폼 먼저 만들어야 함 — Tally MCP로 가능)
- **Xero**: Settings → Invoice settings → Branding theme 편집 → footer/payment instructions에 회사 계좌 (BSB·계좌번호) 입력. #2.5 Prepay/COD 인보이스 PDF에 자동 노출됨.

### ⏳ 그 이후
- `YoungFoods` 알파태그 승인 확인 (대시보드/이메일, ~2026-05-30)
- n8n `tally-webhook-secret` credential 등록 (6 완료 후)
- Airtable UI 마무리 작업 (lookup convert·single link convert) — [[airtable-base]] 참조
- 본격 n8n 워크플로우 빌드 시작 (#1부터)

## 다음 픽업 시 추천 순서 (집/맥북, 2026-05-29 저녁)

1. **컴퓨터 픽업** — 회사 Windows에서 commit·push 완료 (마지막 commit `9b448ab`). 집 맥북에서 `cd yflifecycle && git pull`. 정션 이미 살아있으면 setup-memory-link.ps1 skip.
2. **#0 활성화 전 확인사항 (가장 먼저)** — n8n UI에서 워크플로우 id `lNABcJuKPABoqQf0` 열어 review:
   - **HubSpot Private App scope 확인 필수** — credential 이름이 "HubSpot Private App (companies read)"라 read만 있을 가능성 큼. **Company PATCH (magic_token 갱신) 실패하면 scope `crm.objects.companies.write` 추가 필요**. HubSpot Settings → Integrations → Private Apps → 해당 App → Scopes → CRM → Companies → Write 체크 → 토큰은 그대로 (값은 안 바뀜).
   - **테스트 방법**: n8n UI에서 "Execute Workflow" 수동 실행 (Schedule 안 켜고도 수동 가능). 최근 10분 내 신규 Company 0건이면 0 처리 (정상). HubSpot에서 테스트 Company 1건 만들고 다시 수동 실행 → 6 노드 다 통과하는지, Airtable에 행 생기는지, HubSpot magic_token property에 값 박히는지 확인.
   - **기존 Company bootstrap**: createdate filter 기반이라 #0 활성화 이전에 생성된 HubSpot Company는 처리 안 됨. 필요시 임시로 Search 노드의 filter value를 `Date.now() - 30 * 24 * 60 * 60 * 1000` (30일 전) 같이 확장 → 수동 fire → 다시 10min lookback으로 복원.
   - 테스트 OK → workflow Activate 토글 ON → 5분 cron 시작
3. **그 다음 작업 후보** (Claude 진행 가능):
   - **#7a 빌드** (Tally webhook → HubSpot 매칭 → Airtable staging) — 큼, Tally 폼 먼저 있어야 의미. 폼 없으면 Tally MCP로 만들기부터.
   - **#7b 빌드** (Airtable Onboarding Submissions.status=approved → Xero Contact + Airtable update + 기존 hold 오더 release + 환영 이메일) — 큼.
   - **#1 Slack alert 노드 추가** (pre-onboarding/게스트 알림) — 중간.
   - **Production Plan/Schedule 실제 운영 시작** (스키마는 이미 있음, 실 데이터 입력) — 영업·생산 협의 필요.
4. **사용자 손 작업** (Claude 진행 불가):
   - Tally signing secret 발급 (#7a 빌드 전제)
   - Airtable 자동화 `Onboarding Submissions.status=approved → n8n #7b webhook` (#7b URL 확보 후)
   - Xero Branding theme 회사 계좌 입력 (#2.5 가동 전)
   - ClickSend `YoungFoods` 알파태그 승인 확인 (~2026-05-30, #6 가동 전)
   - HubSpot Private App scope 확장 (위 2번에서 필요 시)

## 활성화 전 워크플로우 점검 체크리스트

| 워크플로우 | id | 활성화 전 점검 |
| --- | --- | --- |
| #0 (HubSpot→Airtable+토큰) | `lNABcJuKPABoqQf0` | ✅ **활성화 완료** (2026-05-29 저녁). 5min cron 가동 중. |
| #1 (주문 제출) | `twZw1wv3Fc1iJdeO` | Webhook Bearer 토큰 (n8n credential `order-intake-token` id `dY4EiGLUEsseUd4h`)을 주문 사이트에 박기, 컷오프 검증·중복 의심 Slack 등 미구현 인지 |
| #7a (Tally onboarding intake) | `ylRJHUCFQ9RmCa6R` | 24 노드, Forward 가드 + Slack + HubSpot PATCH 모두 추가됨. Webhook URL `https://youngfoods.app.n8n.cloud/webhook/tally-onboarding-intake-v1`를 Tally `Me75K8` Integrations > Webhooks에 박기. Tally signing secret 발급 후 HMAC 검증 노드 추가 (next iter). 수동 테스트 = Tally URL에 `?hubspot_id=<test>&email_prefill=foo@bar.com` prefill → 폼 작성·제출 → Airtable staging 행 + Slack `#ops-onboarding` 알림 + matched 시 HubSpot Company `onboarding=form submitted` 확인. |

## 다음 작업 후보 (사용자가 turn 시작 시 택일):
- n8n 워크플로우 #6c 후보 (이메일 복구 — order-site 정책상 phone OR email 모두 허용) — 운영 가동 후 수요 보고 결정
- Production Plan/Schedule 실제 운영 시작 (스키마 있음, 실 데이터 입력)
- 본격 가동 단계로 전환 (운영 액션 집행 + 실제 시스템 구현)
- 가동 전 사용자 UI 액션 남은 것: Airtable 자동화 (`Onboarding Submissions.status=approved → n8n #7b webhook`, #7b 빌드 후 URL 박기), Tally signing secret, Xero Branding theme 계좌, HubSpot Private App scope (필요시), ClickSend `YoungFoods` 승인 확인

남은 운영 액션(설계 외): n8n에 Custom Connection 키·ops-* 채널 ID 등록 (clientSecret은 placeholder인 상태, 사용자가 n8n UI에서 직접 입력하도록 안내함 — [[xero-account]]), Xero scope 문제 진단 대기 ([[xero-account]]).

진행 방식은 [[yf-conversation-style]] 참조.
