import {minimumRoomPrice,occupancyError,seasonError} from '../hotelPricing';
import {hotelFields} from './hotel-schema.js';
(() => {
  'use strict';

  const photos = [
    'assets/external/image-03.jpg',
    'assets/external/image-02.jpg',
    'assets/external/image-06.jpg',
  ];
  const cancellationPolicy = 'سياسة الإلغاء في هذا النموذج غير معتمدة؛ تُراجع السياسة النهائية مع الفريق قبل الحجز.';
  const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };

  const validateHotel = record => {
    const stars = Number(record.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return 'اختر تصنيفًا من نجمة واحدة إلى خمس نجوم.';
    for (const key of ['checkIn', 'checkOut']) {
      if (record[key] && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(record[key])) return 'اكتب وقت الوصول والمغادرة بصيغة HH:mm من 00:00 إلى 23:59.';
    }
    if (record.status === 'published' && (!record.checkIn || !record.checkOut || !String(record.cancellationPolicy || '').trim())) return 'أكمل وقت الوصول والمغادرة ومعلومات الإلغاء قبل نشر الفندق.';
    if (record.latitude != null && (record.latitude < -90 || record.latitude > 90)) return 'خط العرض يجب أن يكون بين -90 و90.';
    if (record.longitude != null && (record.longitude < -180 || record.longitude > 180)) return 'خط الطول يجب أن يكون بين -180 و180.';
    if (record.mapsUrl && !/^https:\/\//.test(record.mapsUrl)) return 'رابط خرائط جوجل يجب أن يبدأ بـ https://';
    const codes = (record.facilities || []).map(f => f.code);
    if (new Set(codes).size !== codes.length) return 'كل مرفق يُضاف مرة واحدة فقط.';
    const rooms = Array.isArray(record.rooms) ? record.rooms : [];
    if (record.status === 'published' && !rooms.length) return 'أضف نوع غرفة واحدًا على الأقل قبل نشر الفندق.';
    if (rooms.length > 30) return 'يمكن إضافة 30 خيار غرفة كحد أقصى.';
    const names = new Set();
    for (let index = 0; index < rooms.length; index += 1) {
      const room = rooms[index];
      const name = String(room.name || '').trim();
      const capacity = Number(room.capacity);
      if (!name) return `اكتب اسم الغرفة رقم ${index + 1}.`;
      if (names.has(name)) return 'استخدم اسمًا مختلفًا لكل خيار غرفة داخل الفندق (مثال: ديلوكس — إطلالة بحر).';
      names.add(name);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 12) return `الحد الأقصى للنزلاء في «${name}» يجب أن يكون من 1 إلى 12.`;
      const occ = occupancyError(room);
      if (occ) return `«${name}»: ${occ}`;
      for (const bed of room.beds || []) {
        if (!bed.type) return `اختر نوع كل سرير في «${name}».`;
        if (!Number.isInteger(Number(bed.quantity)) || Number(bed.quantity) < 1 || Number(bed.quantity) > 10) return `عدد الأسرّة في «${name}» يجب أن يكون من 1 إلى 10.`;
      }
      const plans = room.ratePlans || [];
      const planIds = new Set();
      for (const plan of plans) {
        if (!plan.id || planIds.has(plan.id)) return `معرّف خطة سعر مكرر في «${name}».`;
        planIds.add(plan.id);
        if (!plan.mealPlan) return `اختر نظام الوجبات لكل خطة سعر في «${name}».`;
        if (!['IQD', 'USD'].includes(plan.currency)) return `اختر عملة كل خطة سعر في «${name}».`;
        const price = Number(plan.nightlyPrice);
        const [min, max] = plan.currency === 'USD' ? [1, 100000] : [1000, 100000000];
        if (!Number.isFinite(price) || price < min || price > max) return `سعر خطة «${plan.mealPlan}» في «${name}» خارج الحدود المسموحة.`;
        if (plan.validFrom && plan.validTo && plan.validFrom > plan.validTo) return `بداية صلاحية خطة السعر بعد نهايتها في «${name}».`;
        for (const key of ['extraAdultCharge', 'childCharge', 'extraBedCharge', 'supplierCost']) if (plan[key] != null && Number(plan[key]) < 0) return `الرسوم في «${name}» لا يمكن أن تكون سالبة.`;
        if (plan.minStay != null && (!Number.isInteger(Number(plan.minStay)) || Number(plan.minStay) < 1)) return `الحد الأدنى للإقامة في «${name}» يجب أن يكون ليلة أو أكثر.`;
      }
      if (!plans.length && !(Number(room.nightlyPrice) > 0)) return `أضف خطة سعر واحدة على الأقل للغرفة «${name}».`;
      const se = seasonError(room);
      if (se) return `«${name}»: ${se}`;
      const periods = Array.isArray(room.availability) ? room.availability : [];
      if (periods.length > 24) return `يمكن إضافة 24 فترة كحد أقصى للغرفة «${name}».`;
      for (const period of periods) {
        if (!validDate(period.startDate) || !validDate(period.endDate) || period.startDate > period.endDate) return `راجع تاريخ بداية ونهاية كل فترة للغرفة «${name}».`;
        const available = Number(period.availableRooms);
        if (period.availableRooms == null || !Number.isInteger(available) || available < 0 || available > 1000) return `عدد الغرف المتاحة للفترة في «${name}» يجب أن يكون رقمًا صحيحًا من 0 إلى 1,000.`;
      }
      const sorted = [...periods].sort((left, right) => left.startDate.localeCompare(right.startDate));
      if (sorted.some((period, i) => i > 0 && period.startDate <= sorted[i - 1].endDate)) return `فترات التوافر للغرفة «${name}» متداخلة؛ يوم النهاية مشمول.`;
    }
    return '';
  };

  window.YAR_CATALOG_TYPES ??= {};
  window.YAR_CATALOG_TYPES.hotels = {
    title: 'إدارة الفنادق',
    singular: 'فندق',
    addLabel: 'إضافة فندق',
    icon: 'hotel',
    description: 'نظّم الفنادق ومرافقها والغرف والإطلالات والأسرّة وأنظمة الوجبات والأسعار والتوافر في مكان واحد.',
    searchPlaceholder: 'ابحث باسم الفندق أو المدينة أو العنوان…',
    columns: [
      { key: 'name', label: 'الفندق' },
      { key: 'city', label: 'المدينة' },
      { key: 'stars', label: 'التصنيف', format: 'stars' },
      { key: 'rooms', label: 'الغرف والخيارات', render(record, ctx) { const rooms = record.rooms || []; const types = new Set(rooms.map(r => r.category || r.name)).size; return ctx.esc(`${types} أنواع · ${rooms.length} خيارات`); } },
      { key: 'mealPlans', label: 'أنظمة الوجبات', render(record, ctx) { const codes = [...new Set((record.rooms || []).flatMap(r => (r.ratePlans || []).filter(p => p.status !== 'inactive').map(p => p.mealPlan)).filter(Boolean))]; return codes.length ? codes.map(c => `<span class="meal-code">${ctx.esc(c)}</span>`).join(' ') : '—'; } },
      {
        key: 'nightlyPrice', label: 'الليلة تبدأ من',
        render(record, ctx) {
          const price = minimumRoomPrice(record.rooms);
          return price!==null ? ctx.esc(new Intl.NumberFormat('en-US').format(price) + ' د.ع') : '—';
        },
      },
      { key: 'photos', label: 'الصور', format: 'photos' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
    fields: hotelFields,
    seed: [
      {
        id: 'hotel-yar-gardens', name: 'فندق حدائق يار', city: 'مشهد', stars: 5,
        address: 'مشهد، شارع الإمام الرضا، بالقرب من الحرم',
        description: 'إقامة مريحة في قلب مشهد مع غرف واسعة وخدمة استقبال على مدار الساعة. صور وبيانات توضيحية للنموذج.',
        checkIn: '14:00', checkOut: '12:00', cancellationPolicy,
        photos: [photos[0]], status: 'published',
        rooms: [
          { name: 'غرفة قياسية مزدوجة', capacity: 2, nightlyPrice: 145000, breakfast: true, photos: [photos[0]], availability: [] },
          { name: 'غرفة كومفورت', capacity: 3, nightlyPrice: 180000, breakfast: true, photos: [], availability: [] },
        ],
      },
      {
        id: 'hotel-afaq', name: 'فندق أفق', city: 'طهران', stars: 4,
        address: 'طهران، وسط المدينة، شارع ولي عصر',
        description: 'فندق عملي قريب من معالم طهران ومناطق التسوق، مع خيارات غرف للأفراد والعائلات. بيانات توضيحية للنموذج.',
        checkIn: '14:00', checkOut: '12:00', cancellationPolicy,
        photos: [photos[1]], status: 'published',
        rooms: [
          { name: 'غرفة قياسية مزدوجة', capacity: 2, nightlyPrice: 105000, breakfast: false, photos: [photos[1]], availability: [] },
          { name: 'غرفة كومفورت', capacity: 3, nightlyPrice: 140000, breakfast: false, photos: [], availability: [] },
        ],
      },
      {
        id: 'hotel-naseem', name: 'فندق نسيم', city: 'شيراز', stars: 3,
        address: 'شيراز، مركز المدينة، بالقرب من بازار وكيل',
        description: 'خيار اقتصادي لاستكشاف شيراز ومواقعها الثقافية، مع غرف هادئة وخدمة ودودة. بيانات توضيحية للنموذج.',
        checkIn: '14:00', checkOut: '12:00', cancellationPolicy,
        photos: [photos[2]], status: 'draft',
        rooms: [
          { name: 'غرفة قياسية مزدوجة', capacity: 2, nightlyPrice: 75000, breakfast: false, photos: [photos[2]], availability: [] },
          { name: 'غرفة عائلية', capacity: 4, nightlyPrice: 110000, breakfast: true, photos: [], availability: [] },
        ],
      },
    ],
    validate: validateHotel,
  };
})();
