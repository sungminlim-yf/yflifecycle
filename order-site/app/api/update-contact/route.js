// 등록 고객(매직 토큰)의 연락처·담당자 self-update.
// 서버측에서 n8n #R2 webhook 호출 (order-intake-token 헤더 재사용). 토큰=인증.
// 고객 행의 담당자/연락처 필드만 update — 오더 테이블·payment term 무관.

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error_code: 'bad_request' }, { status: 400 });
  }

  const token = (body && body.token ? String(body.token) : '').trim();
  const contact = (body && body.contact ? String(body.contact) : '').trim();
  const phone = (body && body.phone ? String(body.phone) : '').trim();
  const language = (body && body.language ? String(body.language) : '').trim();

  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_UPDATE_CONTACT_PATH || 'yf-update-contact-v1';
  const headerName = process.env.N8N_ORDER_INTAKE_HEADER_NAME;
  const headerValue = process.env.N8N_ORDER_INTAKE_HEADER_VALUE;

  if (!token || (!contact && !phone && !language)) {
    return Response.json({ ok: false, error_code: 'nothing_to_update' }, { status: 200 });
  }
  if (!base || !headerName || !headerValue) {
    return Response.json({ ok: false, error_code: 'server_misconfig' }, { status: 500 });
  }

  const url = `${base.replace(/\/$/, '')}/webhook/${path}`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName]: headerValue },
      body: JSON.stringify({ token, contact, phone, language }),
    });
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { ok: false, error_code: 'upstream' }; }
    return Response.json(data, { status: r.status });
  } catch (e) {
    return Response.json({ ok: false, error_code: 'upstream_unreachable' }, { status: 502 });
  }
}
