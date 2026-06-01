---
name: architecture-roadmap
description: YF 시스템 아키텍처 단계별 로드맵 — 왜 Airtable / 언제 Supabase / CRM은 자체제작 안 함
metadata: 
  node_type: memory
  type: project
  originSessionId: e8ae2a95-97f6-4aac-a58e-0888a71619de
---

YF 운영 시스템의 장기 아키텍처 방향 (2026-06-01 결정). 상세 근거는 repo `ARCHITECTURE.md`.

**근본 의도 (핵심)**: **Airtable은 목적지가 아니라 중간 단계.** 사업 초기에 빠르게 운영을 시작해 **프로세스를 실제 검증·정련하는 수단**으로 Airtable 사용 → 충분히 최적화된 프로세스를 **최종적으로 Supabase 기반 자체 시스템으로 이전**하는 것이 목적지. Airtable 정련 = 버려지는 게 아니라 Supabase ERP의 검증된 스펙. 비전공자가 Claude Code로 직접 구축하는 게 이상적 그림.

**3단계 로드맵**:
- **1단계 (현재)**: HubSpot(CRM) + Web(order intake) + **Airtable**(고객·오더·라인아이템·생산계획·재고예측·dispatch) + Xero(회계) + n8n(워크플로우). Airtable의 가치 = **공짜로 딸려오는 운영 UI**(그리드·인터페이스·Page Designer). 비전공자가 Claude Code로 빠르게 구축·검증.
- **2단계 (다음, 강력 추천)**: Airtable → **Supabase + Next.js 자체 ERP**로 교체. **Next.js + Supabase + Vercel = Claude Code 자체 구축에 가장 잘 맞는 스택**. Airtable 테이블이 SQL 테이블로 거의 1:1 이식. HubSpot·Xero·n8n은 유지.
- **3단계**: ❌ **자체 CRM 만들지 말 것** (HubSpot 끝까지 유지). 대신 ERP 심화 + BI/분석 + 기사용 모바일앱이 ROI 높음. Xero도 끝까지 유지(회계 자체제작 금지).

**핵심 통찰 — 이식성**: 지금 구축물의 **데이터 모델·비즈니스 규칙·연동 계약·도메인 문서**는 그대로 SQL로 이식됨(자산). Airtable formula/Interface/Page Designer/Automation만 폐기(껍데기). 

**이식성 극대화 규율 (1줄)**: **로직은 Airtable이 아니라 n8n/코드에 둔다. Airtable은 데이터 저장소 + 가벼운 파생까지만.** (가격·인보이스·hold 산출은 이미 n8n Code 노드에 있음 = 잘함. 출하 가능·배송 품목 같은 단순 표시 formula만 Airtable 허용.)

**"API limit 곧 도달" 공포 = 과대평가**: Airtable 한도는 base당 **초당 5요청(버스트)**이지 일일 총량 아님. 진짜 천장은 API속도가 아니라 ① base당 레코드 상한(오더·라인아이템 영구 누적 시 수년 뒤) ② ops seat 비용 ③ formula/automation 경직성. 초기 1~3년은 충분. 위생관리(폴링↓·webhook우선·배치읽기)로 버팀.

**실행 순서 확정 (2026-06-01)**: go-live 2-3개월 남음, office 일상사용자=본인+admin1+sales1(sales는 주로 HubSpot). **"Airtable 폴백 우선 완성(운영가능까지만·gold-plating 금지) → 남는 시간 Supabase 병렬 착수(타임박스) → go-live 시점 결정 게이트: 준비되면 Supabase 바로, 아니면 Airtable로 출시해 시간벌고 천천히 이전"**. 둘 동시 system-of-record 운영 X(이중동기 회피). 다운사이드 0 구조. 어려운 부분(스키마·규칙)은 이미 설계됨→설계 아닌 *이식*. 스택=Next.js+Supabase+Vercel(주문사이트가 프론트 출발점). 연동(HubSpot/Xero/Tally/GoCardless/ClickSend)·n8n은 유지, Airtable 노드만 Supabase로 교체.

**1→2 전환 트리거(완성 후 일반 신호)**: 레코드 상한 근접 / formula로 안 되는 로직 / seat 비용 부담 / 트랜잭션 정합성 필요.

관련: [[yf-design-progress]] · [[order-site-deploy]](2단계 프론트 출발점=기존 Next.js 주문사이트)
