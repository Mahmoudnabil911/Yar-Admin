(() => {
  'use strict';

  window.YAR_CATALOG_TYPES ??= {};
  const hotelPhotos = [
    'assets/external/image-03.jpg',
    'assets/external/image-02.jpg',
    'assets/external/image-06.jpg',
  ];

  window.YAR_CATALOG_TYPES.packages = {
    title: 'إدارة الباقات السياحية',
    singular: 'باقة',
    addLabel: 'إضافة باقة',
    icon: 'bag',
    description: 'حدّد عدد أيام البرنامج والوجهات وخيارات الفنادق لكل باقة. تُحفظ التعديلات في المعاينة المحلية.',
    searchPlaceholder: 'ابحث باسم الباقة أو الوجهات أو الفندق…',
    columns: [
      { key: 'name', label: 'الباقة' },
      { key: 'destinations', label: 'الوجهات' },
      { key: 'departureSchedule', label: 'المغادرة' },
      { key: 'hotelOptions', label: 'خيارات الفنادق', format: 'count' },
      { key: 'durationDays', label: 'عدد الأيام', render: (record, { esc, num }) => Number.isInteger(record.durationDays) && record.durationDays > 0 ? `<bdi>${esc(num(record.durationDays))}</bdi>` : 'غير محدد' },
      { key: 'status', label: 'الحالة', format: 'status' }
    ],
    fields: [
      { key: 'name', label: 'اسم الباقة', type: 'text', required: true, placeholder: 'مثال: باقة مشهد' },
      { key: 'destinations', label: 'المدينة أو المدن المشمولة', type: 'text', required: true, placeholder: 'مثال: مشهد أو طهران، شمال إيران' },
      { key: 'durationDays', label: 'عدد الأيام', type: 'number', min: 1, step: 1, placeholder: 'إجمالي أيام الباقة', help: 'عدد أيام البرنامج كاملًا؛ يُحدَّد بشكل مستقل عن ليالي الإقامة.' },
      { key: 'departureSchedule', label: 'جدول المغادرة', type: 'text', placeholder: 'يوميًا' },
      { key: 'description', label: 'وصف الباقة', type: 'textarea', placeholder: 'تفاصيل البرنامج والمسار بين المدن' },
      { key: 'priceBasis', label: 'أساس احتساب السعر', type: 'textarea', required: true, placeholder: 'الأسعار بالدولار الأمريكي للشخص الواحد عند حجز شخصين.' },
      {
        key: 'hotelOptions',
        label: 'خيارات الفنادق وأسعار الباقة للشخص الواحد عند حجز شخصين',
        type: 'repeat',
        addLabel: 'إضافة خيار فندق',
        fields: [
          { key: 'optionId', label: 'معرّف خيار الفندق', type: 'text', readOnly: true, generated: true, required: true, help: 'معرّف ثابت يُنشأ تلقائيًا ولا يتغير عند تعديل الاسم أو الترتيب.' },
          { key: 'hotelName', label: 'اسم الفندق', type: 'text', required: true, placeholder: 'اسم الفندق المشمول بهذا السعر' },
          {
            key: 'stars', label: 'تصنيف الفندق', type: 'select',
            options: [
              { value: '', label: 'غير محدد' },
              { value: '1', label: 'نجمة واحدة' },
              { value: '2', label: 'نجمتان' },
              { value: '3', label: '3 نجوم' },
              { value: '4', label: '4 نجوم' },
              { value: '5', label: '5 نجوم' }
            ]
          },
          { key: 'price5USD', label: 'باقة 5 ليالٍ — دولار / للشخص', type: 'number', min: 0, step: 1, placeholder: 'السعر للشخص عند حجز شخصين' },
          { key: 'price7USD', label: 'باقة 7 ليالٍ — دولار / للشخص', type: 'number', min: 0, step: 1, placeholder: 'السعر للشخص عند حجز شخصين' },
          { key: 'address', label: 'عنوان الفندق', type: 'textarea', placeholder: 'العنوان أو موقع الفندق ضمن البرنامج' },
          { key: 'description', label: 'تفاصيل خيار الفندق', type: 'textarea', placeholder: 'نوع الإقامة وتفاصيل هذا الخيار ضمن الباقة' },
          { key: 'photos', label: 'صور خيار الفندق', type: 'photos', placeholder: 'رابط صورة في كل سطر؛ معرض مستقل لهذا الفندق' }
        ]
      },
      { key: 'durationNotes', label: 'مدد أخرى وطلبات خاصة (اختياري)', type: 'textarea', placeholder: 'ملاحظات لبرنامج بمدة مختلفة أو ترتيب مخصص' },
      { key: 'inclusions', label: 'ما يشمله السعر', type: 'textarea', placeholder: 'أضف الخدمات المشمولة بعد التأكد منها' },
      { key: 'exclusions', label: 'ما لا يشمله السعر', type: 'textarea', placeholder: 'أضف الخدمات والتكاليف غير المشمولة' },
      { key: 'photos', label: 'صور الباقة', type: 'photos' }
    ],
    seed: [
      {
        id: 'package-mashhad',
        name: 'باقة مشهد',
        destinations: 'مشهد',
        departureSchedule: 'يوميًا',
        description: 'باقة مشهد مع مغادرة يومية وإقامة لمدة 5 أو 7 ليالٍ في فندق لوتوس أو كيانا أو قصر بين الملل. تشمل الطيران ذهابًا وعودة، والإقامة مع الفطور، والاستقبال والتوديع بسيارة خاصة، وجولتين خاصتين: جولة إلى طرقبة أو شانديز وجولة داخل مشهد.',
        priceBasis: 'الأسعار بالدولار الأمريكي للشخص الواحد عند حجز شخصين، وفق الفندق والمدة المحددين.',
        hotelOptions: [
          { optionId: 'lotus', hotelName: 'لوتوس', stars: '4', price5USD: 275, price7USD: 300, address: 'شارع الإمام الرضا 10', description: '4 نجوم · سويتات · صور توضيحية للفندق ضمن برنامج مشهد.', photos: [hotelPhotos[0], hotelPhotos[1]] },
          { optionId: 'kiana', hotelName: 'كيانا', stars: '', price5USD: 285, price7USD: 310, address: 'شارع الإمام الرضا 2', description: 'خيار إقامة ضمن برنامج مشهد؛ صور الفندق توضيحية.', photos: [hotelPhotos[1], hotelPhotos[2]] },
          { optionId: 'qasr', hotelName: 'قصر بين الملل', stars: '5', price5USD: 315, price7USD: 350, address: 'شارع الإمام الرضا 12', description: '5 نجوم · صور توضيحية للفندق ضمن برنامج مشهد.', photos: [hotelPhotos[2], hotelPhotos[0]] }
        ],
        durationNotes: 'يمكن تدوين طلب مدة أخرى أو ترتيب خاص لمراجعته.',
        inclusions: 'طيران ذهاب وعودة\nالإقامة\nالفطور\nاستقبال وتوديع بسيارة خاصة\nجولتان خاصتان: جولة إلى طرقبة أو شانديز، وجولة داخل مشهد',
        exclusions: '',
        photos: [],
        status: 'published'
      },
      {
        id: 'package-tehran-north',
        name: 'باقة طهران وشمال إيران',
        destinations: 'طهران، شمال إيران',
        departureSchedule: 'يوميًا',
        description: 'مسودة برنامج يجمع طهران وشمال إيران؛ خيارات الفنادق والأسعار بانتظار الإضافة.',
        priceBasis: 'تُضاف الأسعار بالدولار الأمريكي للشخص الواحد عند حجز شخصين بعد تحديد الفنادق والبرنامج.',
        hotelOptions: [],
        durationNotes: 'تُحدد المدة وتوزيع الإقامة بين المدن حسب البرنامج المطلوب.',
        inclusions: '',
        exclusions: '',
        photos: [],
        status: 'draft'
      }
    ],
    validate(record) {
      if (!String(record.destinations || '').trim()) return 'أدخل اسم المدينة أو المدن المشمولة بالباقة.';
      if (record.durationDays != null && record.durationDays !== '' && (!Number.isInteger(Number(record.durationDays)) || Number(record.durationDays) < 1)) return 'عدد الأيام يجب أن يكون عددًا صحيحًا أكبر من صفر.';
      if (!String(record.priceBasis || '').trim()) return 'وضّح أساس احتساب السعر للشخص الواحد عند حجز شخصين.';
      const options = Array.isArray(record.hotelOptions) ? record.hotelOptions : [];
      if (options.some(option => !String(option.hotelName || '').trim())) return 'أدخل اسم الفندق لكل خيار مضاف.';
      const ids = new Set();
      for (const option of options) {
        const id = String(option.optionId || '').trim();
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,89}$/.test(id)) return 'معرّف أحد خيارات الفنادق غير صالح. أعد فتح النموذج لتوليد معرّف ثابت.';
        if (ids.has(id)) return 'لكل خيار فندق معرّف مستقل؛ لا يمكن تكرار المعرّف داخل الباقة.';
        ids.add(id);
      }
      if (record.status === 'published') {
        if (!options.length) return 'أضف خيار فندق واحدًا على الأقل قبل نشر الباقة.';
        if (options.some(option => ['price5USD', 'price7USD'].some(key => !Number.isFinite(Number(option[key])) || Number(option[key]) <= 0))) {
          return 'أدخل سعرًا أكبر من صفر لمدتي 5 و7 ليالٍ لكل خيار فندق قبل النشر.';
        }
      }
      return '';
    }
  };
})();
