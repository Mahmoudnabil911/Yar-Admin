(() => {
  'use strict';

  const cities = ['مشهد', 'طهران', 'شمال إيران', 'شيراز', 'أصفهان'];
  const text = value => String(value ?? '').trim();
  const inclusions = 'النقل بسيارة خاصة حتى 3 أشخاص. تُنسق المواعيد ونقطة الانطلاق مع الفريق.';
  const exclusions = 'الوجبات وتذاكر دخول المعالم.';
  const priceBasis = 'بالدولار الأمريكي للمجموعة حتى 3 أشخاص؛ سعر تجريبي يحتاج تأكيد الفريق.';
  const seed = [
    { id: 'tour-mashhad', city: 'مشهد', name: 'اكتشف مدينة مشهد', duration: 4, priceUSD: 45, itinerary: 'محيط حرم الإمام الرضا · بازار رضا · وقت حر للتسوّق', photos: ['assets/content/mashhad.jpg'] },
    { id: 'tour-tehran', city: 'طهران', name: 'معالم طهران', duration: 6, priceUSD: 65, itinerary: 'برج آزادي · قصر كلستان · البازار الكبير', photos: ['assets/content/tehran.jpg'] },
    { id: 'tour-masuleh', city: 'شمال إيران', name: 'يوم في ماسوله', duration: 8, priceUSD: 85, itinerary: 'قرية ماسوله · الأزقة والأسواق المحلية · توقف للتصوير في الطبيعة', photos: ['assets/content/masuleh.jpg'] },
    { id: 'tour-shiraz', city: 'شيراز', name: 'ألوان شيراز', duration: 5, priceUSD: 55, itinerary: 'مسجد نصير الملك · بازار وكيل · حديقة إرم', photos: ['assets/content/shiraz.jpg'] },
  ].map(record => ({ ...record, inclusions, exclusions, priceBasis, capacity: 3, serviceProvider: 'provider-tours', status: 'published' }));

  window.YAR_CATALOG_TYPES ??= {};
  window.YAR_CATALOG_TYPES.tours = {
    title: 'إدارة الجولات السياحية',
    singular: 'جولة سياحية',
    addLabel: 'إضافة جولة سياحية',
    icon: 'map',
    description: 'نظّم الجولات ومدتها ومسارها والخدمات المشمولة وصورها وسعر المجموعة. جميع البيانات للمعاينة المحلية فقط.',
    searchPlaceholder: 'ابحث باسم الجولة أو المدينة أو معالم المسار…',
    columns: [
      { key: 'name', label: 'الجولة' },
      { key: 'city', label: 'المدينة' },
      { key: 'duration', label: 'المدة', render: (record, ctx) => ctx.esc(`${record.duration} ساعات`) },
      { key: 'capacity', label: 'سعة المجموعة' },
      { key: 'priceUSD', label: 'سعر المجموعة', format: 'moneyUSD' },
      { key: 'serviceProvider', label: 'مزوّد الجولة' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
    fields: [
      { key: 'name', label: 'اسم الجولة', type: 'text', required: true, placeholder: 'مثال: اكتشف مدينة مشهد' },
      { key: 'city', label: 'المدينة', type: 'select', required: true, options: cities.map(city => ({ value: city, label: city })) },
      { key: 'duration', label: 'المدة بالساعات', type: 'number', required: true, min: 0.5, max: 72, step: 0.5 },
      { key: 'itinerary', label: 'المسار والمعالم', type: 'textarea', required: true, placeholder: 'المعالم والتوقفات بالترتيب' },
      { key: 'inclusions', label: 'ما يشمله السعر', type: 'textarea', placeholder: 'النقل والخدمات المشمولة' },
      { key: 'exclusions', label: 'ما لا يشمله السعر', type: 'textarea', placeholder: 'الوجبات وتذاكر الدخول أو اكتب «لا توجد استثناءات»' },
      { key: 'photos', label: 'صور الجولة', type: 'photos', placeholder: 'رابط صورة في كل سطر أو مسار صورة من المكتبة المحلية' },
      { key: 'priceUSD', label: 'سعر المجموعة بالدولار', type: 'number', required: true, min: 0.01, max: 100000, step: 0.01 },
      { key: 'priceBasis', label: 'أساس احتساب السعر', type: 'textarea', required: true, placeholder: 'مثال: للمجموعة حتى 3 أشخاص، مع تأكيد التوفر والسعر النهائي.' },
      { key: 'capacity', label: 'الحد الأقصى لأشخاص المجموعة', type: 'number', required: true, min: 1, max: 50, step: 1 },
      {
        key: 'serviceProvider', label: 'مزوّد الجولات (اختياري)', type: 'select',
        options(allCatalogs) {
          return (allCatalogs.providers || []).filter(provider => provider.serviceType === 'tour')
            .map(provider => ({ value: provider.id, label: provider.name + (provider.status === 'published' ? '' : provider.status === 'archived' ? ' · مؤرشف' : ' · مسودة') }));
        },
      },
    ],
    seed,
    validate(record, allCatalogs = {}) {
      if (!text(record.name)) return 'اكتب اسم الجولة السياحية.';
      if (!cities.includes(record.city)) return 'اختر مدينة صالحة للجولة.';
      const duration = Number(record.duration), capacity = Number(record.capacity), price = Number(record.priceUSD);
      if (!Number.isFinite(duration) || duration < 0.5 || duration > 72 || duration * 2 !== Math.round(duration * 2)) return 'مدة الجولة يجب أن تكون من نصف ساعة إلى 72 ساعة، بزيادات نصف ساعة.';
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) return 'سعة المجموعة يجب أن تكون رقمًا صحيحًا من 1 إلى 50 شخصًا.';
      if (!Number.isFinite(price) || price <= 0 || price > 100000) return 'أدخل سعرًا للمجموعة أكبر من صفر وحتى 100,000 دولار.';
      if (!text(record.itinerary)) return 'اكتب مسار الجولة والمعالم المشمولة.';
      if (!text(record.priceBasis)) return 'وضّح أساس احتساب سعر الجولة.';
      if (record.status === 'published') {
        if (!text(record.inclusions) || !text(record.exclusions)) return 'وضّح الخدمات المشمولة وغير المشمولة قبل نشر الجولة.';
        if (!Array.isArray(record.photos) || !record.photos.length) return 'أضف صورة واحدة على الأقل قبل نشر الجولة.';
      }
      if (text(record.serviceProvider)) {
        const provider = (allCatalogs.providers || []).find(item => item.id === record.serviceProvider && item.serviceType === 'tour');
        if (!provider) return 'اختر مزوّد جولات موجودًا أو اترك المزوّد فارغًا.';
        if (record.status === 'published' && provider.status !== 'published') return 'اختر مزوّد جولات منشورًا قبل نشر الجولة أو أزل الربط الاختياري.';
      }
      return '';
    },
  };
})();
