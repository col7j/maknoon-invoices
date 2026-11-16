/* حسابات الفاتورة بالهللات (أعداد صحيحة) لتفادي أخطاء الكسور */
(function (MK) {
  'use strict';
  const rateOf = v => (v === 'E' || v === 'Z' ? 0 : Number(v) / 100);
  const toH = x => Math.round((Number(x) || 0) * 100 + 1e-9);
  const num = x => { const n = parseFloat(String(x).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };

  function line(l, inclusive) {
    const rate = rateOf(l.vat);
    const qty = num(l.qty), pre = toH(qty * num(l.price)), disc = Math.min(toH(l.discount), pre);
    const amt = pre - disc;
    const split = a => inclusive ? Math.round(a / (1 + rate)) : a;
    const netPre = split(pre), net = split(amt);
    const vat = inclusive ? amt - net : Math.round(net * rate);
    return { rate, qty, netPre, disc: netPre - net, net, vat, total: net + vat,
      unit: qty ? Math.round(netPre / qty) : 0 };
  }

  function compute(inv) {
    const rows = inv.lines.map(l => line(l, inv.pricesIncludeVat));
    const t = { netPre: 0, disc: 0, net: 0, vat: 0, total: 0, byRate: {} };
    rows.forEach((r, i) => {
      t.netPre += r.netPre; t.disc += r.disc; t.net += r.net; t.vat += r.vat; t.total += r.total;
      const key = inv.lines[i].vat;
      const b = t.byRate[key] || (t.byRate[key] = { net: 0, vat: 0 });
      b.net += r.net; b.vat += r.vat;
    });
    return { rows, totals: t };
  }

  const fmt = h => (h / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fixed = h => (h / 100).toFixed(2);

  MK.calc = { compute, fmt, fixed, num, toH };
})(window.MK = window.MK || {});
