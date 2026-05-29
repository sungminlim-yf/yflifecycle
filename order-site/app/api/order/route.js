// 서버측 프록시: 브라우저 → 이 route → n8n #1 webhook.
// #1의 header auth 토큰은 여기(server)에서만 주입 → 브라우저에 노출 안 됨.

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error_code: 'bad_request', message: 'invalid JSON' }, { status: 400 });
  }

  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_ORDER_INTAKE_PATH || 'yf-order-intake-v1';
  const headerName = process.env.N8N_ORDER_INTAKE_HEADER_NAME;
  const headerValue = process.env.N8N_ORDER_INTAKE_HEADER_VALUE;

  if (!base || !headerName || !headerValue) {
    return Response.json(
      { ok: false, error_code: 'server_misconfig', message: '.env.local에 N8N_BASE_URL / N8N_ORDER_INTAKE_HEADER_NAME / N8N_ORDER_INTAKE_HEADER_VALUE 설정 필요' },
      { status: 500 }
    );
  }

  const url = `${base.replace(/\/$/, '')}/webhook/${path}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName]: headerValue },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, raw: text }; }
    return Response.json(data, { status: resp.status });
  } catch (e) {
    return Response.json({ ok: false, error_code: 'upstream_unreachable', message: String(e) }, { status: 502 });
  }
}
