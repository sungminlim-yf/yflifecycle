---
name: user-machines
description: "사용자가 두 머신에서 Claude Code 작업 — 집 macOS, 회사 Windows. 메모리는 git 동기화, MCP·OAuth는 머신별 따로."
metadata: 
  node_type: memory
  type: user
  originSessionId: 3085e832-5a2d-42c6-aa15-54fbe5ec1dd0
---

사용자는 **두 컴퓨터**에서 yflifecycle 작업을 진행한다:

- 🏠 **집 = macOS** (`/Users/limsungmin/`)
- 🏢 **회사 = Windows** (`%USERPROFILE%\`)

**How to apply:**
- 경로를 답변에 적을 때 현재 머신 기준 한쪽만 단정하지 말고, OS별 차이가 있으면 양쪽 다 안내.
- "다른 머신에서도 되나요?" 류 질문엔 동기화 범위를 명확히:
  - ✅ **git으로 따라감**: 저장소 내 모든 파일 + `memory/` 폴더 (정션으로 묶여있음)
  - ❌ **머신별 따로**: `~/.claude.json` (MCP 등록), HTTP OAuth 인증 세션, 토큰 환경변수, OS 절대경로 박힌 옵션
- 새 머신 셋업 시 Windows는 `setup-memory-link.ps1` 1회 실행이 추가로 필요 (메모리 정션 복원).

관련: [[mcp-setup]]
