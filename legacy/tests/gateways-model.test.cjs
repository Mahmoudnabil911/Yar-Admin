const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {}, Date, Intl };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'dist', 'gateways-model.js'), 'utf8'), sandbox);
const M = sandbox.YARGatewaysModel;
const plain = value => JSON.parse(JSON.stringify(value));
const clone = value => JSON.parse(JSON.stringify(value));
const candidate = changes => ({ ...clone(M.seed[0]), id: 'gateway-new', name: 'بوابة جديدة', connectionState: 'unknown', lastCheckedAt: '', ...changes });
const bookings = Array.from({ length: 6 }, (_, index) => ({ id: `BOOKING-${index + 1}`, amount: index % 2 ? 100000 : 100, currency: index % 2 ? 'IQD' : 'USD', customer: 'اسم لا يُنسخ إلى التحليل', phone: 'private', payments: [] }));
const data = () => M.createDemoTransactions(bookings, '2026-11-07');
const payment = changes => ({ id: 'p1', reference: 'PAY-1', bookingId: 'BOOK-1', gatewayId: 'gateway-card', gatewayName: 'بوابة تاريخية', environment: 'sandbox', method: 'card', currency: 'USD', kind: 'payment', status: 'succeeded', amount: 100, fee: 3, net: 97, date: '2026-11-06', at: '2026-11-06T09:00:00+03:00', parentId: '', failureReason: '', source: 'simulation', ...changes });
const refund = changes => ({ ...payment(), id: 'r1', reference: 'REF-1', kind: 'refund', parentId: 'p1', amount: 25, fee: 0, net: -25, at: '2026-11-06T10:00:00+03:00', ...changes });

test('seeds validate, capabilities and configuration snapshots allow no credentials or card data', () => {
  assert.equal(M, sandbox.window.YARGatewaysModel);
  assert.equal(M.sanitizeRecords(M.seed).length, 3);
  assert.deepEqual(plain(Object.keys(M.methods)), ['card', 'wallet', 'bank']);
  const source = candidate({ secretKey: 'secret', apiKey: 'private', cardNumber: '1234', merchantId: 'private' });
  const result = M.upsert(M.seed, source).at(-1);
  for (const key of ['secretKey', 'apiKey', 'cardNumber', 'merchantId']) assert.equal(key in result, false);
  assert.equal(M.seed.length, 3);
  assert.notEqual(M.validate(candidate({ name: 'بوابة البطاقات · مثال' }), M.seed), '');
});

test('gateway validation rejects unsupported currencies/methods, ambiguous states and invalid fee precision', () => {
  for (const change of [
    { id: '<script>' }, { name: '' }, { name: 'x'.repeat(81) }, { enabled: 'true' }, { supportsRefunds: null },
    { priority: 0 }, { priority: 100 }, { priority: 1.5 }, { environment: 'live' },
    { methods: [] }, { methods: ['crypto'] }, { currencies: [] }, { currencies: ['EUR'] },
    { connectionState: 'online' }, { connectionState: 'healthy', lastCheckedAt: '' },
    { lastCheckedAt: '2026-02-30T10:00:00Z' },
    { fees: { IQD: { percent: 2.001, fixed: 0 }, USD: { percent: 0, fixed: 0 } } },
    { fees: { IQD: { percent: 101, fixed: 0 }, USD: { percent: 0, fixed: 0 } } },
    { fees: { IQD: { percent: 0, fixed: 0.5 }, USD: { percent: 0, fixed: 0 } } },
    { fees: { IQD: { percent: 0, fixed: 0 }, USD: { percent: 0, fixed: 0.001 } } },
    { fees: { IQD: { percent: 0, fixed: -1 }, USD: { percent: 0, fixed: 0 } } }
  ]) assert.notEqual(M.validate(candidate(change), M.seed), '', JSON.stringify(change));
});

test('upserts preserve connection outcome, dedicated tests update it immutably and enabled order controls eligibility', () => {
  const before = clone(M.seed);
  const changed = M.upsert(M.seed, { ...before[0], name: 'اسم معدل', connectionState: 'failed', lastCheckedAt: '2026-11-07T10:00:00Z' });
  assert.equal(changed[0].connectionState, before[0].connectionState);
  assert.equal(changed[0].lastCheckedAt, before[0].lastCheckedAt);
  const environmentChange = M.upsert(changed, { ...changed[0], environment: 'production' });
  assert.equal(environmentChange[0].connectionState, 'unknown');
  assert.equal(environmentChange[0].lastCheckedAt, '');
  const result = M.connectionTest(changed, changed[0].id, 'failure', '2026-11-07T10:00:00+03:00');
  assert.equal(result.gateways[0].connectionState, 'failed');
  assert.equal(result.log.outcome, 'failure');
  assert.equal(result.log.environment, 'sandbox');
  assert.equal(M.eligible(result.gateways, { method: 'card', currency: 'USD' }).length, 0);
  const slow = M.connectionTest(result.gateways, result.gateways[0].id, 'slow', '2026-11-07T11:00:00+03:00');
  assert.equal(M.eligible(slow.gateways, { method: 'card', currency: 'USD' }).length, 1);
  const disabled = M.setEnabled(slow.gateways, slow.gateways[0].id, false);
  assert.equal(M.eligible(disabled, { method: 'card', currency: 'USD' }).length, 0);
  assert.deepEqual(plain(M.seed), before);
  const additional = M.upsert(M.seed, candidate({ priority: 1 }));
  assert.equal(additional.at(-1).connectionState, 'unknown');
  assert.throws(() => M.connectionTest(additional, 'missing', 'success'));
  assert.throws(() => M.setEnabled(additional, 'gateway-new', 'true'));
});

test('fee quote charges the company only and rounds half cents/dinars exactly with fixed fees', () => {
  const usd = M.quote(M.seed[0], { method: 'card', currency: 'USD', amount: 100 });
  assert.deepEqual(plain(usd), { gatewayId: 'gateway-card', method: 'card', currency: 'USD', amount: 100, fee: 2.75, net: 97.25 });
  const iqd = M.quote(M.seed[0], { method: 'card', currency: 'IQD', amount: 100000 });
  assert.equal(iqd.fee, 3000); assert.equal(iqd.net, 97000); assert.equal(iqd.amount, 100000);
  const half = candidate({ fees: { IQD: { percent: 50, fixed: 0 }, USD: { percent: 50, fixed: 0 } } });
  assert.equal(M.quote(half, { method: 'card', currency: 'USD', amount: 0.01 }).fee, 0.01);
  assert.equal(M.quote(half, { method: 'card', currency: 'IQD', amount: 1 }).fee, 1);
  assert.equal(M.quote(M.seed[0], { method: 'card', currency: 'USD', amount: 1.15 }).amount, 1.15);
  for (const [currency, amount] of [['USD', 1.001], ['IQD', 1.5], ['USD', -1], ['USD', 0], ['USD', Infinity]]) assert.throws(() => M.quote(M.seed[0], { method: 'card', currency, amount }));
  assert.throws(() => M.quote(M.seed[0], { method: 'wallet', currency: 'USD', amount: 100 }));
  assert.throws(() => M.quote(M.seed[0], { method: 'card', currency: 'IQD', amount: 1 }));
});

test('timeout is a distinct saved simulation outcome and leaves the gateway unavailable until another test succeeds', () => {
  const result = M.connectionTest(M.seed, 'gateway-card', 'timeout', '2026-11-07T10:00:00Z');
  assert.equal(result.gateways[0].connectionState, 'failed');
  assert.equal(result.log.outcome, 'timeout');
  assert.match(result.log.detail, /انتهت مهلة الاتصال التجريبية/);
  assert.equal(M.eligible(result.gateways, { method: 'card', currency: 'USD' }).length, 0);
  const restored = M.restore(M.payload(result.gateways, [result.log]));
  assert.equal(restored.logs[0].outcome, 'timeout');
});

test('versioned payload round trips clean config and test history while malformed saved state fails closed', () => {
  const result = M.connectionTest(M.seed, 'gateway-card', 'success', '2026-11-07T10:00:00Z');
  const packed = M.payload(result.gateways, [result.log]);
  assert.deepEqual(plain(M.restore(JSON.parse(JSON.stringify(packed)))), plain(packed));
  assert.equal(M.restore({ ...packed, token: 'private' }).token, undefined);
  const invalid = [
    { ...packed, version: 2 }, { ...packed, gateways: null }, { ...packed, logs: {} },
    { ...packed, gateways: [packed.gateways[0], packed.gateways[0]] },
    { ...packed, gateways: [{ ...packed.gateways[0], methods: ['unsupported'] }] },
    { ...packed, logs: [{ ...result.log, gatewayId: 'missing' }] },
    { ...packed, logs: [result.log, result.log] },
    { ...packed, logs: [result.log, { ...result.log, id: ' ' + result.log.id + ' ' }] },
    { ...packed, logs: [{ ...result.log, at: 'invalid' }] },
  ];
  for (const input of invalid) assert.throws(() => M.restore(input));
});

test('demo log links supplied bookings only, covers statuses/refunds and never mutates booking payments', () => {
  const before = clone(bookings), rows = data();
  assert.deepEqual(plain(rows), plain(data()));
  assert.deepEqual(bookings, before);
  assert.ok(rows.length > bookings.length);
  assert.deepEqual([...new Set(rows.filter(row => row.kind === 'payment').map(row => row.status))].sort(), ['cancelled', 'failed', 'pending', 'succeeded']);
  assert.deepEqual([...new Set(rows.filter(row => row.kind === 'refund').map(row => row.status))].sort(), ['failed', 'pending', 'succeeded']);
  assert.ok(rows.every(row => before.some(booking => booking.id === row.bookingId) && row.source === 'simulation'));
  assert.ok(rows.every(row => !('customer' in row) && !('phone' in row)));
  assert.deepEqual(plain(M.createDemoTransactions([], '2026-11-07')), []);
  assert.deepEqual(plain(M.createDemoTransactions([{ id: 'no-money', amount: 0, currency: 'USD' }], '2026-11-07')), []);
  const small = M.createDemoTransactions([{ id: 'small', amount: 1, currency: 'IQD' }], '2026-11-07');
  assert.equal(small[0].status, 'failed');
  assert.equal(small[0].fee, 0);
});

test('historical fee/name snapshots never change after the gateway configuration changes', () => {
  const rows = data(), before = clone(rows);
  const changed = M.upsert(M.seed, { ...clone(M.seed[0]), name: 'اسم آخر', fees: { IQD: { percent: 10, fixed: 0 }, USD: { percent: 10, fixed: 0 } } });
  assert.equal(changed[0].name, 'اسم آخر');
  assert.deepEqual(plain(M.validateTransactions(rows)), before);
  const tx = rows.find(row => row.kind === 'payment' && row.status === 'succeeded');
  assert.notEqual(tx.gatewayName, changed[0].name);
});

test('demo payments never precede known booking creation and refunds never run past the example date', () => {
  const rows = M.createDemoTransactions([
    { id: 'created-today', date: '2026-11-07', amount: 100, currency: 'USD' },
    { id: 'future-booking', date: '2026-11-08', amount: 100, currency: 'USD' }
  ], '2026-11-07');
  assert.ok(rows.length > 1);
  assert.ok(rows.every(row => row.bookingId === 'created-today' && row.date === '2026-11-07'));
  const parent = rows.find(row => row.kind === 'payment');
  assert.ok(rows.filter(row => row.kind === 'refund').every(row => Date.parse(row.at) > Date.parse(parent.at)));
});

test('transaction validation rejects duplicate IDs/references, precision errors and inconsistent snapshots', () => {
  for (const rows of [
    [payment(), payment()], [payment(), payment({ id: 'p2' })], [payment(), payment({ id: ' p1 ', reference: 'PAY-2' })],
    [payment({ amount: 1.001, net: -1.999 })], [payment({ fee: 100.01, net: -0.01 })],
    [payment({ net: 98 })], [payment({ status: 'pending' })],
    [payment({ status: 'failed', fee: 0, net: 0 })],
    [payment({ currency: 'IQD', amount: 100.5, fee: 0, net: 100.5 })],
    [payment({ date: '2026-11-05' })], [payment({ source: 'live' })],
    [payment({ at: '2026-02-30T10:00:00Z', date: '2026-03-02' })]
  ]) assert.throws(() => M.validateTransactions(rows));
});

test('refunds require successful matching parents and reserve pending amounts without counting failed refunds', () => {
  assert.equal(M.validateTransactions([payment(), refund()]).length, 2);
  const pending = refund({ id: 'r2', reference: 'REF-2', amount: 75, net: 0, status: 'pending' });
  const failed = refund({ id: 'r3', reference: 'REF-3', amount: 100, net: 0, status: 'failed', failureReason: 'رفض تجريبي' });
  assert.equal(M.validateTransactions([payment(), refund(), pending, failed]).length, 4);
  for (const rows of [
    [refund()], [payment({ status: 'failed', fee: 0, net: 0, failureReason: 'رفض' }), refund()],
    [payment(), refund({ bookingId: 'other' })], [payment(), refund({ gatewayId: 'gateway-wallet' })],
    [payment(), refund({ currency: 'IQD' })], [payment(), refund({ method: 'wallet' })],
    [payment(), refund({ amount: 101, net: -101 })],
    [payment(), refund(), { ...pending, amount: 76 }],
    [payment(), refund({ at: '2026-11-06T08:59:59+03:00' })]
  ]) assert.throws(() => M.validateTransactions(rows));
});

test('transaction date filters include Baghdad boundaries and exact booking links without changing input', () => {
  const rows = [payment({ at: '2026-11-05T21:00:00Z' }), refund({ at: '2026-11-06T20:59:59Z' })], before = clone(rows);
  assert.equal(M.filterTransactions(rows, { startDate: '2026-11-06', endDate: '2026-11-06' }).length, 2);
  assert.equal(M.filterTransactions(rows, { bookingId: 'BOOK-1' }).length, 2);
  assert.equal(M.filterTransactions(rows, { bookingId: 'BOOK' }).length, 0);
  assert.equal(M.filterTransactions(rows, { query: 'PAY-1' }).length, 1);
  assert.equal(M.filterTransactions(rows, { kind: 'refund' }).length, 1);
  assert.deepEqual(rows, before);
  for (const filters of [{ startDate: '2026-02-30' }, { startDate: '2026-11-07', endDate: '2026-11-06' }, { currency: 'EUR' }, { status: 'success' }]) assert.throws(() => M.filterTransactions(rows, filters));
});

test('reports exclude pending/refunds from success denominator and isolate currency totals/refunds/fees', () => {
  const rows = [
    payment(), refund(),
    payment({ id: 'p2', reference: 'PAY-2', status: 'failed', failureReason: 'رفض', fee: 0, net: 0 }),
    payment({ id: 'p3', reference: 'PAY-3', status: 'pending', fee: 0, net: 0 }),
    payment({ id: 'p4', reference: 'PAY-4', status: 'cancelled', fee: 0, net: 0 }),
    payment({ id: 'p5', reference: 'PAY-5', currency: 'IQD', amount: 100000, fee: 3000, net: 97000 }),
    refund({ id: 'r2', reference: 'REF-2', parentId: 'p5', currency: 'IQD', amount: 10000, net: -10000 }),
    refund({ id: 'r3', reference: 'REF-3', status: 'pending', amount: 10, net: 0 })
  ];
  const report = M.reportTransactions(rows);
  assert.equal(report.summary.attempts, 5);
  assert.equal(report.summary.terminal, 4);
  assert.equal(report.summary.successRate, 50);
  assert.equal(report.summary.refunds, 3);
  assert.deepEqual(plain(report.currencies.USD), { gross: 100, refunds: 25, fees: 3, net: 72 });
  assert.deepEqual(plain(report.currencies.IQD), { gross: 100000, refunds: 10000, fees: 3000, net: 87000 });
  assert.equal(report.gateways.length, 2);
  const onlyRefund = M.reportTransactions(rows, { kind: 'refund', currency: 'USD' });
  assert.equal(onlyRefund.summary.successRate, null);
  assert.equal(onlyRefund.currencies.USD.net, -25);
  const empty = M.reportTransactions(rows, { bookingId: 'missing' });
  assert.equal(empty.summary.successRate, null);
  assert.equal(empty.currencies.IQD.net, 0);
});

test('CSV export preserves numeric values and escapes formula-like labels and quotes', () => {
  const csv = M.csv([['=HYPERLINK("x")', '+test', '@test', '-label', -25, 12.5], ['نص، عربي', 'سطر\nجديد']]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"\'+test"'));
  assert.ok(csv.includes('"-25","12.5"'));
});
