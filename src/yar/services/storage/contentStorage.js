import { assertCan } from '../../auth/access';
import { contentModel as M } from '../models';
import { catalogStorage } from './catalogStorage';

const STORAGE = 'YAR_ADMIN_CONTENT_V1';
const clone = value => JSON.parse(JSON.stringify(value));

class ContentStorage {
  constructor() {
    this.records = [];
    this.notice = '';
    this.listeners = new Set();
    this.init();
  }

  getContext() {
    return { packages: catalogStorage.getRecords('packages') };
  }

  init() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved?.version !== 1 || !Array.isArray(saved.records)) throw new Error();
        this.records = M.sanitizeRecords(saved.records);
      } else {
        this.records = M.sanitizeRecords(clone(M.seed));
      }
    } catch {
      this.records = M.sanitizeRecords(clone(M.seed));
      this.notice = 'تعذر قراءة المحتوى المحفوظ. تُعرض نسخة المحتوى الأساسية للمعاينة.';
    }
  }

  persist(next) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ version: 1, records: clone(next) }));
      this.records = clone(next);
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

  getRecords() {
    return clone(this.records);
  }

  getSingleton(type) {
    return clone(this.records.find(r => r.kind === type) || null);
  }

  saveDraft(kind, id, draftPayload) {
    assertCan('content.manage');
    const context = this.getContext();
    const next = M.saveDraft(this.records, kind, id, draftPayload, context);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }

  publish(id) {
    assertCan('content.manage');
    const context = this.getContext();
    const next = M.publish(this.records, id, context);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }

  discardDraft(id) {
    assertCan('content.manage');
    const next = M.discardDraft(this.records, id);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }

  archive(id) {
    assertCan('content.manage');
    const next = M.archive(this.records, id);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }

  restoreItem(id) {
    assertCan('content.manage');
    const next = M.restore(this.records, id);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }

  move(id, direction) {
    assertCan('content.manage');
    const next = M.move(this.records, id, direction);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية.');
  }
}

export const contentStorage = new ContentStorage();
export default contentStorage;

