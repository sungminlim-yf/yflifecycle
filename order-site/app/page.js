'use client';

import { useState, useMemo, useEffect } from 'react';

// 카트 미리보기용 제품 정보 (서버 #1이 가격을 재계산하므로 여기 값은 표시용).
// SoT = Airtable 제품 테이블. 변경 시 동기 필요 (추후 /api/bootstrap로 fetch 예정).
const PRODUCTS = [
  { sku: 'KATSNCP1P2MKBRBKV1', code: 'KAT', name: 'Golden Panko Chicken Cutlet (가츠)', boxPrice: 78, kg: 6 },
  { sku: 'GARSNCP1P2MGTHBKV1', code: 'GAR', name: 'Crispy Chicken Bites (가라아게)', boxPrice: 104, kg: 8 },
  { sku: 'TERSNCP300MTTHBKV1', code: 'TER', name: 'Pre-Cooked Chicken Thigh (데리야끼)', boxPrice: 104, kg: 8 },
];
const MOQ = 150;

function plusDaysISO(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function Page() {
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [qty, setQty] = useState({});
  const [deliveryDate, setDeliveryDate] = useState(plusDaysISO(3));
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideAddr, setOverrideAddr] = useState('');
  const [note, setNote] = useState('');
  // 게스트 입력
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [idemKey, setIdemKey] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setToken(p.get('token'));
    setIdemKey(crypto.randomUUID());
    setReady(true);
  }, []);

  const isGuest = !token;

  const lines = useMemo(
    () => PRODUCTS.map((p) => ({ ...p, q: qty[p.sku] || 0 })).filter((p) => p.q > 0),
    [qty]
  );
  const subtotal = useMemo(() => lines.reduce((s, p) => s + p.boxPrice * p.q, 0), [lines]);
  const deliveryFee = subtotal >= 300 ? 0 : 5.5;
  const moqOk = subtotal >= MOQ;
  const guestOk = !isGuest || (storeName.trim() && phone.trim() && address.trim());
  const canSubmit = lines.length > 0 && moqOk && guestOk && !submitting;

  function setQ(sku, v) {
    setQty((prev) => ({ ...prev, [sku]: Math.max(0, Math.floor(v) || 0) }));
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    const payload = {
      mode: isGuest ? 'guest' : 'magic_link',
      client_idempotency_key: idemKey,
      lines: lines.map((p) => ({ sku: p.sku, quantity_boxes: p.q })),
      requested_delivery_date: deliveryDate,
    };
    if (note.trim()) payload.note = note.trim();
    if (overrideOn && overrideAddr.trim()) payload.delivery_override_address = overrideAddr.trim();
    if (isGuest) {
      payload.store_name = storeName.trim();
      payload.contact_phone = phone.trim();
      payload.delivery_address = address.trim();
      if (email.trim()) payload.contact_email = email.trim();
    } else {
      payload.token = token;
    }

    try {
      const r = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      setResult({ status: r.status, data });
      if (r.ok && data && data.ok) setIdemKey(crypto.randomUUID());
    } catch (e) {
      setResult({ status: 0, data: { error: String(e) } });
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap">
      {isGuest ? (
        <div className="banner" style={{ background: '#444' }}>
          <h1>Young Foods 주문</h1>
          <p>게스트 주문입니다. 이미 등록된 가게면 전화번호/이메일로 전용 링크를 받으세요.</p>
        </div>
      ) : (
        <div className="banner">
          <h1>전용 주문 페이지</h1>
          <p>매직 링크로 진입했습니다. 내 가게 정보가 아니면 담당 영업사원에게 연락해 주세요.</p>
        </div>
      )}

      {isGuest && (
        <div className="card">
          <h2>가게 정보</h2>
          <label>상호 *</label>
          <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="가게명" />
          <label>연락처 *</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0412 345 678" />
          <label>배송지 *</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="배송 주소" />
          <label>이메일 (선택)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
      )}

      <div className="card">
        <h2>주문 품목 (박스 단위)</h2>
        {PRODUCTS.map((p) => (
          <div className="prod" key={p.sku}>
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="meta">{p.code} · {p.kg}kg/박스 · ${p.boxPrice}/박스</div>
            </div>
            <div className="stepper">
              <button onClick={() => setQ(p.sku, (qty[p.sku] || 0) - 1)}>−</button>
              <input
                type="number"
                min="0"
                value={qty[p.sku] || 0}
                onChange={(e) => setQ(p.sku, Number(e.target.value))}
              />
              <button onClick={() => setQ(p.sku, (qty[p.sku] || 0) + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>주문 요약</h2>
        {lines.length === 0 && <p className="muted">품목을 담아주세요.</p>}
        {lines.map((p) => (
          <div className="row" key={p.sku}>
            <span>{p.code} × {p.q}박스</span>
            <span>${(p.boxPrice * p.q).toLocaleString()}</span>
          </div>
        ))}
        {lines.length > 0 && (
          <>
            <div className="row">
              <span>소계 (정가)</span>
              <span>${subtotal.toLocaleString()}</span>
            </div>
            <div className="row">
              <span>배송비 {deliveryFee === 0 ? '(소계 $300↑ 무료)' : '($5 + GST)'}</span>
              <span>{deliveryFee === 0 ? '무료' : '$5.50'}</span>
            </div>
            <div className="row total">
              <span>예상 합계 (참고)</span>
              <span>${(subtotal + deliveryFee).toLocaleString()}</span>
            </div>
            <div className="muted">그룹 할인은 인보이스 발행 시 자동 적용됩니다.</div>
          </>
        )}
        <div className="muted" style={{ marginTop: 8 }}>최소 주문 금액 $150 (정가 기준)</div>
        {!moqOk && lines.length > 0 && (
          <div className="warn">${(MOQ - subtotal).toLocaleString()} 더 담으면 주문 가능합니다.</div>
        )}
      </div>

      <div className="card">
        <h2>배송</h2>
        <label>희망 배송일</label>
        <input type="date" value={deliveryDate} min={plusDaysISO(1)} onChange={(e) => setDeliveryDate(e.target.value)} />
        <div className="muted" style={{ marginTop: 4 }}>컷오프 = 배송 전날 12pm (Sydney). 초과 시 서버가 거부합니다.</div>

        <div className="toggle" style={{ marginTop: 12 }}>
          <input id="ov" type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} />
          <label htmlFor="ov" style={{ margin: 0 }}>이번 주문만 다른 곳으로 받기</label>
        </div>
        {overrideOn && (
          <input type="text" value={overrideAddr} onChange={(e) => setOverrideAddr(e.target.value)} placeholder="이번 주문 배송지" />
        )}

        <label>주문 메모 (선택)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="요청사항" />
      </div>

      <button className="submit" disabled={!canSubmit} onClick={submit}>
        {submitting ? '제출 중…' : '주문하기'}
      </button>

      {result && (
        <div className={`result ${result.status >= 200 && result.status < 300 && result.data?.ok ? 'ok' : 'err'}`}>
          {result.status >= 200 && result.status < 300 && result.data?.ok
            ? `✅ 주문 접수: ${result.data.order_no || '(번호 대기)'} · status=${result.data.status || ''}`
            : `⚠️ ${result.data?.error_code || 'error'} (HTTP ${result.status})`}
          {'\n'}
          {JSON.stringify(result.data, null, 2)}
        </div>
      )}
    </div>
  );
}
