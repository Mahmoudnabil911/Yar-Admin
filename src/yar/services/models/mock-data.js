/* Fictional local demo data. No customer records, credentials, or network calls. */
(function () {
  'use strict';

  const today = '2026-11-05';
  const bookings = [
    {
      id: 'YAR-1048', customer: 'ليان الربيعي', initials: 'ل ر',
      service: 'flight', route: 'بغداد ← مشهد',
      detail: 'ذهاب وعودة · مسافر واحد · اقتصادية', date: today,
      amount: 428000, payment: 'paid', status: 'issued',
      provider: 'أفق للسفر', assigned: 'أحمد', createdAt: '09:24'
    },
    {
      id: 'YAR-1047', customer: 'سامر النخيل', initials: 'س ن',
      service: 'hotel', route: 'مشهد · إقامة فندقية',
      detail: 'فندق حدائق الغيم · 3 ليالٍ · غرفة مزدوجة', date: today,
      amount: 680000, payment: 'paid', status: 'issued',
      provider: 'مدار للحجوزات', assigned: 'نور', createdAt: '09:18'
    },
    {
      id: 'YAR-1046', customer: 'مريم السرو', initials: 'م س',
      service: 'package', route: 'بغداد ← طهران والشمال',
      detail: 'باقة طهران وشمال إيران · 5 ليالٍ · 3 مسافرين', date: today,
      amount: 2450000, payment: 'review', status: 'processing',
      provider: 'رحاب للرحلات', assigned: 'زينب', createdAt: '09:12'
    },
    {
      id: 'YAR-1045', customer: 'عمر الواحة', initials: 'ع و',
      service: 'transfer', route: 'مطار مشهد ← فندق حدائق الغيم',
      detail: 'استقبال من المطار · سيارة خاصة · مسافران', date: today,
      amount: 75000, payment: 'paid', status: 'issued',
      provider: 'رحاب للرحلات', assigned: 'أحمد', createdAt: '09:05'
    },
    {
      id: 'YAR-1044', customer: 'هدى الجوري', initials: 'ه ج',
      service: 'flight', route: 'النجف ← طهران',
      detail: 'ذهاب فقط · مسافران · اقتصادية', date: today,
      amount: 615000, payment: 'pending', status: 'processing',
      provider: 'أفق للسفر', assigned: 'علي', createdAt: '08:56'
    },
    {
      id: 'YAR-1043', customer: 'كريم الينابيع', initials: 'ك ي',
      service: 'hotel', route: 'طهران · إقامة فندقية',
      detail: 'فندق شرفة الورد · ليلتان · غرفة مفردة', date: today,
      amount: 390000, payment: 'paid', status: 'issued',
      provider: 'مدار للحجوزات', assigned: 'نور', createdAt: '08:49'
    },
    {
      id: 'YAR-1042', customer: 'رنا الأنسام', initials: 'ر أ',
      service: 'package', route: 'النجف ← مشهد',
      detail: 'باقة مشهد · 4 ليالٍ · مسافران', date: today,
      amount: 1780000, payment: 'pending', status: 'awaiting',
      provider: 'رحاب للرحلات', assigned: 'زينب', createdAt: '08:41'
    },
    {
      id: 'YAR-1041', customer: 'ياسر الصفصاف', initials: 'ي ص',
      service: 'flight', route: 'البصرة ← شيراز',
      detail: 'ذهاب فقط · مسافر واحد · اقتصادية', date: today,
      amount: 332000, payment: 'review', status: 'awaiting',
      provider: 'أفق للسفر', assigned: 'علي', createdAt: '08:33'
    },
    {
      id: 'YAR-1040', customer: 'سلمى الياسمين', initials: 'س ي',
      service: 'transfer', route: 'مطار طهران ← فندق شرفة الورد',
      detail: 'توصيل خاص · أُلغي بطلب العميل', date: today,
      amount: 95000, payment: 'pending', status: 'cancelled',
      provider: 'رحاب للرحلات', assigned: 'أحمد', createdAt: '08:20'
    },
    {
      id: 'YAR-1039', customer: 'نبيل الروابي', initials: 'ن ر',
      service: 'hotel', route: 'شيراز · إقامة فندقية',
      detail: 'فندق ضفاف الندى · 3 ليالٍ · غرفة مزدوجة',
      date: '2026-11-04', amount: 540000, payment: 'paid', status: 'issued',
      provider: 'مدار للحجوزات', assigned: 'نور', createdAt: '16:42'
    },
    {
      id: 'YAR-1038', customer: 'دانا المرجان', initials: 'د م',
      service: 'flight', route: 'أربيل ← طهران',
      detail: 'ذهاب وعودة · مسافر واحد · اقتصادية',
      date: '2026-11-03', amount: 492000, payment: 'paid', status: 'issued',
      provider: 'أفق للسفر', assigned: 'علي', createdAt: '14:15'
    },
    {
      id: 'YAR-1037', customer: 'مازن البستان', initials: 'م ب',
      service: 'package', route: 'بغداد ← طهران والشمال',
      detail: 'باقة طهران ورامسر · 6 ليالٍ · مسافران',
      date: '2026-11-02', amount: 2120000, payment: 'pending', status: 'awaiting',
      provider: 'رحاب للرحلات', assigned: 'زينب', createdAt: '11:32'
    }
  ];

  const suppliers = [
    {
      id: 'supplier-afaq', name: 'أفق للسفر', code: 'AFQ',
      connection: 'healthy', responseMs: 420, successRate: 99.2,
      source: 'NDC', lastSync: 'منذ دقيقة', warning: ''
    },
    {
      id: 'supplier-madar', name: 'مدار للحجوزات', code: 'MDR',
      connection: 'slow', responseMs: 1860, successRate: 94.8,
      source: 'GDS', lastSync: 'منذ 5 دقائق',
      warning: 'وقت الاستجابة أعلى من المعتاد في هذا السيناريو التجريبي.'
    },
    {
      id: 'supplier-rihab', name: 'رحاب للرحلات', code: 'RHB',
      connection: 'offline', responseMs: null, successRate: 0,
      source: 'API', lastSync: 'منذ 24 دقيقة',
      warning: 'الاتصال متوقف تجريبياً؛ يمكن متابعة الطلبات يدوياً.'
    }
  ];

  const sum = rows => rows.reduce((total, row) => total + row.amount, 0);
  const todayRows = bookings.filter(row => row.date === today);
  const activeRows = bookings.filter(row => row.status !== 'cancelled');
  const todayActiveRows = todayRows.filter(row => row.status !== 'cancelled');
  const pendingRows = activeRows.filter(row => row.payment === 'pending');
  const paidRows = activeRows.filter(row => row.payment === 'paid');

  const totals = {
    totalBookings: bookings.length,
    totalBookedValue: sum(activeRows),
    totalRevenue: sum(paidRows),
    todayBookings: todayRows.length,
    todayBookedValue: sum(todayActiveRows),
    todayRevenue: sum(todayActiveRows.filter(row => row.payment === 'paid')),
    todayPaidBookings: todayActiveRows.filter(row => row.payment === 'paid').length,
    todayPendingPayments: todayActiveRows.filter(row => row.payment === 'pending').length,
    pendingPayments: pendingRows.length,
    pendingAmount: sum(pendingRows),
    reviewPayments: activeRows.filter(row => row.payment === 'review').length,
    reviewAmount: sum(activeRows.filter(row => row.payment === 'review')),
    awaitingBookings: bookings.filter(row => row.status === 'awaiting').length,
    processingBookings: bookings.filter(row => row.status === 'processing').length,
    issuedBookings: bookings.filter(row => row.status === 'issued').length,
    cancelledBookings: bookings.filter(row => row.status === 'cancelled').length,
    activeSuppliers: suppliers.filter(row => row.connection !== 'offline').length,
    totalSuppliers: suppliers.length
  };

  // Historical points are a separate illustrative series; today's point uses the table totals.
  const weeklyTrend = [
    { date: '2026-10-30', label: 'الجمعة', revenue: 1120000, bookings: 7 },
    { date: '2026-10-31', label: 'السبت', revenue: 1680000, bookings: 10 },
    { date: '2026-11-01', label: 'الأحد', revenue: 1320000, bookings: 8 },
    { date: '2026-11-02', label: 'الاثنين', revenue: 2010000, bookings: 12 },
    { date: '2026-11-03', label: 'الثلاثاء', revenue: 1840000, bookings: 11 },
    { date: '2026-11-04', label: 'الأربعاء', revenue: 2360000, bookings: 14 },
    { date: today, label: 'الخميس', revenue: totals.todayRevenue, bookings: totals.todayBookings }
  ];

  window.YAR_DEMO = {
    source: 'بيانات تجريبية',
    today: today,
    timezone: 'Asia/Baghdad',
    currency: 'IQD',
    currencyLabel: 'د.ع',
    updatedAt: '09:30',
    description: 'جميع الأسماء والحجوزات والموردين في هذه الواجهة افتراضية.',
    revenueDefinition: 'مجموع الحجوزات المدفوعة غير الملغاة، بالدينار العراقي.',
    weeklyTrendSource: 'ملخص أسبوعي تجريبي؛ الأيام السابقة لا تمثل كامل جدول الحجوزات المعروض.',
    bookings: bookings,
    suppliers: suppliers,
    totals: totals,
    weeklyTrend: weeklyTrend
  };
})();
