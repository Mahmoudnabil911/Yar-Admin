const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'audience-data.js'), 'utf8');
function load(date) {
  const Clock = date ? class extends Date { constructor(...args) { super(...(args.length ? args : [date])); } } : Date;
  const sandbox = { window: {}, Date: Clock, Intl };
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.YARAudienceData, sandbox.window.YARAudienceData);
  return sandbox.YARAudienceData;
}
const engine = load();
const plain = value => JSON.parse(JSON.stringify(value));
const user = overrides => ({ id: 'u1', name: 'أحمد النور', phone: '07XX XXX XX01', city: 'بغداد', createdAt: '2026-10-01', platform: 'android', source: 'direct', status: 'active', ...overrides });
const session = overrides => ({ id: 's1', visitorId: 'browser-a', userId: null, date: '2026-11-06', platform: 'android', source: 'direct', service: 'flight', stage: 1, durationSec: 60, requestId: null, requestStatus: null, ...overrides });
const period = { startDate: '2026-11-05', endDate: '2026-11-06', platform: 'all' };

test('demo data is deterministic, masked, and spread across 30 Baghdad dates after signup', () => {
  const data = engine.createDemo('2026-11-06');
  assert.deepEqual(plain(data), plain(engine.createDemo('2026-11-06')));
  assert.equal(data.users.length, 24);
  assert.equal(data.sessions.length, 180);
  assert.equal(new Set(data.sessions.map(row => row.date)).size, 30);
  assert.equal(data.sessions[0].date, '2026-10-08');
  assert.equal(data.sessions.at(-1).date, '2026-11-06');
  const users = new Map(data.users.map(row => [row.id, row]));
  for (const row of data.users) {
    assert.match(row.phone, /^07XX/);
    assert.equal('email' in row, false);
  }
  for (const row of data.sessions) {
    if (row.userId) assert.ok(row.date >= users.get(row.userId).createdAt);
    assert.equal(row.stage === 5, row.requestId !== null);
    assert.equal(row.stage === 5, row.requestStatus !== null);
  }
  const signedInBrowsers = data.sessions.filter(row => row.userId).map(row => row.visitorId);
  assert.ok(data.sessions.some(row => !row.userId && signedInBrowsers.includes(row.visitorId)));
  for (const status of ['pending', 'confirmed', 'cancelled']) assert.ok(data.sessions.some(row => row.requestStatus === status));
  for (const browser of new Set(data.sessions.map(row => row.visitorId))) {
    assert.equal(new Set(data.sessions.filter(row => row.visitorId === browser).map(row => row.platform)).size, 1);
  }
});

test('Baghdad today and date shifts cross UTC midnight, month and leap-day boundaries', () => {
  assert.equal(load('2026-11-05T20:59:59Z').today(), '2026-11-05');
  assert.equal(load('2026-11-05T21:00:00Z').today(), '2026-11-06');
  assert.equal(engine.shiftDate('2028-03-01', -1), '2028-02-29');
  assert.equal(engine.shiftDate('2026-01-01', -1), '2025-12-31');
  assert.throws(() => engine.shiftDate('2026-02-30', 1));
  assert.throws(() => engine.createDemo('2026-1-01'));
});

test('empty periods keep zero-filled dates and return null rates without NaN', () => {
  const result = engine.report({ users: [], sessions: [] }, period);
  assert.equal(result.sessions, 0);
  assert.equal(result.newAccounts, 0);
  assert.equal(result.activeAccounts, 0);
  assert.equal(result.requestRate, null);
  assert.equal(result.avgDurationSec, 0);
  assert.deepEqual(plain(result.trend), [
    { date: '2026-11-05', sessions: 0, newAccounts: 0, requests: 0 },
    { date: '2026-11-06', sessions: 0, newAccounts: 0, requests: 0 },
  ]);
  for (const row of result.funnel) {
    assert.equal(row.count, 0);
    assert.equal(row.previousRate, null);
    assert.equal(row.overallRate, null);
  }
});

test('inclusive dates and platform filters apply to registrations, sessions and trends', () => {
  const data = {
    users: [user({ createdAt: '2026-11-05' }), user({ id: 'u2', createdAt: '2026-11-06', platform: 'ios' }), user({ id: 'u3', createdAt: '2026-11-07' })],
    sessions: [session({ id: 'a', date: '2026-11-04' }), session({ id: 'b', date: '2026-11-05' }), session({ id: 'c', date: '2026-11-06', platform: 'ios' }), session({ id: 'd', date: '2026-11-07' })],
  };
  const all = engine.report(data, period);
  assert.equal(all.sessions, 2);
  assert.equal(all.newAccounts, 2);
  const ios = engine.report(data, { ...period, platform: 'ios' });
  assert.equal(ios.sessions, 1);
  assert.equal(ios.newAccounts, 1);
  assert.deepEqual(plain(ios.trend.map(row => row.sessions)), [0, 1]);
  assert.throws(() => engine.report(data, { startDate: '2026-11-07', endDate: '2026-11-06' }));
});

test('distinct session IDs drive duration, requests, breakdowns and a nested same-session funnel', () => {
  const s1 = session({ id: 'first', stage: 1, durationSec: 30 });
  const s2 = session({ id: 'second', stage: 3, durationSec: 90, platform: 'ios', source: 'campaign', service: 'hotel' });
  const s3 = session({ id: 'third', stage: 5, durationSec: 180, requestId: 'r1', requestStatus: 'pending', source: 'referral', service: 'package' });
  const data = { users: [], sessions: [s1, s2, s3, { ...s3 }] };
  const result = engine.report(data, period);
  assert.equal(result.sessions, 3);
  assert.equal(result.avgDurationSec, 100);
  assert.equal(result.requests, 1);
  assert.ok(Math.abs(result.requestRate - 100 / 3) < 1e-10);
  assert.deepEqual(plain(result.funnel.map(row => row.count)), [3, 2, 2, 1, 1]);
  assert.equal(result.funnel[0].previousRate, null);
  assert.equal(result.funnel[1].previousRate, 2 / 3 * 100);
  assert.equal(result.funnel[4].previousRate, 100);
  for (const breakdown of [result.sources, result.platforms, result.services]) {
    assert.equal(breakdown.reduce((sum, row) => sum + row.sessions, 0), 3);
    assert.equal(breakdown.reduce((sum, row) => sum + row.requests, 0), 1);
  }
  assert.equal(result.trend.reduce((sum, row) => sum + row.sessions, 0), 3);
});

test('anonymous browsers remain devices and earlier anonymous visits are not retrospectively accounts', () => {
  const data = {
    users: [user()],
    sessions: [
      session({ id: 'before', date: '2026-11-04' }),
      session({ id: 'anon-first', date: '2026-11-05' }),
      session({ id: 'anon-again', date: '2026-11-06' }),
      session({ id: 'signed-in', userId: 'u1', date: '2026-11-06' }),
      session({ id: 'other-device', visitorId: 'browser-b', date: '2026-11-06' }),
    ],
  };
  const result = engine.report(data, period);
  assert.equal(result.newAccounts, 0);
  assert.equal(result.activeAccounts, 1);
  assert.equal(result.sessions, 4);
  assert.equal(result.anonymousSessions, 3);
  assert.equal(result.identifiedSessions, 1);
  assert.equal(result.anonymousDevices, 2);
  assert.equal(result.returningAnonymousDevices, 1);
  assert.equal(engine.userDetail(data, 'u1').sessions.length, 1);
});

test('returning devices require history before the period, matching the platform filter', () => {
  const data = { users: [user()], sessions: [
    session({ id: 'prior-android', date: '2026-11-04', platform: 'android', userId: 'u1' }),
    session({ id: 'prior-ios', date: '2026-11-04', platform: 'ios', visitorId: 'browser-ios' }),
    session({ id: 'a', date: '2026-11-05', platform: 'ios' }),
    session({ id: 'b', date: '2026-11-06', platform: 'ios', visitorId: 'browser-ios' }),
    session({ id: 'c', date: '2026-11-06', platform: 'ios', visitorId: 'only-within' }),
    session({ id: 'd', date: '2026-11-05', platform: 'ios', visitorId: 'only-within' }),
  ] };
  assert.equal(engine.report(data, period).returningAnonymousDevices, 2);
  assert.equal(engine.report(data, { ...period, platform: 'ios' }).returningAnonymousDevices, 1);
});

test('new registrations and active registered accounts measure different things', () => {
  const data = {
    users: [user(), user({ id: 'new-no-activity', createdAt: '2026-11-06' })],
    sessions: [session({ userId: 'u1' }), session({ id: 'unknown', userId: 'missing-profile' })],
  };
  const result = engine.report(data, period);
  assert.equal(result.newAccounts, 1);
  assert.equal(result.activeAccounts, 1);
  assert.equal(result.identifiedSessions, 2);
  assert.equal(engine.listUsers(data).length, 2);
});

test('request submissions include pending and cancelled requests without claiming confirmed bookings', () => {
  const data = { users: [user()], sessions: ['pending', 'confirmed', 'cancelled'].map((requestStatus, index) => session({
    id: `request-${index}`, userId: 'u1', stage: 5, requestId: `r${index}`, requestStatus,
  })) };
  const result = engine.report(data, period);
  assert.equal(result.requests, 3);
  assert.equal(result.funnel.at(-1).count, 3);
  assert.equal(engine.listUsers(data)[0].requestCount, 3);
  assert.equal(engine.userDetail(data, 'u1').requests.length, 3);
});

test('user registration filters and status overrides retain all-time activity, and outputs are clones', () => {
  const data = { users: [user({ createdAt: '2026-11-05' }), user({ id: 'u2', city: 'النجف', platform: 'ios', createdAt: '2026-11-06' })], sessions: [
    session({ id: 'later', userId: 'u1', date: '2026-11-09', stage: 5, requestId: 'r1', requestStatus: 'pending' }),
    session({ id: 'earlier', userId: 'u1', date: '2026-11-05' }),
  ] };
  const rows = engine.listUsers(data, { query: 'احمد', city: 'بغداد', platform: 'android', status: 'suspended', startDate: '2026-11-05', endDate: '2026-11-05', statuses: { u1: 'suspended' } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'suspended');
  assert.equal(rows[0].lastActivity, '2026-11-09');
  assert.equal(rows[0].requestCount, 1);
  rows[0].name = 'changed';
  assert.equal(data.users[0].name, 'أحمد النور');
  assert.equal(data.users[0].status, 'active');
  assert.equal(engine.listUsers(data, { status: 'suspended' }, { u2: 'suspended' })[0].id, 'u2');
  const detail = engine.userDetail(data, 'u1');
  assert.equal(detail.sessions[0].id, 'later');
  detail.sessions[0].stage = 1;
  assert.equal(data.sessions[0].stage, 5);
  assert.equal(engine.userDetail(data, 'unknown'), null);
});
