import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Banknote, AlertTriangle, CheckCircle2, History } from 'lucide-react';
import { fxStorage } from '../../services/storage/fxStorage';
import { can } from '../../auth/access';
import { useWords } from '../../accounts/AccountUI';
import { Drawer } from '../../components/ui/Drawer';
import './fx.css';

let tick = 0;
const subscribe = l => {
  const off = fxStorage.subscribe(() => { tick++; l(); });
  // Re-evaluate at least every minute so a new Baghdad day is detected while the page stays open.
  const t = setInterval(() => { tick++; l(); }, 60000);
  return () => { off(); clearInterval(t); };
};
const snap = () => `${tick}|${fxStorage.today()}`;

/** Live view of today's administrator rate (null when missing). */
export function useFxRate() {
  const key = useSyncExternalStore(subscribe, snap, () => 'ssr');
  const [state, setState] = useState(() => ({ today: fxStorage.today(), rate: fxStorage.todayRate(), latest: fxStorage.latest() }));
  useEffect(() => {
    setState({ today: fxStorage.today(), rate: fxStorage.todayRate(), latest: fxStorage.latest() });
    fxStorage.checkReminder();
  }, [key]);
  return state;
}

const fmt = n => Number(n).toLocaleString('en-US');

export function FxRateForm({ onSaved }) {
  const t = useWords();
  const { rate, latest } = useFxRate();
  const [value, setValue] = useState(() => String(rate?.rate || latest?.rate || ''));
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const history = fxStorage.history().slice(-10).reverse();
  const admin = can('fx.manage');

  function submit(e) {
    e.preventDefault();
    setError('');
    try { fxStorage.setTodayRate(value, note); setNote(''); onSaved?.(); }
    catch (err) { setError(err.message); }
  }

  return (
    <div className="fx-panel" data-no-translate>
      <div className={`fx-status ${rate ? 'ok' : 'missing'}`}>
        {rate ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
        <div>
          <strong>{rate ? t('سعر اليوم معتمد', 'Today’s rate is set') : t('سعر اليوم غير مسجّل', 'Today’s rate is not set')}</strong>
          <p>{rate
            ? <bdi dir="ltr">1 $ = {fmt(rate.rate)} {t('د.ع', 'IQD')}</bdi>
            : latest ? <>{t('آخر سعر مسجّل', 'Last recorded rate')}: <bdi dir="ltr">1 $ = {fmt(latest.rate)} {t('د.ع', 'IQD')} · {latest.date}</bdi></> : t('لم يُسجَّل أي سعر بعد.', 'No rate recorded yet.')}</p>
        </div>
      </div>

      <p className="ops-note">{t('صافي المورّد وحساب المورّد وكشوفه بالدولار. سعر العميل وتحصيله وفواتيره بالدينار العراقي. كل حجز يحفظ سعر التحويل وقت إنشائه ولا يتغير لاحقًا.', 'Supplier net, supplier balances and statements are in USD. Customer prices, collection and invoices are in IQD. Each booking keeps the rate used when it was created.')}</p>

      {admin ? (
        <form className="ops-form-grid" onSubmit={submit}>
          {error && <div className="ops-form-error wide" role="alert">{error}</div>}
          <label className="ops-field wide">
            <span>{t('سعر اليوم: كم دينار مقابل 1 دولار', 'Today’s rate: IQD for 1 USD')}</span>
            <input inputMode="numeric" dir="ltr" value={value} onChange={e => setValue(e.target.value)} placeholder="1310" required aria-label={t('سعر التحويل', 'Exchange rate')} />
          </label>
          <label className="ops-field wide">
            <span>{t('ملاحظة (اختياري)', 'Note (optional)')}</span>
            <input value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder={t('مثال: سعر السوق صباحًا', 'e.g. morning market rate')} />
          </label>
          <button type="submit" className="button primary wide">{rate ? t('تحديث سعر اليوم', 'Update today’s rate') : t('حفظ سعر اليوم', 'Save today’s rate')}</button>
        </form>
      ) : (
        <p className="ops-warning">{t('تحديث سعر التحويل متاح لمدير النظام فقط.', 'Only the administrator can update the exchange rate.')}</p>
      )}

      {history.length > 0 && (
        <section className="fx-history">
          <h4><History aria-hidden="true" />{t('سجل الأسعار', 'Rate history')}</h4>
          <ul>
            {history.map(h => (
              <li key={h.id}>
                <bdi className="fx-rate">{fmt(h.rate)}</bdi>
                <span><bdi>{h.date}</bdi> · {h.setByName || '—'}{h.note ? ` · ${h.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Top-bar chip: shows today's rate and opens the rate panel. */
export function ExchangeRateChip() {
  const t = useWords();
  const { rate } = useFxRate();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const f = () => setOpen(true);
    window.addEventListener('yar:open-fx', f);
    return () => window.removeEventListener('yar:open-fx', f);
  }, []);
  return (
    <>
      <button type="button" className={`fx-chip ${rate ? '' : 'missing'}`} onClick={() => setOpen(true)} aria-label={t('سعر صرف الدولار اليوم', 'Today’s USD rate')} title={t('سعر صرف الدولار اليوم', 'Today’s USD rate')} data-no-translate>
        <Banknote aria-hidden="true" />
        <span>{rate ? <bdi dir="ltr">$1 = {fmt(rate.rate)}</bdi> : t('سعر اليوم؟', 'Rate?')}</span>
      </button>
      {open && (
        <Drawer open onClose={() => setOpen(false)} eyebrow={t('العملات', 'Currencies')} title={t('سعر صرف الدولار اليومي', 'Daily USD exchange rate')}>
          <FxRateForm onSaved={() => setOpen(false)} />
        </Drawer>
      )}
    </>
  );
}

/** Warning shown on operational pages while today's rate is missing. */
export function FxRateBanner() {
  const t = useWords();
  const { rate, latest } = useFxRate();
  if (rate) return null;
  const admin = can('fx.manage');
  return (
    <div className="fx-banner" role="status" data-no-translate>
      <AlertTriangle aria-hidden="true" />
      <p>
        <strong>{t('يجب تحديث سعر الدولار لسعر اليوم.', 'Today’s USD rate must be updated.')}</strong>{' '}
        {admin
          ? t('الحجوزات الجديدة متوقفة حتى تسجيل سعر اليوم.', 'New bookings are paused until today’s rate is saved.')
          : t('الحجوزات الجديدة متوقفة حتى يسجّل المدير سعر اليوم.', 'New bookings are paused until the administrator saves today’s rate.')}
        {latest && <> {t('آخر سعر', 'Last rate')}: <bdi>{fmt(latest.rate)}</bdi> ({latest.date})</>}
      </p>
      {admin && <button type="button" className="button primary" onClick={() => window.dispatchEvent(new CustomEvent('yar:open-fx'))}>{t('سجّل سعر اليوم', 'Set today’s rate')}</button>}
    </div>
  );
}

export default ExchangeRateChip;
