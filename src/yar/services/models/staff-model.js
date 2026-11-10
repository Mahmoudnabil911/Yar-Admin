(() => {
  'use strict';

  const permissions = {
    bookings: 'الحجوزات والطلبات', payments: 'مراجعة الدفع والاسترداد داخل الحجز', reports: 'التقارير',
    catalog: 'الخدمات والأسعار', content: 'محتوى التطبيق', providers: 'تشغيل المزوّدين', staff: 'الموظفون والصلاحيات',
  };
  const roles = { owner: 'مالك النظام', admin: 'مدير النظام', bookings: 'فريق الحجوزات', accounting: 'المحاسبة', content: 'فريق المحتوى', support: 'الدعم والمتابعة' };
  const presets = {
    owner: Object.keys(permissions), admin: Object.keys(permissions),
    bookings: ['bookings', 'catalog', 'providers'], accounting: ['bookings', 'payments', 'reports'],
    content: ['catalog', 'content'], support: ['bookings', 'reports'],
  };
  const ownerId = 'staff-owner';
  const clone = value => JSON.parse(JSON.stringify(value));
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const normalizedName = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  const seed = [
    { id: ownerId, name: 'مالك النظام', role: 'owner', status: 'active', permissions: presets.owner.slice() },
    { id: 'staff-ahmed', name: 'أحمد', role: 'admin', status: 'active', permissions: presets.admin.slice() },
    { id: 'staff-noor', name: 'نور', role: 'bookings', status: 'active', permissions: presets.bookings.slice() },
    { id: 'staff-zainab', name: 'زينب', role: 'accounting', status: 'active', permissions: presets.accounting.slice() },
    { id: 'staff-ali', name: 'علي', role: 'bookings', status: 'active', permissions: presets.bookings.slice() },
  ];

  function normalize(input) {
    const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    return {
      id: typeof value.id === 'string' ? value.id.trim() : '',
      name: typeof value.name === 'string' ? value.name.trim().replace(/\s+/g, ' ') : '',
      role: typeof value.role === 'string' ? value.role : '',
      status: typeof value.status === 'string' ? value.status : '',
      permissions: Array.isArray(value.permissions) ? [...new Set(value.permissions.filter(key => typeof key === 'string' && own(permissions, key)))] : [],
    };
  }

  function shapeError(value) {
    if (!value.id || value.id.length > 90 || !/^[a-zA-Z0-9_-]+$/.test(value.id)) return 'معرّف الموظف غير صالح.';
    if (value.name.length < 2 || value.name.length > 80) return 'اكتب اسم الموظف من حرفين إلى 80 حرفًا.';
    if (!own(roles, value.role)) return 'اختر دورًا صالحًا للموظف.';
    if (!['active', 'inactive'].includes(value.status)) return 'اختر حالة نشطة أو موقوفة للموظف.';
    if (!value.permissions.length) return 'حدّد صلاحية واحدة على الأقل للموظف.';
    if (value.role === 'admin' && !value.permissions.includes('staff')) return 'يجب أن يحتفظ مدير النظام بصلاحية إدارة الموظفين.';
    if (value.id === ownerId) {
      if (value.role !== 'owner' || value.status !== 'active' || Object.keys(permissions).some(key => !value.permissions.includes(key))) return 'حساب المالك محمي؛ لا يمكن إيقافه أو تغيير دوره أو صلاحياته.';
    } else if (value.role === 'owner') return 'حساب المالك ثابت؛ اختر دورًا آخر لهذا الموظف.';
    return '';
  }

  function validate(input, records = seed) {
    const value = normalize(input);
    const error = shapeError(value);
    if (error) return error;
    const rows = Array.isArray(records) ? records : [];
    if (rows.some(row => row.id !== value.id && normalizedName(row.name) === normalizedName(value.name))) return 'يوجد موظف بهذا الاسم. استخدم اسمًا مميزًا لتوضيح الإسناد.';
    const next = rows.filter(row => row.id !== value.id).concat(value);
    if (!next.some(row => row.id === ownerId && row.role === 'owner' && row.status === 'active')) return 'يجب الاحتفاظ بحساب المالك النشط.';
    if (!next.some(row => row.role === 'admin' && row.status === 'active' && row.permissions.includes('staff'))) return 'لا يمكن إيقاف آخر مدير نظام نشط أو تغيير دوره. أضف مديرًا نشطًا آخر أولًا.';
    return '';
  }

  function sanitizeRecords(input) {
    if (!Array.isArray(input) || !input.length) throw new Error('قائمة الموظفين المحفوظة غير صالحة.');
    const rows = input.map(normalize);
    const ids = new Set();
    for (const row of rows) {
      if (ids.has(row.id)) throw new Error('تتكرر معرّفات الموظفين في النسخة المحفوظة.');
      ids.add(row.id);
      const error = validate(row, rows);
      if (error) throw new Error(error);
    }
    return clone(rows);
  }

  function upsert(records, input) {
    const rows = sanitizeRecords(records);
    const record = normalize(input);
    const error = validate(record, rows);
    if (error) throw new Error(error);
    const index = rows.findIndex(row => row.id === record.id);
    if (index < 0) rows.push(record);
    else rows[index] = record;
    return clone(rows);
  }

  function setStatus(records, id, status) {
    const record = records.find(row => row.id === id);
    if (!record) throw new Error('الموظف غير موجود.');
    return upsert(records, { ...record, status });
  }

  function payload(records, logs = []) {
    if (!Array.isArray(logs)) throw new Error('سجل إجراءات الموظفين غير صالح.');
    return {
      version: 1, staff: sanitizeRecords(records),
      logs: logs.slice(-300).map(log => {
        if (!log || typeof log !== 'object' || !['create', 'edit', 'activate', 'deactivate'].includes(log.action) || !Number.isFinite(Date.parse(log.at))) throw new Error('أحد إجراءات الموظفين المحفوظة غير صالح.');
        return { id: String(log.id || '').slice(0, 100), staffId: String(log.staffId || '').slice(0, 90), action: log.action, at: new Date(log.at).toISOString(), detail: String(log.detail || '').slice(0, 500) };
      }),
    };
  }

  function restore(input) {
    if (!input || input.version !== 1 || !Array.isArray(input.staff) || !Array.isArray(input.logs)) throw new Error('نسخة الموظفين المحفوظة غير صالحة أو غير مدعومة.');
    return payload(input.staff, input.logs);
  }

  const api = { roles, permissions, presets, ownerId, seed, normalize, validate, sanitizeRecords, upsert, setStatus, payload, restore };
  globalThis.YARStaffModel = api;
  if (typeof window !== 'undefined') window.YARStaffModel = api;
})();
