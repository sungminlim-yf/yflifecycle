---
name: yf-conversation-style
description: Young Foods 설계 대화에서 사용자가 선호하는 진행 방식
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1d30d126-8bcb-491b-b40d-e1e58d82e7aa
---

설계 대화는 미결을 1~2개씩 점진적으로 닫는 방식으로 진행. 사용자 명시: "하나하나 질문해줘. 만들어 나가자."

**Why**: 큰 결정 묶음을 한 번에 받으면 검토 부담이 크고 결정들이 서로 영향을 흐려놓음. 1개씩 닫으면 컨텍스트가 좁아 결정이 빨라지고, 잠긴 결정이 즉시 문서에 반영돼 누적이 보임.

**How to apply**:
- AskUserQuestion에 default 권장안을 첫 번째 옵션 + 라벨 끝에 "(권장)" 표시 — 대부분 그대로 채택해 옴.
- 결정 1개 잠그면 해당 도메인 폴더 CLAUDE.md에 즉시 반영 + 루트 "확정된 주요 결정" 섹션에 한 줄 추가 + 미결 표 갱신. cross-cutting이면 영향 받는 모든 폴더 동시 갱신.
- 자명한 default (웹 표준·산업 모범사례)는 매번 묻지 말고 "이렇게 갑니다"라고 lock 후 진행. 결정 결과만 문서화.
- 큰 변경 묶음 누적 시 자동 commit 하지 말 것. 사용자가 "커밋해줘"라고 명시할 때만 — 단 commit 메시지 안은 미리 제시해서 동의 받기 쉽게.
- 사용자가 응답에서 commit 부분에 답을 안 주면 보류하고 다음 작업 이어가도 OK (사용자가 momentum 우선).

[[yf-design-progress]]에 현재 phase + 다음 작업 후보.
