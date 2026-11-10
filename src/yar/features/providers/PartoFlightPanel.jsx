import React, { useState } from 'react';
import {
  flightAdapter, AirTripType, CabinType, MaxStopsQuantity, PricingSourceType, RequestOption, SearchLocationType,
  AirQueueStatus, ticketIssuanceOf, isTicketed, priceChanged, Gender, PassengerType, PassengerTitle, SeatPreference, MealPreference,
} from '../../integrations/partocrs';

const STATUS_AR = {
  [AirQueueStatus.Booked]: 'محجوز (غير صادر)', [AirQueueStatus.Pending]: 'معلّق', [AirQueueStatus.Waitlist]: 'قائمة انتظار',
  [AirQueueStatus.TicketinProcess]: 'الإصدار قيد المعالجة', [AirQueueStatus.Ticketed]: 'صادر', [AirQueueStatus.Cancelled]: 'ملغي',
  [AirQueueStatus.Exception]: 'استثناء',
};
const ISSUANCE_AR = { not_requested: 'لم يُطلب الإصدار', in_process: 'قيد الإصدار', ticketed: 'صادرة', voided_or_cancelled: 'ملغاة / مبطلة', exception: 'استثناء' };
const total = it => it?.AirItineraryPricingInfo?.ItinTotalFare?.TotalFare;
const cur = it => it?.AirItineraryPricingInfo?.ItinTotalFare?.Currency || 'USD';
const fmtTime = s => (s ? s.slice(11, 16) : '—');

/** Integration-readiness demo of the future PartoCRS flight flow. Mock adapter only — no network. */
export default function PartoFlightPanel() {
  const [trip, setTrip] = useState('oneway');
  const [legs, setLegs] = useState([{ from: 'BGW', to: 'MHD', date: '2026-12-01' }, { from: 'MHD', to: 'BGW', date: '2026-12-08' }]);
  const [adults, setAdults] = useState(1);
  const [results, setResults] = useState([]);
  const [searchId, setSearchId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [rules, setRules] = useState(null);
  const [reval, setReval] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [traveler, setTraveler] = useState({ first: 'DEMO', last: 'TRAVELLER', passport: 'DEMO-P-001', dob: '1990-01-01' });
  const [booking, setBooking] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');

  const push = (op, res) => setLog(l => [{ op, ok: res.data?.Success !== false, at: new Date().toISOString(), msg: res.data?.Error?.Message || '' }, ...l].slice(0, 12));
  const activeLegs = trip === 'oneway' ? legs.slice(0, 1) : legs;

  const search = async e => {
    e.preventDefault(); setError(''); setSelected(null); setReval(null); setBooking(null); setRules(null);
    const res = await flightAdapter.call('AirLowFareSearch', {
      PricingSourceType: PricingSourceType.All, RequestOption: RequestOption.Fifty,
      AdultCount: Number(adults), ChildCount: 0, InfantCount: 0, IsGenuine: false,
      TravelPreference: { CabinType: CabinType.Y, MaxStopsQuantity: MaxStopsQuantity.All, AirTripType: trip === 'round' ? AirTripType.Return : trip === 'multi' ? AirTripType.OpenJaw : AirTripType.OneWay },
      OriginDestinationInformations: activeLegs.map(l => ({ OriginLocationCode: l.from, DestinationLocationCode: l.to, DepartureDateTime: `${l.date}T00:00:00`, OriginType: SearchLocationType.Airport, DestinationType: SearchLocationType.Airport })),
    });
    push('AirLowFareSearch', res);
    setSearchId(res.data.SearchId ?? null);
    setResults(res.data.PricedItineraries || []);
  };

  const choose = async it => {
    setSelected(it); setReval(null); setAccepted(false); setBooking(null);
    const [r, b] = await Promise.all([
      flightAdapter.call('AirRules', { FareSourceCode: it.FareSourceCode }),
      flightAdapter.call('AirBaggages', { FareSourceCode: it.FareSourceCode }),
    ]);
    push('AirRules', r); push('AirBaggages', b);
    setRules({ rules: r.data.FareRules || [], baggage: b.data.BaggageInfoes || [] });
  };

  const revalidate = async () => {
    const before = total(selected);
    const res = await flightAdapter.call('AirRevalidate', { FareSourceCode: selected.FareSourceCode });
    push('AirRevalidate', res);
    if (!res.data.Success) return setError(res.data.Error?.Message || 'Revalidation failed');
    const after = total(res.data.PricedItinerary);
    setReval({ before, after, changed: priceChanged(before, after) });
  };

  const book = async () => {
    setError('');
    const res = await flightAdapter.call('AirBook', {
      FareSourceCode: selected.FareSourceCode, ClientUniqueId: `YAR-${Date.now()}`,
      TravelerInfo: {
        PhoneNumber: '07XXXXXXXX99', Email: 'demo@example.invalid',
        AirTravelers: Array.from({ length: Number(adults) }, () => ({
          DateOfBirth: `${traveler.dob}T00:00:00`, Gender: Gender.Male, PassengerType: PassengerType.Adt,
          PassengerName: { PassengerFirstName: traveler.first, PassengerMiddleName: '', PassengerLastName: traveler.last, PassengerTitle: PassengerTitle.Mr },
          Passport: { PassportNumber: traveler.passport, Country: 'IQ', ExpiryDate: '2030-01-01T00:00:00' },
          NationalId: '', Nationality: 'IQ', SeatPreference: SeatPreference.Any, MealPreference: MealPreference.Any,
        })),
      },
    });
    push('AirBook', res);
    if (!res.data.Success) return setError(res.data.Error?.Message || 'Booking failed');
    setBooking({ UniqueId: res.data.UniqueId, ClientUniqueId: null, Status: res.data.Status, TktTimeLimit: res.data.TktTimeLimit, warnings: res.data.WarningMessage || [] });
  };

  const op = async (name, req, after) => {
    const res = await flightAdapter.call(name, req);
    push(name, res);
    if (res.data.Success === false) setError(res.data.Error?.Message || `${name} failed`); else setError('');
    after?.(res.data);
  };
  const refresh = () => op('AirBookingData', { UniqueId: booking.UniqueId }, d => setBooking(b => ({ ...b, Status: d.Status ?? b.Status, ClientUniqueId: d.ClientUniqueId ?? b.ClientUniqueId })));

  return (
    <section className="panel parto-panel" aria-labelledby="parto-title">
      <div className="panel-heading compact">
        <div>
          <div className="section-kicker">PartoCRS · طيران فقط</div>
          <h2 id="parto-title">مسار الطيران المستقبلي</h2>
        </div>
        <span className="perm-chip">الاتصال بالمورّد غير مفعّل</span>
      </div>
      <p className="ops-note">الاتصال بالمورّد غير مفعّل. لا يمكن تنفيذ حجوزات أو إصدار تذاكر لدى المورّد من هذه الصفحة.</p>

      <form className="ops-form-grid" onSubmit={e => e.preventDefault()}>
        <label className="ops-field">
          <span>نوع الرحلة</span>
          <select value={trip} onChange={e => setTrip(e.target.value)}>
            <option value="oneway">ذهاب فقط</option>
            <option value="round">ذهاب وعودة</option>
            <option value="multi">وجهات متعددة</option>
          </select>
        </label>
        <label className="ops-field">
          <span>البالغون</span>
          <input type="number" min="1" max="9" value={adults} onChange={e => setAdults(e.target.value)} />
        </label>
        {activeLegs.map((l, i) => (
          <div className="wide parto-leg" key={i}>
            <input aria-label="من" value={l.from} maxLength={3} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, from: e.target.value.toUpperCase() } : x)))} />
            <input aria-label="إلى" value={l.to} maxLength={3} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, to: e.target.value.toUpperCase() } : x)))} />
            <input aria-label="التاريخ" type="date" value={l.date} onChange={e => setLegs(ls => ls.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
          </div>
        ))}
        {trip === 'multi' && (
          <button type="button" className="button secondary" onClick={() => setLegs(ls => [...ls, { from: ls.at(-1).to, to: 'IKA', date: ls.at(-1).date }])}>إضافة مقطع</button>
        )}
        <button className="button primary wide" type="submit" disabled>بحث الرحلات</button>
      </form>

      {searchId && <p className="ops-note">SearchId: <bdi>{searchId}</bdi></p>}
      {results.length > 0 && (
        <div className="parto-results">
          {results.map(it => (
            <button type="button" key={it.FareSourceCode} className={`parto-result ${selected?.FareSourceCode === it.FareSourceCode ? 'selected' : ''}`} onClick={() => choose(it)}>
              <strong><bdi>{it.ValidatingAirlineCode}</bdi> · <bdi>{total(it)?.toFixed(2)} {cur(it)}</bdi></strong>
              {(it.OriginDestinationOptions || []).map((o, k) => (
                <small key={k}>
                  {(o.FlightSegments || []).map(s => (
                    <bdi key={s.FlightNumber}>{s.DepartureAirportLocationCode} {fmtTime(s.DepartureDateTime)} → {s.ArrivalAirportLocationCode} {fmtTime(s.ArrivalDateTime)} · {s.FlightNumber} · {s.StopQuantity ? `${s.StopQuantity} توقف` : 'مباشر'} · {o.JourneyDurationPerMinute} min · {s.Baggage}</bdi>
                  ))}
                </small>
              ))}
              <small>FareSourceCode: <bdi>{it.FareSourceCode}</bdi></small>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="parto-step">
          <h3>القواعد والأمتعة</h3>
          {rules?.rules.map((r, i) => <p className="ops-note" key={i}>{(r.RuleDetails || []).map(d => `${d.Category}: ${d.Rules}`).join(' · ')}</p>)}
          {rules?.baggage.map((b, i) => <p className="ops-note" key={`b${i}`}><bdi>{b.Departure}→{b.Arrival}: {b.Baggage}</bdi></p>)}
          <button type="button" className="button secondary" onClick={revalidate}>إعادة التحقق من السعر (AirRevalidate)</button>
          {reval && reval.changed && (
            <div className="perm-note" role="alert">
              تغيّر السعر: <bdi>{reval.before?.toFixed(2)}</bdi> ← <bdi>{reval.after?.toFixed(2)}</bdi>
              <label className="inline-check"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /> <span>أوافق على السعر الجديد</span></label>
            </div>
          )}
          {reval && !reval.changed && <p className="ops-note" role="status">السعر مؤكد دون تغيير.</p>}
          {reval && (
            <div className="ops-form-grid">
              <label className="ops-field"><span>الاسم الأول</span><input value={traveler.first} onChange={e => setTraveler({ ...traveler, first: e.target.value })} /></label>
              <label className="ops-field"><span>اسم العائلة</span><input value={traveler.last} onChange={e => setTraveler({ ...traveler, last: e.target.value })} /></label>
              <label className="ops-field"><span>رقم الجواز</span><input value={traveler.passport} onChange={e => setTraveler({ ...traveler, passport: e.target.value })} /></label>
              <label className="ops-field"><span>تاريخ الميلاد</span><input type="date" value={traveler.dob} onChange={e => setTraveler({ ...traveler, dob: e.target.value })} /></label>
              <button type="button" className="button primary wide" disabled={reval.changed && !accepted} onClick={book}>إنشاء حجز (AirBook)</button>
            </div>
          )}
        </div>
      )}

      {booking && (
        <div className="parto-step">
          <h3>حالة الحجز</h3>
          <dl className="parto-status">
            <div><dt>UniqueId</dt><dd><bdi>{booking.UniqueId}</bdi></dd></div>
            <div><dt>حالة المورّد</dt><dd>{STATUS_AR[booking.Status] ?? booking.Status}</dd></div>
            <div><dt>إصدار التذكرة</dt><dd>{ISSUANCE_AR[ticketIssuanceOf(booking.Status)]}</dd></div>
            <div><dt>مهلة الإصدار</dt><dd><bdi>{booking.TktTimeLimit}</bdi></dd></div>
          </dl>
          {booking.warnings.map(w => <p key={w} className="ops-note">{w}</p>)}
          <div className="parto-actions">
            <button type="button" className="button primary" disabled={booking.Status !== AirQueueStatus.Booked} onClick={() => op('AirOrderTicket', { UniqueId: booking.UniqueId }, d => setBooking(b => ({ ...b, Status: d.Status ?? b.Status })))}>طلب الإصدار (AirOrderTicket)</button>
            <button type="button" className="button secondary" onClick={refresh}>تحديث الحالة (AirBookingData)</button>
            <button type="button" className="button secondary" onClick={() => op('AirAddBookingNotes', { UniqueId: booking.UniqueId, Notes: ['YAR demo note'] })}>إضافة ملاحظة</button>
            <button type="button" className="button secondary" disabled={booking.Status !== AirQueueStatus.Booked} onClick={() => op('AirCancel', { UniqueId: booking.UniqueId }, d => d.Success && setBooking(b => ({ ...b, Status: AirQueueStatus.Cancelled })))}>إلغاء الحجز (AirCancel)</button>
            <button type="button" className="button secondary" disabled={!isTicketed(booking.Status)} onClick={() => op('AirRefundDisplay', { UniqueId: booking.UniqueId })}>أهلية الاسترداد (AirRefundDisplay)</button>
          </div>
        </div>
      )}

      {error && <div className="ops-form-error" role="alert">{error}</div>}
      {log.length > 0 && (
        <ol className="parto-log" aria-label="سجل العمليات">
          {log.map((l, i) => <li key={i}><bdi>{l.op}</bdi> · {l.ok ? 'OK' : 'FAIL'} {l.msg && `· ${l.msg}`}</li>)}
        </ol>
      )}
    </section>
  );
}
