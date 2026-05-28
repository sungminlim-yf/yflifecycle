---
name: yf-design-progress
description: "Young Foods B2B 시스템 설계 phase 포인터 — 현재 v0.4, 다음 작업 후보 위치"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1d30d126-8bcb-491b-b40d-e1e58d82e7aa
---

설계 단계 v0.4 (2026-05-28 기준). 도메인별 폴더 + 각 폴더 CLAUDE.md 구조 (`onboarding/`, `order-site/`, `airtable/`, `xero/`, `n8n/`). 루트 `CLAUDE.md`가 라우터·대시보드 — 잠긴 결정·미결은 거기에 정리되어 있어 그쪽을 single source로 참조.

설계 닫힌 영역: order-site UX, 가격/할인/배송비/DD, 온보딩 폼, n8n 워크플로우 #1·#2.

다음 작업 후보 (사용자가 turn 시작 시 택일):
- n8n 워크플로우 #6 (분실복구·주문확인 SMS — #1이 sub-workflow로 호출 중)
- n8n 워크플로우 #3 (Xero → Airtable 결제·Hold 동기화)
- n8n 워크플로우 #2.5 (선결제·COD 인보이스 발행)
- `airtable/production-planning.md` 스텁 채우기 (Make-to-stock 생산·재고 예측)

외부 확인 미결: 배송비 GST 회계사 확인 / Xero Item Code 3 SKU 등록 / Slack 채널 ID 확정.

진행 방식은 [[yf-conversation-style]] 참조.
