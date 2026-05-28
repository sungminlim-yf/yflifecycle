---
name: yf-design-progress
description: "Young Foods B2B 시스템 설계 phase 포인터 — 현재 v0.4, 다음 작업 후보 위치"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d30d126-8bcb-491b-b40d-e1e58d82e7aa
---

설계 단계 v0.4+ (2026-05-28 갱신). 도메인별 폴더 + 각 폴더 CLAUDE.md 구조 (`onboarding/`, `order-site/`, `airtable/`, `xero/`, `n8n/`). 루트 `CLAUDE.md`가 라우터·대시보드 — 잠긴 결정·미결은 거기에 정리되어 있어 그쪽을 single source로 참조.

**현재 phase = 운영 액션 집행 중 (5/9 완료, 2026-05-28 밤)**. 자세한 진행상황은 아래 "운영 액션 진행 현황" 섹션.

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

### ⏳ 남음 (사용자 UI 작업, 4개)
3. **HubSpot Workflow**: Company `Onboarding` property가 `approved`로 변경 → "Send a webhook" action → n8n #7b URL (POST, Company ID 포함). 자동화 메뉴에서.
4. **ClickSend**: 가입 → SMS Sender IDs에서 alphanumeric `YoungFoods` 등록 신청 (호주 사전 승인 1~2일) → API Credentials에서 username + API key 발급. **가장 일찍 시작 권장 (승인 lag)**.
5. **Tally**: 온보딩 폼 Integrations → Webhooks → signing secret 활성화·복사. (폼 자체가 아직 없으면 폼 먼저 만들어야 함 — Tally MCP로 가능)
6. **Xero**: Settings → Invoice settings → Branding theme 편집 → footer/payment instructions에 회사 계좌 (BSB·계좌번호) 입력. #2.5 Prepay/COD 인보이스 PDF에 자동 노출됨.

### ⏳ 그 이후
- n8n에 `clicksend-creds`(Basic) + `tally-webhook-secret` credential 등록 (4·5 완료 후)
- Airtable UI 마무리 작업 (lookup convert·single link convert) — [[airtable-base]] 참조
- 본격 n8n 워크플로우 빌드 시작 (#1부터)

## 내일 회사에서 시작 시 추천 순서

1. **메모리 + 진행상황 확인** — [[airtable-base]] (테이블ID·UI 잔여작업) + 이 파일 (운영 액션 진행 현황) 빠르게 훑기
2. **ClickSend 가입부터** (승인 lag 때문에 가장 일찍) — 30분 안에 끝남, 그 다음 1~2일 기다리는 동안 다른 거 진행
3. 그 다음 옵션 — Claude가 할 수 있는 것:
   - schema.md/CLAUDE.md에 **실제 tableId 박기** (운영 디버깅·n8n 빌드 정확도 ↑)
   - **제품 3 SKU 행 입력** (KAT/GAR/TER + 박스 단가·MOQ·Xero Item Code) — Airtable MCP로 가능
   - **n8n #1 빌드 시작** (외부 의존 적음)
4. 사용자 손 작업 — 3·6 (HubSpot workflow, Xero Branding theme), Tally 폼 셋업

## 다음 작업 후보 (사용자가 turn 시작 시 택일):
- n8n 워크플로우 #6c 후보 (이메일 복구 — order-site 정책상 phone OR email 모두 허용) — 운영 가동 후 수요 보고 결정
- Production Plan/Schedule 실제 Airtable 베이스에 테이블 생성 (스키마 → 실 구현)
- 본격 가동 단계로 전환 (남은 워크플로우 설계 없음, 운영 액션 집행 + 실제 시스템 구현)
- #2.5·#5·#6·#7 가동 전 운영 액션: (#7) Airtable `Onboarding Submissions` 테이블, HubSpot `Customer Group` property, HubSpot workflow `Onboarding=approved`→webhook, Tally signing secret. (#6) Airtable `SMS Log` 테이블, ClickSend 계정·sender ID 등록, n8n `clicksend-creds` credential. (#2.5) Xero Branding theme에 회사 계좌(BSB·계좌번호) footer/payment instructions 등록. (#5) HubSpot Company custom property `Hold Reason`·`Outstanding (AUD)` 신설

남은 운영 액션(설계 외): n8n에 Custom Connection 키·ops-* 채널 ID 등록 (clientSecret은 placeholder인 상태, 사용자가 n8n UI에서 직접 입력하도록 안내함 — [[xero-account]]), Xero scope 문제 진단 대기 ([[xero-account]]).

진행 방식은 [[yf-conversation-style]] 참조.
