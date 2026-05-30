// 매직 링크 분실 복구: 등록 이메일로 전용 주문 링크 발송 요청.
// 서버측에서 n8n recover webhook 호출 (order-intake-token 헤더 재사용).
// 보안: enumeration 차단을 위해 등록 여부와 무관하게 항상 동일 응답({ ok: true }).
//   실제 발송 여부 판단·rate limit은 n8n 워크플로우(#6c, email 복구)가 담당.
//   ⚠️ 해당 워크플로우 미구축 시 이 라우트는 동일 응답만 반환(아무것도 발송 안 됨).

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: true }, { status: 200 });
  }

  const email = (body && body.email ? String(body.email) : '').trim();
  const base = process.env.N8N_BASE_URL;
  const path = process.env.N8N_RECOVER_PATH || 'yf-recover-by-email-v1';
  const headerName = process.env.N8N_ORDER_INTAKE_HEADER_NAME;
  const headerValue = process.env.N8N_ORDER_INTAKE_HEADER_VALUE;

  // 입력/설정이 없어도 동일 응답 (정보 노출 차단)
  if (!email || !base || !headerName || !headerValue) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const url = `${base.replace(/\/$/, '')}/webhook/${path}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [headerName]: headerValue },
      body: JSON.stringify({ email }),
    });
  } catch (e) { /* 동일 응답 정책 — 업스트림 에러도 흡수 */ }

  return Response.json({ ok: true }, { status: 200 });
}
