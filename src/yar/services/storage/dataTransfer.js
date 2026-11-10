// JSON export / import of the browser-persisted demo data with validation and duplicate protection.
import { assertCan } from '../../auth/access';

export const FORMAT = 'yar-admin-demo-export';
const EXCLUDED = new Set(['YAR_ADMIN_SESSION_V1', 'YAR_ADMIN_LANG', 'YAR_ADMIN_THEME', 'YAR_ADMIN_ACCOUNTS_V2', 'YAR_ADMIN_REMEMBER_USERNAME']);
const isDataKey = k => /^YAR_ADMIN_[A-Z0-9_]+$/.test(k) && !EXCLUDED.has(k) && !k.includes('__BACKUP_');

export function exportDemoData() {
  assertCan('data.transfer');
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isDataKey(k)) data[k] = localStorage.getItem(k);
  }
  return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), data };
}

export function planImport(file) {
  assertCan('data.transfer');
  if (!file || file.format !== FORMAT || file.version !== 1 || typeof file.data !== 'object' || !file.data) {
    throw new Error('الملف ليس تصديرًا صالحًا من لوحة YAR.');
  }
  const items = [];
  for (const [key, raw] of Object.entries(file.data)) {
    if (!isDataKey(key) || typeof raw !== 'string') throw new Error(`مفتاح غير مدعوم في الملف: ${key}`);
    try { JSON.parse(raw); } catch { throw new Error(`بيانات تالفة في المفتاح: ${key}`); }
    const current = localStorage.getItem(key);
    items.push({ key, raw, state: current === null ? 'new' : current === raw ? 'same' : 'conflict' });
  }
  if (!items.length) throw new Error('الملف لا يحتوي بيانات.');
  return { items };
}

export function applyImport(plan, { replace = false } = {}) {
  assertCan('data.transfer');
  const stamp = Date.now();
  let n = 0;
  for (const item of plan.items) {
    if (item.state === 'same') continue;
    if (item.state === 'conflict') {
      if (!replace) continue;
      localStorage.setItem(`${item.key}__BACKUP_${stamp}`, localStorage.getItem(item.key));
    }
    localStorage.setItem(item.key, item.raw);
    n++;
  }
  return n;
}
