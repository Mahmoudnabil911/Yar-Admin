import React from 'react';
import { Hotel, BedDouble, Utensils, CalendarRange, Eye } from 'lucide-react';
import * as C from '../../services/hotelCatalog';
import { useHotelWords, money } from './hotelUi';

const find = (list, code) => list.find(o => o.code === code);

/** Shows the offer frozen on the booking; later hotel edits never change it. */
export default function HotelOfferSnapshot({ offer }) {
  const { t, L, lang } = useHotelWords();
  if (!offer?.hotel) return null;
  const q = offer.quote || {}, r = offer.request || {};
  const beds = (offer.room.beds || []).map(b => `${b.quantity || 1} × ${L(find(C.BED_TYPES, b.type))}`).join(' + ');
  return (
    <div className="hx-offer-summary" data-no-translate style={{ marginTop: 10 }}>
      <div><strong><Hotel aria-hidden="true" /> {offer.hotel.name}</strong><small>{t('لقطة محفوظة', 'Saved snapshot')} · {String(offer.capturedAt || '').slice(0, 10)}</small></div>
      <div><span><BedDouble aria-hidden="true" /> {offer.room.name}</span><span>{beds || '—'}{beds && !offer.room.bedGuaranteed ? t(' (حسب الطلب)', ' (on request)') : ''}</span></div>
      <div><span><Eye aria-hidden="true" /> {t('الإطلالة', 'View')}</span><span>{offer.room.viewType ? L(find(C.VIEW_TYPES, offer.room.viewType)) : t('غير مضمونة', 'Not guaranteed')}</span></div>
      <div><span><Utensils aria-hidden="true" /> {offer.ratePlan.mealPlan} · {L(find(C.MEAL_PLANS, offer.ratePlan.mealPlan))}</span><span>{L(find(C.REFUNDABILITY, offer.ratePlan.refundability))}</span></div>
      <div><span><CalendarRange aria-hidden="true" /> {r.checkIn} → {r.checkOut}</span><span>{t(`${q.nights} ليالٍ × ${r.rooms} غرف · ${r.adults} بالغين`, `${q.nights} nights × ${r.rooms} rooms · ${r.adults} adults`)}{r.children ? ` + ${r.children}` : ''}</span></div>
      {offer.ratePlan.cancellationPolicy && <div><span>{t('الإلغاء', 'Cancellation')}</span><span>{offer.ratePlan.cancellationPolicy}</span></div>}
      <div className="hx-total"><span>{t('إجمالي العرض', 'Offer total')}</span><span>{money(q.total, q.currency, lang)}</span></div>
    </div>
  );
}
