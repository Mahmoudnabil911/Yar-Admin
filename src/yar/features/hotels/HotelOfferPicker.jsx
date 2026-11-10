import React, { useMemo, useState } from 'react';
import { Hotel, BedDouble, CalendarRange, Users, Utensils, CircleCheck, TriangleAlert, CircleHelp } from 'lucide-react';
import { catalogStorage } from '../../services/storage/catalogStorage';
import * as C from '../../services/hotelCatalog';
import { activeRatePlans, quoteStay, availabilityFor, offerSnapshot, supplierTotal } from '../../services/hotelPricing';
import { useHotelWords, money } from './hotelUi';
import { bedSummary } from './HotelDetailView';
import './hotel-editor.css';

const find = (list, code) => list.find(o => o.code === code);

/** Read-only offer selection for hotel bookings (both roles); never edits hotel master data. */
export default function HotelOfferPicker({ onApply }) {
  const { t, L, lang } = useHotelWords();
  const hotels = useMemo(() => catalogStorage.getRecords('hotels').filter(h => h.status === 'published'), []);
  const [s, setS] = useState({ hotelId: '', roomId: '', planId: '', checkIn: '', checkOut: '', rooms: 1, adults: 2, children: 0, childAges: '', requests: '' });
  const set = patch => setS(v => ({ ...v, ...patch }));
  const hotel = hotels.find(h => h.id === s.hotelId);
  const room = hotel?.rooms?.find(r => r.id === s.roomId);
  const plans = room ? activeRatePlans(room) : [];
  const plan = plans.find(p => p.id === s.planId);
  const quote = room && plan && s.checkIn && s.checkOut ? quoteStay({ room, plan, checkIn: s.checkIn, checkOut: s.checkOut, rooms: s.rooms, adults: s.adults, children: s.children }) : null;
  const avail = room && s.checkIn && s.checkOut ? availabilityFor(room, s.checkIn, s.checkOut, Number(s.rooms)) : null;

  const apply = () => {
    const request = { checkIn: s.checkIn, checkOut: s.checkOut, rooms: Number(s.rooms), adults: Number(s.adults), children: Number(s.children), childAges: s.childAges, requests: s.requests, availability: avail?.status || 'unknown' };
    const snapshot = offerSnapshot({ hotel, room, plan, quote, request });
    onApply({ snapshot, quote, plan, hotel, room, request, supplierCost: supplierTotal(plan, quote, request.rooms, request.adults) });
  };

  const availText = !avail ? '' : avail.status === 'available' ? t(`متاح حسب البيانات المُدخلة (${avail.available} غرف)`, `Available per entered data (${avail.available} rooms)`)
    : avail.status === 'closed' ? t('مغلق للحجز في هذه التواريخ', 'Closed for these dates') : avail.status === 'insufficient' ? t(`غير كافٍ: ${avail.available} غرف فقط`, `Insufficient: only ${avail.available} rooms`)
      : t('التوافر غير معروف — يجب التأكد من المورد', 'Availability unknown — confirm with supplier');
  const AvailIcon = avail?.status === 'available' ? CircleCheck : avail?.status === 'unknown' ? CircleHelp : TriangleAlert;

  return (
    <section className="hx-offer" data-no-translate>
      <h3><Hotel aria-hidden="true" />{t('اختيار عرض فندقي', 'Select a Hotel Offer')}</h3>
      {!hotels.length ? <p className="field-hint">{t('لا توجد فنادق منشورة بعد.', 'No published hotels yet.')}</p> : <>
        <div className="hx-offer-grid">
          <label className="ops-field"><span>{t('الفندق', 'Hotel')}</span>
            <select value={s.hotelId} onChange={e => set({ hotelId: e.target.value, roomId: '', planId: '' })}><option value="">{t('اختر الفندق', 'Choose hotel')}</option>{hotels.map(h => <option key={h.id} value={h.id}>{lang === 'en' && h.nameEn ? h.nameEn : h.name} · {h.city}</option>)}</select></label>
          <label className="ops-field"><span>{t('الغرفة / الخيار', 'Room / Variant')}</span>
            <select value={s.roomId} disabled={!hotel} onChange={e => set({ roomId: e.target.value, planId: '' })}><option value="">{t('اختر الغرفة', 'Choose room')}</option>{(hotel?.rooms || []).map(r => <option key={r.id} value={r.id}>{lang === 'en' && r.nameEn ? r.nameEn : r.name}{r.viewType ? ` · ${L(find(C.VIEW_TYPES, r.viewType))}` : ''}</option>)}</select></label>
          <label className="ops-field"><span>{t('نظام الوجبات وخطة السعر', 'Meal Plan & Rate')}</span>
            <select value={s.planId} disabled={!room} onChange={e => set({ planId: e.target.value })}><option value="">{t('اختر الخطة', 'Choose plan')}</option>{plans.map(p => <option key={p.id} value={p.id}>{p.mealPlan} · {L(find(C.MEAL_PLANS, p.mealPlan))} · {L(find(C.RATE_TYPES, p.rateType || 'standard'))} · {money(p.nightlyPrice, p.currency, lang)}</option>)}</select></label>
          <label className="ops-field"><span>{t('عدد الغرف', 'Rooms')}</span><input type="number" min="1" max="20" value={s.rooms} onChange={e => set({ rooms: e.target.value })} /></label>
          <label className="ops-field"><span>{t('الوصول', 'Check-in')}</span><input type="date" value={s.checkIn} onChange={e => set({ checkIn: e.target.value })} /></label>
          <label className="ops-field"><span>{t('المغادرة', 'Check-out')}</span><input type="date" value={s.checkOut} onChange={e => set({ checkOut: e.target.value })} /></label>
          <label className="ops-field"><span>{t('البالغون', 'Adults')}</span><input type="number" min="1" max="50" value={s.adults} onChange={e => set({ adults: e.target.value })} /></label>
          <label className="ops-field"><span>{t('الأطفال', 'Children')}</span><input type="number" min="0" max="20" value={s.children} onChange={e => set({ children: e.target.value })} /></label>
          {Number(s.children) > 0 && <label className="ops-field"><span>{t('أعمار الأطفال', 'Child Ages')}</span><input value={s.childAges} onChange={e => set({ childAges: e.target.value })} placeholder="4, 9" /></label>}
          <label className="ops-field"><span>{t('طلبات إضافية', 'Additional Requests')}</span><input value={s.requests} onChange={e => set({ requests: e.target.value })} /></label>
        </div>
        {room && plan && quote && (
          <div className="hx-offer-summary" aria-live="polite">
            <div><span><BedDouble aria-hidden="true" /> {room.name}</span><span>{room.viewType ? L(find(C.VIEW_TYPES, room.viewType)) : t('الإطلالة غير مضمونة', 'View not guaranteed')}</span></div>
            <div><span>{t('الأسرّة', 'Beds')}</span><span>{bedSummary(room, L, t)}{room.beds?.length > 0 && !room.bedGuaranteed ? t(' (حسب الطلب)', ' (on request)') : ''}</span></div>
            <div><span><Users aria-hidden="true" /> {t('النزلاء', 'Guests')}</span><span>{t(`${s.adults} بالغين`, `${s.adults} adults`)}{Number(s.children) ? t(` + ${s.children} أطفال`, ` + ${s.children} children`) : ''}</span></div>
            <div><span><CalendarRange aria-hidden="true" /> {s.checkIn} → {s.checkOut}</span><span>{t(`${quote.nights} ليالٍ × ${s.rooms} غرف`, `${quote.nights} nights × ${s.rooms} rooms`)}</span></div>
            <div><span><Utensils aria-hidden="true" /> {plan.mealPlan} · {L(find(C.MEAL_PLANS, plan.mealPlan))}</span><span>{L(find(C.REFUNDABILITY, plan.refundability || 'unknown'))}</span></div>
            {(plan.cancellationPolicy || room.cancellationPolicy || hotel.cancellationPolicy) && <div><span>{t('الإلغاء', 'Cancellation')}</span><span>{plan.cancellationPolicy || room.cancellationPolicy || hotel.cancellationPolicy}</span></div>}
            <div><span>{t('الإقامة الأساسية', 'Base accommodation')}</span><span>{money(quote.base, quote.currency, lang)}</span></div>
            {quote.extras.map(e => <div key={e.label}><span>{e.label}</span><span>{money(e.amount, quote.currency, lang)}</span></div>)}
            <div className="hx-total"><span>{t('الإجمالي', 'Total')}</span><span>{money(quote.total, quote.currency, lang)}</span></div>
            {avail && <p className={`hx-availability ${avail.status === 'available' ? 'is-known' : ''}`}><AvailIcon aria-hidden="true" />{availText}</p>}
            {[...quote.errors, ...quote.notes].map(m => <p key={m} className="hx-warn"><TriangleAlert aria-hidden="true" />{m}</p>)}
            <button type="button" className="button primary" disabled={quote.errors.length > 0} onClick={apply}><CircleCheck aria-hidden="true" />{t('استخدام هذا العرض في الطلب', 'Use this offer')}</button>
          </div>
        )}
      </>}
    </section>
  );
}
