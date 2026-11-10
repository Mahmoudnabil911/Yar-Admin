// Daily USD→IQD exchange rate set by the administrator (pure, SSR-safe helpers).
// Supplier money is USD; everything customer-facing is IQD. A booking freezes the
// rate it was priced with, so later rate changes never recompute old bookings.
export const FX_KEY = 'YAR_ADMIN_FX_V1';
export const RATE_MIN = 100;
export const RATE_MAX = 100000;

export function baghdadDate(date = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(date);
  const d = Object.fromEntries(p.map(v => [v.type, v.value]));
  return `${d.year}-${d.month}-${d.day}`;
}

/** IQD per 1 USD; whole dinars only. */
export function normalizeRate(value) {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[,\s]/g, ''));
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < RATE_MIN || n > RATE_MAX) {
    throw new Error(`أدخل سعر تحويل صحيحًا بالدينار لكل 1 دولار (${RATE_MIN.toLocaleString('en-US')} – ${RATE_MAX.toLocaleString('en-US')}).`);
  }
  return n;
}

const validEntry = e => e && typeof e.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '') && Number.isInteger(e.rate) && e.rate >= RATE_MIN && e.rate <= RATE_MAX;

export function hydrateHistory(input) {
  const rows = Array.isArray(input) ? input : Array.isArray(input?.history) ? input.history : [];
  return rows.filter(validEntry).map(e => ({ ...e }));
}

/** Latest entry recorded for a given Baghdad date, or null. */
export function rateFor(history, date) {
  const rows = hydrateHistory(history).filter(e => e.date === date);
  return rows.length ? rows[rows.length - 1] : null;
}

export function latestRate(history) {
  const rows = hydrateHistory(history);
  return rows.length ? rows.slice().sort((a, b) => (a.date === b.date ? String(a.setAt).localeCompare(String(b.setAt)) : a.date.localeCompare(b.date))).pop() : null;
}

export function needsDailyUpdate(history, date) {
  return !rateFor(history, date);
}

export function addRate(history, { rate, date, setAt, setById = '', setByName = '', note = '' }) {
  const value = normalizeRate(rate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('تاريخ سعر التحويل غير صالح.');
  const rows = hydrateHistory(history);
  const entry = { id: `fx-${date}-${rows.length + 1}`, date, rate: value, setAt: setAt || new Date().toISOString(), setById, setByName, note: String(note || '').trim().slice(0, 200) };
  return [...rows, entry];
}

/** USD (2 decimals) → whole IQD. */
export function usdToIqd(usd, rate) {
  const cents = Math.round(Number(usd) * 100);
  if (!Number.isFinite(cents)) throw new Error('أدخل مبلغًا صالحًا بالدولار.');
  return Math.round((cents * normalizeRate(rate)) / 100);
}

/** IQD → USD rounded to cents. */
export function iqdToUsd(iqd, rate) {
  const n = Number(iqd);
  if (!Number.isFinite(n)) throw new Error('أدخل مبلغًا صالحًا بالدينار.');
  return Math.round((n / normalizeRate(rate)) * 100) / 100;
}
