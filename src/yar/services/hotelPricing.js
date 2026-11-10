// Hotel → room variant (each `rooms[]` entry) → rate plans. Inventory lives on the
// room variant so every rate plan of that room shares the same physical rooms.
import { MEAL_PLANS, optionLabel } from './hotelCatalog';

export const HOTEL_MODEL_VERSION = 3;
const DAY = 86400000;
const num = value => (value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;

/** Occupied nights: check-in inclusive, check-out exclusive. */
export function nightsBetween(checkIn, checkOut) {
  if (!validDate(checkIn) || !validDate(checkOut) || checkOut <= checkIn) return [];
  const out = [];
  for (let t = Date.parse(checkIn + 'T00:00:00Z'); t < Date.parse(checkOut + 'T00:00:00Z'); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function activeRatePlans(room) {
  return (room?.ratePlans || []).filter(p => p && p.status !== 'inactive' && num(p.nightlyPrice) > 0);
}

/** Lowest sellable nightly price of the given rooms in one currency (IQD by default). */
export function minimumRoomPrice(rooms = [], currency = 'IQD') {
  const prices = [];
  for (const room of rooms || []) {
    const plans = room?.ratePlans?.length ? activeRatePlans(room).filter(p => (p.currency || 'IQD') === currency && (p.priceBasis || 'per_room_night') !== 'per_room_stay') : null;
    if (plans) plans.forEach(p => prices.push(Number(p.nightlyPrice)));
    else if (currency === 'IQD' && num(room?.nightlyPrice) > 0) prices.push(Number(room.nightlyPrice));
  }
  return prices.length ? Math.min(...prices) : null;
}

export function startingRates(hotel) {
  return { IQD: minimumRoomPrice(hotel?.rooms, 'IQD'), USD: minimumRoomPrice(hotel?.rooms, 'USD') };
}

export function mealPlan(code) { return MEAL_PLANS.find(m => m.code === code) || null; }
/** Breakfast is included only when the selected meal plan contains it. */
export function includesBreakfast(code) { return !!mealPlan(code)?.meals.includes('breakfast'); }

export function rateForNight(room, plan, date) {
  const season = (room?.seasons || []).find(s => s.ratePlanId === plan?.id && s.startDate <= date && date <= s.endDate && num(s.nightlyPrice) > 0);
  if (season) return { price: Number(season.nightlyPrice), source: season.name || 'season' };
  if (plan?.legacy) {
    const period = (room?.availability || []).find(a => a.startDate <= date && date <= a.endDate && num(a.nightlyPrice) > 0);
    if (period) return { price: Number(period.nightlyPrice), source: 'period' };
  }
  return { price: Number(plan?.nightlyPrice) || 0, source: 'base' };
}

/** Same-plan seasons may not overlap; different plans may share dates. */
export function seasonError(room) {
  const groups = {};
  for (const s of room?.seasons || []) {
    if (!validDate(s.startDate) || !validDate(s.endDate)) return 'أدخل تاريخي بداية ونهاية صحيحين لكل موسم.';
    if (s.startDate > s.endDate) return 'تاريخ بداية الموسم لا يمكن أن يكون بعد نهايته.';
    if (!(room.ratePlans || []).some(p => p.id === s.ratePlanId)) return 'اربط كل موسم بخطة سعر موجودة في الغرفة نفسها.';
    if (!(num(s.nightlyPrice) > 0)) return 'أدخل سعر ليلة صالحًا لكل موسم.';
    (groups[s.ratePlanId] ||= []).push(s);
  }
  for (const list of Object.values(groups)) {
    const sorted = [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (sorted.some((s, i) => i > 0 && s.startDate <= sorted[i - 1].endDate)) return 'مواسم خطة السعر نفسها متداخلة؛ عدّل التواريخ لأن يوم النهاية مشمول.';
  }
  return '';
}

export function occupancyError(room) {
  const std = num(room.standardAdults), maxA = num(room.maxAdults), maxC = num(room.maxChildren), total = num(room.capacity), inv = num(room.inventory);
  for (const v of [std, maxA, total]) if (v !== null && (!Number.isInteger(v) || v < 1)) return 'أعداد الإشغال يجب أن تكون أرقامًا صحيحة موجبة.';
  if (maxC !== null && (!Number.isInteger(maxC) || maxC < 0)) return 'الحد الأقصى للأطفال يجب أن يكون صفرًا أو أكثر.';
  if (std !== null && maxA !== null && std > maxA) return 'الإشغال القياسي لا يمكن أن يتجاوز الحد الأقصى للبالغين.';
  if (maxA !== null && total !== null && maxA > total) return 'الحد الأقصى للبالغين لا يمكن أن يتجاوز الحد الأقصى للنزلاء.';
  if (maxA !== null && maxC !== null && total !== null && maxC > total) return 'الحد الأقصى للأطفال لا يمكن أن يتجاوز الحد الأقصى للنزلاء.';
  if (inv !== null && (!Number.isInteger(inv) || inv < 0)) return 'عدد الغرف في المخزون لا يمكن أن يكون سالبًا.';
  for (const period of room.availability || []) {
    const avail = num(period.availableRooms), totalRooms = num(period.totalRooms);
    if (avail !== null && avail < 0) return 'عدد الغرف المتاحة لا يمكن أن يكون سالبًا.';
    if (avail !== null && totalRooms !== null && avail > totalRooms) return 'الغرف المتاحة لا يمكن أن تتجاوز إجمالي الغرف في الفترة.';
    if (avail !== null && inv !== null && avail > inv) return 'الغرف المتاحة لا يمكن أن تتجاوز مخزون نوع الغرفة.';
  }
  return '';
}

/** Unknown dates are never reported as available; an empty list is not unlimited. */
export function availabilityFor(room, checkIn, checkOut, count = 1) {
  const nights = nightsBetween(checkIn, checkOut);
  if (!nights.length) return { status: 'unknown', available: null };
  let min = Infinity;
  for (const date of nights) {
    const period = (room?.availability || []).find(a => a.startDate <= date && date <= a.endDate);
    if (!period || num(period.availableRooms) === null) return { status: 'unknown', available: null };
    if (period.closed) return { status: 'closed', available: 0 };
    min = Math.min(min, Number(period.availableRooms));
  }
  return { status: min >= count ? 'available' : 'insufficient', available: min };
}

export function quoteStay({ room, plan, checkIn, checkOut, rooms = 1, adults = 1, children = 0 }) {
  const errors = [], notes = [], extras = [];
  const nights = nightsBetween(checkIn, checkOut);
  const roomCount = Number(rooms), adultCount = Number(adults), childCount = Number(children) || 0;
  if (!nights.length) errors.push('اختر تاريخ مغادرة بعد تاريخ الوصول.');
  if (!Number.isInteger(roomCount) || roomCount < 1) errors.push('عدد الغرف يجب أن يكون 1 أو أكثر.');
  if (!Number.isInteger(adultCount) || adultCount < 1) errors.push('عدد البالغين يجب أن يكون 1 أو أكثر.');
  if (!plan) errors.push('اختر خطة سعر.');
  const currency = plan?.currency || 'IQD', basis = plan?.priceBasis || 'per_room_night';
  if (errors.length) return { errors, notes, nights: nights.length, base: 0, extras, total: 0, currency, basis, nightly: [] };

  const maxA = num(room.maxAdults), maxC = num(room.maxChildren), cap = num(room.capacity);
  if (maxA !== null && adultCount > maxA * roomCount) errors.push('عدد البالغين يتجاوز الحد الأقصى لهذه الغرف.');
  if (maxC !== null && childCount > maxC * roomCount) errors.push('عدد الأطفال يتجاوز الحد الأقصى لهذه الغرف.');
  if (cap !== null && adultCount + childCount > cap * roomCount) errors.push('إجمالي النزلاء يتجاوز سعة الغرف المختارة.');
  if (num(plan.minStay) && nights.length < Number(plan.minStay)) errors.push(`الحد الأدنى للإقامة في هذه الخطة ${plan.minStay} ليالٍ.`);
  if ((plan.validFrom && nights[0] < plan.validFrom) || (plan.validTo && nights[nights.length - 1] > plan.validTo)) errors.push('تواريخ الإقامة خارج فترة صلاحية خطة السعر.');

  const nightly = nights.map(date => ({ date, ...rateForNight(room, plan, date) }));
  const sum = nightly.reduce((t, n) => t + n.price, 0);
  let base;
  if (basis === 'per_person_night') base = sum * adultCount;
  else if (basis === 'per_room_stay') base = nightly[0].price * roomCount;
  else base = sum * roomCount;

  const included = (num(plan.includedGuests) ?? num(room.includedGuests) ?? num(room.standardAdults) ?? adultCount) * roomCount;
  const extraAdults = basis === 'per_person_night' ? 0 : Math.max(0, adultCount - included);
  if (extraAdults) {
    if (room.extraAdultAllowed === false) errors.push('هذه الغرفة لا تسمح ببالغ إضافي.');
    else if (num(plan.extraAdultCharge) === null) notes.push('رسوم البالغ الإضافي غير محددة في خطة السعر؛ راجعها قبل التأكيد.');
    else extras.push({ label: `بالغ إضافي × ${extraAdults}`, amount: Number(plan.extraAdultCharge) * extraAdults * nights.length });
  }
  if (childCount) {
    if (num(plan.childCharge) === null) notes.push('رسوم الأطفال غير محددة؛ لا يُفترض أن إقامة الأطفال مجانية.');
    else if (Number(plan.childCharge) > 0) extras.push({ label: `أطفال × ${childCount}`, amount: Number(plan.childCharge) * childCount * nights.length });
  }
  if (plan.taxesInfo) notes.push(plan.taxesInfo);
  const total = base + extras.reduce((t, e) => t + e.amount, 0);
  return { errors, notes, nights: nights.length, nightly, base, extras, total, currency, basis };
}

/** Frozen copy stored on a booking so later catalog edits never change history. */
export function offerSnapshot({ hotel, room, plan, quote, request }) {
  return JSON.parse(JSON.stringify({
    capturedAt: new Date().toISOString(),
    hotel: { id: hotel.id, name: hotel.name, nameEn: hotel.nameEn || '', city: hotel.city, stars: hotel.stars },
    room: { id: room.id, name: room.name, nameEn: room.nameEn || '', category: room.category || '', viewType: room.viewType || '', beds: room.beds || [], bedGuaranteed: !!room.bedGuaranteed, size: room.size ?? null },
    ratePlan: { id: plan.id, mealPlan: plan.mealPlan, mealPlanLabel: optionLabel('MEAL_PLANS', plan.mealPlan), rateType: plan.rateType, refundability: plan.refundability || 'unknown', cancellationPolicy: plan.cancellationPolicy || room.cancellationPolicy || hotel.cancellationPolicy || '', priceBasis: plan.priceBasis || 'per_room_night', currency: plan.currency || 'IQD' },
    request, quote: { nights: quote.nights, nightly: quote.nightly, base: quote.base, extras: quote.extras, total: quote.total, currency: quote.currency, notes: quote.notes },
  }));
}

/** Non-destructive upgrade of a stored hotel; existing values always win. */
export function migrateHotel(hotel) {
  const h = hotel;
  h.facilities = Array.isArray(h.facilities) ? h.facilities : [];
  h.gallery = Array.isArray(h.gallery) ? h.gallery : [];
  h.hotelType ||= 'hotel';
  (h.rooms || []).forEach((room, index) => {
    room.id ||= `${h.id || 'hotel'}-room-${index + 1}`;
    room.beds = Array.isArray(room.beds) ? room.beds : [];
    room.amenityCodes = Array.isArray(room.amenityCodes) ? room.amenityCodes : [];
    room.gallery = Array.isArray(room.gallery) ? room.gallery : [];
    room.seasons = Array.isArray(room.seasons) ? room.seasons : [];
    room.availability = Array.isArray(room.availability) ? room.availability : [];
    if (!Array.isArray(room.ratePlans)) room.ratePlans = [];
    if (!room.ratePlans.length && num(room.nightlyPrice) > 0 && (h.modelVersion || 0) < HOTEL_MODEL_VERSION) {
      // Compatibility default only: breakfast true → BB, false → RO, same historical price.
      room.ratePlans.push({ id: `${room.id}-legacy`, mealPlan: room.breakfast ? 'BB' : 'RO', rateType: 'standard', currency: 'IQD', priceBasis: 'per_room_night', nightlyPrice: Number(room.nightlyPrice), status: 'active', refundability: 'unknown', legacy: true, notes: 'خطة توافق منقولة من السعر والإفطار السابقين.' });
    }
  });
  h.modelVersion = Math.max(h.modelVersion || 0, HOTEL_MODEL_VERSION);
  return h;
}

/** Items that must be fixed before publication (empty array = ready). */
export function publishChecklist(hotel) {
  const missing = [];
  if (!String(hotel.name || '').trim()) missing.push('اسم الفندق بالعربية');
  if (!hotel.city) missing.push('المدينة');
  if (!String(hotel.address || '').trim()) missing.push('العنوان الكامل');
  if (!String(hotel.description || '').trim()) missing.push('وصف الفندق');
  if (!hotel.checkIn || !hotel.checkOut) missing.push('وقت الوصول والمغادرة');
  if (!String(hotel.cancellationPolicy || '').trim()) missing.push('معلومات الإلغاء');
  if (!(hotel.rooms || []).length) missing.push('نوع غرفة واحد على الأقل');
  if ((hotel.rooms || []).some(r => !activeRatePlans(r).length)) missing.push('خطة سعر فعالة لكل غرفة');
  return missing;
}

export const emptyHotelFilters = { city: '', stars: '', hotelType: '', facility: '', mealPlan: '', viewType: '' };

/** True when a hotel record satisfies every selected list filter. */
export function matchHotel(record, f) {
  if (f.city && record.city !== f.city) return false;
  if (f.stars && Number(record.stars) !== Number(f.stars)) return false;
  if (f.hotelType && (record.hotelType || 'hotel') !== f.hotelType) return false;
  if (f.facility && !(record.facilities || []).some(x => x.code === f.facility)) return false;
  if (f.mealPlan && !(record.rooms || []).some(r => (r.ratePlans || []).some(p => p.status !== 'inactive' && p.mealPlan === f.mealPlan))) return false;
  if (f.viewType && !(record.rooms || []).some(r => r.viewType === f.viewType)) return false;
  return true;
}

/** Supplier cost for the same stay, only when the rate plan configures it. */
export function supplierTotal(plan, quote, rooms, adults) {
  if (plan?.supplierCost == null || plan.supplierCost === '') return null;
  const c = Number(plan.supplierCost);
  if (plan.priceBasis === 'per_person_night') return c * quote.nights * adults;
  if (plan.priceBasis === 'per_room_stay') return c * rooms;
  return c * quote.nights * rooms;
}
