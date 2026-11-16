/* رسم الفاتورة كصفحات A4 مع توزيع تلقائي للبنود */
(function (MK) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = d => (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? d.split('-').reverse().join('/') : '';
  const fmtTime = t => (t && /^\d{2}:\d{2}/.test(t)) ? t.slice(0, 5) : '';

  const TYPES = {
    tax: ['فاتورة ضريبية', 'Tax Invoice'],
    simplified: ['فاتورة ضريبية مبسطة', 'Simplified Tax Invoice'],
    credit: ['إشعار دائن', 'Credit Note'],
    debit: ['إشعار مدين', 'Debit Note']
  };
  MK.invoiceTypes = TYPES;

  const IC = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.6 7-11a7 7 0 0 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  };

  function qrPayload(inv, st, totals) {
    return MK.zatca.payload({
      seller: st.seller.name,
      vat: st.seller.vat,
      timestamp: (inv.date || '') + 'T' + (fmtTime(inv.time) || '00:00') + ':00Z',
      total: MK.calc.fixed(totals.total),
      vatTotal: MK.calc.fixed(totals.vat)
    });
  }
  MK.qrPayload = qrPayload;

  function build(inv, st) {
    const { rows, totals } = MK.calc.compute(inv);
    const f = MK.calc.fmt;
    const type = TYPES[inv.type] || TYPES.tax;
    const isNote = inv.type === 'credit' || inv.type === 'debit';
    const hasDisc = totals.disc > 0;
    const s = st.seller, c = inv.customer || {};

    const logo = '<img class="logo" src="assets/brand/logo-color.svg" alt="' + esc(s.name) + '">';

    const headFirst =
      '<div class="edge"></div>' +
      '<div class="hp">' + MK.brand.icon('ico') + '<div class="slogan">' + esc(st.slogan) + '</div><div class="en">MAKNOUN AL-MADINAH</div></div>' +
      '<header class="hd">' + logo + '<h1>' + esc(type[0]) + '</h1>' +
      '<div class="sub"><span>' + esc(type[1]) + '</span></div><div class="orn"><i></i></div></header>';

    const headCont =
      '<div class="edge"></div><header class="hd cont">' + logo +
      '<div class="ct"><b>' + esc(type[0]) + ' <span class="n">' + esc(inv.number) + '</span></b><span>تابع — ' + esc(s.name) + '</span></div></header>';

    const metaCells = [
      ['رقم ' + (isNote ? 'الإشعار' : 'الفاتورة'), '<span class="n">' + esc(inv.number) + '</span>'],
      ['تاريخ الإصدار', '<span class="n">' + fmtDate(inv.date) + '</span>'],
      ['وقت الإصدار', '<span class="n">' + fmtTime(inv.time) + '</span>']
    ];
    if (inv.supplyDate) metaCells.push(['تاريخ التوريد', '<span class="n">' + fmtDate(inv.supplyDate) + '</span>']);
    if (inv.dueDate) metaCells.push(['تاريخ الاستحقاق', '<span class="n">' + fmtDate(inv.dueDate) + '</span>']);
    if (isNote && inv.refNumber) metaCells.push(['الفاتورة الأصلية', '<span class="n">' + esc(inv.refNumber) + '</span>']);
    const meta = '<div class="meta">' + metaCells.map(m => '<div><small>' + m[0] + '</small><b>' + m[1] + '</b></div>').join('') + '</div>';

    const dl = pairs => '<dl>' + pairs.filter(p => p[1]).map(p => '<dt>' + p[0] + '</dt><dd>' + p[1] + '</dd>').join('') + '</dl>';
    const parties = '<div class="parties">' +
      '<div class="party"><span class="tag">المورّد</span><h3>' + esc(s.name) + '</h3>' +
      dl([['الرقم الضريبي', '<span class="n">' + esc(s.vat) + '</span>'], ['السجل التجاري', '<span class="n">' + esc(s.cr) + '</span>'], ['العنوان', esc(s.address)]]) + '</div>' +
      '<div class="party"><span class="tag">العميل</span><h3>' + esc(c.name || (inv.type === 'simplified' ? 'عميل نقدي' : '—')) + '</h3>' +
      dl([['الرقم الضريبي', c.vat ? '<span class="n">' + esc(c.vat) + '</span>' : ''], ['السجل التجاري', c.cr ? '<span class="n">' + esc(c.cr) + '</span>' : ''], ['العنوان', esc(c.address)], ['الجوال', c.phone ? '<span class="n">' + esc(c.phone) + '</span>' : '']]) + '</div></div>';

    const cols = '<colgroup><col style="width:30px"><col>' + '<col style="width:44px"><col style="width:72px">' +
      (hasDisc ? '<col style="width:58px">' : '') + '<col style="width:76px"><col style="width:46px"><col style="width:64px"><col style="width:82px"></colgroup>';
    const thead = '<thead><tr><th>م</th><th style="text-align:right;padding-inline:10px">البيان</th><th>الكمية</th><th>سعر الوحدة<small>قبل الضريبة</small></th>' +
      (hasDisc ? '<th>الخصم</th>' : '') + '<th>الخاضع<small>للضريبة</small></th><th>الضريبة</th><th>مبلغ<small>الضريبة</small></th><th>الإجمالي<small>شامل الضريبة</small></th></tr></thead>';

    const rowHtml = i => {
      const l = inv.lines[i], r = rows[i];
      const sub = [];
      if (l.duration) sub.push('<span>المدة: <b>' + esc(l.duration) + '</b></span>');
      if (l.period) sub.push('<span>الفترة: <b>' + esc(l.period) + '</b></span>');
      if (l.detail) sub.push('<em>' + esc(l.detail) + '</em>');
      const rate = l.vat === 'E' ? 'معفى' : l.vat + '%';
      return '<tr><td class="idx"><span class="n">' + (i + 1) + '</span></td><td class="d"><b>' + esc(l.desc || '—') + '</b>' +
        (sub.length ? '<div class="sub">' + sub.join('') + '</div>' : '') + '</td>' +
        '<td><span class="n">' + esc(MK.calc.num(l.qty)) + '</span></td><td><span class="n">' + f(r.unit) + '</span></td>' +
        (hasDisc ? '<td><span class="n">' + f(r.disc) + '</span></td>' : '') +
        '<td><span class="n">' + f(r.net) + '</span></td><td><span class="n">' + rate + '</span></td><td><span class="n">' + f(r.vat) + '</span></td>' +
        '<td class="tot"><span class="n">' + f(r.total) + '</span></td></tr>';
    };

    /* الذيل */
    const rateRows = Object.keys(totals.byRate).sort().map(k => {
      const b = totals.byRate[k];
      return '<div class="r"><span>' + (k === 'E' ? 'مبالغ معفاة من الضريبة' : 'ضريبة القيمة المضافة (' + k + '%)') + '</span><b class="n">' + f(k === 'E' ? b.net : b.vat) + '</b></div>';
    }).join('');
    const totalsHtml = '<div class="totals">' +
      (hasDisc ? '<div class="r"><span>الإجمالي قبل الخصم</span><b class="n">' + f(totals.netPre) + '</b></div><div class="r neg"><span>الخصم</span><b class="n">-' + f(totals.disc) + '</b></div>' : '') +
      '<div class="r"><span>الإجمالي الخاضع للضريبة</span><b class="n">' + f(totals.net) + '</b></div>' + rateRows +
      '<div class="hero"><small>الإجمالي شامل ضريبة القيمة المضافة</small><div class="v"><span>ريال سعودي</span><b>' + f(totals.total) + '</b></div></div></div>';

    const notes = (inv.notes || []).filter(n => n && n.trim());
    const bank = inv.showBank && (st.bank.iban || st.bank.bank || st.bank.holder)
      ? '<div class="bank"><h4>بيانات الدفع</h4>' + dl([['البنك', esc(st.bank.bank)], ['اسم الحساب', esc(st.bank.holder)], ['الآيبان', '<span class="n">' + esc(st.bank.iban) + '</span>']]) + '</div>' : '';

    let qr = '';
    if (inv.showQR !== false && s.vat) {
      try {
        qr = '<div class="qr"><div class="code">' + MK.zatca.qrSvg(qrPayload(inv, st, totals)) + '</div>' +
          '<div class="cap"><b>رمز QR الضريبي</b>يتضمّن بيانات الفاتورة وفق متطلبات هيئة الزكاة والضريبة والجمارك.</div></div>';
      } catch (e) { qr = ''; }
    }
    let sign = '';
    if (inv.showStamp !== false || inv.showSignature !== false) {
      sign = '<div class="sign">' +
        (inv.showStamp !== false && st.stamp ? '<img class="stamp" src="' + esc(st.stamp) + '" alt="">' : '') +
        (inv.showSignature !== false && st.signature ? '<img class="sig" src="' + esc(st.signature) + '" alt="">' : '') +
        '<div class="who"><b>' + esc(st.signerTitle) + '</b>' + (st.signerName ? '<span>' + esc(st.signerName) + '</span>' : '') + '</div></div>';
    }

    const tail = '<div class="tail"><div class="tail-top"><div class="tail-start">' +
      '<div class="words"><small>المبلغ كتابة</small><p>' + esc(MK.words.tafqeet(totals.total)) + '</p></div>' +
      (notes.length ? '<div class="notes"><h4>ملاحظات</h4><ul>' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '') +
      bank + '</div>' + totalsHtml + '</div>' +
      ((qr || sign) ? '<div class="tail-bot"><div>' + qr + '</div>' + sign + '</div>' : '') + '</div>';

    const contact = '<div class="contact">' +
      (s.phone ? '<span>' + IC.phone + '<span class="n">' + esc(s.phone) + '</span></span>' : '') +
      (s.email ? '<span>' + IC.mail + '<span class="n">' + esc(s.email) + '</span></span>' : '') +
      (s.address ? '<span>' + IC.pin + esc(s.address) + '</span>' : '') + '</div>';
    const foot = n => '<footer class="pf">' + contact + '<div class="bar"><span class="tx">' + esc(st.footerText) + '</span><span class="pg">' + n + '</span></div></footer>';

    return { headFirst, headCont, meta, parties, cols, thead, rowHtml, tail, foot, count: inv.lines.length };
  }

  /* يملأ stack بالصفحات ويرجع عدد الصفحات */
  function render(inv, st, stack) {
    const b = build(inv, st);
    stack.innerHTML = '';
    const pages = [];
    const over = el => el.scrollHeight > el.clientHeight + 1;

    function newPage(first) {
      const el = document.createElement('section');
      el.className = 'page';
      el.innerHTML = (first ? b.headFirst : b.headCont) + '<div class="pb"></div>' + b.foot('');
      stack.appendChild(el);
      const body = el.querySelector('.pb');
      if (first) body.insertAdjacentHTML('beforeend', b.meta + b.parties);
      const p = { el, body, tbody: null };
      pages.push(p);
      return p;
    }
    function addTable(p) {
      p.body.insertAdjacentHTML('beforeend', '<table class="items">' + b.cols + b.thead + '<tbody></tbody></table>');
      p.tbody = p.body.querySelector('tbody');
    }

    let p = newPage(true);
    addTable(p);
    if (!b.count) p.tbody.innerHTML = '<tr><td class="empty" colspan="9">لا توجد بنود</td></tr>';
    for (let i = 0; i < b.count; i++) {
      p.tbody.insertAdjacentHTML('beforeend', b.rowHtml(i));
      if (over(p.body) && p.tbody.children.length > 1) {
        p.tbody.lastElementChild.remove();
        p = newPage(false);
        addTable(p);
        p.tbody.insertAdjacentHTML('beforeend', b.rowHtml(i));
      }
    }
    p.body.insertAdjacentHTML('beforeend', b.tail);
    if (over(p.body)) {
      p.body.lastElementChild.remove();
      p = newPage(false);
      p.body.classList.add('nohead');
      p.body.insertAdjacentHTML('beforeend', b.tail);
    }
    const n = pages.length;
    pages.forEach((pg, i) => { pg.el.querySelector('.pg').textContent = n > 1 ? 'صفحة ' + (i + 1) + ' / ' + n : ''; });
    return n;
  }

  MK.render = render;
})(window.MK = window.MK || {});
