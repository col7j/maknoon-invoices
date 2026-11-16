/* تفقيط المبالغ بالعربية: ريال سعودي وهللة */
(function (MK) {
  'use strict';
  const UNITS = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
    'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const HUNDREDS = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  /* 1..999 */
  function upTo999(n) {
    const parts = [];
    const h = Math.floor(n / 100), r = n % 100;
    if (h) parts.push(HUNDREDS[h]);
    if (r) {
      if (r < 20) parts.push(UNITS[r]);
      else {
        const t = Math.floor(r / 10), u = r % 10;
        parts.push(u ? UNITS[u] + ' و' + TENS[t] : TENS[t]);
      }
    }
    return parts.join(' و');
  }

  /* مجموعة (آلاف / ملايين / مليارات) */
  function scaled(n, one, two, few, many) {
    if (n === 0) return '';
    if (n === 1) return one;
    if (n === 2) return two;
    const r = n % 100;
    if (r >= 3 && r <= 10) return upTo999(n) + ' ' + few;
    const w = upTo999(n);
    if (n % 100 === 0 && n >= 200) return w.replace('ائتان', 'ائة').replace('مائتان', 'مائتا') + ' ' + one; // مائتا ألف
    return w + ' ' + many;
  }

  function integerWords(n) {
    if (n === 0) return 'صفر';
    const billions = Math.floor(n / 1e9);
    const millions = Math.floor((n % 1e9) / 1e6);
    const thousands = Math.floor((n % 1e6) / 1e3);
    const rest = n % 1000;
    const out = [];
    if (billions) out.push(scaled(billions, 'مليار', 'ملياران', 'مليارات', 'ملياراً'));
    if (millions) out.push(scaled(millions, 'مليون', 'مليونان', 'ملايين', 'مليوناً'));
    if (thousands) out.push(scaled(thousands, 'ألف', 'ألفان', 'آلاف', 'ألفاً'));
    if (rest) out.push(upTo999(rest));
    return out.join(' و');
  }

  function counted(n, forms) { // forms: [singular-one, dual, few(3-10), many(11+/100s)]
    const r = n % 100;
    if (n === 1) return forms[0];
    if (n === 2) return forms[1];
    if (r >= 3 && r <= 10) return integerWords(n) + ' ' + forms[2];
    if (r === 1 || r === 2) return integerWords(n - r) + ' و' + (r === 1 ? forms[0] : forms[1]);
    if (r === 0) { // المضاف: «عشرون ألف ريال» و«ألفا ريال»
      const w = integerWords(n)
        .replace(/ألفاً$/, 'ألف').replace(/ألفان$/, 'ألفا')
        .replace(/مليوناً$/, 'مليون').replace(/مليونان$/, 'مليونا')
        .replace(/ملياراً$/, 'مليار').replace(/ملياران$/, 'مليارا');
      return w + ' ' + forms[4];
    }
    return integerWords(n) + ' ' + forms[3];
  }

  /* المبلغ بالهللات (عدد صحيح) -> نص */
  function tafqeet(halalas) {
    halalas = Math.max(0, Math.round(halalas));
    const riyals = Math.floor(halalas / 100), cents = halalas % 100;
    const SAR = ['ريال سعودي واحد', 'ريالان سعوديان', 'ريالات سعودية', 'ريالاً سعودياً', 'ريال سعودي'];
    const HAL = ['هللة واحدة', 'هللتان', 'هللات', 'هللة', 'هللة'];
    let s;
    if (riyals === 0 && cents > 0) s = counted(cents, HAL);
    else if (riyals === 0) s = 'صفر ريال سعودي';
    else {
      s = counted(riyals, SAR);
      if (cents) s += ' و' + counted(cents, HAL);
    }
    return s + ' فقط لا غير';
  }

  MK.words = { tafqeet, integerWords };
})(window.MK = window.MK || {});
