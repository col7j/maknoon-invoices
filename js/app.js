/* منطق الواجهة: الحالة، التخزين المحلي، التحرير، التصدير */
(function (MK) {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- التخزين ---------- */
  const K = { st: 'mk.inv.settings', draft: 'mk.inv.draft', cust: 'mk.inv.customers', hist: 'mk.inv.history', preset: 'mk.inv.presets', theme: 'mk.inv.theme' };
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  let storageOk = true;
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { storageOk = false; return false; } };

  /* ---------- الحالة ---------- */
  const D = MK.defaults;
  const st = Object.assign({
    seller: clone(D.seller), slogan: D.slogan, footerText: D.footerText, signerTitle: D.signerTitle, signerName: D.signerName,
    prefix: D.prefix, counter: D.counter, bank: clone(D.bank), notes: clone(D.notes),
    stamp: 'assets/brand/stamp.png', signature: ''
  }, read(K.st, {}));
  st.seller = Object.assign(clone(D.seller), st.seller);
  st.bank = Object.assign(clone(D.bank), st.bank);

  let customers = read(K.cust, []);
  let history = read(K.hist, []);
  let presets = read(K.preset, []);

  const pad = (n, w) => String(n).padStart(w, '0');
  const nextNumber = () => st.prefix + pad(st.counter, 4);
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); };
  const nowTime = () => { const d = new Date(); return pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2); };

  const blankLine = () => ({ id: uid(), desc: '', duration: '', period: '', detail: '', qty: 1, price: '', discount: '', vat: '15' });
  function blankInvoice() {
    return {
      id: uid(), type: 'tax', number: nextNumber(), refNumber: '', date: todayStr(), time: nowTime(), supplyDate: '', dueDate: '',
      customer: { name: '', vat: '', cr: '', address: '', phone: '' },
      pricesIncludeVat: true, lines: [blankLine()], notes: clone(st.notes),
      showQR: true, showStamp: true, showSignature: true, showBank: false
    };
  }
  let inv = read(K.draft, null) || blankInvoice();
  if (!inv.lines || !inv.lines.length) inv.lines = [blankLine()];

  /* ---------- مسارات متداخلة ---------- */
  function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function setPath(o, p, v) { const ks = p.split('.'), l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; }

  /* ---------- حفظ + إعادة رسم ---------- */
  let zoom = 1, fitMode = true, saveT, drawT;
  function setStatus(txt, busy) { const s = $('#status'); s.textContent = txt; s.classList.toggle('saving', !!busy); }
  function persist() {
    setStatus('جارٍ الحفظ…', true);
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const ok = write(K.draft, inv) & write(K.st, st);
      setStatus(ok ? 'محفوظ تلقائياً' : 'تعذّر الحفظ في المتصفح', !ok);
    }, 250);
  }
  function redraw() { clearTimeout(drawT); drawT = setTimeout(draw, 60); }

  function draw() {
    const pages = MK.render(inv, st, $('#stack'));
    $('#pgInfo').textContent = pages + (pages === 1 ? ' صفحة A4' : ' صفحات A4');
    fit();
    updateSummary();
    updateWarnings();
    updateLineTotals();
  }

  function fit() {
    const cv = $('#canvas'), stack = $('#stack'), sizer = $('#sizer');
    const avail = cv.clientWidth - (parseFloat(getComputedStyle(cv).paddingInline) || 0) * 2;
    const scale = fitMode ? Math.min(1, avail / 794) : zoom;
    stack.style.transform = 'scale(' + scale + ')';
    sizer.style.width = 794 * scale + 'px';
    sizer.style.height = stack.offsetHeight * scale + 'px';
    $('#zVal').textContent = Math.round(scale * 100) + '%';
    zoom = scale;
  }

  function updateSummary() {
    const { totals } = MK.calc.compute(inv), f = MK.calc.fmt;
    $('#sum').innerHTML =
      '<div><span>الإجمالي الخاضع للضريبة</span><b>' + f(totals.net) + '</b></div>' +
      '<div><span>ضريبة القيمة المضافة</span><b>' + f(totals.vat) + '</b></div>' +
      '<div class="tt"><span>الإجمالي شامل الضريبة</span><b>' + f(totals.total) + ' ريال</b></div>';
  }

  function updateWarnings() {
    const w = [];
    const { totals } = MK.calc.compute(inv);
    if (inv.date && inv.date < D.vatEffective && totals.vat > 0)
      w.push(['err', 'تاريخ الفاتورة قبل نفاذ التسجيل في ضريبة القيمة المضافة (01/10/2026)؛ لا يجوز تحصيل الضريبة قبله.']);
    const cv = (inv.customer.vat || '').trim();
    if (inv.type !== 'simplified' && !cv) w.push(['', 'الفاتورة الضريبية تتطلب الرقم الضريبي للعميل. للعميل الفرد استخدم «مبسطة».']);
    if (cv && !/^3\d{13}3$/.test(cv)) w.push(['', 'الرقم الضريبي للعميل يجب أن يكون 15 رقماً يبدأ وينتهي بالرقم 3.']);
    if ((inv.type === 'credit' || inv.type === 'debit') && !inv.refNumber) w.push(['', 'أدخل رقم الفاتورة الأصلية للإشعار.']);
    if (!storageOk) w.push(['err', 'المتصفح لا يسمح بالحفظ المحلي؛ ستضيع البيانات عند الإغلاق.']);
    $('#warns').innerHTML = w.map(x => '<div class="warn ' + x[0] + '">' + x[1] + '</div>').join('');
    $('input[data-k="inv:customer.vat"]').classList.toggle('bad', !!cv && !/^3\d{13}3$/.test(cv));
  }

  /* ---------- ربط الحقول العامة ---------- */
  function bindFields(root) {
    $$('[data-k]', root).forEach(el => {
      const [scope, path] = el.dataset.k.split(':');
      const obj = () => (scope === 'inv' ? inv : st);
      const cur = getPath(obj(), path);
      if (el.type === 'checkbox') el.checked = cur !== false && !!cur;
      else el.value = cur == null ? '' : cur;
      el.addEventListener('input', () => {
        setPath(obj(), path, el.type === 'checkbox' ? el.checked : el.value);
        if (path === 'customer.name') autofillCustomer(el.value);
        if (scope === 'inv') { persist(); redraw(); } else { persistSettings(); redraw(); }
      });
    });
  }
  function persistSettings() { write(K.st, st); persist(); }
  function refreshFields() { $$('.pane [data-k]').forEach(el => { const [s, p] = el.dataset.k.split(':'); const v = getPath(s === 'inv' ? inv : st, p); if (el.type === 'checkbox') el.checked = v !== false && !!v; else el.value = v == null ? '' : v; }); }

  /* ---------- segmented ---------- */
  function syncSegs() {
    $$('#typeSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === inv.type));
    $$('#inclSeg button').forEach(b => b.setAttribute('aria-pressed', (b.dataset.v === '1') === !!inv.pricesIncludeVat));
    $('#refFld').hidden = !(inv.type === 'credit' || inv.type === 'debit');
  }
  $('#typeSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; inv.type = b.dataset.v; syncSegs(); persist(); redraw(); });
  $('#inclSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; inv.pricesIncludeVat = b.dataset.v === '1'; syncSegs(); persist(); redraw(); });

  /* ---------- العملاء ---------- */
  function renderCustList() { $('#custList').innerHTML = customers.map(c => '<option value="' + esc(c.name) + '">').join(''); }
  function autofillCustomer(name) {
    const c = customers.find(x => x.name === name);
    if (!c) return;
    inv.customer = Object.assign({ name: '', vat: '', cr: '', address: '', phone: '' }, c);
    refreshFields();
  }
  $('#btnSaveCust').addEventListener('click', () => {
    const c = inv.customer;
    if (!c.name.trim()) return toast('أدخل اسم العميل أولاً');
    const i = customers.findIndex(x => x.name === c.name);
    if (i >= 0) customers[i] = clone(c); else customers.push(clone(c));
    write(K.cust, customers); renderCustList(); toast('تم حفظ العميل');
  });
  $('#btnDelCust').addEventListener('click', () => {
    const n = inv.customer.name, i = customers.findIndex(x => x.name === n);
    if (i < 0) return toast('هذا العميل غير محفوظ');
    customers.splice(i, 1); write(K.cust, customers); renderCustList(); toast('تم الحذف من المحفوظين');
  });

  /* ---------- البنود ---------- */
  function renderLines() {
    const list = $('#lineList');
    list.innerHTML = inv.lines.map((l, i) =>
      '<div class="li" data-i="' + i + '"><div class="li-bar"><b>بند ' + (i + 1) + '</b><div class="li-act">' +
      '<button class="ib" data-a="up" title="أعلى">↑</button><button class="ib" data-a="down" title="أسفل">↓</button>' +
      '<button class="ib" data-a="dup" title="تكرار">⧉</button><button class="ib" data-a="save" title="حفظ كبند جاهز">★</button>' +
      '<button class="ib" data-a="del" title="حذف">✕</button></div></div><div class="li-body">' +
      '<label class="fld"><span>البيان</span><textarea rows="2" data-f="desc">' + esc(l.desc) + '</textarea></label>' +
      '<div class="row2"><label class="fld"><span>المدة</span><input type="text" data-f="duration" value="' + esc(l.duration) + '" placeholder="مثال: 12 ساعة"></label>' +
      '<label class="fld"><span>الفترة</span><input type="text" data-f="period" value="' + esc(l.period) + '" placeholder="مثال: 6 و7 أكتوبر 2026"></label></div>' +
      '<div class="row3"><label class="fld"><span>الكمية</span><input type="number" step="any" min="0" data-f="qty" value="' + esc(l.qty) + '"></label>' +
      '<label class="fld"><span>السعر</span><input type="number" step="any" min="0" data-f="price" value="' + esc(l.price) + '"></label>' +
      '<label class="fld"><span>الخصم</span><input type="number" step="any" min="0" data-f="discount" value="' + esc(l.discount) + '"></label></div>' +
      '<div class="row2"><label class="fld"><span>الضريبة</span><select data-f="vat"><option value="15"' + (l.vat === '15' ? ' selected' : '') + '>15%</option><option value="0"' + (l.vat === '0' ? ' selected' : '') + '>0% (صفرية)</option><option value="E"' + (l.vat === 'E' ? ' selected' : '') + '>معفى</option></select></label>' +
      '<label class="fld"><span>تفصيل إضافي (اختياري)</span><input type="text" data-f="detail" value="' + esc(l.detail) + '"></label></div>' +
      '<div class="li-tot"><span>إجمالي البند شامل الضريبة</span><b data-t>0.00</b></div></div></div>').join('');
    updateLineTotals();
  }
  function updateLineTotals() {
    const { rows } = MK.calc.compute(inv);
    $$('#lineList .li').forEach((el, i) => { const t = $('[data-t]', el); if (t && rows[i]) t.textContent = MK.calc.fmt(rows[i].total) + ' ريال'; });
  }
  $('#lineList').addEventListener('input', e => {
    const el = e.target, f = el.dataset.f; if (!f) return;
    inv.lines[+el.closest('.li').dataset.i][f] = el.value;
    persist(); redraw();
  });
  $('#lineList').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const i = +b.closest('.li').dataset.i, a = b.dataset.a, L = inv.lines;
    if (a === 'del') { if (L.length === 1) L[0] = blankLine(); else L.splice(i, 1); }
    if (a === 'dup') L.splice(i + 1, 0, Object.assign(clone(L[i]), { id: uid() }));
    if (a === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
    if (a === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
    if (a === 'save') {
      if (!L[i].desc.trim()) return toast('اكتب بيان البند أولاً');
      const p = clone(L[i]); p.id = uid(); presets.push(p); write(K.preset, presets); renderPresets(); return toast('حُفظ في البنود الجاهزة');
    }
    renderLines(); persist(); redraw();
  });
  $('#btnAddLine').addEventListener('click', () => { inv.lines.push(blankLine()); renderLines(); persist(); redraw(); const t = $$('#lineList .li').pop(); t && $('textarea', t).focus(); });
  function renderPresets() {
    $('#presetSel').innerHTML = '<option value="">إضافة من البنود الجاهزة…</option>' + presets.map((p, i) => '<option value="' + i + '">' + esc(p.desc.split('\n')[0]) + '</option>').join('');
  }
  $('#presetSel').addEventListener('change', e => {
    const p = presets[+e.target.value]; e.target.value = ''; if (!p) return;
    inv.lines.push(Object.assign(clone(p), { id: uid() })); renderLines(); persist(); redraw();
  });

  /* ---------- الملاحظات ---------- */
  $('#notesTa').addEventListener('input', e => { inv.notes = e.target.value.split('\n'); persist(); redraw(); });

  /* ---------- التبويبات ---------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.setAttribute('aria-selected', x === t));
    $$('.pane').forEach(p => p.hidden = p.id !== 'pane-' + t.dataset.tab);
  }));

  /* ---------- التكبير ---------- */
  $('#zIn').addEventListener('click', () => { fitMode = false; zoom = Math.min(2, zoom + .1); fit(); });
  $('#zOut').addEventListener('click', () => { fitMode = false; zoom = Math.max(.3, zoom - .1); fit(); });
  $('#zFit').addEventListener('click', () => { fitMode = true; fit(); });
  window.addEventListener('resize', () => fit());

  /* ---------- عام ---------- */
  let toastT;
  function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2400); }

  function totalsOf(i) { return MK.calc.compute(i).totals; }

  function snapshotToHistory() {
    const snap = clone(inv); snap.savedAt = Date.now();
    const i = history.findIndex(h => h.id === inv.id);
    if (i >= 0) history[i] = snap; else history.unshift(snap);
    write(K.hist, history);
    if (inv.number === nextNumber()) { st.counter++; write(K.st, st); }
  }

  function newInvoice(from) {
    inv = from || blankInvoice();
    syncAll(); persist();
  }
  function syncAll() {
    refreshFields(); syncSegs(); renderLines(); $('#notesTa').value = (inv.notes || []).join('\n'); draw();
  }

  /* ---------- أزرار الشريط العلوي ---------- */
  $('#btnNew').addEventListener('click', () => {
    if (!confirm('بدء فاتورة جديدة؟ (المسودة الحالية تبقى في السجل إن كنت صدّرتها)')) return;
    newInvoice();
  });

  $('#btnPdf').addEventListener('click', () => {
    if (!inv.lines.some(l => l.desc.trim() && MK.calc.num(l.price))) return toast('أضف بنداً واحداً على الأقل بسعر');
    const warn = $$('#warns .warn.err');
    if (warn.length && !confirm('توجد ملاحظة مهمة:\n' + warn[0].textContent + '\nمتابعة التصدير؟')) return;
    snapshotToHistory();
    const old = document.title;
    document.title = 'فاتورة ' + inv.number + (inv.customer.name ? ' - ' + inv.customer.name : '');
    draw();
    setTimeout(() => { window.print(); document.title = old; }, 80);
    toast('اختر «حفظ كـ PDF» من نافذة الطباعة');
  });

  $('#btnTheme').addEventListener('click', () => {
    const r = document.documentElement, dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem(K.theme, r.dataset.theme); } catch (e) { }
  });
  try { const t = localStorage.getItem(K.theme); if (t) document.documentElement.dataset.theme = t; } catch (e) { }

  /* ---------- النوافذ ---------- */
  function openDialog(html, onMount) {
    const root = $('#dlgRoot'); root.innerHTML = '<dialog>' + html + '</dialog>';
    const d = $('dialog', root);
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
    d.addEventListener('close', () => { root.innerHTML = ''; });
    d.showModal(); onMount && onMount(d); return d;
  }

  /* السجل */
  $('#btnHist').addEventListener('click', () => {
    const body = () => history.length ? history.map((h, i) => {
      const t = totalsOf(h);
      return '<div class="hrow"><b>' + esc(h.number) + ' — ' + esc(h.customer.name || 'بدون عميل') + '</b>' +
        '<span>' + esc(h.date) + ' · ' + MK.calc.fmt(t.total) + ' ريال · ' + esc((MK.invoiceTypes[h.type] || [''])[0]) + '</span>' +
        '<div class="acts"><button class="btn sm" data-o="' + i + '">فتح</button><button class="btn sm" data-d="' + i + '">نسخة جديدة</button><button class="btn sm danger" data-x="' + i + '">حذف</button></div></div>';
    }).join('') : '<p class="note">لا توجد فواتير في السجل بعد. تُحفظ الفاتورة هنا عند تصدير PDF.</p>';
    const d = openDialog('<div class="dlg"><header><h3>سجل الفواتير</h3><button class="ib" data-close>✕</button></header><div class="body" id="hb">' + body() + '</div>' +
      '<footer><button class="btn sm" id="hExp">نسخة احتياطية (JSON)</button><label class="btn sm" for="hImp">استيراد نسخة</label><input type="file" id="hImp" accept=".json" hidden></footer></div>', d => {
      d.addEventListener('click', e => {
        const b = e.target.closest('[data-o],[data-d],[data-x]'); if (!b) return;
        if (b.dataset.o != null) { newInvoice(clone(history[+b.dataset.o])); d.close(); }
        if (b.dataset.d != null) { const c = clone(history[+b.dataset.d]); c.id = uid(); c.number = nextNumber(); c.date = todayStr(); c.time = nowTime(); newInvoice(c); d.close(); }
        if (b.dataset.x != null && confirm('حذف هذه الفاتورة من السجل؟')) { history.splice(+b.dataset.x, 1); write(K.hist, history); $('#hb', d).innerHTML = body(); }
      });
      $('#hExp', d).onclick = () => {
        const data = JSON.stringify({ app: 'mk-invoices', v: 1, settings: st, customers, history, presets, draft: inv }, null, 1);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
        a.download = 'mknon-invoices-backup-' + todayStr() + '.json'; a.click();
      };
      $('#hImp', d).onchange = e => {
        const f = e.target.files[0]; if (!f) return;
        f.text().then(t => {
          const j = JSON.parse(t); if (j.app !== 'mk-invoices') throw 0;
          if (!confirm('سيُستبدل ما في هذا المتصفح بمحتوى النسخة. متابعة؟')) return;
          write(K.st, j.settings); write(K.cust, j.customers || []); write(K.hist, j.history || []); write(K.preset, j.presets || []); write(K.draft, j.draft);
          location.reload();
        }).catch(() => toast('ملف غير صالح'));
      };
    });
  });

  /* بيانات الشركة */
  function imgToDataUrl(file, max, cb) {
    const fr = new FileReader();
    fr.onload = () => {
      const im = new Image();
      im.onload = () => {
        const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/png'));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  $('#btnSet').addEventListener('click', () => {
    const fld = (l, k, ex) => '<label class="fld"><span>' + l + '</span><input type="text" data-k="st:' + k + '" ' + (ex || '') + '></label>';
    const d = openDialog('<div class="dlg"><header><h3>بيانات الشركة والمستند</h3><button class="ib" data-close>✕</button></header><div class="body">' +
      '<h4>بيانات المورّد (من السجل التجاري وشهادة الضريبة)</h4>' +
      fld('اسم الشركة', 'seller.name') + '<div class="row2">' + fld('الرقم الضريبي', 'seller.vat', 'dir="ltr" maxlength="15"') + fld('السجل التجاري', 'seller.cr', 'dir="ltr"') + '</div>' +
      fld('العنوان', 'seller.address') + '<div class="row2">' + fld('الجوال', 'seller.phone', 'dir="ltr"') + fld('البريد', 'seller.email', 'dir="ltr"') + '</div>' +
      '<h4>الترقيم</h4><div class="row2">' + fld('بادئة الرقم', 'prefix', 'dir="ltr"') + '<label class="fld"><span>الرقم التالي</span><input type="number" min="1" data-k="st:counter"></label></div>' +
      '<h4>النصوص</h4>' + fld('الشعار اللفظي في اللوحة الداكنة', 'slogan') + fld('نص التذييل', 'footerText') + '<div class="row2">' + fld('صفة الموقّع', 'signerTitle') + fld('اسم الموقّع (اختياري)', 'signerName') + '</div>' +
      '<h4>الختم والتوقيع</h4>' +
      '<div class="imgbox"><img id="pvStamp" alt=""><i>الختم</i><label class="btn sm" for="upStamp">رفع</label><button class="btn sm danger" id="rmStamp">إزالة</button><input type="file" id="upStamp" accept="image/*" hidden></div>' +
      '<div class="imgbox"><img id="pvSig" alt=""><i>التوقيع (صورة بخلفية شفافة يُفضَّل)</i><label class="btn sm" for="upSig">رفع</label><button class="btn sm danger" id="rmSig">إزالة</button><input type="file" id="upSig" accept="image/*" hidden></div>' +
      '<h4>بيانات الدفع (تظهر عند تفعيلها داخل الفاتورة)</h4>' + fld('البنك', 'bank.bank') + fld('اسم الحساب', 'bank.holder') + fld('الآيبان', 'bank.iban', 'dir="ltr"') +
      '<h4>الملاحظات الافتراضية للفواتير الجديدة</h4><textarea rows="4" id="defNotes"></textarea>' +
      '</div><footer><button class="btn sm danger" id="resetAll">مسح كل بيانات المنصة</button><button class="btn primary" data-close>تم</button></footer></div>', d => {
      bindFields(d);
      const pv = () => { $('#pvStamp', d).src = st.stamp || ''; $('#pvSig', d).src = st.signature || ''; $('#pvStamp', d).hidden = !st.stamp; $('#pvSig', d).hidden = !st.signature; };
      pv();
      const dn = $('#defNotes', d); dn.value = st.notes.join('\n');
      dn.oninput = () => { st.notes = dn.value.split('\n'); write(K.st, st); };
      $('#upStamp', d).onchange = e => e.target.files[0] && imgToDataUrl(e.target.files[0], 500, u => { st.stamp = u; persistSettings(); pv(); redraw(); });
      $('#upSig', d).onchange = e => e.target.files[0] && imgToDataUrl(e.target.files[0], 600, u => { st.signature = u; persistSettings(); pv(); redraw(); });
      $('#rmStamp', d).onclick = () => { st.stamp = ''; persistSettings(); pv(); redraw(); };
      $('#rmSig', d).onclick = () => { st.signature = ''; persistSettings(); pv(); redraw(); };
      $('#resetAll', d).onclick = () => { if (confirm('سيُمسح كل ما في هذا المتصفح (السجل، العملاء، الإعدادات). متابعة؟')) { Object.values(K).forEach(k => { try { localStorage.removeItem(k); } catch (e) { } }); location.reload(); } };
    });
  });

  /* فحص QR */
  $('#btnQr').addEventListener('click', () => {
    const { totals } = MK.calc.compute(inv);
    const b64 = MK.qrPayload(inv, st, totals), t = MK.zatca.decode(b64);
    openDialog('<div class="dlg"><header><h3>محتوى رمز QR</h3><button class="ib" data-close>✕</button></header><div class="body">' +
      '<p class="note">الرمز بصيغة TLV/Base64 المعتمدة من هيئة الزكاة والضريبة والجمارك (المرحلة الأولى). امسحه بتطبيق «فاتورة» أو أي قارئ QR وستظهر هذه الحقول:</p>' +
      '<dl class="kv"><dt>اسم البائع</dt><dd style="direction:rtl">' + esc(t[1]) + '</dd><dt>الرقم الضريبي</dt><dd>' + esc(t[2]) + '</dd><dt>التاريخ والوقت</dt><dd>' + esc(t[3]) + '</dd><dt>الإجمالي شامل الضريبة</dt><dd>' + esc(t[4]) + '</dd><dt>مبلغ الضريبة</dt><dd>' + esc(t[5]) + '</dd></dl>' +
      '<h4>النص المشفّر</h4><dl class="kv"><dd style="grid-column:1/-1">' + esc(b64) + '</dd></dl></div><footer><button class="btn primary" data-close>إغلاق</button></footer></div>');
  });

  /* ---------- الإقلاع ---------- */
  bindFields($('.side'));
  renderCustList(); renderPresets();
  syncAll();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  window.addEventListener('beforeprint', () => { clearTimeout(drawT); draw(); });
})(window.MK = window.MK || {});
