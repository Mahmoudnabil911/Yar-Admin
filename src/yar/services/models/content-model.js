(() => {
  'use strict';

  const kinds = {
    home: 'الرئيسية', banners: 'البنرات والعروض', destinations: 'الوجهات',
    notifications: 'الإشعارات', faqs: 'الأسئلة الشائعة', support: 'الدعم والتواصل',
  };
  const schemas = {
    home: ['title', 'tagline'],
    banners: ['title', 'body', 'image', 'imageAlt', 'buttonLabel', 'target', 'packageId', 'nights', 'startDate', 'endDate'],
    destinations: ['city', 'title', 'body', 'image', 'imageAlt'],
    notifications: ['title', 'body', 'category', 'audience', 'target', 'startDate', 'endDate'],
    faqs: ['category', 'question', 'answer'],
    support: ['title', 'body', 'whatsapp', 'phone', 'buttonLabel', 'message', 'hours'],
  };
  const singletonIds = { home: 'home-id', support: 'support-id' };
  const targets = new Set(['packages', 'package', 'hotels', 'flights', 'transfers', 'tours', 'destination', 'help']);
  const cities = new Set(['مشهد', 'طهران', 'شيراز', 'أصفهان', 'شمال إيران', 'ماسوله']);
  const faqCategories = new Set(['general', 'flight', 'hotel', 'package', 'transfer', 'tour', 'account', 'payment']);
  const localImage = /^assets\/content\/(?:mashhad|tehran|shiraz|north|masuleh)\.jpg$/;
  const copy = value => JSON.parse(JSON.stringify(value));
  const hasKind = kind => Object.prototype.hasOwnProperty.call(kinds, kind);
  let sequence = 0;

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Baghdad', calendar: 'gregory', numberingSystem: 'latn',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function shiftDate(date, days) {
    const value = new Date(date + 'T00:00:00.000Z');
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  function normalizePayload(kind, input) {
    if (!hasKind(kind)) throw new Error('نوع المحتوى غير صالح.');
    const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const payload = Object.fromEntries(schemas[kind].map(key => [key, String(source[key] ?? '').trim()]));
    if (kind === 'support') {
      for (const key of ['whatsapp', 'phone']) payload[key] = payload[key].replace(/^\+/, '').replace(/\s+/g, '');
    }
    return payload;
  }

  function imageValid(value) {
    if (localImage.test(value)) return true;
    if (!/^https:\/\//i.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }

  function scheduleValid(payload) {
    const { startDate = '', endDate = '' } = payload;
    return (!startDate || validDate(startDate)) && (!endDate || validDate(endDate)) && (!startDate || !endDate || startDate <= endDate);
  }

  function validate(kind, input, context = {}) {
    if (!hasKind(kind)) return 'اختر نوع محتوى صالحًا.';
    const payload = normalizePayload(kind, input);
    const limits = { title: 80, body: 300, tagline: 160, imageAlt: 160, buttonLabel: 40, question: 160, answer: 2000, message: 300, hours: 120 };
    for (const [key, maximum] of Object.entries(limits)) {
      if (payload[key]?.length > maximum) return `النص في حقل «${{ title: 'العنوان', body: 'الوصف', tagline: 'العبارة التعريفية', imageAlt: 'وصف الصورة', buttonLabel: 'نص الزر', question: 'السؤال', answer: 'الإجابة', message: 'الرسالة الجاهزة', hours: 'أوقات العمل' }[key]}» يجب ألا يتجاوز ${maximum} حرفًا.`;
    }
    if (kind !== 'faqs' && !payload.title) return 'اكتب عنوان المحتوى قبل النشر.';
    if (kind === 'home' && !payload.tagline) return 'اكتب العبارة التعريفية للرئيسية.';
    if (kind === 'banners' || kind === 'destinations') {
      if (!payload.image || !imageValid(payload.image)) return 'اختر صورة محلية معتمدة أو رابط صورة https صالحًا دون بيانات دخول.';
      if (!payload.imageAlt) return 'اكتب وصفًا بديلًا للصورة.';
    }
    if (kind === 'banners') {
      if (!payload.buttonLabel) return 'اكتب نص زر البنر.';
      if (!targets.has(payload.target)) return 'اختر وجهة صالحة لزر البنر.';
      if (payload.target === 'package') {
        const packages = Array.isArray(context?.packages) ? context.packages : [];
        if (!packages.some(item => item && item.id === payload.packageId && item.status === 'published')) return 'اختر باقة منشورة قبل نشر بنر يرتبط بباقة محددة.';
        if (!['5', '7'].includes(payload.nights)) return 'اختر مدة 5 أو 7 ليالٍ للباقة المرتبطة بالبنر.';
      }
    }
    if (kind === 'destinations' && !cities.has(payload.city)) return 'اختر مدينة معتمدة للوجهة.';
    if (kind === 'notifications') {
      if (!payload.body) return 'اكتب نص الإشعار قبل النشر.';
      if (!['offer', 'service', 'info'].includes(payload.category)) return 'اختر نوع الإشعار: عرض أو خدمة أو معلومة.';
      if (!['all', 'registered', 'guests'].includes(payload.audience)) return 'اختر الجمهور المستهدف للإشعار.';
      if (payload.target !== 'none' && !targets.has(payload.target)) return 'اختر وجهة صالحة للإشعار أو «دون رابط».';
    }
    if ((kind === 'banners' || kind === 'notifications') && !scheduleValid(payload)) return 'استخدم تواريخ صحيحة، واجعل تاريخ النهاية مساويًا لتاريخ البداية أو بعده.';
    if (kind === 'faqs') {
      if (!faqCategories.has(payload.category)) return 'اختر تصنيفًا صالحًا للسؤال.';
      if (!payload.question) return 'اكتب السؤال قبل النشر.';
      if (!payload.answer) return 'اكتب إجابة السؤال قبل النشر.';
    }
    if (kind === 'support') {
      if (!/^\d{10,15}$/.test(payload.whatsapp)) return 'اكتب رقم واتساب من 10 إلى 15 رقمًا، مع رمز الدولة.';
      if (payload.phone && !/^\d{10,15}$/.test(payload.phone)) return 'رقم الاتصال الاختياري يجب أن يتكون من 10 إلى 15 رقمًا.';
    }
    return '';
  }

  function stateOf(record, date = today()) {
    if (!validDate(date)) throw new Error('اختر تاريخًا صحيحًا لمعاينة المحتوى.');
    if (record?.archived) return 'archived';
    if (record?.published && record?.draft) return 'changes';
    if (!record?.published) return 'draft';
    if (!scheduleValid(record.published)) return 'draft';
    if (record.published.startDate && date < record.published.startDate) return 'scheduled';
    if (record.published.endDate && date > record.published.endDate) return 'expired';
    return 'published';
  }

  function sorted(records, kind) {
    return records.filter(record => record.kind === kind && !record.archived)
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
  }

  function live(records, kind, date = today()) {
    if (!hasKind(kind)) return [];
    if (!validDate(date)) throw new Error('اختر تاريخًا صحيحًا لمعاينة المحتوى.');
    return sorted(Array.isArray(records) ? records : [], kind).filter(record => {
      const payload = record.published;
      return payload && scheduleValid(payload) && (!payload.startDate || payload.startDate <= date) && (!payload.endDate || date <= payload.endDate);
    }).map(record => ({ ...copy(record), draft: null, payload: copy(record.published) }));
  }

  function sanitizeRecords(input) {
    if (!Array.isArray(input)) throw new Error('صيغة المحتوى المحفوظ غير صالحة.');
    const records = [];
    const ids = new Set();
    const singletons = new Set();
    for (const source of input) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('أحد سجلات المحتوى المحفوظ غير صالح.');
      if (!hasKind(source.kind)) continue;
      if (typeof source.id !== 'string' || !source.id.trim()) throw new Error('معرّف أحد سجلات المحتوى المحفوظ غير صالح.');
      const id = singletonIds[source.kind] || source.id.trim();
      if (!singletonIds[source.kind] && Object.values(singletonIds).includes(id)) continue;
      if (ids.has(id) || (singletonIds[source.kind] && singletons.has(source.kind))) continue;
      const payload = value => {
        if (value == null) return null;
        if (typeof value !== 'object' || Array.isArray(value)) throw new Error('نسخة محتوى محفوظة غير صالحة.');
        return normalizePayload(source.kind, value);
      };
      const draft = payload(source.draft);
      const published = payload(source.published);
      if (!draft && !published) throw new Error('أحد سجلات المحتوى المحفوظ لا يحتوي مسودة أو نسخة منشورة.');
      records.push({
        id, kind: source.kind, order: Number.isFinite(source.order) ? source.order : records.length + 1,
        archived: singletonIds[source.kind] ? false : source.archived === true, draft, published,
      });
      ids.add(id);
      if (singletonIds[source.kind]) singletons.add(source.kind);
    }
    if (input.length && !records.length) throw new Error('لا توجد سجلات محتوى صالحة في النسخة المحفوظة.');
    return records;
  }

  function editable(records, id) {
    const index = records.findIndex(record => record.id === id);
    if (index < 0) throw new Error('سجل المحتوى غير موجود.');
    return { record: records[index], index };
  }

  function nextOrder(records, kind) {
    return Math.max(0, ...records.filter(record => record.kind === kind && !record.archived).map(record => record.order)) + 1;
  }

  function saveDraft(records, kind, id, payload, context) {
    if (!hasKind(kind)) throw new Error('نوع المحتوى غير صالح.');
    const result = sanitizeRecords(records);
    const draft = normalizePayload(kind, payload);
    if (id == null) {
      if (singletonIds[kind] && result.some(record => record.kind === kind)) throw new Error('هذا القسم يملك سجلًا واحدًا فقط. عدّل السجل الموجود.');
      let newId = singletonIds[kind];
      if (!newId) {
        do { newId = `content-${kind}-${Date.now().toString(36)}-${++sequence}`; } while (result.some(record => record.id === newId));
      }
      result.push({ id: newId, kind, order: nextOrder(result, kind), archived: false, draft, published: null });
    } else {
      const { record } = editable(result, id);
      if (record.kind !== kind) throw new Error('نوع المحتوى لا يطابق السجل المختار.');
      if (record.archived) throw new Error('استعد السجل من الأرشيف قبل تعديله.');
      record.draft = draft;
    }
    return result;
  }

  function publish(records, id, context = {}) {
    const result = sanitizeRecords(records);
    const { record } = editable(result, id);
    if (record.archived) throw new Error('استعد السجل من الأرشيف قبل نشره.');
    if (!record.draft) throw new Error('لا توجد مسودة جديدة لنشرها.');
    const error = validate(record.kind, record.draft, context);
    if (error) throw new Error(error);
    record.published = copy(record.draft);
    record.draft = null;
    return result;
  }

  function discardDraft(records, id) {
    const result = sanitizeRecords(records);
    const { record, index } = editable(result, id);
    if (!record.draft) return result;
    if (record.published) record.draft = null;
    else if (singletonIds[record.kind]) throw new Error('أكمل مسودة هذا القسم وانشرها؛ لا يمكن حذف سجله الوحيد.');
    else result.splice(index, 1);
    return result;
  }

  function archive(records, id) {
    const result = sanitizeRecords(records);
    const { record } = editable(result, id);
    if (singletonIds[record.kind]) throw new Error('لا يمكن أرشفة السجل الأساسي لهذا القسم.');
    record.archived = true;
    return result;
  }

  function restore(records, id) {
    const result = sanitizeRecords(records);
    const { record } = editable(result, id);
    if (!record.archived) return result;
    record.archived = false;
    record.draft = copy(record.draft || record.published);
    record.published = null;
    record.order = nextOrder(result.filter(item => item.id !== id), record.kind);
    return result;
  }

  function move(records, id, delta) {
    if (!Number.isInteger(delta)) throw new Error('اتجاه ترتيب المحتوى غير صالح.');
    const result = sanitizeRecords(records);
    const { record } = editable(result, id);
    if (record.archived) throw new Error('استعد السجل من الأرشيف قبل تغيير ترتيبه.');
    const siblings = sorted(result, record.kind);
    const index = siblings.findIndex(item => item.id === id);
    const target = index + delta;
    if (!delta || target < 0 || target >= siblings.length) return result;
    if (new Set(siblings.map(item => item.order)).size !== siblings.length) siblings.forEach((item, position) => { item.order = position + 1; });
    const before = siblings[index].order;
    siblings[index].order = siblings[target].order;
    siblings[target].order = before;
    return result;
  }

  const published = (id, kind, order, payload) => ({ id, kind, order, archived: false, draft: null, published: normalizePayload(kind, payload) });
  const seed = [
    published('home-id', 'home', 1, { title: 'DISCOVER IRAN', tagline: 'رفيقك في كل رحلة' }),
    published('banner-mashhad-5', 'banners', 1, { title: 'مشهد · 5 ليالٍ', body: 'اختر الفندق المناسب وراجع تفاصيل برنامج مشهد والخدمات المشمولة.', image: 'assets/content/mashhad.jpg', imageAlt: 'معالم مشهد', buttonLabel: 'استكشف الباقة', target: 'package', packageId: 'package-mashhad', nights: '5' }),
    published('banner-mashhad-7', 'banners', 2, { title: 'مشهد · 7 ليالٍ', body: 'وقت أطول لاستكشاف مشهد، مع خيارات الفنادق ضمن البرنامج نفسه.', image: 'assets/content/mashhad.jpg', imageAlt: 'وجهة مشهد', buttonLabel: 'شوف التفاصيل', target: 'package', packageId: 'package-mashhad', nights: '7' }),
    published('banner-tehran-north', 'banners', 3, { title: 'طهران وشمال إيران', body: 'تعرّف على وجهات إيران وراجع البرامج المتاحة للتخطيط لرحلتك.', image: 'assets/content/north.jpg', imageAlt: 'طبيعة شمال إيران', buttonLabel: 'اكتشف البرامج', target: 'packages' }),
    published('destination-mashhad', 'destinations', 1, { city: 'مشهد', title: 'مشهد', body: 'اكتشف خيارات الإقامة والبرامج في مشهد.', image: 'assets/content/mashhad.jpg', imageAlt: 'مدينة مشهد' }),
    published('destination-tehran', 'destinations', 2, { city: 'طهران', title: 'طهران', body: 'العاصمة ومحطة لاستكشاف وجهات إيران.', image: 'assets/content/tehran.jpg', imageAlt: 'مدينة طهران' }),
    published('destination-shiraz', 'destinations', 3, { city: 'شيراز', title: 'شيراز', body: 'معالم ثقافية وحدائق لاستكشاف المدينة.', image: 'assets/content/shiraz.jpg', imageAlt: 'معالم شيراز' }),
    published('notification-service', 'notifications', 1, { title: 'تفاصيل رحلتك بمكان واحد', body: 'راجع تفاصيل الطلب وحالته من قسم حجوزاتي داخل التطبيق.', category: 'service', audience: 'registered', target: 'none' }),
    { id: 'notification-draft', kind: 'notifications', order: 2, archived: false, published: null, draft: normalizePayload('notifications', { title: 'استكشف برامج مشهد', body: 'راجع خيارات الفنادق ومدة الإقامة قبل تنسيق رحلتك.', category: 'offer', audience: 'all', target: 'packages' }) },
    published('notification-scheduled', 'notifications', 3, { title: 'خطّط لرحلتك القادمة', body: 'تعرّف على الوجهات وخيارات البرامج المتاحة في المعاينة.', category: 'info', audience: 'all', target: 'destination', startDate: shiftDate(today(), 2), endDate: shiftDate(today(), 9) }),
    published('faq-flight', 'faqs', 1, { category: 'flight', question: 'أين أراجع الأمتعة والسعر؟', answer: 'افتح «تفاصيل الرحلة» في بطاقة الطيران لمراجعة الأمتعة وتفصيل السعر. راجع الإجمالي لجميع المسافرين قبل المتابعة.' }),
    published('faq-package', 'faqs', 2, { category: 'package', question: 'ماذا تشمل الباقة السياحية؟', answer: 'افتح الباقة وراجع «الخدمات والجولات المشمولة» وخيارات الفنادق والأسعار. تختلف التفاصيل حسب البرنامج ومدة الإقامة.' }),
    published('faq-transfer', 'faqs', 3, { category: 'transfer', question: 'ما الفرق بين استقبال واستقبال وتوديع؟', answer: 'الاستقبال يشمل المطار إلى الفندق. الاستقبال والتوديع يضيف الفندق إلى المطار عند المغادرة. يتغير السعر المعروض حسب المدينة والخدمة والسيارة.' }),
    published('faq-account', 'faqs', 4, { category: 'account', question: 'أين أجد حجوزاتي؟', answer: 'افتح «حجوزاتي» من الشريط السفلي. تنقسم الأمثلة إلى قادمة وسابقة، ويمكن فتح تفاصيل كل رحلة.' }),
    published('support-id', 'support', 1, { title: 'شلون نكدر نساعدك؟', body: 'راسل فريق YAR لتنسيق طلبك أو الاستفسار عن تفاصيل رحلتك.', whatsapp: '9647831400500', phone: '', buttonLabel: 'تواصل عبر واتساب', message: 'مرحبًا فريق YAR، أحتاج مساعدة بخصوص رحلتي.', hours: '' }),
  ];
  const api = { kinds, seed, today, validate, stateOf, live, normalizePayload, saveDraft, publish, discardDraft, archive, restore, move, sanitizeRecords };
  globalThis.YARContentModel = api;
  if (typeof window !== 'undefined') window.YARContentModel = api;
})();
