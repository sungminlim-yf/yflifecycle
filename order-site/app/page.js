'use client';

import { useState, useMemo, useEffect } from 'react';

// 카트 미리보기용 제품 정보 (서버 #1이 가격 재계산 — 표시용). SoT = Airtable 제품 테이블.
const PRODUCTS = [
  { sku: 'KATSNCP1P2MKBRBKV1', code: 'KAT', name: 'Golden Panko Chicken Cutlet (KATSU)', boxPrice: 78, kg: 6 },
  { sku: 'GARSNCP1P2MGTHBKV1', code: 'GAR', name: 'Crispy Chicken Bites (KARAAGE)', boxPrice: 104, kg: 8 },
  { sku: 'TERSNCP300MTTHBKV1', code: 'TER', name: 'Pre-Cooked Chicken Thigh (TERIYAKI)', boxPrice: 104, kg: 8 },
];
const MOQ = 150;

// EN/KO 사전. 새 언어 추가 시 키 동일하게 블록만 추가.
const STRINGS = {
  en: {
    langName: 'English',
    magicTitle: 'Your dedicated order page',
    magicSub: 'Please confirm the shop below is yours. If not, do not order — contact your sales rep.',
    guestTitle: 'Young Foods Order',
    guestSub: 'Guest order. Already registered? Get your private link by phone/email.',
    resolving: 'Loading your shop info…',
    invalidLink: '⚠️ This link is invalid or expired. Please request a new one.',
    confirmShop: 'Is this your shop?',
    fShop: 'Shop', fContact: 'Contact', fPhone: 'Phone', fAddress: 'Address', fPayment: 'Payment term',
    guestInfo: 'Shop details',
    lShop: 'Shop name', lPhone: 'Phone', lAddress: 'Delivery address', lEmail: 'Email (optional)',
    reqShop: 'Shop name', reqPhone: '04xx xxx xxx', reqAddr: 'Delivery address',
    products: 'Order items (by box)', boxKg: 'kg/box', perBox: '/box',
    summary: 'Order summary', emptyCart: 'Add items to your cart.',
    boxes: 'boxes', subtotal: 'Subtotal (list price)',
    delivery: 'Delivery', deliveryFree: '(free over $300)', deliveryFee: '($5 + GST)', free: 'Free',
    estTotal: 'Estimated total (ref.)', discountNote: 'Group discount is applied automatically on the invoice.',
    moqNote: 'Minimum order $150 (list price)', moqShort: (n) => `Add $${n} more to place the order.`,
    deliverySec: 'Delivery', deliveryDate: 'Requested delivery date',
    cutoffNote: 'Cutoff = 12pm the day before delivery (Sydney). Server rejects if past.',
    overrideToggle: 'Deliver this order to a different address', overridePh: 'This order delivery address',
    noteLabel: 'Order note (optional)', notePh: 'Requests',
    submit: 'Place order', submitting: 'Submitting…',
    okMsg: (no) => `✅ Order received: ${no}`, errMsg: 'Could not place order',
  },
  ko: {
    langName: '한국어',
    magicTitle: '전용 주문 페이지',
    magicSub: '아래 가게가 내 가게가 맞는지 확인하세요. 아니라면 주문하지 말고 담당 영업사원에게 연락해 주세요.',
    guestTitle: 'Young Foods 주문',
    guestSub: '게스트 주문입니다. 이미 등록된 가게면 전화번호/이메일로 전용 링크를 받으세요.',
    resolving: '가게 정보를 불러오는 중…',
    invalidLink: '⚠️ 유효하지 않거나 만료된 링크입니다. 재발급을 요청해 주세요.',
    confirmShop: '이 가게가 맞나요?',
    fShop: '상호', fContact: '담당자', fPhone: '연락처', fAddress: '배송지', fPayment: '결제 조건',
    guestInfo: '가게 정보',
    lShop: '상호', lPhone: '연락처', lAddress: '배송지', lEmail: '이메일 (선택)',
    reqShop: '가게명', reqPhone: '0412 345 678', reqAddr: '배송 주소',
    products: '주문 품목 (박스 단위)', boxKg: 'kg/박스', perBox: '/박스',
    summary: '주문 요약', emptyCart: '품목을 담아주세요.',
    boxes: '박스', subtotal: '소계 (정가)',
    delivery: '배송비', deliveryFree: '(소계 $300↑ 무료)', deliveryFee: '($5 + GST)', free: '무료',
    estTotal: '예상 합계 (참고)', discountNote: '그룹 할인은 인보이스 발행 시 자동 적용됩니다.',
    moqNote: '최소 주문 금액 $150 (정가 기준)', moqShort: (n) => `$${n} 더 담으면 주문 가능합니다.`,
    deliverySec: '배송', deliveryDate: '희망 배송일',
    cutoffNote: '컷오프 = 배송 전날 12pm (Sydney). 초과 시 서버가 거부합니다.',
    overrideToggle: '이번 주문만 다른 곳으로 받기', overridePh: '이번 주문 배송지',
    noteLabel: '주문 메모 (선택)', notePh: '요청사항',
    submit: '주문하기', submitting: '제출 중…',
    okMsg: (no) => `✅ 주문 접수: ${no}`, errMsg: '주문에 실패했습니다',
  },
};

function plusDaysISO(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function Page() {
  const [lang, setLang] = useState('en');
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState(null); // resolved customer info
  const [shopState, setShopState] = useState('idle'); // idle|loading|found|notfound
  const [qty, setQty] = useState({});
  const [deliveryDate, setDeliveryDate] = useState(plusDaysISO(3));
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideAddr, setOverrideAddr] = useState('');
  const [note, setNote] = useState('');
  const [storeName, setStoreName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [idemKey, setIdemKey] = useState('');

  const t = STRINGS[lang];

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tk = p.get('token');
    setToken(tk);
    setIdemKey(crypto.randomUUID());
    const savedLang = localStorage.getItem('yf_lang');
    if (savedLang && STRINGS[savedLang]) setLang(savedLang);
    setReady(true);
    if (tk) {
      setShopState('loading');
      fetch('/api/resolve?token=' + encodeURIComponent(tk))
        .then((r) => r.json())
        .then((d) => {
          if (d && d.found) { setShop(d); setShopState('found'); }
          else setShopState('notfound');
        })
        .catch(() => setShopState('notfound'));
    }
  }, []);

  function switchLang(l) {
    setLang(l);
    localStorage.setItem('yf_lang', l);
  }

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
      <div className="langbar">
        {Object.keys(STRINGS).map((l) => (
          <button key={l} className={'langbtn' + (l === lang ? ' active' : '')} onClick={() => switchLang(l)}>
            {STRINGS[l].langName}
          </button>
        ))}
      </div>

      {isGuest ? (
        <div className="banner" style={{ background: '#444' }}>
          <h1>{t.guestTitle}</h1>
          <p>{t.guestSub}</p>
        </div>
      ) : (
        <div className="banner">
          <h1>{t.magicTitle}</h1>
          <p>{t.magicSub}</p>
        </div>
      )}

      {/* 매직링크 진입: 연결된 샵 정보 — 자체 인지 검토 */}
      {!isGuest && (
        <div className="card shopcard">
          <h2>{t.confirmShop}</h2>
          {shopState === 'loading' && <p className="muted">{t.resolving}</p>}
          {shopState === 'notfound' && <p className="warn">{t.invalidLink}</p>}
          {shopState === 'found' && shop && (
            <>
              <div className="shoprow"><span className="muted">{t.fShop}</span><b>{shop.shop_name || '—'}</b></div>
              {shop.contact ? <div className="shoprow"><span className="muted">{t.fContact}</span><span>{shop.contact}</span></div> : null}
              {shop.phone ? <div className="shoprow"><span className="muted">{t.fPhone}</span><span>{shop.phone}</span></div> : null}
              {shop.address ? <div className="shoprow"><span className="muted">{t.fAddress}</span><span>{shop.address}</span></div> : null}
              {shop.payment_term ? <div className="shoprow"><span className="muted">{t.fPayment}</span><span>{shop.payment_term}</span></div> : null}
            </>
          )}
        </div>
      )}

      {isGuest && (
        <div className="card">
          <h2>{t.guestInfo}</h2>
          <label>{t.lShop} *</label>
          <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={t.reqShop} />
          <label>{t.lPhone} *</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.reqPhone} />
          <label>{t.lAddress} *</label>
          <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t.reqAddr} />
          <label>{t.lEmail}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
        </div>
      )}

      <div className="card">
        <h2>{t.products}</h2>
        {PRODUCTS.map((p) => (
          <div className="prod" key={p.sku}>
            <div className="info">
              <div className="name">{p.name}</div>
              <div className="meta">{p.code} · {p.kg}{t.boxKg} · ${p.boxPrice}{t.perBox}</div>
            </div>
            <div className="stepper">
              <button onClick={() => setQ(p.sku, (qty[p.sku] || 0) - 1)}>−</button>
              <input type="number" min="0" value={qty[p.sku] || 0} onChange={(e) => setQ(p.sku, Number(e.target.value))} />
              <button onClick={() => setQ(p.sku, (qty[p.sku] || 0) + 1)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>{t.summary}</h2>
        {lines.length === 0 && <p className="muted">{t.emptyCart}</p>}
        {lines.map((p) => (
          <div className="row" key={p.sku}>
            <span>{p.code} × {p.q}{t.boxes}</span>
            <span>${(p.boxPrice * p.q).toLocaleString()}</span>
          </div>
        ))}
        {lines.length > 0 && (
          <>
            <div className="row"><span>{t.subtotal}</span><span>${subtotal.toLocaleString()}</span></div>
            <div className="row">
              <span>{t.delivery} {deliveryFee === 0 ? t.deliveryFree : t.deliveryFee}</span>
              <span>{deliveryFee === 0 ? t.free : '$5.50'}</span>
            </div>
            <div className="row total"><span>{t.estTotal}</span><span>${(subtotal + deliveryFee).toLocaleString()}</span></div>
            <div className="muted">{t.discountNote}</div>
          </>
        )}
        <div className="muted" style={{ marginTop: 8 }}>{t.moqNote}</div>
        {!moqOk && lines.length > 0 && <div className="warn">{t.moqShort((MOQ - subtotal).toLocaleString())}</div>}
      </div>

      <div className="card">
        <h2>{t.deliverySec}</h2>
        <label>{t.deliveryDate}</label>
        <input type="date" value={deliveryDate} min={plusDaysISO(1)} onChange={(e) => setDeliveryDate(e.target.value)} />
        <div className="muted" style={{ marginTop: 4 }}>{t.cutoffNote}</div>
        <div className="toggle" style={{ marginTop: 12 }}>
          <input id="ov" type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} />
          <label htmlFor="ov" style={{ margin: 0 }}>{t.overrideToggle}</label>
        </div>
        {overrideOn && <input type="text" value={overrideAddr} onChange={(e) => setOverrideAddr(e.target.value)} placeholder={t.overridePh} />}
        <label>{t.noteLabel}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePh} />
      </div>

      <button className="submit" disabled={!canSubmit} onClick={submit}>
        {submitting ? t.submitting : t.submit}
      </button>

      {result && (
        <div className={`result ${result.status >= 200 && result.status < 300 && result.data?.ok ? 'ok' : 'err'}`}>
          {result.status >= 200 && result.status < 300 && result.data?.ok
            ? t.okMsg(result.data.order_no || '')
            : `⚠️ ${t.errMsg}: ${result.data?.error_code || result.status}`}
          {'\n'}
          {JSON.stringify(result.data, null, 2)}
        </div>
      )}
    </div>
  );
}
