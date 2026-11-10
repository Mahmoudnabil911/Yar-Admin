import { assertCan } from '../../auth/access';
import { catalogTypes } from '../models';
import { migrateHotel } from '../hotelPricing';
import { sampleResort } from '../models/hotel-schema.js';

const STORAGE = 'YAR_ADMIN_CATALOG_V2';
const clone = value => JSON.parse(JSON.stringify(value));
export const statusLabels = { published: 'منشور', draft: 'مسودة', archived: 'مؤرشف' };

export function photoAllowed(value) {
  if(typeof value==='string'&&/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=2000000)return true;
  if (typeof value !== 'string' || value.length > 3000) return false;
  const approved = [
    'assets/external/image-01.jpeg',
    'assets/external/image-02.jpg',
    'assets/external/image-03.jpg',
    'assets/external/image-04.jpg',
    'assets/external/image-05.jpg',
    'assets/external/image-06.jpg',
    'assets/external/image-07.webp',
    'assets/external/image-08.webp',
    'assets/external/image-09.webp',
    '/assets/external/image-01.jpeg',
    '/assets/external/image-02.jpg',
    '/assets/external/image-03.jpg',
    '/assets/external/image-04.jpg',
    '/assets/external/image-05.jpg',
    '/assets/external/image-06.jpg',
    '/assets/external/image-07.webp',
    '/assets/external/image-08.webp',
    '/assets/external/image-09.webp'
  ];
  if (approved.includes(value)) return true;
  if (/^(\/)?assets\/content\/(mashhad|tehran|shiraz|north|masuleh)\.jpg$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function safePhotos(value) {
  return (Array.isArray(value) ? value : []).filter(photoAllowed).slice(0, 12);
}

export function generatedId() {
  return 'option-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export function normalized(value) {
  return String(value || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

export function sanitize(record, fields = []) {
  const result = {};
  for (const field of fields) {
    const value = record?.[field.key];
    if (field.type === 'repeat') {
      result[field.key] = (Array.isArray(value) ? value : []).slice(0, field.maxItems || 20).map(row => sanitize(row, field.fields));
    } else if (field.type === 'photos') {
      result[field.key] = safePhotos(value);
    } else if (field.type === 'codes') {
      result[field.key] = [...new Set((Array.isArray(value) ? value : []).filter(v => typeof v === 'string' && /^[a-z0-9_:-]{1,60}$/i.test(v)))].slice(0, 120);
    } else if (field.type === 'checkbox') {
      result[field.key] = !!value;
    } else if (field.type === 'number') {
      result[field.key] = value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    } else {
      result[field.key] = field.generated ? String(value || generatedId()).slice(0, 90) : String(value ?? '').slice(0, 12000);
    }
  }
  return result;
}

function hydrationDefaults(key, r) {
  const copy = clone(r);
  if (key === 'providers') {
    copy.operatingEnabled = typeof r.operatingEnabled === 'boolean' ? r.operatingEnabled : r.status === 'published';
    copy.environment ||= 'test';
    copy.fallbackProviderId ||= '';
  }
  if (key === 'packages') {
    copy.hotelOptions = (copy.hotelOptions || []).map(option => {
      const template = catalogTypes.packages.seed.flatMap(pkg => pkg.hotelOptions || []).find(row => normalized(row.hotelName) === normalized(option.hotelName));
      if (!option.optionId) option.optionId = template?.optionId || generatedId();
      if (!Object.hasOwn(option, 'photos')) option.photos = clone(template?.photos || []);
      option.description ||= template?.description || '';
      return option;
    });
  }
  if (key === 'hotels') {
    copy.checkIn ||= '14:00';
    copy.checkOut ||= '12:00';
    copy.cancellationPolicy ||= 'سياسة الإلغاء في هذا النموذج غير معتمدة؛ تُراجع السياسة النهائية مع الفريق قبل الحجز.';
  }
  return copy;
}

class CatalogStorage {
  constructor() {
    this.catalogs = Object.fromEntries(
      Object.entries(catalogTypes).map(([key, c]) => [key, clone(c.seed)])
    );
    this.storageNotice = '';
    this.listeners = new Set();
    this.init();
  }

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
      if (saved?.version === 2 && saved.records) {
        for (const [key, type] of Object.entries(catalogTypes)) {
          if (Array.isArray(saved.records[key])) {
            this.catalogs[key] = saved.records[key].filter(r => r && typeof r.id === 'string').map(r => ({
              ...sanitize(hydrationDefaults(key, r), type.fields),
              id: r.id.slice(0, 90),
              status: statusLabels[r.status] ? r.status : 'draft',
              updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : ''
            }));
          }
        }
      } else {
        const legacy = JSON.parse(localStorage.getItem('YAR_ADMIN_DEMO_DRAFTS_V1') || '[]');
        if (Array.isArray(legacy)) {
          legacy.slice(0, 30).forEach((r, index) => {
            const key = { hotel: 'hotels', package: 'packages', transfer: 'cars', provider: 'providers' }[r?.kind];
            if (!key || !r.name) return;
            const record = { ...this.blankRecord(key), id: `legacy-${key}-${index}`, name: String(r.name).slice(0, 80), status: 'draft' };
            if (key === 'hotels') {
              record.city = String(r.city || 'مشهد');
              record.stars = parseInt(r.option, 10) || 3;
              record.description = String(r.notes || '');
            }
            if (key === 'packages') {
              record.destinations = String(r.city || 'مشهد');
              record.description = String(r.notes || '');
            }
            this.catalogs[key].push(record);
          });
        }
      }
    } catch {
      this.storageNotice = 'تعذر استعادة المسودات المحلية. تُعرض البيانات التجريبية الأصلية.';
    }

    this.migrateCatalogs();
    this.store();
  }

  migrateCatalogs() {
    for (const [key, type] of Object.entries(catalogTypes)) {
      for (const example of type.seed.filter(r => r.id.startsWith("DEMO-FINAL-CAT-"))) {
        if (!this.catalogs[key].some(r => r.id === example.id)) {
          this.catalogs[key].push(clone(example));
        }
      }
    }
    if (!this.catalogs.providers.some(p => p.id === 'provider-tours')) {
      this.catalogs.providers.push(clone(catalogTypes.providers.seed.find(p => p.id === 'provider-tours')));
    }
    for (const provider of this.catalogs.providers) {
      if (typeof provider.operatingEnabled !== 'boolean') provider.operatingEnabled = provider.status === 'published';
      if (!['test', 'production'].includes(provider.environment)) provider.environment = 'test';
      provider.fallbackProviderId ||= '';
    }
    // Fictional full-configuration example, added once and never overwritten.
    if (!this.catalogs.hotels.some(r => r.id === sampleResort.id)) this.catalogs.hotels.push(clone(sampleResort));
    for (const hotel of this.catalogs.hotels) {
      hotel.checkIn ||= '14:00';
      hotel.checkOut ||= '12:00';
      hotel.cancellationPolicy ||= 'سياسة الإلغاء في هذا النموذج غير معتمدة؛ تُراجع السياسة النهائية مع الفريق قبل الحجز.';
      for (const room of hotel.rooms || []) room.availability ||= [];
      migrateHotel(hotel);
    }
    for (const pkg of this.catalogs.packages) {
      for (const option of pkg.hotelOptions || []) {
        option.optionId ||= generatedId();
        option.description ||= '';
        option.photos ||= [];
      }
    }
  }

  store() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ version: 2, records: this.catalogs }));
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try { listener(); } catch (err) { console.error(err); }
    }
  }

  getRecords(key) {
    return clone(this.catalogs[key] || []);
  }

  blankRecord(key) {
    const base = sanitize({}, catalogTypes[key].fields);
    base.status = 'draft';
    return base;
  }

  referenceError(records) {
    for (const [key, service, label] of [['cars', 'transfer', 'سيارة'], ['tours', 'tour', 'جولة']]) {
      for (const item of (records[key] || []).filter(r => r.status === 'published' && (key === 'cars' || r.serviceProvider))) {
        const provider = records.providers.find(p => p.id === item.serviceProvider);
        if (!provider || provider.status !== 'published' || provider.serviceType !== service) {
          return 'هذا المزوّد مرتبط بـ' + label + ' منشورة. غيّر المزوّد أو حوّل الخدمة لمسودة قبل أرشفته أو تغيير نوعه.';
        }
      }
    }
    for (const provider of records.providers) {
      if (!provider.fallbackProviderId) continue;
      if (provider.serviceType !== 'flight') return 'المزوّد البديل متاح لمصادر الطيران فقط.';
      const seen = new Set([provider.id]);
      let current = provider;
      while (current.fallbackProviderId) {
        if (seen.has(current.fallbackProviderId)) {
          return 'تسلسل المزوّدين البدلاء يحتوي على حلقة. اختر مصدرًا بديلًا مختلفًا.';
        }
        seen.add(current.fallbackProviderId);
        current = records.providers.find(p => p.id === current.fallbackProviderId);
        if (!current || current.serviceType !== 'flight' || current.status !== 'published') {
          return 'اختر مزوّد طيران منشورًا كبديل، أو أزل الربط قبل أرشفته.';
        }
      }
    }
    return '';
  }

  validatePhotos(record, fields) {
    for (const field of fields) {
      const value = record[field.key];
      if (field.type === 'photos' && (value.length > 12 || value.some(src => !photoAllowed(src)))) {
        return 'استخدم رابط صورة http أو https دون بيانات دخول أو صورة من المكتبة المحلية المعتمدة، حتى 12 صورة لكل معرض.';
      }
      if (field.type === 'repeat') {
        for (const row of value || []) {
          const error = this.validatePhotos(row, field.fields);
          if (error) return error;
        }
      }
    }
    return '';
  }

  saveRecord(key, record) {
    assertCan('catalog.manage');
    const type = catalogTypes[key];
    const photoError = this.validatePhotos(record, type.fields);
    if (photoError) throw new Error(photoError);

    const error = type.validate?.(record, this.catalogs);
    if (error) throw new Error(error);

    if (this.catalogs[key].some(r => r.id !== record.id && normalized(r.name) === normalized(record.name))) {
      throw new Error('يوجد سجل بالاسم نفسه في هذا القسم. استخدم اسمًا مميزًا.');
    }

    const candidate = { ...record };
    if (!candidate.id) {
      candidate.id = `${key}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }
    candidate.updatedAt = new Date().toISOString();

    const before = clone(this.catalogs[key]);
    const index = this.catalogs[key].findIndex(r => r.id === candidate.id);
    if (index < 0) {
      this.catalogs[key].unshift(candidate);
    } else {
      this.catalogs[key].splice(index, 1, candidate);
    }

    const linkError = this.referenceError(this.catalogs);
    if (linkError) {
      this.catalogs[key] = before;
      throw new Error(linkError);
    }

    if (!this.store()) {
      this.catalogs[key] = before;
      throw new Error('مساحة التخزين المحلي غير متاحة. لم يُحفظ التعديل؛ احتفظ بالبيانات الظاهرة وجرّب متصفحًا يسمح بالتخزين.');
    }

    return clone(candidate);
  }

  async saveForm(key,record,form){
    assertCan('catalog.manage');
    if(!(form instanceof FormData))throw new Error('Expected multipart form');
    return this.saveRecord(key,record);
  }

  archiveRecord(key, id) {
    assertCan('catalog.manage');
    const record = this.catalogs[key].find(r => r.id === id);
    if (!record) return;
    const previous = record.status;
    record.status = previous === 'archived' ? 'draft' : 'archived';

    const error = this.referenceError(this.catalogs);
    if (error) {
      record.status = previous;
      throw new Error(error);
    }

    if (!this.store()) {
      record.status = previous;
      throw new Error('تعذر الحفظ المحلي. لم تتغير حالة السجل.');
    }

    return record.status;
  }

  updateProvider(id, patch) {
    assertCan('catalog.manage');
    const index = this.catalogs.providers.findIndex(p => p.id === id);
    if (index < 0) throw new Error('المزوّد غير موجود.');
    const previous = clone(this.catalogs.providers);
    const allowed = ['operatingEnabled', 'connectionState', 'priority', 'environment', 'fallbackProviderId'];
    const candidate = { ...this.catalogs.providers[index] };
    for (const key of allowed) {
      if (Object.hasOwn(patch, key)) candidate[key] = patch[key];
    }
    candidate.updatedAt = new Date().toISOString();

    const error = catalogTypes.providers.validate(candidate, this.catalogs);
    if (error) throw new Error(error);

    this.catalogs.providers[index] = candidate;
    const linkError = this.referenceError(this.catalogs);
    if (linkError) {
      this.catalogs.providers = previous;
      throw new Error(linkError);
    }

    if (!this.store()) {
      this.catalogs.providers = previous;
      throw new Error('تعذر الحفظ المحلي. بقيت إعدادات المزوّد السابقة.');
    }

    return clone(candidate);
  }
}

export const catalogStorage = new CatalogStorage();
export default catalogStorage;

