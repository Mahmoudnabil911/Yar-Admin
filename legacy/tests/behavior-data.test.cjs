const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const sandbox = { window: {}, Date, Intl };
for (const name of ['audience-data.js', 'behavior-data.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist', name), 'utf8'), sandbox);
const D = sandbox.YARBehaviorData;
const plain = value => JSON.parse(JSON.stringify(value));
const filters = { startDate: '2026-11-06', endDate: '2026-11-07', platform: 'all', service: 'all' };
const session = (id = 's1', overrides = {}) => ({ id, date: '2026-11-06', platform: 'android', service: 'flight', visitorId: 'browser-a', userId: null, ended: true, ...overrides });
const event = (type, sequence, overrides = {}) => ({ id: type + '-' + sequence, sessionId: 's1', date: '2026-11-06', sequence, type, ...overrides });
const search = overrides => event('search', 10, { origin: 'بغداد', destination: 'مشهد', originCode: 'BGW', destinationCode: 'MHD', resultCount: 3, currency: 'IQD', travelDate: '2026-11-20', ...overrides });
const dataset = (events, sessions = [session()], extra = {}) => ({ sessions, events, campaigns: [], offers: [], ...extra });
function journey(overrides = {}) {
  const first = search(overrides.search);
  const view = event('view', 11, { searchId: first.id, itemId: 'item1', itemLabel: 'فندق تجريبي', ...overrides.view });
  const checkout = event('checkout', 12, { viewId: view.id, ...overrides.checkout });
  const request = event('request', 13, { checkoutId: checkout.id, requestId: 'r1', ...overrides.request });
  const booking = event('booking', 14, { requestId: request.requestId, bookingId: 'b1', status: 'confirmed', currency: first.currency, amount: 100000, ...overrides.booking });
  return [first, view, checkout, request, booking];
}

test('behavior fixture is deterministic, independent, covers five services and all seven report families', () => {
  const base = sandbox.YARAudienceData.createDemo('2026-11-07');
  const before = plain(base), data = D.createDemo(base, '2026-11-07');
  assert.deepEqual(plain(data), plain(D.createDemo(base, '2026-11-07')));
  assert.deepEqual(plain(base), before);
  assert.equal(data.sessions.length, 180);
  assert.equal(new Set(data.sessions.map(s => s.service)).size, 5);
  const report = D.report(data, { startDate: '2026-10-09', endDate: '2026-11-07' });
  for (const key of ['destinations', 'routes', 'items', 'zeroResults', 'abandonment', 'travelDates', 'durations', 'campaigns', 'offers', 'conversionServices']) assert.ok(report[key].length, key);
  assert.ok(report.summary.searches > report.summary.searchSessions, 'repeated searches remain distinct');
  assert.ok(report.summary.confirmed > 0);
  assert.ok(report.summary.abandoned > 0);
  assert.ok(report.summary.conversion <= 100);
});

test('repeated searches and views are events, unique identities and converted sessions are deduplicated', () => {
  const chain = journey(), repeat = search({ id: 'repeat', sequence: 9 });
  const duplicateBooking = event('booking', 15, { bookingId: 'b2', requestId: 'r1', currency: 'IQD', status: 'confirmed', amount: 100000 });
  const data = dataset([repeat, ...chain, duplicateBooking, plain(chain[0]), plain(chain[4])]);
  const before = plain(data), report = D.report(data, filters);
  assert.equal(report.summary.searches, 2);
  assert.equal(report.summary.users, 1);
  assert.equal(report.summary.searchSessions, 1);
  assert.equal(report.summary.confirmed, 2);
  assert.equal(report.summary.convertedSessions, 1);
  assert.equal(report.summary.conversion, 100);
  assert.deepEqual(plain(data), before);
});

test('anonymous and identified sessions do not retroactively merge a shared browser identity', () => {
  const sessions = [session(), session('s2', { userId: 'u1' }), session('s3', { userId: 'u1', visitorId: 'browser-b' })];
  const report = D.report(dataset([search(), search({ id: 's2-search', sessionId: 's2' }), search({ id: 's3-search', sessionId: 's3' })], sessions), filters);
  assert.equal(report.summary.searchSessions, 3);
  assert.equal(report.summary.users, 2);
});

test('a booking converts only its linked destination when one session searches several routes', () => {
  const report = D.report(dataset([search({ id: 'unconverted-mashhad', sequence: 8 }), ...journey({ search: { destination: 'طهران', destinationCode: 'IKA' } })]), filters);
  assert.equal(report.destinations.find(row => row.key === 'MHD').confirmed, 0);
  assert.equal(report.destinations.find(row => row.key === 'MHD').conversion, 0);
  assert.equal(report.destinations.find(row => row.key === 'IKA').confirmed, 1);
  assert.equal(report.destinations.find(row => row.key === 'IKA').conversion, 100);
  assert.equal(report.summary.convertedSessions, 1);
});

test('only linked confirmed bookings count; pending, cancelled, impossible and zero-result journeys do not', () => {
  for (const status of ['pending', 'cancelled']) assert.equal(D.report(dataset(journey({ booking: { status } })), filters).summary.confirmed, 0);
  const chain = journey();
  for (const events of [
    chain.slice(1),
    journey({ search: { resultCount: 0 } }),
    journey({ view: { sessionId: 'other' } }),
    journey({ checkout: { sequence: 1 } }),
    journey({ booking: { requestId: 'missing' } }),
    journey({ booking: { currency: 'USD' } }),
  ]) assert.equal(D.report(dataset(events, [session(), session('other')]), filters).summary.confirmed, 0);
  const cancelled = event('booking', 16, { bookingId: 'b1', requestId: 'r1', currency: 'IQD', status: 'cancelled', amount: 100000 });
  assert.equal(D.report(dataset([...chain, cancelled]), filters).summary.confirmed, 0, 'latest cancellation excludes an earlier confirmation');
});

test('inclusive cohort dates and platform/service filters never leak later confirmations or earlier sessions', () => {
  const chain = journey({ booking: { date: '2026-11-07' } });
  const data = dataset(chain);
  assert.equal(D.report(data, { ...filters, endDate: '2026-11-06' }).summary.confirmed, 0);
  assert.equal(D.report(data, filters).summary.confirmed, 1);
  assert.equal(D.report(data, { ...filters, startDate: '2026-11-07' }).summary.searches, 0, 'cohort session predates selected period');
  assert.equal(D.report(data, { ...filters, platform: 'ios' }).summary.searches, 0);
  assert.equal(D.report(data, { ...filters, service: 'hotel' }).summary.searches, 0);
  assert.equal(D.report(data, { ...filters, endDate: '2026-11-06', startDate: '2026-11-06' }).summary.searches, 1);
});

test('zero-result report counts searches and searchers without inventing a booking', () => {
  const report = D.report(dataset([search({ resultCount: 0 }), search({ id: 'repeat-zero', sequence: 12, resultCount: 0 })]), filters);
  assert.equal(report.summary.zeroSearches, 2);
  assert.equal(report.summary.zeroRate, 100);
  assert.equal(report.zeroResults.length, 1);
  assert.equal(report.zeroResults[0].searches, 2);
  assert.equal(report.zeroResults[0].users, 1);
});

test('abandonment requires an ended session and never treats a submitted pending request as abandoned checkout', () => {
  const chain = journey({ booking: { status: 'pending' } });
  assert.equal(D.report(dataset(chain.slice(0, 3)), filters).summary.abandoned, 1);
  assert.equal(D.report(dataset(chain.slice(0, 3), [session('s1', { ended: false })]), filters).summary.abandoned, 0);
  assert.equal(D.report(dataset(chain), filters).summary.abandoned, 0);
  assert.equal(D.report(dataset(chain), filters).summary.confirmed, 0);
  const report = D.report(dataset(chain.slice(0, 2)), filters);
  assert.equal(report.abandonment.find(s => s.key === 'details').abandoned, 1);
  assert.equal(report.abandonment.find(s => s.key === 'search').abandoned, 0);
});

test('interest keeps hotel/package views and request links separate; hotel nights never become package days', () => {
  const h = journey({ search: { stayNights: 7 } });
  const p = journey({ search: { id: 'ps', sessionId: 's2', packageDays: 5, currency: 'USD' }, view: { id: 'pv', sessionId: 's2', itemId: 'package1' }, checkout: { id: 'pc', sessionId: 's2' }, request: { id: 'pr', sessionId: 's2', requestId: 'r2' }, booking: { id: 'pb', sessionId: 's2', bookingId: 'b2', amount: 275 } });
  const report = D.report(dataset([...h, ...p], [session('s1', { service: 'hotel' }), session('s2', { service: 'package' })]), filters);
  assert.equal(report.items.length, 2);
  assert.ok(report.items.every(row => row.requests === 1 && row.confirmed === 1));
  assert.deepEqual(plain(report.durations.map(row => row.label).sort()), ['5 أيام للباقة', '7 ليالٍ فندقية']);
});

test('campaign/offer attribution is the last prior click in the same session, never a later or other-session click', () => {
  const campaigns = [{ id: 'a', label: 'أ' }, { id: 'b', label: 'ب' }], offers = [{ id: 'o', label: 'عرض', discountPercent: 20 }];
  const ads = [event('campaign_impression', 1, { campaignId: 'a', currency: 'IQD' }), event('campaign_click', 2, { campaignId: 'a', currency: 'IQD', cost: 100 }), event('campaign_impression', 3, { campaignId: 'b', currency: 'IQD' }), event('campaign_click', 4, { campaignId: 'b', currency: 'IQD', cost: 200 }), event('offer_impression', 5, { offerId: 'o' }), event('offer_click', 6, { offerId: 'o' }), event('campaign_click', 20, { campaignId: 'a', currency: 'IQD', cost: 100 })];
  const report = D.report(dataset([...ads, ...journey({ booking: { offerId: 'o', discountPercent: 20 } })], [session()], { campaigns, offers }), filters);
  assert.equal(report.campaigns.find(row => row.key === 'a:IQD').confirmed, 0);
  assert.equal(report.campaigns.find(row => row.key === 'b:IQD').confirmed, 1);
  assert.equal(report.campaigns.find(row => row.key === 'b:IQD').revenue, 100000);
  assert.equal(report.offers[0].confirmed, 1);
  assert.equal(report.offers[0].conversion, 100);
  assert.equal(D.report(dataset([...ads, ...journey({ booking: { offerId: 'o', discountPercent: 10 } })], [session()], { campaigns, offers }), filters).offers[0].confirmed, 0, 'mismatching discount snapshot is not attributed to this offer');
  assert.equal(D.report(dataset([...ads, ...journey()], [session()], { campaigns, offers }), filters).offers[0].confirmed, 0, 'a click alone does not prove offer application');
  const impossible = ads.map(e => ({ ...e, sessionId: 'other' }));
  const isolated = D.report(dataset([...impossible, ...journey()], [session(), session('other')], { campaigns, offers }), filters);
  assert.equal(isolated.campaigns.reduce((sum, row) => sum + row.confirmed, 0), 0);
  assert.equal(isolated.offers[0].confirmed, 0);
});

test('campaign spend/revenue stay in separate USD and IQD rows with no conversion or double counting', () => {
  const campaigns = [{ id: 'a', label: 'حملة' }];
  const iq = journey(), us = journey({ search: { id: 'us-search', sessionId: 's2', currency: 'USD' }, view: { id: 'uv', sessionId: 's2' }, checkout: { id: 'uc', sessionId: 's2' }, request: { id: 'ur', sessionId: 's2', requestId: 'r2' }, booking: { id: 'ub', sessionId: 's2', bookingId: 'b2', amount: 250 } });
  const ads = ['s1', 's2'].flatMap((id, i) => [event('campaign_impression', 1, { id: id + '-impression', sessionId: id, campaignId: 'a', currency: i ? 'USD' : 'IQD' }), event('campaign_click', 2, { id: id + '-click', sessionId: id, campaignId: 'a', currency: i ? 'USD' : 'IQD', cost: i ? 0.5 : 500 })]);
  const report = D.report(dataset([...ads, ...iq, ...us], [session(), session('s2', { service: 'package' })], { campaigns }), filters);
  const usd = report.campaigns.find(row => row.currency === 'USD'), iqd = report.campaigns.find(row => row.currency === 'IQD');
  assert.equal(usd.revenue, 250); assert.equal(usd.cost, 0.5); assert.equal(usd.roas, 500);
  assert.equal(iqd.revenue, 100000); assert.equal(iqd.cost, 500); assert.equal(iqd.roas, 200);
  assert.equal(usd.confirmed + iqd.confirmed, report.summary.confirmed);
  const packages = D.report(dataset([...ads, ...iq, ...us], [session(), session('s2', { service: 'package', platform: 'ios' })], { campaigns }), { ...filters, service: 'package', platform: 'ios' });
  assert.equal(packages.campaigns.length, 1);
  assert.equal(packages.campaigns[0].currency, 'USD');
  assert.equal(packages.campaigns[0].cost, 0.5, 'no proportional allocation of spend from other service/platform');
});

test('empty periods stay finite with null rates and validation rejects invalid filters without mutating data', () => {
  const data = dataset(journey()), before = plain(data);
  const report = D.report(data, { startDate: '2027-01-01', endDate: '2027-01-02' });
  assert.equal(report.summary.searches, 0); assert.equal(report.summary.conversion, null); assert.equal(report.summary.zeroRate, null);
  assert.ok(report.conversionServices.every(row => row.conversion === null));
  assert.equal(JSON.stringify(report).includes('NaN'), false);
  for (const change of [{ startDate: '2026-02-30' }, { startDate: '2026-12-01' }, { platform: 'web' }, { service: 'bad' }]) assert.throws(() => D.report(data, { ...filters, ...change }));
  assert.deepEqual(plain(data), before);
});
