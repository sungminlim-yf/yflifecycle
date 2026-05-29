---
name: mcp-setup
description: "yflifecycle 프로젝트에 설치한 MCP 서버 구성 — 설치 방식, 패키지, 주의점 (집 macOS + 회사 Windows 양쪽 동일 구성, 2026-05-28 갱신)"
metadata: 
  node_type: memory
  type: project
  originSessionId: d5393fe5-e6fe-4ec2-a0a1-f2ef3743eab7
---

CLAUDE.md 흐름에 필요한 외부 서비스 MCP들. 모두 **local scope** (`~/.claude.json`의 project 항목) — git/.mcp.json에 안 올라가므로 **머신마다 별도 등록 필요**. 실제 토큰 값은 이 메모리에 저장 안 함(설정 파일에만 있음).

**머신 현황 (2026-05-28 기준)**
- 🏠 집 = **macOS** (`/Users/limsungmin/.claude.json`)
- 🏢 회사 = **Windows** (`%USERPROFILE%\.claude.json`)
- 양쪽 다 아래 11개 MCP 등록 완료. 같은 토큰·키 사용. 머신별 차이는 OAuth 인증 세션과 경로 박힌 옵션(아래 ⚠️ 참고).

⚠️ **playwright `--user-data-dir`** 은 OS별 절대경로라 머신마다 다르게 등록되어 있어야 함 (macOS=`/Users/limsungmin/...`, Windows=`C:\Users\<이름>\...`). 다른 stdio MCP는 npx 기반이라 OS 무관.

⚠️ **HTTP OAuth 서버** (Airtable / Canva / Firecrawl / Tally) 은 `claude mcp add`로 등록은 공유되지만 **브라우저 OAuth 인증 세션은 머신별로 따로** 진행해야 함.

**현재 연결 상태 (2026-05-28 macOS)**

✅ 정상 연결 (stdio):
- **n8n** — `npx -y n8n-mcp` (czlonkowski). env: `N8N_API_URL=https://youngfoods.app.n8n.cloud`, `N8N_API_KEY` (JWT, **exp 약 2026-08-25** — 갱신 필요). 첫 부팅 시 대용량 다운로드로 헬스체크가 한 번 timeout 날 수 있음 → 캐시 후 재실행.
- **Xero** — `@xeroapi/xero-mcp-server@latest` (공식). Custom Connection `claude-yflifecycle-v1` 사용. env: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET` (client credentials grant, single-tenant). 도구 prefix `mcp__xero__*`. 키 출처는 [[xero-account]].
- **Slack** — `npx -y slack-mcp-server@latest --transport stdio` (korotovsky). env: `SLACK_MCP_XOXB_TOKEN` (Bot 토큰 xoxb), `SLACK_MCP_ADD_MESSAGE_TOOL=true` (전송 활성화, 기본은 비활성).
- **HubSpot** — `npx -y @hubspot/mcp-server` (공식). env: `PRIVATE_APP_ACCESS_TOKEN` (pat-ap1-…, 포털 443192961 ap1). 원격 `mcp.hubspot.com/anthropic`는 2026-05-28 시도 시 redirect URL mismatch로 실패 → Private App 로컬로 fallback (메모리 원래 권고대로).

✅ 정상 연결 (원격 HTTP):
- **plugin:airtable:airtable** — `https://mcp.airtable.com/mcp`. OAuth 인증 완료.
- **claude.ai Canva** — `https://mcp.canva.com/mcp`. 디자인/asset 관리.
- **context7** — `npx -y @upstash/context7-mcp --api-key …`. 라이브러리 docs fetch.
- **firecrawl** — `https://mcp.firecrawl.dev/.../v2/mcp` (HTTP). 웹 검색·scraping.
- **playwright** — `npx -y @playwright/mcp@latest --browser chrome --user-data-dir …`. 브라우저 자동화/스크린샷.
- **sequential-thinking** — `npx -y @modelcontextprotocol/server-sequential-thinking`.

⚠️ 등록은 됐고 브라우저 OAuth 인증 대기:
- **tally** — `claude mcp add --transport http tally https://api.tally.so/mcp`. `/mcp`에서 브라우저 인증 필요. (참고: 새로 추가한 HTTP 서버는 `/mcp` UI가 바로 안 잡을 수 있음 — 메시지 한 번 보낸 뒤 다시 열거나 세션 재시작.)

**n8n 내부 credentials 인벤토리** (n8n.cloud 인스턴스, 2026-05-29):
- `xero-custom-connection` (oAuth2Api) — Xero Custom Connection, [[xero-account]]
- `HubSpot Private App (companies read)` (hubspotAppToken)
- `Slack account` (slackApi, Bot 토큰)
- `Airtable Personal Access Token account` (airtableTokenApi)
- `Gmail OAuth2 API` (gmailOAuth2)
- `clicksend-creds` (httpBasicAuth, id `WZGjzqhfPeU4PL4i`) — 2026-05-29 추가, 도메인 제한 `rest.clicksend.com`
- 기타: Slack OAuth2 API, Header Auth account, OpenAI account, OpenWeatherMap account
- 예정: `tally-webhook-secret` (signing secret 발급 후)

**Slack 스코프 주의**: korotovsky 서버는 부팅 시 모든 대화 타입(public/private/mpim/im)을 강제 캐싱하므로 Bot 토큰에 `channels:read`+`groups:read`+`im:read`+`mpim:read`가 모두 필요(하나라도 없으면 missing_scope로 부팅 실패). 끄는 env 없음. 알림 발송 자체엔 `chat:write`만 필요.

**설치 패턴 (재설치 시 참고)**
- stdio + env: `claude mcp add <name> --env KEY=VAL --env KEY2=VAL2 -- npx -y <pkg>`
- HTTP OAuth: `claude mcp add --transport http <name> <url>` → `/mcp`에서 브라우저 인증

관련: [[currentDate]] · [[xero-account]]
