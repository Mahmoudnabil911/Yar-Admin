// Browser-local storage for the administrator's daily USD→IQD rate + Odoo 18 sync.
import { assertCan, actor } from '../../auth/access';
import { ensureRateReminder } from '../../accounts/repository';
import * as F from '../fxRate';
import { fxApi } from '../api/fxApi';

const listeners = new Set();
const emit = () => listeners.forEach(l => { try { l(); } catch (e) { console.error(e); } });
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === F.FX_KEY) emit(); });

function read() {
  try { return F.hydrateHistory(JSON.parse(localStorage.getItem(F.FX_KEY) || 'null')); } catch { return []; }
}

let isSyncing = false;
let lastSyncedAt = 0;

export const fxStorage = {
  history() { return read(); },
  today() { return F.baghdadDate(); },
  todayRate() { return F.rateFor(read(), F.baghdadDate()); },
  latest() { return F.latestRate(read()); },
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  setTodayRate(rate, note = '') {
    assertCan('fx.manage');
    const a = actor();
    const date = F.baghdadDate();
    const next = F.addRate(read(), { rate, date, setById: a.staffId, setByName: a.staffName, note });
    localStorage.setItem(F.FX_KEY, JSON.stringify({ version: 1, history: next }));
    ensureRateReminder(date, false);
    emit();
    // Asynchronously sync to Odoo 18 backend (API 112)
    fxApi.setRate(Number(rate)).catch(() => {});
    return next[next.length - 1];
  },
  /** Creates (once per day) the administrator reminder when today's rate is missing. */
  checkReminder() {
    const date = F.baghdadDate();
    try { ensureRateReminder(date, F.needsDailyUpdate(read(), date)); } catch { /* signed out */ }
  },
  /** Synchronizes daily FX rates with Odoo 18 (API 111) once per session / cooldown */
  async syncFromBackend() {
    if (isSyncing || (Date.now() - lastSyncedAt < 300000)) return;
    isSyncing = true;
    try {
      const data = await fxApi.getRates();
      lastSyncedAt = Date.now();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        let current = read();
        let changed = false;
        for (const item of data.items) {
          if (!current.some(c => c.date === item.date)) {
            const intRate = Math.round(Number(item.rate_iqd_per_usd) || 0);
            if (intRate >= F.RATE_MIN && intRate <= F.RATE_MAX) {
              current = F.addRate(current, {
                rate: intRate,
                date: item.date,
                setById: String(item.set_by || ''),
                note: item.note || '',
              });
              changed = true;
            }
          }
        }
        if (changed) {
          localStorage.setItem(F.FX_KEY, JSON.stringify({ version: 1, history: current }));
          emit();
        }
      }
    } catch {
      // Offline, rate limited, or mock session
    } finally {
      isSyncing = false;
    }
  },
};

export default fxStorage;
