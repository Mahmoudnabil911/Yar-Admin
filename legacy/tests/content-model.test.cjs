const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'dist', 'content-model.js'), 'utf8');
function load(date = '2026-11-06T10:00:00Z') {
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [date])); } }
  const sandbox = { window: {}, Date: Clock, Intl, URL };
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.YARContentModel, sandbox.window.YARContentModel);
  return sandbox.YARContentModel;
}
const model = load();
const plain = value => JSON.parse(JSON.stringify(value));
const context = { packages: [{ id: 'package-mashhad', status: 'published' }, { id: 'package-draft', status: 'draft' }] };
const banner = changes => ({ title: 'مشهد', body: 'برنامج تجريبي', image: 'assets/content/mashhad.jpg', imageAlt: 'مشهد', buttonLabel: 'عرض الباقة', target: 'package', packageId: 'package-mashhad', nights: '5', startDate: '', endDate: '', ...changes });
const record = (id, kind, order, payload) => ({ id, kind, order, archived: false, draft: null, published: payload });

test('seed has complete published examples and one draft and one future notification', () => {
  assert.equal(model.today(), '2026-11-06');
  assert.equal(load('2026-11-05T21:00:00Z').today(), '2026-11-06');
  for (const row of model.seed) assert.equal(model.validate(row.kind, row.draft || row.published, context), '', row.id);
  assert.equal(model.seed.filter(row => row.kind === 'banners').length, 3);
  assert.equal(model.seed.filter(row => row.kind === 'destinations').length, 3);
  assert.equal(model.seed.filter(row => row.kind === 'faqs').length, 4);
  assert.equal(model.seed.find(row => row.kind === 'home').published.title, 'DISCOVER IRAN');
  assert.equal(model.seed.find(row => row.kind === 'support').published.whatsapp, '9647831400500');
  assert.equal(model.seed.find(row => row.kind === 'support').published.hours, '');
  assert.equal(model.stateOf(model.seed.find(row => row.id === 'notification-draft')), 'draft');
  assert.equal(model.stateOf(model.seed.find(row => row.id === 'notification-scheduled')), 'scheduled');
});

test('saving an incomplete draft never changes or leaks the independent published snapshot', () => {
  const original = [record('b1', 'banners', 1, banner())];
  const before = plain(original);
  const changed = model.saveDraft(original, 'banners', 'b1', { title: 'عنوان جديد' }, context);
  assert.deepEqual(plain(original), before);
  assert.equal(model.stateOf(changed[0]), 'changes');
  assert.equal(changed[0].draft.title, 'عنوان جديد');
  assert.equal(changed[0].published.title, 'مشهد');
  assert.equal(model.live(changed, 'banners')[0].payload.title, 'مشهد');
  assert.equal(model.live(changed, 'banners')[0].draft, null);
  changed[0].draft.title = 'تغيير خارجي';
  changed[0].published.body = 'تغيير خارجي';
  assert.deepEqual(plain(original), before);
  const output = model.live(original, 'banners');
  output[0].payload.title = 'معدّل';
  assert.equal(original[0].published.title, 'مشهد');
  assert.throws(() => model.publish(changed, 'b1', context));
});

test('only explicit publish replaces the live snapshot and clears pending changes', () => {
  const original = [record('b1', 'banners', 1, banner())];
  const draft = model.saveDraft(original, 'banners', 'b1', banner({ title: 'الإصدار الثاني' }), context);
  const published = model.publish(draft, 'b1', context);
  assert.equal(published[0].draft, null);
  assert.equal(published[0].published.title, 'الإصدار الثاني');
  assert.equal(model.live(published, 'banners')[0].payload.title, 'الإصدار الثاني');
  assert.equal(draft[0].published.title, 'مشهد');
  assert.equal(draft[0].draft.title, 'الإصدار الثاني');
  assert.throws(() => model.publish(published, 'b1', context));
});

test('archive retains both versions and restore requires a fresh explicit publish', () => {
  const original = [record('b1', 'banners', 1, banner())];
  const draft = model.saveDraft(original, 'banners', 'b1', banner({ title: 'المسودة الأخيرة' }), context);
  const archived = model.archive(draft, 'b1');
  assert.equal(model.stateOf(archived[0]), 'archived');
  assert.equal(model.live(archived, 'banners').length, 0);
  assert.equal(archived[0].published.title, 'مشهد');
  assert.equal(archived[0].draft.title, 'المسودة الأخيرة');
  assert.throws(() => model.publish(archived, 'b1', context));
  const restored = model.restore(archived, 'b1');
  assert.equal(model.stateOf(restored[0]), 'draft');
  assert.equal(restored[0].published, null);
  assert.equal(restored[0].draft.title, 'المسودة الأخيرة');
  assert.equal(model.live(restored, 'banners').length, 0);
  assert.equal(model.publish(restored, 'b1', context)[0].published.title, 'المسودة الأخيرة');
  assert.equal(archived[0].archived, true);
  const noDraft = model.restore(model.archive(original, 'b1'), 'b1');
  assert.equal(noDraft[0].draft.title, 'مشهد');
});

test('discarding changes preserves live content, while deleting a draft-only item removes that item', () => {
  const original = [record('b1', 'banners', 1, banner())];
  const changed = model.saveDraft(original, 'banners', 'b1', banner({ title: 'مسودة' }));
  const discarded = model.discardDraft(changed, 'b1');
  assert.equal(discarded[0].draft, null);
  assert.equal(discarded[0].published.title, 'مشهد');
  const added = model.saveDraft(original, 'faqs', null, { question: 'سؤال غير مكتمل' });
  assert.equal(added.length, 2);
  assert.equal(model.discardDraft(added, added[1].id).length, 1);
});

test('home and support remain singletons and cannot be archived', () => {
  for (const kind of ['home', 'support']) {
    const singleton = model.seed.find(row => row.kind === kind);
    assert.throws(() => model.archive(model.seed, singleton.id));
    assert.throws(() => model.saveDraft(model.seed, kind, null, {}));
  }
  const empty = model.saveDraft([], 'home', null, { title: 'الرئيسية' });
  assert.equal(empty[0].id, 'home-id');
  assert.throws(() => model.discardDraft(empty, 'home-id'));
});

test('move swaps order within active items of one kind without touching archived or unrelated content', () => {
  const rows = [record('a', 'banners', 1, banner()), record('b', 'banners', 2, banner()), { ...record('c', 'banners', 3, banner()), archived: true }, record('d', 'faqs', 1, { category: 'general', question: 'س', answer: 'ج' })];
  const moved = model.move(rows, 'b', -1);
  assert.deepEqual(plain(model.live(moved, 'banners').map(row => row.id)), ['b', 'a']);
  assert.equal(moved.find(row => row.id === 'c').order, 3);
  assert.equal(moved.find(row => row.id === 'd').order, 1);
  assert.deepEqual(plain(model.move(rows, 'a', -1)), plain(rows));
  assert.deepEqual(plain(rows.map(row => row.order)), [1, 2, 3, 1]);
  assert.throws(() => model.move(rows, 'c', -1));
  const tied = [{ ...rows[0] }, { ...rows[1], order: 1 }];
  assert.deepEqual(plain(model.live(model.move(tied, 'b', -1), 'banners').map(row => row.id)), ['b', 'a']);
});

test('published schedules are inclusive and draft schedule changes never change live visibility', () => {
  const rows = [record('b1', 'banners', 1, banner({ startDate: '2026-11-06', endDate: '2026-11-08' }))];
  assert.equal(model.stateOf(rows[0], '2026-11-05'), 'scheduled');
  assert.equal(model.stateOf(rows[0], '2026-11-06'), 'published');
  assert.equal(model.stateOf(rows[0], '2026-11-08'), 'published');
  assert.equal(model.stateOf(rows[0], '2026-11-09'), 'expired');
  assert.equal(model.live(rows, 'banners', '2026-11-06').length, 1);
  assert.equal(model.live(rows, 'banners', '2026-11-08').length, 1);
  assert.equal(model.live(rows, 'banners', '2026-11-09').length, 0);
  const changed = model.saveDraft(rows, 'banners', 'b1', banner({ startDate: '2026-11-10' }));
  assert.equal(model.stateOf(changed[0], '2026-11-05'), 'changes');
  assert.equal(model.live(changed, 'banners', '2026-11-06').length, 1);
  for (const dates of [{ startDate: '2026-02-30' }, { endDate: '2026-02-29' }, { startDate: '2026-11-08', endDate: '2026-11-06' }]) assert.notEqual(model.validate('banners', banner(dates), context), '');
});

test('package references are checked when publishing, while incomplete drafts and hydration retain them', () => {
  const rows = model.saveDraft([], 'banners', null, banner({ packageId: 'package-draft' }), context);
  assert.equal(rows[0].draft.packageId, 'package-draft');
  assert.throws(() => model.publish(rows, rows[0].id, context));
  assert.equal(model.sanitizeRecords(rows)[0].draft.packageId, 'package-draft');
  assert.notEqual(model.validate('banners', banner({ nights: '3' }), context), '');
  assert.equal(model.validate('banners', banner({ target: 'packages', packageId: '', nights: '' }), context), '');
});

test('image validation allows only approved exact local paths or credential-free HTTPS URLs', () => {
  for (const image of ['assets/content/mashhad.jpg', 'assets/content/tehran.jpg', 'assets/content/shiraz.jpg', 'assets/content/north.jpg', 'assets/content/masuleh.jpg', 'https://images.example.invalid/hero.jpg']) assert.equal(model.validate('banners', banner({ image }), context), '', image);
  for (const image of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'http://example.invalid/image.jpg', '//example.invalid/image.jpg', 'https://user:pass@example.invalid/image.jpg', 'assets/content/../secret.jpg', '../assets/content/mashhad.jpg', 'assets/content/mashhad.jpg?next=x', 'https://']) assert.notEqual(model.validate('banners', banner({ image }), context), '', image);
});

test('normalization keeps schema strings, simple text and normalized phone numbers without executing HTML', () => {
  const payload = model.normalizePayload('home', { title: '<img onerror=alert(1)>', tagline: 123, onclick: 'alert(1)' });
  assert.deepEqual(plain(payload), { title: '<img onerror=alert(1)>', tagline: '123' });
  const support = model.normalizePayload('support', { title: 'مساعدة', whatsapp: '+964 783 140 0500', phone: '+964 783 140 0500' });
  assert.equal(support.whatsapp, '9647831400500');
  assert.equal(support.phone, '9647831400500');
  assert.equal(model.validate('support', support), '');
  assert.notEqual(model.validate('support', { ...support, whatsapp: 'letters9647831400500' }), '');
  assert.notEqual(model.validate('home', { title: 'x'.repeat(81), tagline: 'تجربة' }), '');
  assert.notEqual(model.validate('faqs', { category: 'general', question: 'سؤال', answer: 'x'.repeat(2001) }), '');
});

test('safe hydration deduplicates IDs and singletons while preserving pending drafts and unavailable links', () => {
  const home = model.seed.find(row => row.kind === 'home');
  const rows = [home, { ...home, id: 'another-home' }, record('b1', 'banners', 1, banner({ packageId: 'missing' })), { ...record('b2', 'banners', 2, banner()), draft: { title: 'مسودة غير مكتملة' } }, record('b1', 'banners', 7, banner())];
  const hydrated = model.sanitizeRecords(rows);
  assert.equal(hydrated.length, 3);
  assert.equal(hydrated[0].id, 'home-id');
  assert.equal(hydrated.find(row => row.id === 'b1').published.packageId, 'missing');
  assert.equal(hydrated.find(row => row.id === 'b2').draft.title, 'مسودة غير مكتملة');
  hydrated[0].published.title = 'معدّل';
  assert.equal(home.published.title, 'DISCOVER IRAN');
  assert.throws(() => model.sanitizeRecords({ records: [] }));
  assert.throws(() => model.sanitizeRecords([{ id: 'b', kind: 'banners', draft: 'not-a-payload' }]));
});
