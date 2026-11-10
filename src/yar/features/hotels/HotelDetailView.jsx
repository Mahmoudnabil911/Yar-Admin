import React from 'react';
import { MapPin, Star, Clock, Ruler, Users, CalendarRange, CircleAlert, CircleCheck, ShieldCheck, Baby, PawPrint, CigaretteOff, BedDouble } from 'lucide-react';
import * as C from '../../services/hotelCatalog';
import { activeRatePlans, startingRates, includesBreakfast } from '../../services/hotelPricing';
import { imageSource } from '../catalog/PhotoDropzone';
import { FACILITY_ICONS, ROOM_AMENITY_ICONS, VIEW_ICONS, BED_ICONS, HOTEL_TYPE_ICONS, MEAL_ICONS, FALLBACK_ICON } from './hotelIcons';
import { useHotelWords, money } from './hotelUi';

const find = (list, code) => list.find(o => o.code === code);

export function bedSummary(room, L, t) {
  const beds = (room.beds || []).filter(b => b.type);
  if (!beds.length) return room.bedType || t('ترتيب الأسرّة غير محدد', 'Bed setup not specified');
  return beds.map(b => `${b.quantity || 1} × ${L(find(C.BED_TYPES, b.type))}`).join(' + ');
}

export function RoomCard({ room, hotel }) {
  const { t, L, lang } = useHotelWords();
  const View = VIEW_ICONS[room.viewType] || null;
  const plans = activeRatePlans(room);
  const cover = room.photos?.[0] || room.gallery?.find(g => g.photos?.length)?.photos[0];
  const amenities = (room.amenityCodes || []).map(code => find(C.ALL_ROOM_AMENITIES, code)).filter(Boolean);
  const firstBed = room.beds?.[0]?.type;
  const BedIcon = BED_ICONS[firstBed] || BedDouble;
  const known = (room.availability || []).length;
  return (
    <article className="hx-room-card">
      <div className="hx-room-media">{cover ? <img src={imageSource(cover)} alt={room.name} loading="lazy" /> : <BedDouble aria-hidden="true" />}</div>
      <div className="hx-room-body">
        <header>
          <h4>{lang === 'en' && room.nameEn ? room.nameEn : room.name}</h4>
          {room.category && <small>{L(find(C.ROOM_CATEGORIES, room.category))}</small>}
        </header>
        <ul className="hx-room-facts">
          <li>{View ? <View aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}{room.viewType ? L(find(C.VIEW_TYPES, room.viewType)) : t('الإطلالة غير مضمونة', 'View not guaranteed')}</li>
          <li><BedIcon aria-hidden="true" />{bedSummary(room, L, t)}{room.beds?.length > 0 && !room.bedGuaranteed && <em>{t(' · حسب الطلب', ' · on request')}</em>}</li>
          {room.size && <li><Ruler aria-hidden="true" />{room.size} m²</li>}
          <li><Users aria-hidden="true" />{t(`${room.standardAdults || room.maxAdults || '—'} بالغين`, `${room.standardAdults || room.maxAdults || '—'} adults`)}{room.maxChildren ? t(` + ${room.maxChildren} طفل`, ` + ${room.maxChildren} child`) : ''} · {t(`حتى ${room.capacity || '—'}`, `up to ${room.capacity || '—'}`)}</li>
        </ul>
        {amenities.length > 0 && (
          <ul className="hx-icon-list">
            {amenities.slice(0, 10).map(a => { const I = ROOM_AMENITY_ICONS[a.code] || FALLBACK_ICON; return <li key={a.code}><I aria-hidden="true" />{L(a)}</li>; })}
            {amenities.length > 10 && <li>+{amenities.length - 10}</li>}
          </ul>
        )}
        <div className="hx-rates">
          {plans.length ? plans.map(p => {
            const meal = find(C.MEAL_PLANS, p.mealPlan); const MealIcon = MEAL_ICONS[p.mealPlan] || FALLBACK_ICON;
            return (
              <div className="hx-rate-row" key={p.id}>
                <span className="hx-rate-meal"><MealIcon aria-hidden="true" /><strong>{p.mealPlan}</strong>{L(meal)}{p.mealPlan === 'HB' && p.secondMeal && ` (${L(find(C.SECOND_MEALS, p.secondMeal))})`}</span>
                <span className="hx-rate-tags">
                  <small>{includesBreakfast(p.mealPlan) ? t('الإفطار مشمول', 'Breakfast included') : t('بدون إفطار', 'No breakfast')}</small>
                  <small>{L(find(C.REFUNDABILITY, p.refundability || 'unknown'))}</small>
                </span>
                <strong className="hx-rate-price">{money(p.nightlyPrice, p.currency, lang)}<small> / {L(find(C.PRICE_BASES, p.priceBasis || 'per_room_night'))}</small></strong>
              </div>
            );
          }) : <p className="field-hint">{t('لا توجد خطة سعر فعالة لهذه الغرفة.', 'No active rate plan for this room.')}</p>}
        </div>
        <p className={`hx-availability ${known ? 'is-known' : ''}`}><CalendarRange aria-hidden="true" />{known ? t(`${known} فترات توافر مُدخلة؛ تُراجع قبل التأكيد`, `${known} availability periods entered; verify before confirming`) : t('التوافر غير مُدخل — لا يُعتبر متاحًا', 'Availability not entered — not treated as available')}</p>
      </div>
    </article>
  );
}

export default function HotelDetailView({ hotel }) {
  const { t, L, lang } = useHotelWords();
  const TypeIcon = HOTEL_TYPE_ICONS[hotel.hotelType] || HOTEL_TYPE_ICONS.hotel;
  const photos = [...(hotel.photos || []), ...(hotel.gallery || []).flatMap(g => g.photos || [])];
  const rates = startingRates(hotel);
  const facilities = (hotel.facilities || []).map(f => ({ ...f, def: find(C.ALL_FACILITIES, f.code) || { code: f.code, ar: f.labelAr, en: f.labelEn } })).filter(f => f.def.ar || f.def.en);
  const policies = [
    [Clock, t('الوصول والمغادرة', 'Check-in / Check-out'), hotel.checkIn || hotel.checkOut ? `${hotel.checkIn || '—'} / ${hotel.checkOut || '—'}` : ''],
    [ShieldCheck, t('الإلغاء', 'Cancellation'), hotel.cancellationPolicy],
    [Baby, t('الأطفال', 'Children'), hotel.childrenPolicy],
    [BedDouble, t('السرير الإضافي', 'Extra Bed'), hotel.extraBedPolicy],
    [PawPrint, t('الحيوانات الأليفة', 'Pets'), hotel.petPolicy],
    [CigaretteOff, t('التدخين', 'Smoking'), hotel.smokingPolicy],
  ].filter(row => String(row[2] || '').trim());
  return (
    <div className="hx-detail" data-no-translate>
      <section className="hx-detail-hero">
        {photos[0] ? <img src={imageSource(photos[0])} alt={hotel.name} /> : <div className="hx-detail-placeholder"><TypeIcon aria-hidden="true" /></div>}
        <div>
          <span className={`catalog-status ${hotel.status || 'draft'}`}><span></span>{L(find(C.HOTEL_STATUSES, hotel.status || 'draft'))}</span>
          <h3>{lang === 'en' && hotel.nameEn ? hotel.nameEn : hotel.name || t('فندق بدون اسم', 'Untitled hotel')}</h3>
          <p className="hx-stars" aria-label={t(`${hotel.stars || 0} نجوم`, `${hotel.stars || 0} stars`)}>{Array.from({ length: Number(hotel.stars) || 0 }, (_, i) => <Star key={i} aria-hidden="true" />)}<span><TypeIcon aria-hidden="true" />{L(find(C.HOTEL_TYPES, hotel.hotelType))}</span></p>
          <p className="hx-address"><MapPin aria-hidden="true" />{[hotel.city, hotel.area, hotel.address].filter(Boolean).join(' · ')}</p>
          <p className="hx-from">{t('الليلة تبدأ من', 'From per night')} <strong>{rates.IQD != null ? money(rates.IQD, 'IQD', lang) : '—'}</strong>{rates.USD != null && <strong> · {money(rates.USD, 'USD', lang)}</strong>}</p>
        </div>
      </section>
      {photos.length > 1 && <div className="hx-thumbs">{photos.slice(1, 9).map((src, i) => <img key={i} src={imageSource(src)} alt={`${hotel.name} ${i + 2}`} loading="lazy" />)}</div>}
      {(hotel.description || hotel.descriptionEn) && <p className="hx-description">{lang === 'en' && hotel.descriptionEn ? hotel.descriptionEn : hotel.description}</p>}
      {facilities.length > 0 && (
        <section><h3 className="hx-detail-title">{t('مرافق الفندق', 'Hotel Facilities')}</h3>
          <ul className="hx-icon-list is-large">
            {facilities.map(f => { const I = FACILITY_ICONS[f.code] || FALLBACK_ICON; return <li key={f.code}><I aria-hidden="true" />{L(f.def)}{f.charge && f.charge !== 'included' && <small>{L(find(C.FACILITY_CHARGES, f.charge))}</small>}</li>; })}
          </ul>
        </section>
      )}
      {policies.length > 0 && (
        <section><h3 className="hx-detail-title">{t('السياسات', 'Policies')}</h3>
          <dl className="hx-policies">{policies.map(([I, label, value]) => <div key={label}><dt><I aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
      )}
      <section><h3 className="hx-detail-title">{t('الغرف والأسعار', 'Rooms & Rates')}</h3>
        {(hotel.rooms || []).length ? <div className="hx-room-list">{hotel.rooms.map(room => <RoomCard key={room.id} room={room} hotel={hotel} />)}</div>
          : <p className="field-hint"><CircleCheck aria-hidden="true" /> {t('لم تُضف غرف بعد.', 'No rooms added yet.')}</p>}
      </section>
    </div>
  );
}
