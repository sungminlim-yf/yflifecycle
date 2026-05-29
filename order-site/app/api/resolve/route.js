// 매직 토큰 → 고객 정보 조회 (자체 인지 검토용 배너).
// 서버측에서 n8n resolve webhook 호출 (order-intake-token 헤더 재사용). 토큰=인증.

export async function GET(req) {
  const token = (new URL(req.url).searchParams.get('token') || '').trim();
  if (!token) return Response.json({ found: false }, { status: 200 });

  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_RESOLVE_PATH || 'yf-resolve-token-v1';
  const headerName = process.env.N8N_ORDER_INTAKE_HEADER_NAME;
  const headerValue = process.env.N8N_ORDER_INTAKE_HEADER_VALUE;
  if (!base || !headerName || !headerValue) {
    return Response.json({ found: false, error: 'server_misconfig' }, { status: 200 });
  }

  const url = `${base.replace(/\/$/, '')}/webhook/${path}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName]: headerValue },
      body: JSON.stringify({ token }),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { found: false }; }
    return Response.json(data, { status: 200 });
  } catch (e) {
    return Response.json({ found: false, error: 'upstream' }, { status: 200 });
  }
}
