(() => {
  'use strict';

  const services = {
    all: 'كل الخدمات', flight: 'الطيران', hotel: 'الفنادق',
    package: 'الباقات السياحية', transfer: 'النقل', tour: 'الجولات السياحية',
  };
  const routeCities = { BGW: 'بغداد', NJF: 'النجف', BSR: 'البصرة', EBL: 'أربيل', MHD: 'مشهد', IKA: 'طهران', SYZ: 'شيراز', IFN: 'أصفهان', RAS: 'رامسر' };
  const cabins = { economy: 'اقتصادية', business: 'الأعمال' };
  const flightScopeKeys = ['routeFrom', 'routeTo', 'carrier', 'cabin'];
  const currencies = new Set(['IQD', 'USD']);
  const kinds = new Set(['markup', 'discount']);
  const modes = new Set(['percent', 'fixed']);
  const list = value => Array.isArray(value) ? value : [];
  const hasService = value => Object.prototype.hasOwnProperty.call(services, value);
  const text = value => typeof value === 'string' ? value.trim() : '';

  function normalizeFlightScope(source = {}) {
    return {
      routeFrom: text(source.routeFrom).toUpperCase(), routeTo: text(source.routeTo).toUpperCase(),
      carrier: text(source.carrier).toUpperCase(), cabin: text(source.cabin).toLowerCase(),
    };
  }

  function flightScopeError(source) {
    if (flightScopeKeys.some(key => source[key] != null && typeof source[key] !== 'string')) return 'نطاق المسار وشركة الطيران والمقصورة يجب أن يكون نصًا صالحًا.';
    const scope = normalizeFlightScope(source);
    if (source.service !== 'flight' && flightScopeKeys.some(key => scope[key])) return 'نطاق المسار وشركة الطيران والمقصورة متاح لخدمة الطيران فقط.';
    if ([scope.routeFrom, scope.routeTo].some(code => code && !Object.hasOwn(routeCities, code))) return 'اختر رمز مدينة صالحًا من قائمة مسارات الطيران.';
    if (scope.routeFrom && scope.routeFrom === scope.routeTo) return 'اختر مدينتين مختلفتين لمسار الطيران.';
    if (scope.carrier && !/^[A-Z0-9]{1,12}$/.test(scope.carrier)) return 'رمز شركة الطيران يجب أن يتكون من أحرف إنجليزية وأرقام فقط، حتى 12 خانة.';
    if (scope.cabin && !Object.hasOwn(cabins, scope.cabin)) return 'اختر المقصورة الاقتصادية أو الأعمال، أو اتركها لجميع المقصورات.';
    return '';
  }

  function rank(rule) {
    const base = rule.providerId !== 'all' ? 2 : rule.service !== 'all' ? 1 : 0;
    const scope = normalizeFlightScope(rule);
    return base * (flightScopeKeys.length + 1) + flightScopeKeys.filter(key => scope[key]).length;
  }

  function scopesIntersect(left, right) {
    const a = normalizeFlightScope(left), b = normalizeFlightScope(right);
    return flightScopeKeys.every(key => !a[key] || !b[key] || a[key] === b[key]);
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad', calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function dateRangeValid(rule) {
    const start = rule.startDate ?? '';
    const end = rule.endDate ?? '';
    return (start === '' || validDate(start)) && (end === '' || validDate(end)) && (!start || !end || start <= end);
  }

  function status(rule, date = today()) {
    if (!rule || rule.enabled !== true || !validDate(date) || !dateRangeValid(rule)) return 'disabled';
    if (rule.startDate && date < rule.startDate) return 'scheduled';
    if (rule.endDate && date > rule.endDate) return 'expired';
    return 'active';
  }

  function shapeError(rule, providers) {
    if (!rule || typeof rule !== 'object') return 'بيانات قاعدة التسعير غير صالحة.';
    if (!text(rule.name)) return 'اكتب اسمًا لقاعدة التسعير.';
    if (!kinds.has(rule.kind)) return 'اختر زيادة على التكلفة أو خصمًا.';
    if (!hasService(rule.service)) return 'اختر خدمة صالحة لقاعدة التسعير.';
    const scopeError = flightScopeError(rule);
    if (scopeError) return scopeError;
    if (!currencies.has(rule.currency)) return 'اختر الدينار العراقي أو الدولار الأمريكي.';
    if (!modes.has(rule.mode)) return 'اختر نسبة مئوية أو مبلغًا ثابتًا.';
    if (typeof rule.enabled !== 'boolean') return 'حدّد ما إذا كانت القاعدة مفعّلة.';
    if (typeof rule.value !== 'number' || !Number.isFinite(rule.value) || rule.value <= 0) return 'أدخل قيمة رقمية أكبر من صفر.';
    if (rule.mode === 'percent' && rule.kind === 'discount' && rule.value > 100) return 'نسبة الخصم يجب ألا تتجاوز 100%.';
    if (rule.mode === 'percent' && rule.kind === 'markup' && rule.value > 1000) return 'نسبة الزيادة يجب ألا تتجاوز 1,000%.';
    if (!dateRangeValid(rule)) return 'استخدم تواريخ صحيحة، على أن يكون تاريخ الانتهاء مساويًا لتاريخ البداية أو بعده.';
    if (!text(rule.providerId)) return 'اختر جميع المزوّدين أو مزوّدًا محددًا.';
    if (rule.providerId !== 'all') {
      if (rule.service === 'all') return 'اختر خدمة محددة قبل تحديد المزوّد.';
      const provider = list(providers).find(item => item && item.id === rule.providerId);
      if (!provider || provider.status !== 'published' || provider.operatingEnabled === false) return 'اختر مزوّد خدمة منشورًا ومفعّلًا في محاكاة التشغيل.';
      if (provider.serviceType !== rule.service) return 'نوع خدمة المزوّد لا يطابق الخدمة المختارة.';
    }
    return '';
  }

  function validate(rule, rules = [], providers = []) {
    const error = shapeError(rule, providers);
    if (error) return error;
    if (!rule.enabled) return '';
    const start = rule.startDate || '0001-01-01';
    const end = rule.endDate || '9999-12-31';
    const overlap = list(rules).find(other => {
      if (!other || other === rule || (text(rule.id) && other.id === rule.id)) return false;
      if (other.enabled !== true || shapeError(other, providers)) return false;
      if (other.kind !== rule.kind || other.service !== rule.service || other.providerId !== rule.providerId || other.currency !== rule.currency) return false;
      // A generic fallback and a more specific rule coexist. Equal-priority
      // intersecting scopes would have no unique winner and must not be saved.
      if (rank(other) !== rank(rule) || !scopesIntersect(rule, other)) return false;
      return start <= (other.endDate || '9999-12-31') && (other.startDate || '0001-01-01') <= end;
    });
    return overlap ? `تتداخل هذه القاعدة مع «${text(overlap.name) || 'قاعدة أخرى'}» بالأولوية نفسها في نطاق متقاطع وعملة وفترة متطابقتين. عدّل النطاق أو التواريخ أو عطّل إحدى القاعدتين.` : '';
  }

  function contextDate(ctx) {
    return ctx?.date == null || ctx.date === '' ? today() : ctx.date;
  }

  function selectRule(rules, kind, ctx, providers = []) {
    if (!ctx || !kinds.has(kind) || !hasService(ctx.service) || !currencies.has(ctx.currency)) return null;
    if (flightScopeError(ctx)) return null;
    const date = contextDate(ctx);
    if (!validDate(date)) return null;
    const providerId = ctx.providerId || 'all';
    const scope = normalizeFlightScope(ctx);
    let selected = null;
    let specificity = -1;
    for (const rule of list(rules)) {
      if (!rule || rule.kind !== kind || rule.currency !== ctx.currency || status(rule, date) !== 'active') continue;
      if (shapeError(rule, providers)) continue;
      if (rule.service !== 'all' && rule.service !== ctx.service) continue;
      if (rule.providerId !== 'all' && rule.providerId !== providerId) continue;
      const ruleScope = normalizeFlightScope(rule);
      if (flightScopeKeys.some(key => ruleScope[key] && ruleScope[key] !== scope[key])) continue;
      const priority = rank(rule);
      // Equal-rank intersecting rules cannot be saved; retain the first record
      // deterministically if an imported list contains an unresolved conflict.
      if (priority > specificity) {
        selected = rule;
        specificity = priority;
      }
    }
    return selected;
  }

  function shiftDecimal(value, places) {
    const [coefficient, exponent = '0'] = value.toString().split('e');
    return Number(`${coefficient}e${Number(exponent) + places}`);
  }

  function roundMoney(value, currency) {
    if (!Number.isFinite(value)) throw new RangeError('قيمة السعر خارج النطاق الرقمي المتاح.');
    const digits = currency === 'IQD' ? 0 : 2;
    const sign = value < 0 ? -1 : 1;
    const rounded = sign * shiftDecimal(Math.round(shiftDecimal(Math.abs(value), digits)), -digits);
    if (!Number.isFinite(rounded)) throw new RangeError('قيمة السعر خارج النطاق الرقمي المتاح.');
    return rounded === 0 ? 0 : rounded;
  }

  function decimalRatio(value) {
    const [coefficient, exponent = '0'] = value.toString().split('e');
    const places = (coefficient.split('.')[1] || '').length - Number(exponent);
    const integer = BigInt(coefficient.replace('.', ''));
    return places >= 0
      ? { numerator: integer, denominator: 10n ** BigInt(places) }
      : { numerator: integer * 10n ** BigInt(-places), denominator: 1n };
  }

  function percentageMoney(base, percent, currency) {
    // Work from decimal input values so 1.15 × 10% rounds from exactly 0.115.
    const amount = decimalRatio(base);
    const rate = decimalRatio(percent);
    const digits = currency === 'IQD' ? 0 : 2;
    const numerator = amount.numerator * rate.numerator * (10n ** BigInt(digits));
    const denominator = amount.denominator * rate.denominator * 100n;
    const units = (2n * numerator + denominator) / (2n * denominator);
    const rounded = Number(`${units}e-${digits}`);
    if (!Number.isFinite(rounded)) throw new RangeError('قيمة السعر خارج النطاق الرقمي المتاح.');
    return rounded;
  }

  function calculate(rules, ctx, providers = []) {
    if (!ctx || typeof ctx.cost !== 'number' || !Number.isFinite(ctx.cost) || ctx.cost < 0) {
      throw new RangeError('أدخل تكلفة مزوّد رقمية تساوي صفرًا أو أكبر.');
    }
    if (!hasService(ctx.service)) throw new RangeError('اختر خدمة صالحة لمعاينة السعر.');
    const scopeError = flightScopeError(ctx);
    if (scopeError) throw new RangeError(scopeError);
    if (!currencies.has(ctx.currency)) throw new RangeError('اختر عملة صالحة لمعاينة السعر.');
    if (!validDate(contextDate(ctx))) throw new RangeError('اختر تاريخًا صحيحًا لمعاينة السعر.');
    const cost = roundMoney(ctx.cost, ctx.currency);
    const markupRule = selectRule(rules, 'markup', ctx, providers);
    const markupAmount = markupRule?.mode === 'percent'
      ? percentageMoney(cost, markupRule.value, ctx.currency)
      : roundMoney(markupRule?.value || 0, ctx.currency);
    const original = roundMoney(cost + markupAmount, ctx.currency);
    const discountRule = selectRule(rules, 'discount', ctx, providers);
    const requestedDiscount = discountRule?.mode === 'percent'
      ? percentageMoney(original, discountRule.value, ctx.currency)
      : roundMoney(discountRule?.value || 0, ctx.currency);
    const discountExceeded = requestedDiscount > original;
    const discountAmount = Math.min(requestedDiscount, original);
    const final = roundMoney(original - discountAmount, ctx.currency);
    const net = roundMoney(final - cost, ctx.currency);
    return { cost, markupAmount, original, discountAmount, final, net, markupRule, discountRule, belowCost: final < cost, discountExceeded };
  }

  const seed = [
    {
      id: 'pricing-default-iqd-markup', kind: 'markup', name: 'زيادة YAR الافتراضية',
      service: 'all', providerId: 'all', currency: 'IQD', mode: 'percent', value: 10,
      startDate: '', endDate: '', enabled: true,
    },
    {
      id: 'pricing-demo-iqd-discount', kind: 'discount', name: 'خصم تجريبي 20%',
      service: 'all', providerId: 'all', currency: 'IQD', mode: 'percent', value: 20,
      startDate: '', endDate: '', enabled: false,
    },
  ];
  const engine = { services, routeCities, cabins, normalizeFlightScope, today, status, selectRule, validate, calculate, seed };
  globalThis.YARPricingEngine = engine;
  if (typeof window !== 'undefined') window.YARPricingEngine = engine;
})();
