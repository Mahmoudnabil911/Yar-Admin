const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'pricing-engine.js'), 'utf8');
function load(date) {
  const clock = date ? class extends Date { constructor(...args) { super(...(args.length ? args : [date])); } } : Date;
  const sandbox = { window: {}, Date: clock, Intl };
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.window.YARPricingEngine, sandbox.YARPricingEngine);
  return sandbox.YARPricingEngine;
}
const engine = load();
const providers = [
  { id: 'flight-a', name: 'أفق', serviceType: 'flight', status: 'published' },
  { id: 'flight-b', name: 'مدار', serviceType: 'flight', status: 'published' },
  { id: 'hotel-a', name: 'رواق', serviceType: 'hotel', status: 'published' },
  { id: 'archived', name: 'مؤرشف', serviceType: 'flight', status: 'archived' },
  { id: 'draft', name: 'مسودة', serviceType: 'flight', status: 'draft' },
];
const context = overrides => ({ cost: 100000, service: 'flight', providerId: 'flight-a', currency: 'IQD', date: '2026-11-06', ...overrides });
const rule = overrides => ({
  id: 'rule-default', kind: 'markup', name: 'قاعدة تجريبية', service: 'all', providerId: 'all',
  currency: 'IQD', mode: 'percent', value: 10, startDate: '', endDate: '', enabled: true, ...overrides,
});

test('default markup is 10% over supplier cost, with a consciously disabled 20% discount', () => {
  const result = engine.calculate(engine.seed, context(), providers);
  assert.equal(result.cost, 100000);
  assert.equal(result.markupAmount, 10000);
  assert.equal(result.original, 110000);
  assert.equal(result.final, 110000);
  assert.equal(result.discountRule, null);
  assert.equal(result.net, 10000);
  assert.equal(result.belowCost, false);
  for (const seed of engine.seed) assert.equal(engine.validate(seed, engine.seed, providers), '');
  assert.equal(engine.calculate([rule({ value: 1 })], context(), providers).final, 101000);
});

test('provider overrides service, service overrides general, and rules never stack', () => {
  const general = rule({ id: 'general', value: 10 });
  const service = rule({ id: 'service', service: 'flight', value: 15 });
  const provider = rule({ id: 'provider', service: 'flight', providerId: 'flight-a', mode: 'fixed', value: 25000 });
  const rules = [general, provider, service];
  assert.equal(engine.calculate(rules, context(), providers).original, 125000);
  assert.equal(engine.calculate(rules, context({ providerId: 'flight-b' }), providers).original, 115000);
  assert.equal(engine.calculate(rules, context({ service: 'hotel', providerId: 'hotel-a' }), providers).original, 110000);
  assert.equal(engine.selectRule(rules, 'markup', context(), providers), provider);
});

test('markup and discount resolve independently and discount is based on original retail', () => {
  const markup = rule({ id: 'markup', service: 'flight', providerId: 'flight-a', value: 10 });
  const discount = rule({ id: 'discount', kind: 'discount', value: 5 });
  const result = engine.calculate([markup, discount], context(), providers);
  assert.equal(result.original, 110000);
  assert.equal(result.discountAmount, 5500);
  assert.equal(result.final, 104500);
  assert.equal(result.net, 4500);
  assert.equal(result.markupRule, markup);
  assert.equal(result.discountRule, discount);
});

test('selection excludes disabled, scheduled, expired, wrong currency and invalid provider rules', () => {
  const general = rule({ id: 'fallback', value: 4 });
  const variants = [
    { enabled: false }, { startDate: '2026-11-07' }, { endDate: '2026-11-05' }, { currency: 'USD' },
    { service: 'flight', providerId: 'archived' }, { service: 'flight', providerId: 'draft' },
    { service: 'flight', providerId: 'missing' }, { service: 'flight', providerId: 'hotel-a' },
    { service: 'all', providerId: 'flight-a' }, { mode: 'unknown' }, { value: NaN }, { value: Infinity },
  ];
  for (const [index, change] of variants.entries()) {
    const candidate = rule({ id: `candidate-${index}`, service: 'flight', providerId: 'flight-a', value: 99, ...change });
    const ctx = context({ providerId: change.providerId || 'flight-a' });
    assert.equal(engine.selectRule([candidate, general], 'markup', ctx, providers), general, `variant ${index}`);
  }
  assert.equal(engine.calculate([general], context({ currency: 'USD' }), providers).final, 100000);
  assert.equal(engine.selectRule([general], 'markup', context({ service: 'invalid' }), providers), null);
});

test('calendar states have inclusive boundaries and Baghdad day is independent of UTC', () => {
  const dated = rule({ startDate: '2026-11-06', endDate: '2026-11-10' });
  assert.equal(engine.status(dated, '2026-11-05'), 'scheduled');
  assert.equal(engine.status(dated, '2026-11-06'), 'active');
  assert.equal(engine.status(dated, '2026-11-10'), 'active');
  assert.equal(engine.status(dated, '2026-11-11'), 'expired');
  assert.equal(engine.status({ ...dated, enabled: false }, '2026-11-07'), 'disabled');
  assert.equal(engine.status(rule(), '2026-11-07'), 'active');
  assert.equal(engine.status(rule(), '2026-02-30'), 'disabled');
  assert.equal(load('2026-11-05T20:59:59Z').today(), '2026-11-05');
  assert.equal(load('2026-11-05T21:00:00Z').today(), '2026-11-06');
});

test('validation blocks exact-scope inclusive overlap but allows next-day boundaries and different scopes', () => {
  const existing = rule({ id: 'existing', startDate: '2026-11-01', endDate: '2026-11-06' });
  const candidate = rule({ id: 'candidate', startDate: '2026-11-06', endDate: '2026-11-09' });
  assert.notEqual(engine.validate(candidate, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, startDate: '2026-11-07' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, id: 'existing' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, enabled: false }, [existing], providers), '');
  assert.equal(engine.validate(candidate, [{ ...existing, enabled: false }], providers), '');
  assert.equal(engine.validate({ ...candidate, kind: 'discount' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, currency: 'USD' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, service: 'flight' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, service: 'flight', providerId: 'flight-a' }, [existing], providers), '');
  assert.notEqual(engine.validate(rule({ id: '' }), [rule({ id: '' })], providers), '');
  assert.notEqual(engine.validate(candidate, [rule({ id: 'unbounded' })], providers), '');
});

test('validation rejects invalid dates, provider scope and nonpositive/nonfinite percentages', () => {
  const invalid = [
    { startDate: '2026-02-29' }, { endDate: '2026-02-30' }, { startDate: '2026-11-07', endDate: '2026-11-06' },
    { startDate: '0000-01-01' }, { startDate: '2026-1-01' }, { providerId: 'flight-a' },
    { service: 'flight', providerId: 'hotel-a' }, { service: 'flight', providerId: 'archived' },
    { kind: 'discount', value: 100.01 }, { value: 1000.01 }, { value: 0 }, { value: -1 },
    { value: NaN }, { value: Infinity }, { value: '10' }, { name: '   ' },
  ];
  for (const change of invalid) assert.notEqual(engine.validate(rule(change), [], providers), '', JSON.stringify(change));
  assert.equal(engine.validate(rule({ kind: 'discount', value: 100 }), [], providers), '');
  assert.equal(engine.validate(rule({ value: 1000 }), [], providers), '');
  assert.equal(engine.validate(rule({ startDate: '2028-02-29' }), [], providers), '');
});

test('USD rounds to cents at each stage and IQD to whole dinars', () => {
  const fixedMarkup = rule({ currency: 'USD', mode: 'fixed', value: 0.105 });
  const fixedDiscount = rule({ id: 'discount', currency: 'USD', kind: 'discount', mode: 'fixed', value: 0.105 });
  const result = engine.calculate([fixedMarkup, fixedDiscount], context({ cost: 1.005, currency: 'USD' }), providers);
  assert.equal(result.cost, 1.01);
  assert.equal(result.markupAmount, 0.11);
  assert.equal(result.original, 1.12);
  assert.equal(result.discountAmount, 0.11);
  assert.equal(result.final, 1.01);
  assert.equal(result.net, 0);
  assert.equal(engine.calculate([], context({ cost: 10.075, currency: 'USD' }), providers).cost, 10.08);
  assert.equal(engine.calculate([], context({ cost: 100000.5 }), providers).cost, 100001);
});

test('percentage arithmetic preserves exact half-cent and half-dinar boundaries', () => {
  const markup = rule({ currency: 'USD', value: 10 });
  const discount = rule({ currency: 'USD', kind: 'discount', value: 10 });
  const withMarkup = engine.calculate([markup], context({ cost: 1.15, currency: 'USD' }), providers);
  assert.equal(withMarkup.markupAmount, 0.12);
  assert.equal(withMarkup.original, 1.27);
  const withDiscount = engine.calculate([discount], context({ cost: 1.15, currency: 'USD' }), providers);
  assert.equal(withDiscount.discountAmount, 0.12);
  assert.equal(withDiscount.final, 1.03);
  assert.equal(engine.calculate([rule({ value: 3 })], context({ cost: 1150 }), providers).markupAmount, 35);
  assert.equal(engine.calculate([rule({ value: 0.1 })], context({ cost: 11500 }), providers).markupAmount, 12);
});

test('fixed discounts cannot create negative final prices and below-cost losses stay visible', () => {
  const markup = rule();
  const discount = rule({ id: 'discount', kind: 'discount', mode: 'fixed', value: 120000 });
  const result = engine.calculate([markup, discount], context(), providers);
  assert.equal(result.original, 110000);
  assert.equal(result.discountAmount, 110000);
  assert.equal(result.final, 0);
  assert.equal(result.net, -100000);
  assert.equal(result.discountExceeded, true);
  assert.equal(result.belowCost, true);
  const exact = engine.calculate([markup, { ...discount, value: 110000 }], context(), providers);
  assert.equal(exact.discountExceeded, false);
  const percent = engine.calculate([markup, { ...discount, mode: 'percent', value: 20 }], context(), providers);
  assert.equal(percent.final, 88000);
  assert.equal(percent.net, -12000);
  assert.equal(percent.belowCost, true);
  assert.equal(percent.discountExceeded, false);
});

test('invalid costs and contexts fail explicitly instead of returning NaN or infinite totals', () => {
  for (const cost of [NaN, Infinity, -Infinity, -1, '', null, undefined, '100000']) {
    assert.throws(() => engine.calculate(engine.seed, context({ cost }), providers), /تكلفة/);
  }
  for (const change of [{ service: 'invalid' }, { currency: 'EUR' }, { date: '2026-02-30' }]) {
    assert.throws(() => engine.calculate(engine.seed, context(change), providers));
  }
  assert.throws(() => engine.calculate([rule({ value: 1000 })], context({ cost: Number.MAX_VALUE }), providers), /النطاق/);
  assert.equal(engine.calculate([], context({ cost: 0 }), providers).final, 0);
});
