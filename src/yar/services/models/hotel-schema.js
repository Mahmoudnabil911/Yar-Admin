// Field schema used by catalog storage to sanitize hotel records (unknown keys are dropped).
// The dedicated hotel editor renders these groups; codes come from ../hotelCatalog.
const t = (key, extra = {}) => ({ key, type: 'text', ...extra });
const n = (key, extra = {}) => ({ key, type: 'number', ...extra });
const b = key => ({ key, type: 'checkbox' });
const ta = key => ({ key, type: 'textarea' });
const gallery = { key: 'gallery', type: 'repeat', maxItems: 12, fields: [t('category'), { key: 'photos', type: 'photos' }, t('captionAr'), t('captionEn'), t('altAr'), t('altEn')] };

export const ratePlanFields = [
  t('id'), t('mealPlan'), t('secondMeal'), t('rateType'), t('nameAr'), t('nameEn'), t('currency'), t('priceBasis'),
  n('nightlyPrice'), n('supplierCost'), n('includedGuests'), n('extraAdultCharge'), n('childCharge'), n('extraBedCharge'),
  { key: 'validFrom', type: 'date' }, { key: 'validTo', type: 'date' }, t('refundability'), ta('cancellationPolicy'), n('minStay'),
  t('status'), t('taxesInfo'), ta('includedMeals'), t('includedDrinks'), t('includedSnacks'), t('includedRestaurants'), t('serviceHours'),
  ta('benefits'), ta('exclusions'), ta('childMealPolicy'), ta('notes'), b('legacy'),
];

export const roomFields = [
  t('id'), { key: 'name', type: 'text', required: true }, t('nameEn'), t('category'), t('viewType'), t('view'),
  { key: 'beds', type: 'repeat', maxItems: 6, fields: [t('type'), n('quantity')] }, b('bedGuaranteed'), t('bedType'),
  ta('description'), ta('descriptionEn'), n('size'), n('standardAdults'), n('maxAdults'), n('maxChildren'),
  { key: 'capacity', type: 'number', required: true }, n('includedGuests'), b('extraAdultAllowed'), b('extraChildAllowed'),
  b('extraBedAvailable'), b('babyCotAvailable'), n('inventory'), { key: 'amenityCodes', type: 'codes' }, ta('amenities'),
  b('privateBathroom'), b('smokingAllowed'), ta('cancellationPolicy'), n('nightlyPrice'), b('breakfast'),
  { key: 'photos', type: 'photos' }, gallery,
  { key: 'ratePlans', type: 'repeat', maxItems: 12, fields: ratePlanFields },
  { key: 'seasons', type: 'repeat', maxItems: 40, fields: [t('name'), t('ratePlanId'), { key: 'startDate', type: 'date' }, { key: 'endDate', type: 'date' }, n('nightlyPrice'), n('minStay')] },
  { key: 'availability', type: 'repeat', maxItems: 24, fields: [{ key: 'startDate', type: 'date' }, { key: 'endDate', type: 'date' }, n('nightlyPrice'), n('totalRooms'), n('availableRooms'), b('closed')] },
];

export const hotelFields = [
  { key: 'name', label: 'اسم الفندق', type: 'text', required: true }, t('nameEn'), t('code'), t('hotelType'),
  { key: 'stars', type: 'number', required: true }, t('country'),
  { key: 'city', type: 'select', required: true, options: ['مشهد', 'طهران', 'شيراز', 'أصفهان', 'شمال إيران'].map(city => ({ value: city, label: city })) },
  t('area'), { key: 'address', type: 'text', required: true }, t('mapsUrl'), n('latitude'), n('longitude'), ta('landmarks'),
  { key: 'description', type: 'textarea', required: true }, ta('descriptionEn'), t('website'), t('phone'), t('receptionHours'),
  t('checkIn'), t('checkOut'), ta('propertyPolicies'), ta('cancellationPolicy'), n('minCheckInAge'), ta('childrenPolicy'),
  ta('extraBedPolicy'), ta('petPolicy'), ta('smokingPolicy'), ta('notes'),
  { key: 'facilities', type: 'repeat', maxItems: 120, fields: [t('code'), t('charge'), t('notes'), t('labelAr'), t('labelEn'), t('category')] },
  { key: 'photos', type: 'photos', label: 'صور الفندق' }, gallery,
  { key: 'rooms', type: 'repeat', maxItems: 30, fields: roomFields },
  n('modelVersion'),
];

const p = ['assets/external/image-03.jpg', 'assets/external/image-02.jpg', 'assets/external/image-06.jpg'];
const rate = (id, mealPlan, nightlyPrice, extra = {}) => ({ id, mealPlan, rateType: 'standard', currency: 'IQD', priceBasis: 'per_room_night', nightlyPrice, status: 'active', refundability: 'unknown', notes: 'سعر نموذجي للتجربة فقط؛ ليس سعر مورد فعلي.', ...extra });

/** Clearly fictional sample used to exercise the full hotel configuration. */
export const sampleResort = {
  id: 'DEMO-FINAL-CAT-hotel-yar-resort', name: 'منتجع YAR (نموذج)', nameEn: 'YAR Resort (Sample)', code: 'YAR-RES-01', hotelType: 'resort', stars: 5,
  country: 'إيران', city: 'شمال إيران', area: 'الساحل', address: 'عنوان نموذجي على الساحل — بيانات تجريبية',
  description: 'منتجع نموذجي لاختبار إدارة الغرف والإطلالات وأنظمة الوجبات. جميع البيانات والأسعار تجريبية.',
  descriptionEn: 'A fictional resort used to validate room, view and meal-plan management. All data and prices are samples.',
  checkIn: '14:00', checkOut: '12:00', cancellationPolicy: 'سياسة نموذجية؛ تُعتمد السياسة النهائية مع المورد قبل الحجز.',
  photos: [p[0], p[1]], gallery: [], status: 'draft', modelVersion: 3,
  facilities: ['free_wifi', 'outdoor_pool', 'gym', 'spa', 'restaurant', 'reception_24h', 'free_parking'].map(code => ({ code, charge: code === 'spa' ? 'paid' : 'included', notes: '' })),
  rooms: [
    { id: 'yar-resort-standard-garden', name: 'غرفة قياسية — إطلالة حديقة', nameEn: 'Standard Room — Garden View', category: 'standard', viewType: 'garden',
      beds: [{ type: 'queen', quantity: 1 }], bedGuaranteed: true, size: 28, standardAdults: 2, maxAdults: 2, maxChildren: 1, capacity: 3, includedGuests: 2,
      extraAdultAllowed: false, extraChildAllowed: true, extraBedAvailable: false, babyCotAvailable: true, inventory: 10,
      amenityCodes: ['air_conditioning', 'room_wifi', 'tv', 'minibar', 'private_bathroom'], privateBathroom: true, photos: [p[2]], gallery: [],
      ratePlans: [rate('yar-std-ro', 'RO', 120000), rate('yar-std-bb', 'BB', 140000)], seasons: [], availability: [] },
    { id: 'yar-resort-deluxe-sea', name: 'غرفة ديلوكس — إطلالة بحر', nameEn: 'Deluxe Room — Sea View', category: 'deluxe', viewType: 'sea',
      beds: [{ type: 'king', quantity: 1 }], bedGuaranteed: true, size: 35, standardAdults: 2, maxAdults: 2, maxChildren: 1, capacity: 3, includedGuests: 2,
      extraAdultAllowed: false, extraChildAllowed: true, extraBedAvailable: false, babyCotAvailable: true, inventory: 6,
      amenityCodes: ['balcony', 'air_conditioning', 'room_wifi', 'smart_tv', 'minibar', 'bathtub', 'private_bathroom'], privateBathroom: true, photos: [p[0]], gallery: [],
      ratePlans: [rate('yar-dlx-ro', 'RO', 150000), rate('yar-dlx-bb', 'BB', 175000), rate('yar-dlx-hb', 'HB', 205000, { secondMeal: 'dinner' }), rate('yar-dlx-fb', 'FB', 230000), rate('yar-dlx-ai', 'AI', 280000, { benefits: 'تُحدد مزايا الباقة الشاملة مع الفندق.' })],
      seasons: [], availability: [] },
  ],
};
