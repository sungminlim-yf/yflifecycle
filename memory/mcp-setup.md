---
name: mcp-setup
description: "yflifecycle 프로젝트에 설치한 MCP 서버 구성 — 설치 방식, 패키지, 주의점, 미완료(Xero)"
metadata: 
  node_type: memory
  type: project
  originSessionId: d5393fe5-e6fe-4ec2-a0a1-f2ef3743eab7
---

CLAUDE.md에 등장하는 6개 서비스의 MCP를 2026-05-27에 설치함. 모두 **local scope**(`C:\Users\doing\.claude.json`의 project 항목) — git/.mcp.json에 안 올라가므로 **다른 PC에서는 재설치 필요**. 실제 토큰 값은 이 메모리에 저장 안 함(설정 파일에만 있음).

**설치 방식 요약**
- **Slack** ✅ — `npx -y slack-mcp-server@latest --transport stdio` (korotovsky 서버). env: `SLACK_MCP_XOXB_TOKEN`(Bot 토큰 xoxb), `SLACK_MCP_ADD_MESSAGE_TOOL=true`(전송 활성화, 기본은 전송 비활성).
- **HubSpot** ✅ — `npx -y @hubspot/mcp-server` (공식). env: `PRIVATE_APP_ACCESS_TOKEN`(Private App 토큰 pat-ap1-…, 포털 443192961 ap1). 원격 mcp.hubspot.com은 DCR 미지원이라 Claude Code OAuth로 연결 불가 → Private App 방식 채택.
- **n8n** ✅ — `npx -y n8n-mcp` (czlonkowski). env: `N8N_API_URL=https://youngfoods.app.n8n.cloud`, `N8N_API_KEY`(JWT, exp 2026-09경). 첫 설치 시 대용량 다운로드로 헬스체크가 한 번 timeout날 수 있음 → 캐시 후 재실행하면 연결됨.
- **Tally** 🔑 — `claude mcp add --transport http tally https://api.tally.so/mcp`. OAuth 원격 → `/mcp`에서 브라우저 인증 필요.
- **Airtable** 🔑 — `claude mcp add --transport http airtable https://mcp.airtable.com/mcp`. OAuth 원격 → `/mcp`에서 브라우저 인증 필요.
- **Xero** ⏳ 미설치 — 나중에 Custom Connection 만들어 추가 예정. 명령: `claude mcp add --scope local xero --env XERO_CLIENT_ID=… --env XERO_CLIENT_SECRET=… -- npx -y @xeroapi/xero-mcp-server@latest`. (Custom Connection 생성 시 "Company or application URL"엔 https://youngfoods.com.au 같은 아무 유효 URL.)

**Slack 스코프 주의**: korotovsky 서버는 부팅 시 모든 대화 타입(public/private/mpim/im)을 강제 캐싱하므로 봇 토큰에 `channels:read`+`groups:read`+`im:read`+`mpim:read`가 모두 필요(하나라도 없으면 missing_scope로 부팅 실패). 끄는 env 없음. 알림 발송 자체엔 `chat:write`만 필요.

관련: [[currentDate]]
