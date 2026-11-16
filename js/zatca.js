/* رمز QR الضريبي (هيئة الزكاة والضريبة والجمارك) — ترميز TLV ثم Base64
   الوسوم: 1 اسم البائع · 2 الرقم الضريبي · 3 تاريخ ووقت الفاتورة (ISO 8601) · 4 الإجمالي شامل الضريبة · 5 مبلغ الضريبة */
(function (MK) {
  'use strict';
  const enc = new TextEncoder();

  function tlv(tag, value) {
    const bytes = enc.encode(String(value));
    if (bytes.length > 255) throw new Error('قيمة طويلة جداً في رمز QR');
    return [tag, bytes.length, ...bytes];
  }

  function toBase64(bytes) {
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  /* fields: {seller, vat, timestamp, total, vatTotal} */
  function payload(f) {
    const bytes = [].concat(
      tlv(1, f.seller), tlv(2, f.vat), tlv(3, f.timestamp), tlv(4, f.total), tlv(5, f.vatTotal));
    return toBase64(bytes);
  }

  function decode(b64) {
    const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const dec = new TextDecoder(), out = {};
    for (let i = 0; i < bytes.length;) {
      const tag = bytes[i], len = bytes[i + 1];
      out[tag] = dec.decode(bytes.slice(i + 2, i + 2 + len));
      i += 2 + len;
    }
    return out;
  }

  /* SVG نظيف (مسار واحد) يُطبع بحدّة تامة */
  function qrSvg(text, opts) {
    opts = opts || {};
    const qr = qrcode(0, opts.level || 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount(), q = 2; // منطقة هادئة
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) {
          let len = 1;
          while (c + len < n && qr.isDark(r, c + len)) len++;
          d += 'M' + (c + q) + ' ' + (r + q) + 'h' + len + 'v1h-' + len + 'z';
          c += len - 1;
        }
      }
    }
    const size = n + q * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
      '" shape-rendering="crispEdges" role="img" aria-label="رمز QR ضريبي"><rect width="' + size +
      '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#1b1a17"/></svg>';
  }

  MK.zatca = { payload, decode, qrSvg };
})(window.MK = window.MK || {});
