const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist');
const source = fs.readFileSync(path.join(dist, 'pricing-engine.js'), 'utf8');
const sandbox = { window: {}, Date, Intl };
vm.runInNewContext(source, sandbox);
const engine = sandbox.window.YARPricingEngine;
const plain = value => JSON.parse(JSON.stringify(value));
const providers = [
  { id: 'flight-a', serviceType: 'flight', status: 'published' },
  { id: 'flight-b', serviceType: 'flight', status: 'published', operatingEnabled: true },
  { id: 'paused', serviceType: 'flight', status: 'published', operatingEnabled: false },
  { id: 'tour-a', serviceType: 'tour', status: 'published', operatingEnabled: true },
];
let sequence = 0;
const rule = changes => ({
  id: `scope-rule-${++sequence}`, name: 'قاعدة اختبار النطاق', kind: 'markup', service: 'flight',
  providerId: 'all', currency: 'IQD', mode: 'percent', value: 10,
  startDate: '', endDate: '', enabled: true, ...changes,
});
const context = changes => ({
  cost: 100000, service: 'flight', providerId: 'flight-a', currency: 'IQD', date: '2026-11-06',
  routeFrom: 'BGW', routeTo: 'MHD', carrier: 'IA', cabin: 'economy', ...changes,
});

test('legacy blank scopes stay broad and the nine stable route codes normalize without mutating inputs', () => {
  assert.deepEqual(Object.keys(engine.routeCities), ['BGW', 'NJF', 'BSR', 'EBL', 'MHD', 'IKA', 'SYZ', 'IFN', 'RAS']);
  const legacy = rule();
  assert.equal(engine.validate(legacy, [], providers), '');
  assert.equal(engine.selectRule([legacy], 'markup', context(), providers), legacy);
  assert.equal(engine.selectRule([legacy], 'markup', context({ routeFrom: '', routeTo: '', carrier: '', cabin: '' }), providers), legacy);
  const sourceScope = { routeFrom: ' bgw ', routeTo: ' mhd ', carrier: ' ia ', cabin: ' Business ' };
  const before = plain(sourceScope);
  assert.deepEqual(plain(engine.normalizeFlightScope(sourceScope)), { routeFrom: 'BGW', routeTo: 'MHD', carrier: 'IA', cabin: 'business' });
  assert.deepEqual(sourceScope, before);
  const scoped = rule(sourceScope);
  assert.equal(engine.validate(scoped, [], providers), '');
  assert.equal(engine.selectRule([scoped], 'markup', context({ cabin: 'business' }), providers), scoped);
});

test('provider then service then general precedence remains stronger than the number of flight constraints', () => {
  const general = rule({ service: 'all', value: 2 });
  const service = rule({ value: 4 });
  const serviceSpecific = rule({ routeFrom: 'BGW', routeTo: 'MHD', carrier: 'IA', cabin: 'economy', value: 99 });
  const provider = rule({ providerId: 'flight-a', value: 6 });
  const providerSpecific = rule({ providerId: 'flight-a', carrier: 'IA', value: 8 });
  assert.equal(engine.calculate([general, service, serviceSpecific, provider], context(), providers).markupAmount, 6000);
  assert.equal(engine.calculate([providerSpecific, provider, serviceSpecific], context(), providers).markupAmount, 8000);
  assert.equal(engine.calculate([general, service, serviceSpecific], context({ providerId: 'flight-b' }), providers).markupAmount, 99000);
  assert.equal(engine.calculate([general, service, serviceSpecific], context({ routeFrom: 'NJF' }), providers).markupAmount, 4000);
  assert.equal(engine.calculate([general, service], { cost: 100000, service: 'hotel', currency: 'IQD', date: '2026-11-06' }, providers).markupAmount, 2000);
});

test('all populated fields must match and route direction never reverses implicitly', () => {
  const fallback = rule({ value: 2 });
  const specific = rule({ routeFrom: 'BGW', routeTo: 'MHD', carrier: 'IA', cabin: 'business', value: 20 });
  const rules = [fallback, specific];
  assert.equal(engine.selectRule(rules, 'markup', context({ cabin: 'business' }), providers), specific);
  for (const changes of [
    { routeFrom: 'MHD', routeTo: 'BGW', cabin: 'business' },
    { routeFrom: 'NJF', cabin: 'business' }, { routeTo: 'IKA', cabin: 'business' },
    { carrier: 'W5', cabin: 'business' }, { cabin: 'economy' }, { routeTo: '', cabin: 'business' },
  ]) assert.equal(engine.selectRule(rules, 'markup', context(changes), providers), fallback, JSON.stringify(changes));
  const originOnly = rule({ routeFrom: 'BGW' });
  assert.equal(engine.selectRule([originOnly], 'markup', context({ routeTo: 'RAS' }), providers), originOnly);
});

test('generic and more specific rules can coexist while equal-rank intersecting scopes cannot', () => {
  const broad = rule();
  const origin = rule({ routeFrom: 'BGW' });
  const route = rule({ routeFrom: 'BGW', routeTo: 'MHD' });
  const routeAndCarrier = rule({ routeFrom: 'BGW', routeTo: 'MHD', carrier: 'IA' });
  assert.equal(engine.validate(origin, [broad], providers), '');
  assert.equal(engine.validate(route, [broad, origin], providers), '');
  assert.equal(engine.validate(routeAndCarrier, [broad, origin, route], providers), '');
  assert.notEqual(engine.validate(rule({ routeTo: 'MHD' }), [origin], providers), '', 'origin-only and destination-only scopes intersect at equal rank');
  assert.notEqual(engine.validate(rule({ carrier: 'IA' }), [origin], providers), '', 'a wildcard in a different dimension still intersects');
  assert.notEqual(engine.validate(rule({ carrier: 'IA', cabin: 'business' }), [route], providers), '', 'two constraints on different dimensions can be ambiguous');
  assert.equal(engine.validate(rule({ routeFrom: 'NJF' }), [origin], providers), '');
  assert.equal(engine.validate(rule({ routeFrom: 'BGW', routeTo: 'IKA' }), [route], providers), '');
  assert.equal(engine.validate(rule({ routeFrom: 'BGW', routeTo: 'MHD', carrier: 'W5' }), [routeAndCarrier], providers), '');
  assert.equal(engine.validate(rule({ routeFrom: 'BGW', providerId: 'flight-b' }), [{ ...origin, providerId: 'flight-a' }], providers), '');
});

test('scoped conflicts retain inclusive date boundaries and separate kind/currency/disabled rules', () => {
  const existing = rule({ routeFrom: 'BGW', startDate: '2026-11-01', endDate: '2026-11-06' });
  const candidate = rule({ carrier: 'IA', startDate: '2026-11-06', endDate: '2026-11-10' });
  assert.notEqual(engine.validate(candidate, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, startDate: '2026-11-07' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, kind: 'discount' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, currency: 'USD' }, [existing], providers), '');
  assert.equal(engine.validate({ ...candidate, enabled: false }, [existing], providers), '');
  assert.equal(engine.validate(candidate, [{ ...existing, enabled: false }], providers), '');
});

test('flight-only scopes reject unknown airports, same-city routes, nonalphanumeric carriers and unsupported cabins', () => {
  for (const changes of [
    { routeFrom: 'XXX' }, { routeFrom: 'BGW', routeTo: 'BGW' }, { carrier: 'IA-1' },
    { carrier: 'IA W5' }, { carrier: 'A'.repeat(13) }, { cabin: 'first' }, { routeFrom: ['BGW'] },
    { service: 'hotel', routeFrom: 'BGW' }, { service: 'all', cabin: 'business' }, { service: 'tour', carrier: 'IA' },
  ]) assert.notEqual(engine.validate(rule(changes), [], providers), '', JSON.stringify(changes));
  assert.equal(engine.validate(rule({ carrier: ' w5 ', routeTo: 'RAS' }), [], providers), '');
  assert.equal(engine.selectRule([rule()], 'markup', context({ routeTo: 'XXX' }), providers), null);
  assert.throws(() => engine.calculate([rule()], context({ carrier: 'IA-1' }), providers), /رمز شركة/);
  assert.throws(() => engine.calculate([], context({ service: 'tour' }), providers), /الطيران فقط/);
});

test('paused providers are ineligible while legacy providers without operatingEnabled remain valid', () => {
  const paused = rule({ providerId: 'paused', value: 50 });
  const fallback = rule({ value: 3 });
  assert.notEqual(engine.validate(paused, [], providers), '');
  assert.equal(engine.selectRule([paused, fallback], 'markup', context({ providerId: 'paused' }), providers), fallback);
  const legacy = rule({ providerId: 'flight-a' });
  assert.equal(engine.validate(legacy, [], providers), '');
  assert.equal(engine.selectRule([legacy], 'markup', context(), providers), legacy);
});

test('scoped markup and discount resolve independently with existing USD rounding and loss controls', () => {
  const markup = rule({ providerId: 'flight-a', routeFrom: 'BGW', currency: 'USD', value: 10 });
  const discount = rule({ kind: 'discount', service: 'all', currency: 'USD', mode: 'fixed', value: 0.105 });
  const result = engine.calculate([markup, discount], context({ cost: 1.15, currency: 'USD' }), providers);
  assert.equal(result.markupAmount, 0.12);
  assert.equal(result.original, 1.27);
  assert.equal(result.discountAmount, 0.11);
  assert.equal(result.final, 1.16);
  const loss = engine.calculate([markup, { ...discount, value: 20 }], context({ cost: 1.15, currency: 'USD' }), providers);
  assert.equal(loss.final, 0);
  assert.equal(loss.belowCost, true);
  assert.equal(loss.discountExceeded, true);
});

test('tour rules support general and provider pricing in their own currency without flight scope', () => {
  assert.equal(engine.services.tour, 'الجولات السياحية');
  const markup = rule({ service: 'tour', providerId: 'tour-a', currency: 'USD', value: 10 });
  const discount = rule({ service: 'all', currency: 'USD', kind: 'discount', value: 5 });
  assert.equal(engine.validate(markup, [discount], providers), '');
  const result = engine.calculate([markup, discount], { cost: 45, service: 'tour', providerId: 'tour-a', currency: 'USD', date: '2026-11-06' }, providers);
  assert.equal(result.original, 49.5);
  assert.equal(result.discountAmount, 2.48);
  assert.equal(result.final, 47.02);
});

test('getRules loads persisted rules before mount and returns independent normalized snapshots', () => {
  const savedRule = rule({ providerId: 'flight-a', routeFrom: ' bgw ', routeTo: ' mhd ', carrier: ' ia ', cabin: 'business' });
  const store = JSON.stringify({ version: 1, rules: [savedRule] });
  const context = {
    window: { YAR_ADMIN: { esc: String, icon: () => '', toast: () => {} } }, Date, Intl,
    localStorage: { getItem: key => key === 'YAR_ADMIN_PRICING_V1' ? store : null },
  };
  vm.runInNewContext(source, context);
  vm.runInNewContext(fs.readFileSync(path.join(dist, 'pricing.js'), 'utf8'), context);
  const first = context.window.YARPricing.getRules();
  assert.equal(first.length, 1);
  assert.equal(first[0].routeFrom, 'BGW');
  assert.equal(first[0].carrier, 'IA');
  first[0].name = 'mutated';
  first.push(rule());
  const next = context.window.YARPricing.getRules();
  assert.equal(next.length, 1);
  assert.equal(next[0].name, savedRule.name);
});
