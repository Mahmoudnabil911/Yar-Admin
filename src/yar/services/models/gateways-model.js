(() => {
  'use strict';

  const methods = { card: 'بطاقة مصرفية', wallet: 'محفظة إلكترونية', bank: 'تحويل مصرفي' };
  const currencies = { IQD: 'دينار عراقي', USD: 'دولار أمريكي' };
  const environments = { sandbox: 'اختبار', production: 'إنتاج · محاكاة' };
  const connectionStates = { unknown: 'لم يُختبر', healthy: 'نجح الاختبار التجريبي', slow: 'استجابة بطيئة · تجريبية', failed: 'تعذّر الاختبار التجريبي' };
  const transactionStatuses = { succeeded: 'ناجحة', failed: 'فاشلة', pending: 'معلّقة', cancelled: 'ملغاة' };
  const transactionKinds = { payment: 'دفع', refund: 'استرداد' };
  const outcomes = { success: 'healthy', slow: 'slow', failure: 'failed', timeout: 'failed' };
  const clone = value => JSON.parse(JSON.stringify(value));
  const array = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const normalizedName = value => text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  const fail = message => { throw new Error(message); };
  const number = (value, fallback = NaN) => value === undefined ? fallback : typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  const scaleFor = currency => currency === 'USD' ? 2 : currency === 'IQD' ? 0 : fail('اختر عملة صحيحة.');

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function shiftDate(value, days) {
    if (!validDate(value) || !Number.isInteger(days)) fail('التاريخ التجريبي غير صالح.');
    const date = new Date(value + 'T00:00:00Z');
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function timestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validDate(value.slice(0, 10)) || !Number.isFinite(Date.parse(value))) fail('توقيت الحركة غير صالح.');
    return new Date(value).toISOString();
  }

  function baghdadDate(value) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function scaled(value, digits, allowNegative = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || (!allowNegative && value < 0)) fail('المبلغ غير صالح.');
    const raw = String(value), match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(raw);
    if (!match) fail('المبلغ خارج الدقة المتاحة.');
    const fraction = match[3] || '';
    if (fraction.slice(digits).replace(/0/g, '')) fail(digits ? 'الدولار يقبل منزلتين عشريتين كحد أقصى.' : 'الدينار العراقي يُسجّل برقم صحيح.');
    const units = (BigInt(match[2]) * 10n ** BigInt(digits) + BigInt(fraction.slice(0, digits).padEnd(digits, '0') || '0')) * (match[1] ? -1n : 1n);
    if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < -BigInt(Number.MAX_SAFE_INTEGER)) fail('المبلغ أكبر من النطاق المسموح.');
    return units;
  }
  const moneyUnits = (value, currency, allowNegative = false) => scaled(value, scaleFor(currency), allowNegative);
  function fromUnits(value, currency) {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) fail('إجمالي المبالغ أكبر من النطاق المسموح.');
    return Number(value) / 10 ** scaleFor(currency);
  }
  const rate = (part, total) => total > 0 ? part / total * 100 : null;

  const seed = [
    { id: 'gateway-card', name: 'بوابة البطاقات · مثال', enabled: true, priority: 1, environment: 'sandbox', methods: ['card'], currencies: ['IQD', 'USD'], fees: { IQD: { percent: 2.5, fixed: 500 }, USD: { percent: 2.5, fixed: 0.25 } }, supportsRefunds: true, connectionState: 'healthy', lastCheckedAt: '2026-11-07T06:00:00.000Z' },
    { id: 'gateway-wallet', name: 'بوابة المحفظة · مثال', enabled: true, priority: 2, environment: 'sandbox', methods: ['wallet'], currencies: ['IQD'], fees: { IQD: { percent: 1, fixed: 250 }, USD: { percent: 0, fixed: 0 } }, supportsRefunds: true, connectionState: 'healthy', lastCheckedAt: '2026-11-07T06:05:00.000Z' },
    { id: 'gateway-bank', name: 'بوابة التحويل · مثال', enabled: false, priority: 3, environment: 'sandbox', methods: ['bank'], currencies: ['USD'], fees: { IQD: { percent: 0, fixed: 0 }, USD: { percent: 0, fixed: 0 } }, supportsRefunds: false, connectionState: 'unknown', lastCheckedAt: '' }
  ];

  function normalize(input) {
    const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
      id: text(value.id), name: text(value.name).replace(/\s+/g, ' '),
      enabled: typeof value.enabled === 'boolean' ? value.enabled : null,
      priority: number(value.priority), environment: text(value.environment),
      methods: [...new Set(array(value.methods).map(text))], currencies: [...new Set(array(value.currencies).map(text))],
      fees: Object.fromEntries(Object.keys(currencies).map(currency => [currency, { percent: number(value.fees?.[currency]?.percent, 0), fixed: number(value.fees?.[currency]?.fixed, 0) }])),
      supportsRefunds: typeof value.supportsRefunds === 'boolean' ? value.supportsRefunds : null,
      connectionState: text(value.connectionState) || 'unknown', lastCheckedAt: text(value.lastCheckedAt)
    };
  }

  function validate(input, records = []) {
    const value = normalize(input);
    if (!/^[a-zA-Z0-9_-]{1,90}$/.test(value.id)) return 'معرّف البوابة غير صالح.';
    if (value.name.length < 2 || value.name.length > 80) return 'اكتب اسمًا للبوابة من حرفين إلى 80 حرفًا.';
    if (typeof value.enabled !== 'boolean' || typeof value.supportsRefunds !== 'boolean') return 'راجع حالة البوابة ودعم الاسترداد.';
    if (!Number.isInteger(value.priority) || value.priority < 1 || value.priority > 99) return 'ترتيب الظهور يجب أن يكون رقمًا صحيحًا من 1 إلى 99.';
    if (!own(environments, value.environment)) return 'اختر بيئة الاختبار أو الإنتاج.';
    if (!value.methods.length || value.methods.some(method => !own(methods, method))) return 'حدّد طريقة دفع صحيحة واحدة على الأقل.';
    if (!value.currencies.length || value.currencies.some(currency => !own(currencies, currency))) return 'حدّد عملة صحيحة واحدة على الأقل.';
    if (!own(connectionStates, value.connectionState)) return 'حالة اختبار الاتصال غير صالحة.';
    if (value.lastCheckedAt) { try { timestamp(value.lastCheckedAt); } catch { return 'تاريخ اختبار الاتصال غير صالح.'; } }
    if (value.connectionState !== 'unknown' && !value.lastCheckedAt) return 'حالة الاختبار تحتاج تاريخًا محفوظًا.';
    for (const currency of Object.keys(currencies)) {
      const fee = value.fees[currency];
      try {
        if (!Number.isFinite(fee.percent) || fee.percent < 0 || fee.percent > 100) return 'نسبة رسوم البوابة يجب أن تكون من 0 إلى 100%.';
        scaled(fee.percent, 2); moneyUnits(fee.fixed, currency);
      } catch { return 'راجع دقة رسوم البوابة: نسبة بمنزلتين، مبلغ ثابت صحيح للدينار ومنزلتان للدولار.'; }
    }
    if (array(records).some(row => row.id !== value.id && normalizedName(row.name) === normalizedName(value.name))) return 'يوجد اسم بوابة مطابق. استخدم اسمًا مميزًا.';
    return '';
  }

  function sanitizeRecords(records) {
    if (!Array.isArray(records)) fail('قائمة البوابات غير صالحة.');
    const result = records.map(normalize), ids = new Set();
    for (const record of result) {
      if (ids.has(record.id)) fail('تتكرر معرّفات البوابات في البيانات المحفوظة.');
      ids.add(record.id);
      const error = validate(record, result); if (error) fail(error);
    }
    return clone(result);
  }

  function upsert(records, input) {
    const rows = sanitizeRecords(records), candidate = normalize(input);
    const existing = rows.find(row => row.id === candidate.id);
    // Connection outcomes are produced only by the dedicated local simulation action.
    const sameEnvironment = existing?.environment === candidate.environment;
    candidate.connectionState = sameEnvironment ? existing.connectionState : 'unknown';
    candidate.lastCheckedAt = sameEnvironment ? existing.lastCheckedAt : '';
    const error = validate(candidate, rows); if (error) fail(error);
    const index = rows.findIndex(row => row.id === candidate.id);
    index < 0 ? rows.push(candidate) : rows.splice(index, 1, candidate);
    return clone(rows);
  }

  function setEnabled(records, id, enabled) {
    if (typeof enabled !== 'boolean') fail('اختر حالة تفعيل صحيحة.');
    const rows = sanitizeRecords(records), record = rows.find(row => row.id === id);
    if (!record) fail('البوابة غير موجودة.');
    return upsert(rows, { ...record, enabled });
  }

  let serial = 0;
  function connectionTest(records, id, outcome, at = new Date().toISOString()) {
    const rows = sanitizeRecords(records), record = rows.find(row => row.id === id);
    if (!record || !own(outcomes, outcome)) fail('اختر بوابة وسيناريو اختبار صالحين.');
    at = timestamp(at);
    record.connectionState = outcomes[outcome]; record.lastCheckedAt = at;
    const log = { id: `gateway-test-${id}-${Date.parse(at).toString(36)}-${++serial}`, gatewayId: id, outcome, environment: record.environment, at, detail: outcome === 'success' ? 'نجحت محاكاة الاتصال محليًا، دون استدعاء بوابة حقيقية.' : outcome === 'slow' ? 'محاكاة استجابة بطيئة؛ لم يُرسل أي طلب شبكة.' : outcome === 'timeout' ? 'انتهت مهلة الاتصال التجريبية؛ لم يُرسل أي طلب شبكة.' : 'فشلت المحاكاة المختارة؛ لا يعكس ذلك حالة مزوّد حقيقي.' };
    return { gateways: clone(rows), log };
  }

  function payload(gateways, logs = []) {
    const rows = sanitizeRecords(gateways);
    if (!Array.isArray(logs)) fail('سجل اختبارات البوابات غير صالح.');
    const ids = new Set();
    const cleanLogs = logs.map(log => {
      const id = text(log?.id), gatewayId = text(log?.gatewayId);
      if (!log || !id || id.length > 180 || ids.has(id) || !rows.some(row => row.id === gatewayId) || !own(outcomes, log.outcome) || !own(environments, log.environment)) fail('أحد اختبارات البوابات المحفوظة غير صالح.');
      ids.add(id);
      return { id, gatewayId, outcome: log.outcome, environment: log.environment, at: timestamp(log.at), detail: text(log.detail).slice(0, 500) };
    });
    return { version: 1, gateways: rows, logs: cleanLogs.slice(-300) };
  }

  function restore(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.gateways) || !Array.isArray(input.logs)) fail('نسخة إعدادات البوابات غير صالحة أو غير مدعومة.');
    return payload(input.gateways, input.logs);
  }

  function quote(input, context = {}) {
    const gateway = normalize(input), error = validate(gateway);
    if (error) fail(error);
    const { method, currency } = context;
    if (!gateway.methods.includes(method) || !gateway.currencies.includes(currency)) fail('هذه البوابة لا تدعم الطريقة والعملة المختارتين.');
    const units = moneyUnits(number(context.amount), currency); if (units <= 0n) fail('اكتب مبلغًا أكبر من صفر.');
    const fee = gateway.fees[currency], basisPoints = scaled(fee.percent, 2);
    const feeUnits = (units * basisPoints + 5000n) / 10000n + moneyUnits(fee.fixed, currency);
    if (feeUnits > units) fail('الرسوم التقديرية تتجاوز قيمة العملية. راجع المبلغ أو إعدادات الرسوم.');
    return { gatewayId: gateway.id, method, currency, amount: fromUnits(units, currency), fee: fromUnits(feeUnits, currency), net: fromUnits(units - feeUnits, currency) };
  }

  function eligible(records, context = {}) {
    if (!own(methods, context.method) || !own(currencies, context.currency)) fail('اختر طريقة دفع وعملة صحيحتين.');
    return sanitizeRecords(records).filter(row => row.enabled && ['healthy', 'slow'].includes(row.connectionState) && row.methods.includes(context.method) && row.currencies.includes(context.currency) && (!context.environment || row.environment === context.environment)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  function validateTransactions(input) {
    if (!Array.isArray(input)) fail('سجل عمليات البوابات غير صالح.');
    const ids = new Set(), references = new Set();
    const rows = input.map(source => {
      const id = text(source?.id);
      if (!source || !id || id.length > 300 || ids.has(id)) fail('معرّف عملية البوابة مفقود أو متكرر.');
      ids.add(id);
      const row = { id, reference: text(source.reference), bookingId: text(source.bookingId), gatewayId: text(source.gatewayId), gatewayName: text(source.gatewayName), environment: source.environment, method: source.method, currency: source.currency, kind: source.kind, status: source.status, amount: source.amount, fee: source.fee, net: source.net, date: text(source.date), at: timestamp(source.at), parentId: text(source.parentId), failureReason: text(source.failureReason).slice(0, 500), source: source.source };
      if (!row.reference || row.reference.length > 300 || !row.bookingId || row.bookingId.length > 180 || !/^[A-Za-z0-9_-]{1,90}$/.test(row.gatewayId) || !row.gatewayName || row.gatewayName.length > 80 || !own(environments, row.environment) || !own(methods, row.method) || !own(currencies, row.currency) || !own(transactionKinds, row.kind) || !own(transactionStatuses, row.status) || row.source !== 'simulation') fail('تفاصيل عملية البوابة غير صالحة.');
      if (!validDate(row.date) || baghdadDate(row.at) !== row.date) fail('تاريخ عملية البوابة لا يطابق توقيتها في بغداد.');
      const referenceKey = row.gatewayId + ':' + row.reference;
      if (references.has(referenceKey)) fail('مرجع البوابة متكرر داخل البوابة نفسها.'); references.add(referenceKey);
      const gross = moneyUnits(row.amount, row.currency), fee = moneyUnits(row.fee, row.currency), net = moneyUnits(row.net, row.currency, true);
      if (gross <= 0n || fee > gross || row.status === 'failed' && !row.failureReason) fail('راجع مبلغ العملية أو سبب الفشل.');
      if (row.kind === 'payment') {
        if (row.parentId || net !== (row.status === 'succeeded' ? gross - fee : 0n) || row.status !== 'succeeded' && fee !== 0n) fail('لقطة رسوم الدفع أو صافي العملية غير متسقة.');
      } else if (!row.parentId || fee !== 0n || net !== (row.status === 'succeeded' ? -gross : 0n)) fail('لقطة الاسترداد غير متسقة.');
      return row;
    });
    const map = new Map(rows.map(row => [row.id, row])), reserved = new Map();
    for (const row of rows.filter(row => row.kind === 'refund')) {
      const parent = map.get(row.parentId);
      if (!parent || parent.kind !== 'payment' || parent.status !== 'succeeded' || ['bookingId', 'gatewayId', 'currency', 'method', 'environment'].some(key => row[key] !== parent[key]) || Date.parse(row.at) < Date.parse(parent.at) || moneyUnits(row.amount, row.currency) > moneyUnits(parent.amount, parent.currency)) fail('الاسترداد يحتاج عملية دفع ناجحة مطابقة ومبلغًا ضمن أصل الدفع.');
      if (['succeeded', 'pending'].includes(row.status)) {
        const amount = (reserved.get(parent.id) || 0n) + moneyUnits(row.amount, row.currency);
        if (amount > moneyUnits(parent.amount, parent.currency)) fail('إجمالي الاسترداد الناجح والمعلّق يتجاوز أصل الدفع.');
        reserved.set(parent.id, amount);
      }
    }
    return clone(rows.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id)));
  }

  function createDemoTransactions(bookings, anchorDate = today()) {
    if (!validDate(anchorDate)) fail('اختر تاريخًا صحيحًا لبيانات العمليات التجريبية.');
    const seen = new Set(), records = [];
    for (const record of array(bookings)) {
      if (!record || !text(record.id) || text(record.id).length > 180 || seen.has(record.id) || !own(currencies, record.currency) || validDate(record.date) && record.date > anchorDate) continue;
      try { if (moneyUnits(number(record.amount), record.currency) <= 0n) continue; } catch { continue; }
      seen.add(record.id); records.push(record);
      if (records.length === 24) break;
    }
    const result = [];
    records.forEach((record, index) => {
      let status = ['succeeded', 'failed', 'pending', 'cancelled', 'succeeded', 'succeeded'][index % 6];
      const gateway = record.currency === 'IQD' && index % 2 ? seed[1] : record.currency === 'USD' && index % 4 === 3 ? seed[2] : seed[0];
      const proposedDate = shiftDate(anchorDate, -(6 - index % 6));
      const date = validDate(record.date) && record.date > proposedDate ? record.date : proposedDate;
      const at = timestamp(`${date}T${String(8 + Math.floor(index / 6)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}:00+03:00`);
      const amount = number(record.amount), method = gateway.methods[0];
      let estimated, failureReason = status === 'failed' ? 'سيناريو رفض توضيحي من البوابة، دون محاولة دفع فعلية.' : '';
      try { estimated = quote(gateway, { amount, method, currency: record.currency }); } catch (error) { estimated = { fee: 0, net: 0 }; if (status === 'succeeded') { status = 'failed'; failureReason = 'تعذّر سيناريو المعاينة: ' + error.message; } }
      const id = `simulation-pay-${index + 1}`;
      result.push({ id, reference: `SIM-PAY-${String(index + 1).padStart(4, '0')}`, bookingId: record.id, gatewayId: gateway.id, gatewayName: gateway.name, environment: gateway.environment, method, currency: record.currency, kind: 'payment', status, amount, fee: status === 'succeeded' ? estimated.fee : 0, net: status === 'succeeded' ? estimated.net : 0, date, at, parentId: '', failureReason, source: 'simulation' });
      if (status !== 'succeeded' || !gateway.supportsRefunds) return;
      const refundUnits = moneyUnits(amount, record.currency) / 4n;
      if (refundUnits <= 0n) return;
      for (const [slot, refundStatus] of ['succeeded', 'pending', 'failed'].entries()) {
        const nextDate = shiftDate(date, 1), refundDate = nextDate > anchorDate ? anchorDate : nextDate;
        const refundAt = timestamp(`${refundDate}T${String(12 + Math.floor(index / 6)).padStart(2, '0')}:${String(slot * 5 + index % 5).padStart(2, '0')}:00+03:00`);
        const refundAmount = fromUnits(refundUnits, record.currency);
        result.push({ id: `${id}-refund-${slot + 1}`, reference: `SIM-REF-${index + 1}-${slot + 1}`, bookingId: record.id, gatewayId: gateway.id, gatewayName: gateway.name, environment: gateway.environment, method, currency: record.currency, kind: 'refund', status: refundStatus, amount: refundAmount, fee: 0, net: refundStatus === 'succeeded' ? -refundAmount : 0, date: refundDate, at: refundAt, parentId: id, failureReason: refundStatus === 'failed' ? 'سيناريو استرداد مرفوض توضيحي؛ لم يُسترد مبلغ فعلي.' : '', source: 'simulation' });
      }
    });
    return validateTransactions(result);
  }

  function filterTransactions(input, filters = {}) {
    const rows = validateTransactions(input);
    filters = filters || {};
    for (const [key, labels] of [['currency', currencies], ['method', methods], ['kind', transactionKinds], ['status', transactionStatuses]]) if (filters[key] && filters[key] !== 'all' && !own(labels, filters[key])) fail('أحد مرشحات العمليات غير صالح.');
    if (filters.startDate && !validDate(filters.startDate) || filters.endDate && !validDate(filters.endDate) || filters.startDate && filters.endDate && filters.startDate > filters.endDate) fail('اختر فترة صحيحة للعمليات.');
    const query = normalizedName(String(filters.query || '').slice(0, 300));
    return rows.filter(row => ['gatewayId', 'currency', 'method', 'status', 'kind', 'bookingId'].every(key => !filters[key] || filters[key] === 'all' || row[key] === filters[key]) && (!filters.startDate || row.date >= filters.startDate) && (!filters.endDate || row.date <= filters.endDate) && (!query || normalizedName([row.id, row.reference, row.bookingId, row.gatewayName].join(' ')).includes(query)));
  }

  function paymentCounts(rows) {
    const payments = rows.filter(row => row.kind === 'payment');
    const values = Object.fromEntries(Object.keys(transactionStatuses).map(status => [status, payments.filter(row => row.status === status).length]));
    const terminal = values.succeeded + values.failed + values.cancelled;
    return { attempts: payments.length, ...values, terminal, refunds: rows.filter(row => row.kind === 'refund').length, successRate: rate(values.succeeded, terminal) };
  }

  function totals(rows, currency) {
    const sum = (kind, field) => fromUnits(rows.filter(row => row.currency === currency && row.kind === kind && row.status === 'succeeded').reduce((total, row) => total + moneyUnits(row[field], currency), 0n), currency);
    const gross = sum('payment', 'amount'), refunds = sum('refund', 'amount'), fees = sum('payment', 'fee');
    return { gross, refunds, fees, net: fromUnits(moneyUnits(gross, currency) - moneyUnits(refunds, currency) - moneyUnits(fees, currency), currency) };
  }

  function reportTransactions(input, filters = {}) {
    const rows = filterTransactions(input, filters), groups = new Map();
    for (const row of rows) { const key = row.gatewayId + ':' + row.currency; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(row); }
    return {
      rows: clone(rows), summary: paymentCounts(rows),
      currencies: Object.fromEntries(Object.keys(currencies).map(currency => [currency, totals(rows, currency)])),
      gateways: [...groups.values()].map(group => ({ gatewayId: group[0].gatewayId, gatewayName: group[0].gatewayName, currency: group[0].currency, ...paymentCounts(group), refundCount: group.filter(row => row.kind === 'refund').length, ...totals(group, group[0].currency) }))
    };
  }

  function csv(rows) {
    const cell = value => { let raw = String(value ?? ''); if (typeof value !== 'number' && /^[\s\uFEFF]*[=+\-@]/u.test(raw)) raw = "'" + raw; return '"' + raw.replace(/"/g, '""') + '"'; };
    return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
  }

  const api = { seed, methods, currencies, environments, connectionStates, transactionStatuses, transactionKinds, today, validDate, normalize, validate, sanitizeRecords, upsert, setEnabled, connectionTest, payload, restore, quote, eligible, validateTransactions, createDemoTransactions, filterTransactions, reportTransactions, csv };
  globalThis.YARGatewaysModel = api;
  if (typeof window !== 'undefined') window.YARGatewaysModel = api;
})();
