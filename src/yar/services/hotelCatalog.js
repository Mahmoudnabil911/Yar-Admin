// Stable hotel option codes with localized labels. Records store codes only;
// labels are looked up here so translations can change without touching data.
const rows = list => list.map(([code, ar, en]) => ({ code, ar, en }));

export const HOTEL_TYPES = rows([
  ['hotel', 'فندق', 'Hotel'], ['resort', 'منتجع', 'Resort'], ['boutique', 'فندق بوتيك', 'Boutique Hotel'],
  ['aparthotel', 'شقق فندقية', 'Aparthotel'], ['serviced_apartment', 'شقة مخدومة', 'Serviced Apartment'],
  ['guesthouse', 'بيت ضيافة', 'Guesthouse'], ['villa', 'فيلا', 'Villa'], ['chalet', 'شاليه', 'Chalet'],
]);

export const FACILITY_CATEGORIES = [
  { code: 'internet', ar: 'الإنترنت والاتصال', en: 'Internet & Connectivity', items: rows([
    ['free_wifi', 'واي فاي مجاني', 'Free Wi-Fi'], ['paid_wifi', 'واي فاي مدفوع', 'Paid Wi-Fi'],
    ['public_wifi', 'إنترنت في الأماكن العامة', 'Wi-Fi in Public Areas'], ['business_center', 'مركز أعمال', 'Business Center'],
  ]) },
  { code: 'pools', ar: 'المسابح', en: 'Swimming Pools', items: rows([
    ['outdoor_pool', 'مسبح خارجي', 'Outdoor Swimming Pool'], ['indoor_pool', 'مسبح داخلي', 'Indoor Swimming Pool'],
    ['heated_pool', 'مسبح مدفأ', 'Heated Swimming Pool'], ['kids_pool', 'مسبح أطفال', "Children's Pool"],
    ['infinity_pool', 'مسبح إنفينيتي', 'Infinity Pool'], ['rooftop_pool', 'مسبح على السطح', 'Rooftop Pool'],
    ['private_pool_facilities', 'مرافق مسبح خاص', 'Private Pool Facilities'], ['poolside_service', 'خدمة بجانب المسبح', 'Poolside Service'],
  ]) },
  { code: 'wellness', ar: 'اللياقة والعافية', en: 'Fitness & Wellness', items: rows([
    ['gym', 'صالة ألعاب رياضية', 'Fitness Center / Gym'], ['spa', 'سبا', 'Spa'], ['sauna', 'ساونا', 'Sauna'],
    ['steam_room', 'غرفة بخار', 'Steam Room'], ['jacuzzi', 'جاكوزي', 'Jacuzzi / Hot Tub'], ['massage', 'خدمات مساج', 'Massage Services'],
    ['beauty_salon', 'صالون تجميل', 'Beauty Salon'], ['wellness_center', 'مركز عافية', 'Wellness Center'],
  ]) },
  { code: 'dining', ar: 'المطاعم والمشروبات', en: 'Food & Beverage', items: rows([
    ['restaurant', 'مطعم', 'Restaurant'], ['multiple_restaurants', 'عدة مطاعم', 'Multiple Restaurants'], ['cafe', 'مقهى', 'Café'],
    ['coffee_shop', 'كوفي شوب', 'Coffee Shop'], ['breakfast_restaurant', 'مطعم إفطار', 'Breakfast Restaurant'],
    ['buffet_restaurant', 'مطعم بوفيه', 'Buffet Restaurant'], ['room_service', 'خدمة الغرف', 'Room Service'],
    ['room_service_24h', 'خدمة غرف 24 ساعة', '24-Hour Room Service'],
  ]) },
  { code: 'guest', ar: 'الاستقبال وخدمات النزلاء', en: 'Reception & Guest Services', items: rows([
    ['reception_24h', 'استقبال 24 ساعة', '24-Hour Reception'], ['concierge', 'كونسيرج', 'Concierge'],
    ['luggage_storage', 'حفظ الأمتعة', 'Luggage Storage'], ['currency_exchange', 'صرافة عملات', 'Currency Exchange'],
    ['laundry', 'خدمة غسيل الملابس', 'Laundry Service'], ['dry_cleaning', 'تنظيف جاف', 'Dry Cleaning'],
    ['housekeeping', 'تنظيف يومي', 'Daily Housekeeping'], ['tour_desk', 'مكتب تنظيم رحلات', 'Tour Desk'],
    ['wake_up', 'خدمة الإيقاظ', 'Wake-Up Service'], ['multilingual_staff', 'موظفون متعددو اللغات', 'Multilingual Staff'],
  ]) },
  { code: 'transport', ar: 'النقل والمواقف', en: 'Transport & Parking', items: rows([
    ['free_parking', 'مواقف مجانية', 'Free Parking'], ['paid_parking', 'مواقف مدفوعة', 'Paid Parking'],
    ['private_parking', 'مواقف خاصة', 'Private Parking'], ['valet_parking', 'خدمة صف السيارات', 'Valet Parking'],
    ['airport_shuttle', 'نقل من وإلى المطار', 'Airport Shuttle'], ['shuttle', 'خدمة نقل', 'Shuttle Service'],
    ['car_rental', 'مكتب تأجير سيارات', 'Car Rental Desk'],
  ]) },
  { code: 'family', ar: 'العائلة والترفيه', en: 'Family & Entertainment', items: rows([
    ['kids_club', 'نادي أطفال', 'Kids Club'], ['playground', 'منطقة ألعاب أطفال', "Children's Playground"],
    ['babysitting', 'خدمة رعاية الأطفال', 'Babysitting'], ['entertainment', 'أنشطة ترفيهية', 'Entertainment Activities'],
    ['games_room', 'غرفة ألعاب', 'Games Room'], ['private_beach', 'شاطئ خاص', 'Private Beach'],
    ['beach_access', 'وصول إلى الشاطئ', 'Beach Access'], ['garden', 'حديقة', 'Garden'],
  ]) },
  { code: 'safety', ar: 'سهولة الوصول والسلامة', en: 'Accessibility & Safety', items: rows([
    ['elevator', 'مصعد', 'Elevator'], ['wheelchair', 'سهولة وصول الكراسي المتحركة', 'Wheelchair Accessibility'],
    ['accessible_rooms', 'غرف مجهزة لذوي الإعاقة', 'Accessible Rooms'], ['accessible_parking', 'مواقف مخصصة', 'Accessible Parking'],
    ['cctv', 'كاميرات مراقبة بالأماكن العامة', 'CCTV in Common Areas'], ['security', 'أفراد أمن', 'Security Personnel'],
    ['smoke_detectors', 'كواشف دخان', 'Smoke Detectors'], ['fire_safety', 'معدات السلامة من الحريق', 'Fire Safety Equipment'],
  ]) },
];

export const ROOM_AMENITY_CATEGORIES = [
  { code: 'comfort', ar: 'الراحة', en: 'Comfort', items: rows([
    ['air_conditioning', 'تكييف', 'Air Conditioning'], ['heating', 'تدفئة', 'Heating'], ['soundproofing', 'عزل صوت', 'Soundproofing'],
    ['blackout_curtains', 'ستائر معتمة', 'Blackout Curtains'], ['wardrobe', 'خزانة ملابس', 'Wardrobe'], ['desk', 'مكتب', 'Desk'],
    ['seating_area', 'منطقة جلوس', 'Seating Area'], ['sofa', 'أريكة', 'Sofa'], ['connecting_door', 'باب لغرف متصلة', 'Connecting Door'],
  ]) },
  { code: 'media', ar: 'الترفيه والاتصال', en: 'Entertainment & Connectivity', items: rows([
    ['room_wifi', 'إنترنت مجاني بالغرفة', 'Free Room Wi-Fi'], ['tv', 'تلفزيون', 'Television'], ['smart_tv', 'تلفزيون ذكي', 'Smart TV'],
    ['satellite', 'قنوات فضائية', 'Satellite Channels'], ['telephone', 'هاتف', 'Telephone'], ['usb_ports', 'منافذ شحن USB', 'USB Charging Ports'],
  ]) },
  { code: 'bathroom', ar: 'الحمام', en: 'Bathroom', items: rows([
    ['private_bathroom', 'حمام خاص', 'Private Bathroom'], ['shower', 'دش', 'Shower'], ['bathtub', 'حوض استحمام', 'Bathtub'],
    ['jacuzzi_bath', 'جاكوزي داخل الحمام', 'Jacuzzi Bath'], ['hair_dryer', 'مجفف شعر', 'Hair Dryer'], ['bathrobes', 'أردية حمام', 'Bathrobes'],
    ['slippers', 'نعال', 'Slippers'], ['toiletries', 'مستلزمات استحمام', 'Toiletries'], ['towels', 'مناشف', 'Towels'],
  ]) },
  { code: 'food', ar: 'الطعام والمشروبات', en: 'Food & Beverage', items: rows([
    ['mini_fridge', 'ثلاجة صغيرة', 'Mini Fridge'], ['minibar', 'ميني بار', 'Minibar'], ['kettle', 'غلاية كهربائية', 'Electric Kettle'],
    ['coffee_machine', 'ماكينة قهوة', 'Coffee Machine'], ['water', 'مياه مجانية', 'Complimentary Water'],
    ['kitchenette', 'مطبخ صغير', 'Kitchenette'], ['full_kitchen', 'مطبخ متكامل', 'Full Kitchen'], ['microwave', 'ميكروويف', 'Microwave'],
  ]) },
  { code: 'outdoor', ar: 'المساحات الخارجية والمميزات', en: 'Outdoor & Special Features', items: rows([
    ['balcony', 'شرفة', 'Balcony'], ['terrace', 'تراس', 'Terrace'], ['private_garden', 'حديقة خاصة', 'Private Garden'],
    ['private_pool', 'مسبح خاص', 'Private Pool'], ['pool_access', 'دخول مباشر للمسبح', 'Pool Access'], ['outdoor_seating', 'جلسة خارجية', 'Outdoor Seating'],
  ]) },
  { code: 'room_safety', ar: 'الأمان', en: 'Safety', items: rows([
    ['safe', 'خزنة داخل الغرفة', 'In-Room Safe'], ['smoke_detector', 'كاشف دخان', 'Smoke Detector'], ['electronic_lock', 'قفل إلكتروني', 'Electronic Door Lock'],
  ]) },
];

export const ROOM_CATEGORIES = rows([
  ['standard', 'غرفة قياسية', 'Standard Room'], ['superior', 'غرفة سوبيريور', 'Superior Room'], ['deluxe', 'غرفة ديلوكس', 'Deluxe Room'],
  ['premium', 'غرفة بريميوم', 'Premium Room'], ['executive', 'غرفة تنفيذية', 'Executive Room'], ['single', 'غرفة مفردة', 'Single Room'],
  ['double', 'غرفة مزدوجة', 'Double Room'], ['twin', 'غرفة بسريرين منفصلين', 'Twin Room'], ['triple', 'غرفة ثلاثية', 'Triple Room'],
  ['quadruple', 'غرفة رباعية', 'Quadruple Room'], ['family', 'غرفة عائلية', 'Family Room'], ['studio', 'استوديو', 'Studio'],
  ['junior_suite', 'جناح جونيور', 'Junior Suite'], ['executive_suite', 'جناح تنفيذي', 'Executive Suite'], ['family_suite', 'جناح عائلي', 'Family Suite'],
  ['presidential_suite', 'جناح رئاسي', 'Presidential Suite'], ['connecting', 'غرف متصلة', 'Connecting Rooms'], ['apartment', 'شقة فندقية', 'Apartment'],
  ['villa', 'فيلا', 'Villa'], ['bungalow', 'بنغل', 'Bungalow'],
]);

export const VIEW_TYPES = rows([
  ['sea', 'إطلالة بحر', 'Sea View'], ['partial_sea', 'إطلالة بحر جزئية', 'Partial Sea View'], ['ocean', 'إطلالة محيط', 'Ocean View'],
  ['garden', 'إطلالة حديقة', 'Garden View'], ['pool', 'إطلالة مسبح', 'Pool View'], ['city', 'إطلالة مدينة', 'City View'],
  ['mountain', 'إطلالة جبل', 'Mountain View'], ['lake', 'إطلالة بحيرة', 'Lake View'], ['river', 'إطلالة نهر', 'River View'],
  ['landmark', 'إطلالة معلم سياحي', 'Landmark View'], ['courtyard', 'إطلالة ساحة داخلية', 'Courtyard View'], ['street', 'إطلالة شارع', 'Street View'],
  ['interior', 'إطلالة داخلية', 'Interior View'], ['unspecified', 'إطلالة غير محددة', 'No Specified View'],
]);

export const BED_TYPES = rows([
  ['single', 'سرير فردي', 'Single Bed'], ['twin', 'سرير توين / فردي', 'Twin Bed'], ['double', 'سرير مزدوج', 'Double Bed'],
  ['queen', 'سرير كوين', 'Queen Bed'], ['king', 'سرير كينج', 'King Bed'], ['super_king', 'سرير سوبر كينج', 'Super King Bed'],
  ['sofa_bed', 'كنبة سرير', 'Sofa Bed'], ['bunk', 'سرير بطابقين', 'Bunk Bed'], ['extra', 'سرير إضافي', 'Extra Bed'], ['cot', 'سرير أطفال', 'Baby Cot / Crib'],
]);

export const MEAL_PLANS = [
  { code: 'RO', ar: 'إقامة فقط', en: 'Room Only', meals: [], descAr: 'إقامة دون وجبات مشمولة.', descEn: 'Accommodation without included meals.' },
  { code: 'BB', ar: 'إقامة مع الإفطار', en: 'Bed & Breakfast', meals: ['breakfast'], descAr: 'إقامة مع الإفطار.', descEn: 'Accommodation with breakfast included.' },
  { code: 'HB', ar: 'نصف إقامة — إفطار وعشاء', en: 'Half Board', meals: ['breakfast', 'second'], descAr: 'إفطار ووجبة رئيسية أخرى تُحدد (عادةً العشاء).', descEn: 'Breakfast and one configurable main meal, usually dinner.' },
  { code: 'FB', ar: 'إقامة كاملة — ثلاث وجبات', en: 'Full Board', meals: ['breakfast', 'lunch', 'dinner'], descAr: 'إفطار وغداء وعشاء؛ المشروبات والإضافات غير مشمولة إلا إذا ذُكرت.', descEn: 'Breakfast, lunch and dinner; drinks and extras are not assumed.' },
  { code: 'AI', ar: 'شامل كليًا', en: 'All Inclusive', meals: ['breakfast', 'lunch', 'dinner'], descAr: 'وجبات وخدمات إضافية حسب سياسة الفندق المحددة.', descEn: "Meals plus services defined by the hotel's own policy." },
  { code: 'UAI', ar: 'شامل كليًا بامتيازات إضافية', en: 'Ultra All Inclusive', meals: ['breakfast', 'lunch', 'dinner'], descAr: 'باقة شاملة موسعة بمزايا خاصة بالفندق.', descEn: 'Extended all-inclusive with property-specific benefits.' },
  { code: 'SC', ar: 'إقامة مع تجهيزات للطبخ', en: 'Self Catering', meals: [], descAr: 'تجهيزات طبخ دون وجبات مشمولة إلا إذا ذُكرت.', descEn: 'Self-catering facilities, no included meals unless stated.' },
];

export const RATE_TYPES = rows([
  ['standard', 'سعر قياسي', 'Standard Rate'], ['non_refundable', 'غير قابل للاسترداد', 'Non-Refundable Rate'],
  ['flexible', 'سعر مرن', 'Flexible Rate'], ['early_booking', 'حجز مبكر', 'Early Booking Rate'],
  ['promotional', 'سعر ترويجي', 'Promotional Rate'], ['seasonal', 'سعر موسمي', 'Seasonal Rate'], ['long_stay', 'إقامة طويلة', 'Long Stay Rate'],
]);

export const PRICE_BASES = rows([
  ['per_room_night', 'لكل غرفة لكل ليلة', 'Per Room Per Night'],
  ['per_person_night', 'لكل شخص لكل ليلة', 'Per Person Per Night'],
  ['per_room_stay', 'لكل غرفة للإقامة كاملة', 'Per Room Per Stay'],
]);

export const REFUNDABILITY = rows([
  ['refundable', 'قابل للاسترداد', 'Refundable'], ['partial', 'استرداد جزئي', 'Partially Refundable'],
  ['non_refundable', 'غير قابل للاسترداد', 'Non-Refundable'], ['unknown', 'غير محدد', 'Not Specified'],
]);

export const FACILITY_CHARGES = rows([
  ['included', 'مشمول', 'Included'], ['paid', 'برسوم', 'Paid'], ['on_request', 'عند الطلب', 'On Request'], ['unknown', 'غير محدد', 'Unknown'],
]);

export const HOTEL_GALLERY_CATEGORIES = rows([
  ['exterior', 'الواجهة الخارجية', 'Exterior'], ['lobby', 'الردهة', 'Lobby'], ['reception', 'الاستقبال', 'Reception'],
  ['restaurant', 'المطعم', 'Restaurant'], ['pool', 'المسبح', 'Swimming Pool'], ['gym', 'الصالة الرياضية', 'Gym'],
  ['spa', 'السبا', 'Spa'], ['garden', 'الحديقة', 'Garden'], ['beach', 'الشاطئ', 'Beach'], ['facilities', 'مرافق عامة', 'General Facilities'],
]);

export const ROOM_GALLERY_CATEGORIES = rows([
  ['room', 'صور الغرفة', 'Room Photos'], ['bathroom', 'الحمام', 'Bathroom'], ['view', 'الإطلالة', 'View'],
  ['balcony', 'الشرفة', 'Balcony'], ['amenities', 'مرافق الغرفة', 'Room Amenities'],
]);

export const SECOND_MEALS = rows([['dinner', 'عشاء', 'Dinner'], ['lunch', 'غداء', 'Lunch']]);

export const HOTEL_STATUSES = rows([['draft', 'مسودة', 'Draft'], ['published', 'منشور', 'Published'], ['archived', 'غير نشط', 'Inactive']]);

export const ALL_FACILITIES = FACILITY_CATEGORIES.flatMap(c => c.items.map(i => ({ ...i, category: c.code })));
export const ALL_ROOM_AMENITIES = ROOM_AMENITY_CATEGORIES.flatMap(c => c.items.map(i => ({ ...i, category: c.code })));

const lists = { HOTEL_TYPES, ROOM_CATEGORIES, VIEW_TYPES, BED_TYPES, MEAL_PLANS, RATE_TYPES, PRICE_BASES, REFUNDABILITY, FACILITY_CHARGES, HOTEL_GALLERY_CATEGORIES, ROOM_GALLERY_CATEGORIES, SECOND_MEALS, HOTEL_STATUSES, ALL_FACILITIES, ALL_ROOM_AMENITIES };

/** Localized label of a stable code, falling back to the stored code. */
export function optionLabel(listName, code, lang = 'ar') {
  const found = (lists[listName] || []).find(o => o.code === code);
  return found ? found[lang === 'en' ? 'en' : 'ar'] : (code || '');
}

/** Arabic→English pairs for the dashboard DOM translator. */
export function hotelTranslations() {
  const pairs = {};
  const add = o => { if (o.ar && o.en) pairs[o.ar] = o.en; };
  Object.values(lists).flat().forEach(add);
  [...FACILITY_CATEGORIES, ...ROOM_AMENITY_CATEGORIES].forEach(add);
  MEAL_PLANS.forEach(m => { pairs[m.descAr] = m.descEn; });
  return pairs;
}
