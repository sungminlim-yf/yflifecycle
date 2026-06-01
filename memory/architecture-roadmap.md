---
name: architecture-roadmap
description: YF 시스템 아키텍처 단계별 로드맵 — 왜 Airtable / 언제 Supabase / CRM은 자체제작 안 함
metadata: 
  node_type: memory
  type: project
  originSessionId: e8ae2a95-97f6-4aac-a58e-0888a71619de
---

YF 운영 시스템의 장기 아키텍처 방향 (2026-06-01 결정). 상세 근거는 repo `ARCHITECTURE.md`.

**3단계 로드맵**:
- **1단계 (현재)**: HubSpot(CRM) + Web(order intake) + **Airtable**(고객·오더·라인아이템·생산계획·재고예측·dispatch) + Xero(회계) + n8n(워크플로우). Airtable의 가치 = **공짜로 딸려오는 운영 UI**(그리드·인터페이스·Page Designer). 비전공자가 Claude Code로 빠르게 구축·검증.
- **2단계 (다음, 강력 추천)**: Airtable → **Supabase + Next.js 자체 ERP**로 교체. **Next.js + Supabase + Vercel = Claude Code 자체 구축에 가장 잘 맞는 스택**. Airtable 테이블이 SQL 테이블로 거의 1:1 이식. HubSpot·Xero·n8n은 유지.
- **3단계**: ❌ **자체 CRM 만들지 말 것** (HubSpot 끝까지 유지). 대신 ERP 심화 + BI/분석 + 기사용 모바일앱이 ROI 높음. Xero도 끝까지 유지(회계 자체제작 금지).

**핵심 통찰 — 이식성**: 지금 구축물의 **데이터 모델·비즈니스 규칙·연동 계약·도메인 문서**는 그대로 SQL로 이식됨(자산). Airtable formula/Interface/Page Designer/Automation만 폐기(껍데기). 

**이식성 극대화 규율 (1줄)**: **로직은 Airtable이 아니라 n8n/코드에 둔다. Airtable은 데이터 저장소 + 가벼운 파생까지만.** (가격·인보이스·hold 산출은 이미 n8n Code 노드에 있음 = 잘함. 출하 가능·배송 품목 같은 단순 표시 formula만 Airtable 허용.)

**"API limit 곧 도달" 공포 = 과대평가**: Airtable 한도는 base당 **초당 5요청(버스트)**이지 일일 총량 아님. 진짜 천장은 API속도가 아니라 ① base당 레코드 상한(오더·라인아이템 영구 누적 시 수년 뒤) ② ops seat 비용 ③ formula/automation 경직성. 초기 1~3년은 충분. 위생관리(폴링↓·webhook우선·배치읽기)로 버팀.

**1→2 전환 트리거**: 레코드 상한 근접 / formula로 안 되는 로직 / seat 비용 부담 / 트랜잭션 정합성 필요 — 이 신호 오면 이전, 그 전엔 NO.

관련: [[yf-design-progress]] · [[order-site-deploy]](2단계 프론트 출발점=기존 Next.js 주문사이트)
