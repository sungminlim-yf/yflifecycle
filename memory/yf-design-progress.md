---
name: yf-design-progress
description: "Young Foods B2B 시스템 설계 phase 포인터 — 현재 v0.4, 다음 작업 후보 위치"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d30d126-8bcb-491b-b40d-e1e58d82e7aa
---

설계 단계 v0.4+ (2026-05-28 갱신). 도메인별 폴더 + 각 폴더 CLAUDE.md 구조 (`onboarding/`, `order-site/`, `airtable/`, `xero/`, `n8n/`). 루트 `CLAUDE.md`가 라우터·대시보드 — 잠긴 결정·미결은 거기에 정리되어 있어 그쪽을 single source로 참조.

설계 닫힌 영역: order-site UX, 가격/할인/배송비/DD, 온보딩 폼, n8n 워크플로우 #1·#2, **MOQ($150 grand subtotal), 배송비($5+GST, OUTPUT 10%), Xero Item Code(KAT/GAR/TER), Slack ops-* 매핑** (2026-05-28 추가 closure). `xero/` 도메인 미결 모두 해소. **`airtable/production-planning.md` v1 작성 + `schema.md`에 Production Plan/Schedule 2 테이블 + 제품 lookup 3필드 반영** (2026-05-28 추가).

라벨·박스 단위 갱신 반영 완료: KARAAGE·TERIYAKI 라벨(=bag) 2.5kg→4kg + **박스 = 2 bag = 8kg 확정**, 박스 단가 $32.50→$52→**$104** ([[product-source-files]]).
Xero 환경 확보 + Item 3개 등록 완료 ($78/$104/$104, EXEMPTOUTPUT) ([[xero-account]]).

다음 작업 후보 (사용자가 turn 시작 시 택일):
- n8n 워크플로우 #6 (분실복구·주문확인 SMS — #1이 sub-workflow로 호출 중)
- n8n 워크플로우 #3 (Xero → Airtable 결제·Hold 동기화)
- n8n 워크플로우 #2.5 (선결제·COD 인보이스 발행)
- Production Plan/Schedule 실제 Airtable 베이스에 테이블 생성 (스키마 → 실 구현)

남은 운영 액션(설계 외): n8n에 Custom Connection 키·ops-* 채널 ID 등록 (clientSecret은 placeholder인 상태, 사용자가 n8n UI에서 직접 입력하도록 안내함 — [[xero-account]]), Xero scope 문제 진단 대기 ([[xero-account]]).

진행 방식은 [[yf-conversation-style]] 참조.
