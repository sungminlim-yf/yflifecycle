---
name: tally-onboarding-form
description: "Young Foods 온보딩 Tally 폼 ID + v2 명세 (2단계, COD 추가, GoCardless 동적 분리)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1b951c24-3fba-4261-b1b6-ad5167dc43d8
---

운영용 온보딩 Tally 폼 = **`Me75K8`** ("onboarding form " — 이름 끝 공백 포함, workspace `w4Pyvr`).

대안 폼 `1ApGJ1` ("Young Foods – Customer Onboarding")은 정식 이름이지만 미사용 → 나중에 archive 대상.

**Why:** 사용자가 명시적으로 `Me75K8`를 운영용으로 지목 (2026-05-29). 폼 구조는 운영 중 진화 예정.

## 폼 v2 명세 (2026-05-29 결정)

**구조**: 단일 page, 섹션 2개 (multi-page 안 함 — conditional + page navigation 충돌 회피).

**섹션 1 — 기본 정보**:
- 가게명, entity name (optional), 배송지, 담당자 이름, 이메일, 전화
- 회계팀 정보: same/different 분기 dropdown → "different" 시 회계팀 이름/이메일/전화 표시
- Hidden field (URL prefill): `hubspot_id`, `email_prefill`

**섹션 2 — 지불 방법** (dropdown 3 옵션):
- Direct Debit (default 권장) — 추가 필드 X. Tally 완료 후 redirect page에서 GoCardless flow로 동적 redirect
- Credit - 7 days — 분기 필드: Legal entity, ABN/ACN, Credit limit 요청액 (0-3000 / 3001-10000 / over 10001). _EOM·credit_term 폐기 (2026-05-30) — Credit은 7일로만 통일_
- COD — 환영 이메일에 회사 계좌 안내. 출하 전 bank transfer 입금 증빙 필수

**제거된 것**:
- 기존 GoCardless EMBED 블록 (정적 URL `BRT00050310ZYNZ` — single-use라 운영 불가)
- 기존 "Direct Debit Request" TITLE 블록

## GoCardless 연결 패턴

Tally 정적 임베드 불가 → **Tally redirect on completion** + 별도 redirect page:
1. Tally submit → `https://<our>/onboarding-redirect?response_id={tally_response_id}` 이동
2. Redirect page가 #7a 결과 fetch
3. payment=DD면 → n8n endpoint → GoCardless API 동적 BRT 생성 → flow URL로 redirect
4. payment=Credit/COD면 → 정적 thank-you 메시지

Redirect page 구현은 별도 작업 (#7a 빌드 이후).

## #7a 빌드 시 적용 정책

- Tally webhook payload는 **questionId 기반 strict 매핑** (라벨 변경에 견고)
- Airtable `Onboarding Submissions` staging은 두 갈래:
  - 핵심 식별 필드 strict 매핑: `hubspot_id` (hidden), `email`, `phone`, `submitted_at`, `tally_response_id` (멱등 키), `tally_form_id`
  - 나머지 필드는 `raw_payload` JSON dump → 폼 진화에 강건
- 폼에 필드 추가돼도 #7a 코드 변경 없이 raw_payload로 흡수
- 폼 v2/v3 나와도 동일 webhook URL 유지 가능 → `tally_form_id`로 버전 식별
