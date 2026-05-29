# Young Foods 오더 사이트 (Next.js)

> 고객용 주문 웹. 매직 링크 진입 → 3 SKU 주문 → 제출. App Router. 서버측 API route가 n8n #1 webhook을 프록시(토큰 server-side 주입).
> 화면·UX 설계는 `CLAUDE.md` 참조.

## 구조

```
order-site/
  app/
    layout.js          루트 레이아웃
    page.js            주문 페이지 (client) — 매직링크/게스트 분기
    globals.css        스타일
    api/order/route.js #1 webhook 프록시 (header 토큰 주입)
  package.json
  .env.local.example   → .env.local 로 복사 후 값 입력
```

## 로컬 실행

```bash
cd order-site
npm install
cp .env.local.example .env.local   # 값 채우기 (아래)
npm run dev                        # http://localhost:3000
```

### .env.local 값
- `N8N_BASE_URL` = `https://youngfoods.app.n8n.cloud`
- `N8N_ORDER_INTAKE_PATH` = `yf-order-intake-v1`
- `N8N_ORDER_INTAKE_HEADER_NAME` / `_VALUE` = n8n credential `order-intake-token`(`dY4EiGLUEsseUd4h`)의 헤더 이름·값

### 테스트
- 매직 링크 진입: `http://localhost:3000/?token=<Airtable 고객의 매직 토큰>`
- 게스트: `http://localhost:3000/` (token 없이)
- 전제: n8n #1(`twZw1wv3Fc1iJdeO`) **active**.

## 현재 범위 (MVP, iteration 1)
- ✅ 매직링크/게스트 진입, 3 SKU 주문, 카트 미리보기(소계·배송비·MOQ), 컷오프 날짜 선택, 멱등키, #1 제출
- ⏳ 다음: 고객정보 배너(매직토큰→고객 resolve, n8n 읽기 webhook), 선결제/COD 셀프수정, 분실복구 글로벌 페이지(#6b), PWA

## 배포 (추후)
Vercel 연결 → 환경변수 동일 입력 → 도메인(`order.youngfoods.com.au`) 연결. `ORDER_SITE_BASE_URL`(#7b 환영메일 매직링크)도 이 도메인으로 맞출 것.
