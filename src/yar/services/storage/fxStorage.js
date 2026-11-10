// Browser-local storage for the administrator's daily USD→IQD rate.
import { assertCan, actor } from '../../auth/access';
import { ensureRateReminder } from '../../accounts/repository';
import * as F from '../fxRate';

const listeners = new Set();
const emit = () => listeners.forEach(l => { try { l(); } catch (e) { console.error(e); } });
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if (e.key === F.FX_KEY) emit(); });

function read() {
  try { return F.hydrateHistory(JSON.parse(localStorage.getItem(F.FX_KEY) || 'null')); } catch { return []; }
}

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
    return next[next.length - 1];
  },
  /** Creates (once per day) the administrator reminder when today's rate is missing. */
  checkReminder() {
    const date = F.baghdadDate();
    try { ensureRateReminder(date, F.needsDailyUpdate(read(), date)); } catch { /* signed out */ }
  },
};

export default fxStorage;
