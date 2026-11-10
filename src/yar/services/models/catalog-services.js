(() => {
  'use strict';

  const cities = ['مشهد', 'طهران', 'شيراز', 'أصفهان', 'شمال إيران'];
  const cityOptions = cities.map(city => ({ value: city, label: city }));
  const serviceLabels = { flight: 'طيران', hotel: 'فنادق', transfer: 'نقل', package: 'باقات سياحية', tour: 'جولات سياحية' };
  const integrationLabels = { api: 'ربط API تجريبي', manual: 'إدارة يدوية' };
  const channelLabels = { ndc: 'NDC', gds: 'GDS', direct: 'مباشر', manual: 'يدوي' };
  const connectionLabels = {
    healthy: 'متاح · تجريبي', slow: 'استجابة بطيئة · تجريبي',
    offline: 'غير متصل · تجريبي', manual: 'إدارة يدوية',
  };
  const capabilityOptions = [
    { value: 'search', label: 'البحث عن التوفر والأسعار' },
    { value: 'booking', label: 'إنشاء الحجز' },
    { value: 'issuance', label: 'الإصدار والتأكيد' },
    { value: 'amendment', label: 'تعديل الحجز' },
    { value: 'cancellation', label: 'إلغاء الحجز' },
    { value: 'refund', label: 'طلب استرداد' },
  ];
  const capabilityCodes = new Set(capabilityOptions.map(option => option.value));
  const number = value => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  const text = value => String(value ?? '').trim();

  window.YAR_CATALOG_TYPES ??= {};
  window.YAR_CATALOG_TYPES.providers = {
    title: 'إدارة مزوّدي الخدمات',
    singular: 'مزوّد خدمة',
    addLabel: 'إضافة مزوّد خدمة',
    icon: 'swap',
    description: 'نظّم مزوّدي الطيران والفنادق والنقل والباقات والجولات. بيانات الربط وحالات الاتصال هنا توضيحية للنموذج.',
    searchPlaceholder: 'ابحث باسم المزوّد أو نوع الخدمة أو المدينة…',
    columns: [
      { key: 'name', label: 'مزوّد الخدمة' },
      { key: 'serviceType', label: 'الخدمة', render: (record, ctx) => ctx.esc(serviceLabels[record.serviceType] || '—') },
      { key: 'integration', label: 'طريقة الإدارة', render: (record, ctx) => ctx.esc(integrationLabels[record.integration] || '—') },
      { key: 'channel', label: 'المصدر', render: (record, ctx) => ctx.esc(channelLabels[record.channel] || '—') },
      { key: 'connectionState', label: 'حالة الربط التجريبية', render: (record, ctx) => ctx.esc(connectionLabels[record.connectionState] || '—') },
      { key: 'priority', label: 'الأولوية' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
    fields: [
      { key: 'name', label: 'اسم مزوّد الخدمة', type: 'text', required: true, placeholder: 'مثال: رحاب للنقل' },
      {
        key: 'serviceType', label: 'نوع الخدمة', type: 'select', required: true,
        options: Object.entries(serviceLabels).map(([value, label]) => ({ value, label })),
      },
      {
        key: 'integration', label: 'طريقة الإدارة', type: 'select', required: true,
        options: Object.entries(integrationLabels).map(([value, label]) => ({ value, label })),
      },
      {
        key: 'channel', label: 'مصدر الخدمة', type: 'select', required: true,
        options: Object.entries(channelLabels).map(([value, label]) => ({ value, label })),
      },
      { key: 'priority', label: 'أولوية المزوّد (1 هي الأعلى)', type: 'number', required: true, min: 1, max: 100, step: 1 },
      { key: 'cities', label: 'المدن التي يغطيها', type: 'textarea', required: true, placeholder: 'مثال: بغداد، النجف، مشهد، طهران' },
      {
        key: 'currency', label: 'عملة التعامل', type: 'select', required: true,
        options: [{ value: 'USD', label: 'دولار أمريكي · USD' }, { value: 'IQD', label: 'دينار عراقي · IQD' }],
      },
      {
        key: 'connectionState', label: 'حالة الربط التجريبية', type: 'select', required: true,
        options: Object.entries(connectionLabels).map(([value, label]) => ({ value, label })),
      },
      { key: 'operatingEnabled', label: 'تفعيل المزوّد في محاكاة التشغيل', type: 'checkbox', help: 'حالة تشغيل محلية مستقلة عن النشر؛ لا تغيّر اتصالًا فعليًا.' },
      {
        key: 'environment', label: 'بيئة التشغيل المحاكاة', type: 'select', required: true,
        options: [{ value: 'test', label: 'اختبار · محاكاة' }, { value: 'production', label: 'إنتاج · محاكاة فقط' }],
      },
      {
        key: 'fallbackProviderId', label: 'مزوّد الطيران الاحتياطي (اختياري)', type: 'select',
        help: 'للطيران فقط؛ لا يجوز اختيار المزوّد نفسه. التشغيل والانتقال إلى الاحتياطي محاكاة محلية.',
        options(allCatalogs) {
          return (allCatalogs.providers || []).filter(provider => provider.serviceType === 'flight' && provider.status === 'published')
            .map(provider => ({ value: provider.id, label: provider.name }));
        },
      },
      {
        key: 'capabilities', label: 'القدرات المتاحة', type: 'repeat', minItems: 0, maxItems: 6, addLabel: 'إضافة قدرة',
        fields: [
          { key: 'code', label: 'القدرة', type: 'select', required: true, options: capabilityOptions },
          { key: 'enabled', label: 'هذه القدرة متاحة', type: 'checkbox' },
        ],
      },
      { key: 'docsUrl', label: 'رابط التوثيق التجريبي (اختياري)', type: 'text', placeholder: 'https://demo.invalid/providers/example' },
      { key: 'notes', label: 'ملاحظات إدارية', type: 'textarea', placeholder: 'ملاحظات عن نطاق الخدمة أو آلية التأكيد، دون بيانات دخول.' },
    ],
    seed: [
      {
        id: 'provider-afaq', name: 'أفق للسفر', serviceType: 'flight', integration: 'api', channel: 'ndc',
        priority: 1, cities: 'بغداد، النجف، مشهد، طهران', currency: 'USD', connectionState: 'healthy', status: 'published',
        capabilities: [{ code: 'search', enabled: true }, { code: 'booking', enabled: true }, { code: 'issuance', enabled: true }],
        docsUrl: 'https://demo.invalid/providers/afaq', notes: 'مزوّد افتراضي للطيران عبر NDC. حالة الربط توضيحية ولا تتصل بخدمة فعلية.',
      },
      {
        id: 'provider-madar', name: 'مدار للحجوزات', serviceType: 'flight', integration: 'api', channel: 'gds',
        priority: 2, cities: 'بغداد، النجف، طهران، شيراز', currency: 'USD', connectionState: 'slow', status: 'published',
        capabilities: [{ code: 'search', enabled: true }, { code: 'booking', enabled: true }, { code: 'cancellation', enabled: true }],
        docsUrl: 'https://demo.invalid/providers/madar', notes: 'مزوّد افتراضي للطيران عبر GDS. بطء الاستجابة مثال تجريبي فقط.',
      },
      {
        id: 'provider-hotel', name: 'رواق للإقامة', serviceType: 'hotel', integration: 'manual', channel: 'manual',
        priority: 1, cities: 'مشهد، طهران، شيراز، أصفهان', currency: 'IQD', connectionState: 'manual', status: 'published',
        capabilities: [{ code: 'booking', enabled: true }, { code: 'amendment', enabled: true }, { code: 'cancellation', enabled: true }],
        docsUrl: '', notes: 'مزوّد فنادق افتراضي. يتم تأكيد التوفر والحجز يدويًا.',
      },
      {
        id: 'provider-transfer', name: 'رحاب للنقل', serviceType: 'transfer', integration: 'manual', channel: 'manual',
        priority: 1, cities: 'مشهد، طهران، شيراز، أصفهان، شمال إيران', currency: 'USD', connectionState: 'manual', status: 'published',
        capabilities: [{ code: 'booking', enabled: true }, { code: 'amendment', enabled: true }, { code: 'cancellation', enabled: true }],
        docsUrl: '', notes: 'مزوّد نقل افتراضي. تسعير السيارة بحسب المدينة ونوع الرحلة.',
      },
      {
        id: 'provider-tours', name: 'رحاب للجولات', serviceType: 'tour', integration: 'manual', channel: 'manual',
        priority: 1, cities: 'مشهد، طهران، شيراز، شمال إيران', currency: 'USD', connectionState: 'manual', status: 'published',
        capabilities: [{ code: 'booking', enabled: true }, { code: 'amendment', enabled: true }, { code: 'cancellation', enabled: true }],
        docsUrl: '', notes: 'مزوّد جولات افتراضي للمعاينة. المواعيد ونقطة الانطلاق تُراجع مع الفريق؛ لا تُرسل طلبات فعلية.',
      },
    ].map(record => ({ operatingEnabled: true, environment: 'test', fallbackProviderId: '', ...record })),
    validate(record) {
      if (!text(record.name)) return 'اكتب اسم مزوّد الخدمة.';
      if (!Object.hasOwn(serviceLabels, record.serviceType)) return 'اختر نوع خدمة صالحًا للمزوّد.';
      if (!Object.hasOwn(integrationLabels, record.integration)) return 'اختر طريقة إدارة المزوّد.';
      if (!Object.hasOwn(channelLabels, record.channel)) return 'اختر مصدر خدمة صالحًا.';
      const priority = Number(record.priority);
      if (!Number.isInteger(priority) || priority < 1 || priority > 100) return 'أولوية المزوّد يجب أن تكون رقمًا صحيحًا من 1 إلى 100.';
      if (!text(record.cities)) return 'اكتب مدينة واحدة على الأقل ضمن تغطية المزوّد.';
      if (!['USD', 'IQD'].includes(record.currency)) return 'اختر الدولار الأمريكي أو الدينار العراقي.';
      if (!Object.hasOwn(connectionLabels, record.connectionState)) return 'اختر حالة الربط التجريبية.';
      if (typeof record.operatingEnabled !== 'boolean') return 'حدّد حالة التشغيل المحلية للمزوّد.';
      if (!['test', 'production'].includes(record.environment)) return 'اختر بيئة اختبار أو إنتاج للمحاكاة.';
      if (record.integration === 'manual' && (record.channel !== 'manual' || record.connectionState !== 'manual')) {
        return 'للمزوّد اليدوي، اختر «يدوي» لمصدر الخدمة و«إدارة يدوية» لحالة الربط.';
      }
      if (record.integration === 'api' && (record.channel === 'manual' || record.connectionState === 'manual')) {
        return 'لربط API التجريبي، اختر مصدرًا وحالة ربط تجريبية مناسبة.';
      }
      const capabilities = Array.isArray(record.capabilities) ? record.capabilities : [];
      if (capabilities.length > 6) return 'يمكن تحديد ست قدرات كحد أقصى.';
      const seen = new Set();
      for (const capability of capabilities) {
        if (!capabilityCodes.has(capability.code)) return 'اختر قدرة صالحة من القائمة.';
        if (seen.has(capability.code)) return 'أضف كل قدرة مرة واحدة فقط.';
        seen.add(capability.code);
      }
      if (text(record.docsUrl)) {
        try {
          const url = new URL(text(record.docsUrl));
          if (url.protocol !== 'https:' || url.hostname !== 'demo.invalid' || url.username || url.password || url.port) {
            return 'رابط التوثيق في النموذج يجب أن يبدأ بـ https://demo.invalid/ دون بيانات دخول.';
          }
        } catch {
          return 'اكتب رابط توثيق تجريبي صالحًا ضمن https://demo.invalid/ أو اتركه فارغًا.';
        }
      }
      return '';
    },
  };

  window.YAR_CATALOG_TYPES.cars = {
    title: 'إدارة السيارات',
    singular: 'سيارة',
    addLabel: 'إضافة سيارة',
    icon: 'car',
    description: 'أضف السيارات وصورها وسعة الركاب والحقائب، وحدّد سعر الاستقبال والاستقبال والتوديع لكل مدينة.',
    searchPlaceholder: 'ابحث باسم السيارة أو الموديل أو المدينة…',
    columns: [
      { key: 'name', label: 'السيارة' },
      { key: 'model', label: 'الموديل' },
      { key: 'seatCount', label: 'الركاب' },
      { key: 'bags', label: 'الحقائب' },
      {
        key: 'cityPrices', label: 'الاستقبال / الاستقبال والتوديع · USD',
        render(record, ctx) {
          const prices = Array.isArray(record.cityPrices) ? record.cityPrices : [];
          return prices.length ? prices.map(price => `${ctx.esc(price.city)}: ${ctx.esc(number(price.oneWayUSD))} / ${ctx.esc(number(price.roundTripUSD))}`).join('<br>') : '—';
        },
      },
      { key: 'photos', label: 'الصور', format: 'photos' },
      { key: 'status', label: 'الحالة', format: 'status' },
    ],
    fields: [
      { key: 'name', label: 'اسم السيارة', type: 'text', required: true, placeholder: 'مثال: سيدان كامري' },
      { key: 'model', label: 'الموديل', type: 'text', required: true, placeholder: 'مثال: Toyota Camry 2024' },
      { key: 'seatCount', label: 'سعة الركاب', type: 'number', required: true, min: 1, max: 50, step: 1 },
      { key: 'bags', label: 'سعة الحقائب', type: 'number', required: true, min: 0, max: 50, step: 1 },
      { key: 'photos', label: 'صور السيارة', type: 'photos', placeholder: 'رابط صورة في كل سطر' },
      {
        key: 'serviceProvider', label: 'مزوّد النقل', type: 'select', required: true,
        options(allCatalogs) {
          return (allCatalogs.providers || []).filter(provider => provider.serviceType === 'transfer')
            .map(provider => ({ value: provider.id, label: provider.name + (provider.status === 'archived' ? ' · مؤرشف' : '') }));
        },
      },
      {
        key: 'cityPrices', label: 'الأسعار حسب المدينة', type: 'repeat', minItems: 1, maxItems: 5, addLabel: 'إضافة سعر مدينة',
        fields: [
          { key: 'city', label: 'المدينة', type: 'select', required: true, options: cityOptions },
          { key: 'oneWayUSD', label: 'سعر الاستقبال بالدولار', type: 'number', required: true, min: 1, max: 10000, step: 1 },
          { key: 'roundTripUSD', label: 'سعر الاستقبال والتوديع بالدولار', type: 'number', required: true, min: 1, max: 20000, step: 1 },
        ],
      },
    ],
    seed: [
      {
        id: 'car-camry', name: 'سيدان كامري', model: 'Toyota Camry 2024', seatCount: 3, bags: 2,
        photos: [
          'assets/external/image-05.jpg',
          'assets/external/image-07.webp',
        ],
        serviceProvider: 'provider-transfer', status: 'published',
        cityPrices: [
          { city: 'مشهد', oneWayUSD: 30, roundTripUSD: 60 }, { city: 'طهران', oneWayUSD: 45, roundTripUSD: 90 },
          { city: 'شيراز', oneWayUSD: 35, roundTripUSD: 70 }, { city: 'أصفهان', oneWayUSD: 40, roundTripUSD: 80 },
        ],
      },
      {
        id: 'car-suv', name: 'سيارة SUV', model: 'Toyota Fortuner 2024', seatCount: 5, bags: 3,
        photos: [
          'assets/external/image-08.webp',
          'assets/external/image-09.webp',
        ],
        serviceProvider: 'provider-transfer', status: 'published',
        cityPrices: [
          { city: 'مشهد', oneWayUSD: 45, roundTripUSD: 90 }, { city: 'طهران', oneWayUSD: 60, roundTripUSD: 120 },
          { city: 'شيراز', oneWayUSD: 50, roundTripUSD: 100 }, { city: 'أصفهان', oneWayUSD: 55, roundTripUSD: 110 },
        ],
      },
      {
        id: 'car-minivan', name: 'ميني فان', model: 'Toyota Hiace 2024', seatCount: 10, bags: 8,
        photos: [
          'assets/external/image-04.jpg',
          'assets/external/image-01.jpeg',
        ],
        serviceProvider: 'provider-transfer', status: 'published',
        cityPrices: [
          { city: 'مشهد', oneWayUSD: 70, roundTripUSD: 140 }, { city: 'طهران', oneWayUSD: 85, roundTripUSD: 170 },
          { city: 'شيراز', oneWayUSD: 75, roundTripUSD: 150 }, { city: 'أصفهان', oneWayUSD: 80, roundTripUSD: 160 },
        ],
      },
    ],
    validate(record, allCatalogs = {}) {
      if (!text(record.name) || !text(record.model)) return 'اكتب اسم السيارة والموديل.';
      const seats = Number(record.seatCount);
      const bags = Number(record.bags);
      if (!Number.isInteger(seats) || seats < 1 || seats > 50) return 'سعة الركاب يجب أن تكون رقمًا صحيحًا من 1 إلى 50.';
      if (text(record.bags) === '' || !Number.isInteger(bags) || bags < 0 || bags > 50) return 'سعة الحقائب يجب أن تكون رقمًا صحيحًا من 0 إلى 50.';
      const provider = (allCatalogs.providers || []).find(item => item.id === record.serviceProvider && item.serviceType === 'transfer');
      if (!provider) return 'اختر مزوّد نقل موجودًا ضمن مزوّدي الخدمات.';
      if (record.status === 'published' && provider.status !== 'published') return 'لنشر السيارة، اختر مزوّد نقل منشورًا.';
      const prices = Array.isArray(record.cityPrices) ? record.cityPrices : [];
      if (!prices.length) return 'أضف سعرًا لمدينة واحدة على الأقل.';
      if (prices.length > cities.length) return 'يمكن إضافة خمس مدن كحد أقصى.';
      const seen = new Set();
      for (const price of prices) {
        if (!cities.includes(price.city)) return 'اختر مدينة صالحة لكل صف أسعار.';
        if (seen.has(price.city)) return 'أضف سعرًا واحدًا فقط لكل مدينة.';
        seen.add(price.city);
        const oneWay = Number(price.oneWayUSD);
        const roundTrip = Number(price.roundTripUSD);
        if (!Number.isFinite(oneWay) || oneWay < 1 || oneWay > 10000) return `سعر الاستقبال في ${price.city} يجب أن يكون بين 1 و10,000 دولار.`;
        if (!Number.isFinite(roundTrip) || roundTrip < 1 || roundTrip > 20000) return `سعر الاستقبال والتوديع في ${price.city} يجب أن يكون بين 1 و20,000 دولار.`;
        if (roundTrip < oneWay) return `سعر الاستقبال والتوديع في ${price.city} يجب ألا يقل عن سعر الاستقبال.`;
      }
      return '';
    },
  };
})();
