'use client';

import { useState, useMemo, useEffect } from 'react';

// 카트 미리보기용 제품 정보 (서버 #1이 가격 재계산 — 표시용). SoT = Airtable 제품 테이블.
const PRODUCTS = [
  { sku: 'KATSNCP1P2MKBRBKV1', code: 'KAT', name: 'Golden Panko Chicken Cutlet (KATSU)', boxPrice: 78, kg: 6 },
  { sku: 'GARSNCP1P2MGTHBKV1', code: 'GAR', name: 'Crispy Chicken Bites (KARAAGE)', boxPrice: 104, kg: 8 },
  { sku: 'TERSNCP300MTTHBKV1', code: 'TER', name: 'Pre-Cooked Chicken Thigh (TERIYAKI)', boxPrice: 104, kg: 8 },
];
const MOQ = 150;

// 다국어 사전. 새 언어 추가 시 키 동일하게 블록만 추가.
const STRINGS = {
  en: {
    langName: 'English',
    magicTitle: 'Young Foods Order',
    magicTag: 'Registered shop',
    magicSub: 'Your dedicated order page',
    magicShopLine: (n) => `“${n}” dedicated order page`,
    magicNotYours: 'Not your shop?',
    magicGuestLink: 'Order as a guest →',
    guestTitle: 'Young Foods Order',
    guestTag: 'Guest order',
    guestSub: 'Already registered? Get your private link by email below.',
    resolving: 'Loading your shop info…',
    invalidLink: '⚠️ This link is invalid or expired. Please request a new one.',
    confirmShop: 'Please confirm your details',
    fShop: 'Shop', fContact: 'Contact', fPhone: 'Phone', fAddress: 'Delivery address', fPayment: 'Payment term',
    editBtn: 'Edit', saveBtn: 'Save', cancelBtn: 'Cancel', savedMsg: 'Saved ✓', saveErr: 'Could not save',
    editHint: 'Contact or phone changed? Edit here — your orders are unaffected.',
    guestInfo: 'Shop details',
    lShop: 'Shop name', lPhone: 'Phone', lAddress: 'Delivery address', lEmail: 'Email (optional)',
    reqShop: 'Shop name', reqPhone: '04xx xxx xxx', reqAddr: 'Delivery address',
    products: 'Order items (by box)', boxKg: 'kg/box', perBox: '/box',
    summary: 'Order summary', emptyCart: 'Add items to your cart.',
    boxes: 'boxes', subtotal: 'Subtotal (list price)',
    delivery: 'Delivery', deliveryFree: '(free over $300)', deliveryFee: '($5 + GST)', free: 'Free',
    estTotal: 'Estimated total (ref.)', discountNote: 'A promotion or discount may be applied on the final invoice.',
    moqNote: 'Minimum order $150 (list price)', moqShort: (n) => `Add $${n} more to place the order.`,
    deliverySec: 'Delivery', deliveryDate: 'Requested delivery date',
    cutoffNote: 'Cutoff = 12pm the day before delivery.',
    cutoffBumped: (d) => `The 12pm cutoff has passed. Earliest delivery is now ${d}. Please review and place the order again.`,
    overrideToggle: 'Deliver this order to a different address', overridePh: 'This order delivery address',
    noteLabel: 'Order note (optional)', notePh: 'Requests',
    submit: 'Place order', submitting: 'Submitting…',
    submitted: '✓ Order submitted', newOrder: 'Place another order',
    okMsg: (no) => `✅ Order received: ${no}`, errMsg: 'Could not place order',
    nameEnglishOnly: 'Shop name must be entered in English only.',
    recoverTitle: 'Lost your link?',
    recoverPh: 'Your registered email',
    recoverBtn: 'Email me my link',
    recoverSent: "If your email is registered, we've sent your order link. Please check your inbox.",
    recoverSending: 'Sending…',
    recoverTapHint: '(tap to open)',
    recoverGuestHint: "Can't remember your email either? You can still order as a guest — just fill in the details below.",
  },
  ko: {
    langName: '한국어',
    magicTitle: 'Young Foods 주문',
    magicTag: '등록된 가게',
    magicSub: '전용 주문 페이지',
    magicShopLine: (n) => `「${n}」 전용 주문 페이지`,
    magicNotYours: '내 가게가 아닌가요?',
    magicGuestLink: '손님으로 주문하기 →',
    guestTitle: 'Young Foods 주문',
    guestTag: '손님으로 주문',
    guestSub: '이미 등록된 가게라면 아래에서 이메일로 전용 링크를 받으세요.',
    resolving: '가게 정보를 불러오는 중…',
    invalidLink: '⚠️ 유효하지 않거나 만료된 링크입니다. 재발급을 요청해 주세요.',
    confirmShop: '아래 정보를 확인해 주세요',
    fShop: '상호', fContact: '담당자', fPhone: '연락처', fAddress: '배송지', fPayment: '결제 조건',
    editBtn: '수정', saveBtn: '저장', cancelBtn: '취소', savedMsg: '저장되었습니다 ✓', saveErr: '저장 실패',
    editHint: '연락처·담당자가 바뀌었나요? 여기서 수정하세요 — 주문에는 영향 없습니다.',
    guestInfo: '가게 정보',
    lShop: '상호', lPhone: '연락처', lAddress: '배송지', lEmail: '이메일 (선택)',
    reqShop: '가게명', reqPhone: '0412 345 678', reqAddr: '배송 주소',
    products: '주문 품목 (박스 단위)', boxKg: 'kg/박스', perBox: '/박스',
    summary: '주문 요약', emptyCart: '품목을 담아주세요.',
    boxes: '박스', subtotal: '소계 (정가)',
    delivery: '배송비', deliveryFree: '(소계 $300↑ 무료)', deliveryFee: '($5 + GST)', free: '무료',
    estTotal: '예상 합계 (참고)', discountNote: '프로모션 또는 할인이 인보이스에 적용될 수 있습니다.',
    moqNote: '최소 주문 금액 $150 (정가 기준)', moqShort: (n) => `$${n} 더 담으면 주문 가능합니다.`,
    deliverySec: '배송', deliveryDate: '희망 배송일',
    cutoffNote: '컷오프 = 배송 전날 낮 12시.',
    cutoffBumped: (d) => `낮 12시 컷오프가 지나 가장 빠른 배송일이 ${d}(으)로 변경되었습니다. 확인 후 다시 주문해 주세요.`,
    overrideToggle: '이번 주문만 다른 곳으로 받기', overridePh: '이번 주문 배송지',
    noteLabel: '주문 메모 (선택)', notePh: '요청사항',
    submit: '주문하기', submitting: '제출 중…',
    submitted: '✓ 주문 제출 완료', newOrder: '추가 주문하기',
    okMsg: (no) => `✅ 주문 접수: ${no}`, errMsg: '주문에 실패했습니다',
    nameEnglishOnly: '상호는 영문만 입력 가능합니다.',
    recoverTitle: '링크를 잃어버리셨나요?',
    recoverPh: '등록된 이메일',
    recoverBtn: '이메일로 링크 받기',
    recoverSent: '등록된 이메일이라면 주문 링크를 보냈습니다. 받은편지함을 확인해 주세요.',
    recoverSending: '전송 중…',
    recoverTapHint: '(여기를 클릭)',
    recoverGuestHint: '복구 이메일도 기억나지 않으시면, 아래 정보를 작성해 게스트로 바로 주문하셔도 됩니다.',
  },
  zh: {
    langName: '中文',
    magicTitle: 'Young Foods 订购',
    magicTag: '已注册店铺',
    magicSub: '专属订购页面',
    magicShopLine: (n) => `「${n}」专属订购页面`,
    magicNotYours: '不是您的店铺？',
    magicGuestLink: '以访客身份订购 →',
    guestTitle: 'Young Foods 订购',
    guestTag: '访客订购',
    guestSub: '已注册？请在下方通过邮箱获取专属链接。',
    resolving: '正在加载店铺信息…',
    invalidLink: '⚠️ 此链接无效或已过期。请重新申请。',
    confirmShop: '请确认以下信息',
    fShop: '店铺', fContact: '联系人', fPhone: '电话', fAddress: '配送地址', fPayment: '付款方式',
    editBtn: '修改', saveBtn: '保存', cancelBtn: '取消', savedMsg: '已保存 ✓', saveErr: '保存失败',
    editHint: '联系人或电话有变动？在此修改 — 不影响您的订单。',
    guestInfo: '店铺信息',
    lShop: '店铺名', lPhone: '电话', lAddress: '配送地址', lEmail: '邮箱（可选）',
    reqShop: '店铺名称', reqPhone: '0412 345 678', reqAddr: '配送地址',
    products: '订购商品（按箱）', boxKg: '公斤/箱', perBox: '/箱',
    summary: '订单摘要', emptyCart: '请添加商品。',
    boxes: '箱', subtotal: '小计（标价）',
    delivery: '运费', deliveryFree: '（满$300免运费）', deliveryFee: '（$5 + GST）', free: '免费',
    estTotal: '预计总额（参考）', discountNote: '发票可能会应用促销或折扣。',
    moqNote: '最低订购金额 $150（标价）', moqShort: (n) => `再添加 $${n} 即可下单。`,
    deliverySec: '配送', deliveryDate: '期望配送日期',
    cutoffNote: '截止 = 配送前一天中午12点。',
    cutoffBumped: (d) => `已过中午12点截止时间。最早配送日期现为 ${d}。请确认后重新下单。`,
    overrideToggle: '本次订单送至其他地址', overridePh: '本次订单配送地址',
    noteLabel: '订单备注（可选）', notePh: '要求',
    submit: '下单', submitting: '提交中…',
    submitted: '✓ 订单已提交', newOrder: '再下一单',
    okMsg: (no) => `✅ 订单已接收：${no}`, errMsg: '下单失败',
    nameEnglishOnly: '店铺名称只能使用英文。',
    recoverTitle: '丢失了链接？',
    recoverPh: '您的注册邮箱',
    recoverBtn: '通过邮箱发送链接',
    recoverSent: '如果您的邮箱已注册，我们已发送您的订购链接。请查收邮件。',
    recoverSending: '发送中…',
    recoverTapHint: '(点击展开)',
    recoverGuestHint: '也不记得邮箱了？您可以在下方填写信息，以访客身份下单。',
  },
  ja: {
    langName: '日本語',
    magicTitle: 'Young Foods 注文',
    magicTag: '登録店舗',
    magicSub: '専用注文ページ',
    magicShopLine: (n) => `「${n}」専用注文ページ`,
    magicNotYours: 'あなたの店舗ではありませんか？',
    magicGuestLink: 'ゲストとして注文 →',
    guestTitle: 'Young Foods 注文',
    guestTag: 'ゲスト注文',
    guestSub: '登録済みの場合は、下記からメールで専用リンクを受け取れます。',
    resolving: '店舗情報を読み込み中…',
    invalidLink: '⚠️ このリンクは無効か期限切れです。再発行をご依頼ください。',
    confirmShop: '内容をご確認ください',
    fShop: '店舗', fContact: '担当者', fPhone: '電話', fAddress: '配送先', fPayment: 'お支払い条件',
    editBtn: '編集', saveBtn: '保存', cancelBtn: 'キャンセル', savedMsg: '保存しました ✓', saveErr: '保存できませんでした',
    editHint: '担当者や電話番号が変わりましたか？こちらで編集 — 注文には影響しません。',
    guestInfo: '店舗情報',
    lShop: '店舗名', lPhone: '電話', lAddress: '配送先住所', lEmail: 'メール（任意）',
    reqShop: '店舗名', reqPhone: '0412 345 678', reqAddr: '配送先住所',
    products: '注文商品（箱単位）', boxKg: 'kg/箱', perBox: '/箱',
    summary: '注文内容', emptyCart: '商品を追加してください。',
    boxes: '箱', subtotal: '小計（定価）',
    delivery: '配送料', deliveryFree: '（$300以上で無料）', deliveryFee: '（$5 + GST）', free: '無料',
    estTotal: '合計の目安（参考）', discountNote: 'プロモーションまたは割引が請求書に適用される場合があります。',
    moqNote: '最低注文金額 $150（定価）', moqShort: (n) => `あと $${n} で注文できます。`,
    deliverySec: '配送', deliveryDate: '希望配送日',
    cutoffNote: '締切 = 配送前日の正午12時。',
    cutoffBumped: (d) => `正午12時の締切を過ぎました。最短配送日は ${d} になりました。ご確認のうえ再度ご注文ください。`,
    overrideToggle: 'この注文だけ別の住所に届ける', overridePh: 'この注文の配送先',
    noteLabel: '注文メモ（任意）', notePh: 'ご要望',
    submit: '注文する', submitting: '送信中…',
    submitted: '✓ 注文を送信しました', newOrder: '追加で注文する',
    okMsg: (no) => `✅ 注文を受け付けました：${no}`, errMsg: '注文に失敗しました',
    nameEnglishOnly: '店舗名は英語のみ入力可能です。',
    recoverTitle: 'リンクを紛失しましたか？',
    recoverPh: '登録済みのメールアドレス',
    recoverBtn: 'メールでリンクを受け取る',
    recoverSent: 'メールアドレスが登録されていれば、注文リンクを送信しました。受信箱をご確認ください。',
    recoverSending: '送信中…',
    recoverTapHint: '(タップで開く)',
    recoverGuestHint: 'メールも思い出せない場合は、下記にご記入のうえゲストとしてご注文いただけます。',
  },
  th: {
    langName: 'ไทย',
    magicTitle: 'Young Foods สั่งซื้อ',
    magicTag: 'ร้านที่ลงทะเบียน',
    magicSub: 'หน้าสั่งซื้อเฉพาะของคุณ',
    magicShopLine: (n) => `หน้าสั่งซื้อเฉพาะของ “${n}”`,
    magicNotYours: 'ไม่ใช่ร้านของคุณ?',
    magicGuestLink: 'สั่งซื้อแบบผู้เยี่ยมชม →',
    guestTitle: 'Young Foods สั่งซื้อ',
    guestTag: 'สั่งซื้อแบบผู้เยี่ยมชม',
    guestSub: 'ลงทะเบียนแล้ว? รับลิงก์เฉพาะของคุณทางอีเมลด้านล่าง',
    resolving: 'กำลังโหลดข้อมูลร้าน…',
    invalidLink: '⚠️ ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ กรุณาขอลิงก์ใหม่',
    confirmShop: 'กรุณาตรวจสอบข้อมูลด้านล่าง',
    fShop: 'ร้าน', fContact: 'ผู้ติดต่อ', fPhone: 'โทรศัพท์', fAddress: 'ที่อยู่จัดส่ง', fPayment: 'เงื่อนไขการชำระเงิน',
    editBtn: 'แก้ไข', saveBtn: 'บันทึก', cancelBtn: 'ยกเลิก', savedMsg: 'บันทึกแล้ว ✓', saveErr: 'บันทึกไม่สำเร็จ',
    editHint: 'ผู้ติดต่อหรือเบอร์โทรเปลี่ยน? แก้ไขที่นี่ — ไม่กระทบคำสั่งซื้อ',
    guestInfo: 'ข้อมูลร้าน',
    lShop: 'ชื่อร้าน', lPhone: 'โทรศัพท์', lAddress: 'ที่อยู่จัดส่ง', lEmail: 'อีเมล (ไม่บังคับ)',
    reqShop: 'ชื่อร้าน', reqPhone: '0412 345 678', reqAddr: 'ที่อยู่จัดส่ง',
    products: 'รายการสั่งซื้อ (ต่อกล่อง)', boxKg: 'กก./กล่อง', perBox: '/กล่อง',
    summary: 'สรุปคำสั่งซื้อ', emptyCart: 'กรุณาเพิ่มสินค้า',
    boxes: 'กล่อง', subtotal: 'ยอดรวมย่อย (ราคาปกติ)',
    delivery: 'ค่าจัดส่ง', deliveryFree: '(ฟรีเมื่อเกิน $300)', deliveryFee: '($5 + GST)', free: 'ฟรี',
    estTotal: 'ยอดรวมโดยประมาณ (อ้างอิง)', discountNote: 'อาจมีการใช้โปรโมชันหรือส่วนลดในใบแจ้งหนี้',
    moqNote: 'ยอดสั่งซื้อขั้นต่ำ $150 (ราคาปกติ)', moqShort: (n) => `เพิ่มอีก $${n} เพื่อสั่งซื้อ`,
    deliverySec: 'การจัดส่ง', deliveryDate: 'วันที่ต้องการจัดส่ง',
    cutoffNote: 'กำหนดตัดยอด = เที่ยงวันก่อนวันจัดส่ง',
    cutoffBumped: (d) => `เลยกำหนดตัดยอดเที่ยงวันแล้ว วันจัดส่งเร็วที่สุดคือ ${d} กรุณาตรวจสอบและสั่งซื้ออีกครั้ง`,
    overrideToggle: 'จัดส่งคำสั่งนี้ไปยังที่อยู่อื่น', overridePh: 'ที่อยู่จัดส่งสำหรับคำสั่งนี้',
    noteLabel: 'หมายเหตุคำสั่งซื้อ (ไม่บังคับ)', notePh: 'คำขอ',
    submit: 'สั่งซื้อ', submitting: 'กำลังส่ง…',
    submitted: '✓ ส่งคำสั่งซื้อแล้ว', newOrder: 'สั่งซื้อเพิ่ม',
    okMsg: (no) => `✅ รับคำสั่งซื้อแล้ว: ${no}`, errMsg: 'ไม่สามารถสั่งซื้อได้',
    nameEnglishOnly: 'ชื่อร้านต้องกรอกเป็นภาษาอังกฤษเท่านั้น',
    recoverTitle: 'ลิงก์หายหรือไม่?',
    recoverPh: 'อีเมลที่ลงทะเบียนไว้',
    recoverBtn: 'ส่งลิงก์ทางอีเมล',
    recoverSent: 'หากอีเมลของคุณลงทะเบียนไว้ เราได้ส่งลิงก์สั่งซื้อแล้ว กรุณาตรวจสอบกล่องจดหมาย',
    recoverSending: 'กำลังส่ง…',
    recoverTapHint: '(แตะเพื่อเปิด)',
    recoverGuestHint: 'จำอีเมลไม่ได้ด้วย? คุณสามารถกรอกข้อมูลด้านล่างเพื่อสั่งซื้อแบบผู้เยี่ยมชมได้',
  },
  es: {
    langName: 'Español',
    magicTitle: 'Pedido Young Foods',
    magicTag: 'Tienda registrada',
    magicSub: 'Tu página de pedidos exclusiva',
    magicShopLine: (n) => `Página de pedidos exclusiva de “${n}”`,
    magicNotYours: '¿No es tu tienda?',
    magicGuestLink: 'Pedir como invitado →',
    guestTitle: 'Pedido Young Foods',
    guestTag: 'Pedido como invitado',
    guestSub: '¿Ya estás registrado? Recibe tu enlace privado por correo electrónico abajo.',
    resolving: 'Cargando la información de tu tienda…',
    invalidLink: '⚠️ Este enlace no es válido o ha caducado. Solicita uno nuevo.',
    confirmShop: 'Confirma tus datos',
    fShop: 'Tienda', fContact: 'Contacto', fPhone: 'Teléfono', fAddress: 'Dirección de entrega', fPayment: 'Condiciones de pago',
    editBtn: 'Editar', saveBtn: 'Guardar', cancelBtn: 'Cancelar', savedMsg: 'Guardado ✓', saveErr: 'No se pudo guardar',
    editHint: '¿Cambió el contacto o teléfono? Edítalo aquí — no afecta tus pedidos.',
    guestInfo: 'Datos de la tienda',
    lShop: 'Nombre de la tienda', lPhone: 'Teléfono', lAddress: 'Dirección de entrega', lEmail: 'Correo electrónico (opcional)',
    reqShop: 'Nombre de la tienda', reqPhone: '0412 345 678', reqAddr: 'Dirección de entrega',
    products: 'Artículos del pedido (por caja)', boxKg: 'kg/caja', perBox: '/caja',
    summary: 'Resumen del pedido', emptyCart: 'Añade artículos al carrito.',
    boxes: 'cajas', subtotal: 'Subtotal (precio de lista)',
    delivery: 'Envío', deliveryFree: '(gratis desde $300)', deliveryFee: '($5 + GST)', free: 'Gratis',
    estTotal: 'Total estimado (ref.)', discountNote: 'Es posible que se aplique una promoción o descuento en la factura.',
    moqNote: 'Pedido mínimo $150 (precio de lista)', moqShort: (n) => `Añade $${n} más para realizar el pedido.`,
    deliverySec: 'Entrega', deliveryDate: 'Fecha de entrega deseada',
    cutoffNote: 'Cierre = 12 del mediodía del día anterior a la entrega.',
    cutoffBumped: (d) => `Se pasó el cierre de las 12 del mediodía. La entrega más próxima ahora es ${d}. Revisa y realiza el pedido de nuevo.`,
    overrideToggle: 'Entregar este pedido en otra dirección', overridePh: 'Dirección de entrega de este pedido',
    noteLabel: 'Nota del pedido (opcional)', notePh: 'Solicitudes',
    submit: 'Realizar pedido', submitting: 'Enviando…',
    submitted: '✓ Pedido enviado', newOrder: 'Realizar otro pedido',
    okMsg: (no) => `✅ Pedido recibido: ${no}`, errMsg: 'No se pudo realizar el pedido',
    nameEnglishOnly: 'El nombre de la tienda debe ingresarse solo en inglés.',
    recoverTitle: '¿Perdiste tu enlace?',
    recoverPh: 'Tu correo registrado',
    recoverBtn: 'Enviarme mi enlace por correo',
    recoverSent: 'Si tu correo está registrado, te hemos enviado tu enlace de pedido. Revisa tu bandeja de entrada.',
    recoverSending: 'Enviando…',
    recoverTapHint: '(toca para abrir)',
    recoverGuestHint: '¿Tampoco recuerdas tu correo? Puedes pedir como invitado completando los datos de abajo.',
  },
};

function plusDaysISO(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// 컷오프 = 배송 전날 낮 12시 (QLD/Brisbane 기준, 서머타임 없음).
// 지금(=호출 시점) 기준 선택 가능한 가장 빠른 배송일을 ISO로 반환.
// 정오 전이면 내일(D+1), 정오 이후면 모레(D+2). place order 시점에 재평가됨.
function earliestDeliveryISO(now = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  });
  const p = {};
  for (const part of dtf.formatToParts(now)) p[part.type] = part.value;
  const base = Date.UTC(+p.year, +p.month - 1, +p.day);
  const addDays = +p.hour >= 12 ? 2 : 1;
  return new Date(base + addDays * 86400000).toISOString().slice(0, 10);
}

// 상호는 영문(printable ASCII)만 — 생산·배송팀 가독성. 회사 공식 언어.
const isAscii = (s) => /^[\x20-\x7E]*$/.test(s);

export default function Page() {
  const [lang, setLang] = useState('en');
  const [fontScale, setFontScale] = useState(1); // 글씨 크기 (zoom 0.9~1.3)
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState(null); // resolved customer info
  const [shopState, setShopState] = useState('idle'); // idle|loading|found|notfound
  const [qty, setQty] = useState({});
  const [deliveryDate, setDeliveryDate] = useState(() => earliestDeliveryISO());
  const [cutoffNotice, setCutoffNotice] = useState(null);
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
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverState, setRecoverState] = useState('idle'); // idle|sending|sent
  const [recoverOpen, setRecoverOpen] = useState(false); // 분실복구 접기/펼치기 (기본 접힘)
  const [editing, setEditing] = useState(false); // 연락처·담당자 인라인 편집
  const [editContact, setEditContact] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState(null); // 'saved' | 'err' | null

  const t = STRINGS[lang];

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const tk = p.get('token');
    setToken(tk);
    setIdemKey(crypto.randomUUID());
    const savedLang = localStorage.getItem('yf_lang');
    if (savedLang && STRINGS[savedLang]) setLang(savedLang);
    const savedZoom = parseFloat(localStorage.getItem('yf_zoom'));
    if (savedZoom >= 0.9 && savedZoom <= 1.6) setFontScale(savedZoom);
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

  function setZoom(v) {
    const z = Math.min(1.6, Math.max(0.9, Math.round(v * 10) / 10));
    setFontScale(z);
    localStorage.setItem('yf_zoom', String(z));
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
  const nameOk = !isGuest || !storeName.trim() || isAscii(storeName.trim());
  const canSubmit = lines.length > 0 && moqOk && guestOk && nameOk && !submitting;
  const submitted = !!(result && result.status >= 200 && result.status < 300 && result.data?.ok);
  const earliest = earliestDeliveryISO(); // 렌더 시점 최소 배송일 (제출 시 재평가)

  function setQ(sku, v) {
    setQty((prev) => ({ ...prev, [sku]: Math.max(0, Math.floor(v) || 0) }));
  }

  // 매직링크 분실 복구 — 등록 이메일로 링크 발송 요청. enumeration 차단 위해
  // 등록 여부와 무관하게 항상 동일한 안내를 보여준다.
  async function recover() {
    if (!recoverEmail.trim() || recoverState === 'sending') return;
    setRecoverState('sending');
    try {
      await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail.trim() }),
      });
    } catch (e) { /* 동일 응답 정책 — 에러도 흡수 */ }
    setRecoverState('sent');
  }

  function startEdit() {
    setEditContact(shop?.contact || '');
    setEditPhone(shop?.phone || '');
    setContactMsg(null);
    setEditing(true);
  }
  async function saveContact() {
    setSavingContact(true);
    setContactMsg(null);
    try {
      const r = await fetch('/api/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, contact: editContact.trim(), phone: editPhone.trim() }),
      });
      const data = await r.json();
      if (r.ok && data && data.ok) {
        setShop((s) => ({ ...s, contact: editContact.trim(), phone: editPhone.trim() }));
        setContactMsg('saved');
        setEditing(false);
      } else {
        setContactMsg('err');
      }
    } catch (e) {
      setContactMsg('err');
    } finally {
      setSavingContact(false);
    }
  }

  function newOrder() {
    setQty({});
    setNote('');
    setOverrideOn(false);
    setOverrideAddr('');
    setResult(null);
    setCutoffNotice(null);
    setIdemKey(crypto.randomUUID());
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    // 컷오프 판정 = place order 누른 "이 시점" 기준. 정오 지났으면 다음날 선택 불가 → 보정 후 재확인.
    const earliestNow = earliestDeliveryISO();
    if (deliveryDate < earliestNow) {
      setDeliveryDate(earliestNow);
      setCutoffNotice(earliestNow);
      return;
    }
    setCutoffNotice(null);
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
    } catch (e) {
      setResult({ status: 0, data: { error: String(e) } });
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="wrap" style={{ zoom: fontScale }}>
      <div className="zoombar">
        <span className="zoomicon" aria-hidden="true">🔍</span>
        <button className="zoombtn zsm" onClick={() => setZoom(fontScale - 0.1)} aria-label="Smaller text">A</button>
        <button className="zoombtn zreset" onClick={() => setZoom(1)} aria-label="Reset text size">↺</button>
        <button className="zoombtn zlg" onClick={() => setZoom(fontScale + 0.1)} aria-label="Larger text">A</button>
      </div>
      <div className="langbar">
        {Object.keys(STRINGS).map((l) => (
          <button key={l} className={'langbtn' + (l === lang ? ' active' : '')} onClick={() => switchLang(l)}>
            {STRINGS[l].langName}
          </button>
        ))}
      </div>

      {isGuest ? (
        <div className="banner" style={{ background: '#444' }}>
          <h1>{t.guestTitle} <span className="banner-tag">{t.guestTag}</span></h1>
          <p>{t.guestSub}</p>
        </div>
      ) : (
        <div className="banner">
          <h1>{t.magicTitle} <span className="banner-tag">{t.magicTag}</span></h1>
          <p>{shopState === 'found' && shop?.shop_name ? t.magicShopLine(shop.shop_name) : t.magicSub}</p>
          <p className="banner-alt">{t.magicNotYours} <a href="/">{t.magicGuestLink}</a></p>
        </div>
      )}

      {/* 분실 복구 (게스트 전용) — 배너 문구 바로 아래, 기본 접힘으로 Shop details에 무게를 둔다 */}
      {isGuest && (
        <div className="card collapse">
          <button type="button" className="collapse-head" aria-expanded={recoverOpen} onClick={() => setRecoverOpen((o) => !o)}>
            <span>{t.recoverTitle} <span className="tap-hint">{t.recoverTapHint}</span></span>
            <span className="chev">{recoverOpen ? '▾' : '▸'}</span>
          </button>
          {recoverOpen && (
            <div className="collapse-body">
              {recoverState === 'sent' ? (
                <p className="muted">{t.recoverSent}</p>
              ) : (
                <>
                  <input type="email" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} placeholder={t.recoverPh} />
                  <button
                    className="submit secondary compact"
                    style={{ marginTop: 10 }}
                    disabled={!recoverEmail.trim() || recoverState === 'sending'}
                    onClick={recover}
                  >
                    {recoverState === 'sending' ? t.recoverSending : t.recoverBtn}
                  </button>
                </>
              )}
              <p className="muted" style={{ marginTop: 10 }}>{t.recoverGuestHint}</p>
            </div>
          )}
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
              {editing ? (
                <>
                  <label>{t.fContact}</label>
                  <input type="text" value={editContact} onChange={(e) => setEditContact(e.target.value)} />
                  <label>{t.fPhone}</label>
                  <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  <div className="edit-actions">
                    <button className="submit secondary compact" disabled={savingContact} onClick={saveContact}>{savingContact ? t.submitting : t.saveBtn}</button>
                    <button className="linkbtn" onClick={() => { setEditing(false); setContactMsg(null); }}>{t.cancelBtn}</button>
                  </div>
                </>
              ) : (
                <>
                  {shop.contact ? <div className="shoprow"><span className="muted">{t.fContact}</span><span>{shop.contact}</span></div> : null}
                  {shop.phone ? <div className="shoprow"><span className="muted">{t.fPhone}</span><span>{shop.phone}</span></div> : null}
                  {shop.address ? <div className="shoprow"><span className="muted">{t.fAddress}</span><span>{shop.address}</span></div> : null}
                  {shop.payment_term ? <div className="shoprow"><span className="muted">{t.fPayment}</span><span>{shop.payment_term}</span></div> : null}
                  {contactMsg === 'saved' && <div className="muted" style={{ color: '#1f9d55', marginTop: 8 }}>{t.savedMsg}</div>}
                  <div className="edit-hint"><span>{t.editHint}</span> <button className="linkbtn" onClick={startEdit}>{t.editBtn}</button></div>
                </>
              )}
              {contactMsg === 'err' && <div className="warn">{t.saveErr}</div>}
            </>
          )}
        </div>
      )}

      {isGuest && (
        <div className="card">
          <h2>{t.guestInfo}</h2>
          <label>{t.lShop} *</label>
          <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={t.reqShop} />
          {storeName.trim() && !isAscii(storeName.trim()) && <div className="warn">{t.nameEnglishOnly}</div>}
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
            <span>{p.code} × {p.q} {t.boxes}</span>
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
        <input type="date" value={deliveryDate} min={earliest} onChange={(e) => { setDeliveryDate(e.target.value); setCutoffNotice(null); }} />
        <div className="muted" style={{ marginTop: 4 }}>{t.cutoffNote}</div>
        {cutoffNotice && <div className="warn">{t.cutoffBumped(cutoffNotice)}</div>}
        <div className="toggle" style={{ marginTop: 12 }}>
          <input id="ov" type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} />
          <label htmlFor="ov" style={{ margin: 0 }}>{t.overrideToggle}</label>
        </div>
        {overrideOn && <input type="text" value={overrideAddr} onChange={(e) => setOverrideAddr(e.target.value)} placeholder={t.overridePh} />}
        <label>{t.noteLabel}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.notePh} />
      </div>

      {submitted ? (
        <>
          <button className="submit done" disabled>{t.submitted}</button>
          <button className="submit secondary" style={{ marginTop: 10 }} onClick={newOrder}>{t.newOrder}</button>
        </>
      ) : (
        <button className="submit" disabled={!canSubmit} onClick={submit}>
          {submitting ? t.submitting : t.submit}
        </button>
      )}

      {result && (
        <div className={`result ${submitted ? 'ok' : 'err'}`}>
          {submitted
            ? t.okMsg(result.data.order_no || '')
            : `⚠️ ${t.errMsg}: ${result.data?.error_code || result.status}`}
        </div>
      )}
    </div>
  );
}
