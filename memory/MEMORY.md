# 메모리 인덱스

> 이 폴더는 Claude Code의 영구 메모리 저장소입니다.
> 저장소 안에 두어 git으로 컴퓨터 간 동기화합니다.
> 실제 메모리 경로(`~/.claude/projects/<hash>/memory`)에서 이 폴더로 디렉터리 정션이 연결되어 있습니다.
> 새 컴퓨터에서는 `setup-memory-link.ps1`을 한 번 실행해 정션을 다시 만드세요.

- [MCP 서버 구성](mcp-setup.md) — 집 macOS + 회사 Windows 양쪽 동일 구성. n8n/Xero/Slack/HubSpot/Airtable + 보조 5개 + Tally. n8n 키 exp 2026-08-25
- [사용자 머신 환경](user-machines.md) — 집 macOS / 회사 Windows 두 머신. git=공유, MCP·OAuth·토큰=머신별 따로
- [제품 원본 파일 위치](product-source-files.md) — 라벨·바코드·레시피 원본은 Dropbox `…/01. Recipe Label SKU/`. products.md는 이 파일들로 채운 스냅샷
- [설계 진행도](yf-design-progress.md) — v0.4 — n8n #1~#7 전부 설계 완료. **운영 액션 5/9 진행 중** (2026-05-28 밤). 내일 픽업 가이드 포함
- [Airtable base + 테이블 ID](airtable-base.md) — base `yflifecycle` (appag4IfzpTeQPS1X) + 8개 운영 테이블 ID + UI 잔여작업(lookup convert 등). HubSpot portal·currency 메모도 같이
- [Xero 계정 상태](xero-account.md) — Young Foods Pty Ltd 회사 생성, Custom Connection App 키 확보. n8n REST + Claude Code `mcp__xero__*` 양쪽에서 사용
- [대화 진행 스타일](yf-conversation-style.md) — 미결 1~2개씩 점진 진행, default 권장 잘 채택, 큰 묶음마다 명시 commit 요청
