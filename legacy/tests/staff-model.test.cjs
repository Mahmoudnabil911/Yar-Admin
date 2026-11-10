const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'staff-model.js'), 'utf8');
const sandbox = { window: {}, Date };
vm.runInNewContext(source, sandbox);
const M = sandbox.YARStaffModel;
const plain = value => JSON.parse(JSON.stringify(value));
const person = changes => ({ id: 'staff-new', name: 'مها', role: 'bookings', status: 'active', permissions: ['bookings'], ...changes });

test('seed includes protected owner and the four legacy assignees with safe permissions', () => {
  assert.equal(M, sandbox.window.YARStaffModel);
  assert.deepEqual(plain(M.seed.slice(1).map(row => row.name)), ['أحمد', 'نور', 'زينب', 'علي']);
  assert.equal(M.sanitizeRecords(M.seed).length, 5);
  assert.ok(M.seed.every(row => row.permissions.length));
});

test('validates roles, statuses, names and explicit permission allowlist', () => {
  for (const change of [{ role: 'root' }, { status: 'paused' }, { name: '' }, { name: 'x'.repeat(81) }, { permissions: [] }, { permissions: ['unknown'] }, { id: '<script>' }]) {
    assert.notEqual(M.validate(person(change), M.seed), '');
  }
  assert.equal(M.validate(person({ permissions: ['bookings', 'unknown', 'bookings'] }), M.seed), '');
  assert.notEqual(M.validate(person({ name: 'احمد' }), M.seed), '');
  assert.notEqual(M.validate(person({ role: 'admin', permissions: ['bookings'] }), M.seed), '');
});

test('owner cannot be disabled, demoted, cloned or lose a permission', () => {
  const owner = M.seed.find(row => row.id === M.ownerId);
  for (const change of [{ status: 'inactive' }, { role: 'admin' }, { permissions: ['staff'] }]) {
    assert.throws(() => M.upsert(M.seed, { ...owner, ...change }), /المالك/);
  }
  assert.throws(() => M.upsert(M.seed, person({ role: 'owner' })), /المالك/);
});

test('last active admin cannot be disabled or demoted until another active admin exists', () => {
  assert.throws(() => M.setStatus(M.seed, 'staff-ahmed', 'inactive'), /آخر مدير/);
  const ahmed = M.seed.find(row => row.id === 'staff-ahmed');
  assert.throws(() => M.upsert(M.seed, { ...ahmed, role: 'bookings', permissions: ['bookings'] }), /آخر مدير/);
  const withAdmin = M.upsert(M.seed, person({ role: 'admin', permissions: ['staff', 'bookings'] }));
  const changed = M.setStatus(withAdmin, 'staff-ahmed', 'inactive');
  assert.equal(changed.find(row => row.id === 'staff-ahmed').status, 'inactive');
  assert.equal(M.seed.find(row => row.id === 'staff-ahmed').status, 'active');
});

test('upserts, status changes and serialized outputs never mutate inputs', () => {
  const before = plain(M.seed);
  const rows = M.upsert(M.seed, person());
  rows[0].permissions.pop();
  rows[1].name = 'changed';
  assert.deepEqual(plain(M.seed), before);
  const inactive = M.setStatus(M.seed, 'staff-noor', 'inactive');
  assert.equal(inactive.find(row => row.id === 'staff-noor').status, 'inactive');
  assert.equal(M.seed.find(row => row.id === 'staff-noor').status, 'active');
});

test('versioned payload restores staff and action history while stripping unrelated fields', () => {
  const log = { id: 'log-1', staffId: 'staff-noor', action: 'edit', at: '2026-11-06T10:00:00Z', detail: 'تحديث الدور', secret: 'drop' };
  const saved = M.payload(M.seed.map(row => ({ ...row, password: 'drop', email: 'drop' })), [log]);
  assert.equal(saved.version, 1);
  assert.equal('password' in saved.staff[0], false);
  assert.equal('email' in saved.staff[0], false);
  assert.equal('secret' in saved.logs[0], false);
  assert.deepEqual(plain(M.restore(JSON.parse(JSON.stringify(saved)))), plain(saved));
  assert.throws(() => M.restore({ ...saved, version: 2 }));
  assert.throws(() => M.payload(M.seed, [{ ...log, at: 'invalid' }]));
});

test('hydration rejects duplicate IDs, missing owner and unsafe admin state', () => {
  assert.throws(() => M.sanitizeRecords([...M.seed, M.seed[0]]), /تتكرر/);
  assert.throws(() => M.sanitizeRecords(M.seed.filter(row => row.id !== M.ownerId)), /المالك/);
  assert.throws(() => M.sanitizeRecords(M.seed.map(row => row.role === 'admin' ? { ...row, status: 'inactive' } : row)), /آخر مدير/);
  assert.throws(() => M.sanitizeRecords([]));
});
