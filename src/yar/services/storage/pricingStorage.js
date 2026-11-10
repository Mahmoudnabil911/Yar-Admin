import { assertCan } from '../../auth/access';
import { pricingEngine as E } from '../models';
import { catalogStorage } from './catalogStorage';

const STORAGE = 'YAR_ADMIN_PRICING_V1';
const clone = value => JSON.parse(JSON.stringify(value));

export function normalize(source) {
  const rule = source && typeof source === 'object' ? source : {};
  return {
    id: String(rule.id ?? '').trim().slice(0, 90),
    kind: String(rule.kind ?? ''),
    name: String(rule.name ?? '').trim().slice(0, 80),
    service: String(rule.service ?? ''),
    providerId: String(rule.providerId ?? ''),
    currency: String(rule.currency ?? ''),
    mode: String(rule.mode ?? ''),
    value: rule.value === '' || rule.value == null ? NaN : Number(rule.value),
    startDate: String(rule.startDate ?? '').trim(),
    endDate: String(rule.endDate ?? '').trim(),
    enabled: rule.enabled === true,
    ...E.normalizeFlightScope(rule)
  };
}

export function structuralError(rule) {
  const references = rule.providerId !== 'all' ? [{ id: rule.providerId, serviceType: rule.service, status: 'published' }] : [];
  return E.validate(rule, [], references);
}

class PricingStorage {
  constructor() {
    this.rules = [];
    this.deleted = null;
    this.notice = '';
    this.listeners = new Set();
    this.init();
  }

  getProviders() {
    return catalogStorage.getRecords('providers');
  }

  init() {
    let source = E.seed;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved?.version !== 1 || !Array.isArray(saved.rules)) throw new Error('invalid-storage');
        source = saved.rules;
        if (saved.deleted?.rule) {
          const rule = normalize(saved.deleted.rule);
          if (rule.id && !structuralError(rule)) {
            this.deleted = { rule, index: Number.isInteger(saved.deleted.index) ? saved.deleted.index : 0 };
          }
        }
      }
    } catch {
      this.notice = 'تعذر قراءة القواعد المحفوظة؛ تُعرض القواعد التجريبية الأساسية.';
    }

    const accepted = [];
    for (const sourceRule of (Array.isArray(source) ? source : [])) {
      const rule = normalize(sourceRule);
      if (!rule.id || accepted.some(item => item.id === rule.id) || structuralError(rule)) {
        // skipped
      } else {
        accepted.push(rule);
      }
    }
    this.rules = accepted;
  }

  persist(next, deleted = this.deleted) {
    const payload = {
      version: 1,
      rules: clone(next),
      deleted: deleted?.rule ? { rule: clone(deleted.rule), index: deleted.index } : null
    };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(payload));
      this.rules = clone(next);
      this.deleted = deleted;
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

  getRules() {
    return clone(this.rules);
  }

  getCalculationRules() {
    const currentProviders = this.getProviders();
    return this.rules.filter(rule => !E.validate(rule, this.rules, currentProviders));
  }

  saveRule(rule) {
    assertCan('pricing.manage');
    const normalizedRule = normalize(rule);
    const existingIndex = this.rules.findIndex(item => item.id === normalizedRule.id);
    const currentProviders = this.getProviders();

    if (!normalizedRule.id) {
      normalizedRule.id = `pricing-${normalizedRule.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const next = clone(this.rules);
    if (existingIndex >= 0) {
      next[existingIndex] = normalizedRule;
    } else {
      next.unshift(normalizedRule);
    }

    const error = E.validate(normalizedRule, next, currentProviders);
    if (error) throw new Error(error);

    if (!this.persist(next)) {
      throw new Error('مساحة التخزين غير متاحة؛ لم يُحفظ التعديل.');
    }
    return normalizedRule;
  }

  toggleRule(id, enabled) {
    assertCan('pricing.manage');
    const index = this.rules.findIndex(r => r.id === id);
    if (index < 0) return;
    const next = clone(this.rules);
    next[index].enabled = enabled;
    this.persist(next);
  }

  deleteRule(id) {
    assertCan('pricing.manage');
    const index = this.rules.findIndex(r => r.id === id);
    if (index < 0) return;
    const rule = this.rules[index];
    const next = clone(this.rules);
    next.splice(index, 1);
    this.persist(next, { rule: clone(rule), index });
    return rule;
  }

  undoDelete() {
    assertCan('pricing.manage');
    if (!this.deleted?.rule) return null;
    const { rule, index } = this.deleted;
    const next = clone(this.rules);
    next.splice(Math.min(index, next.length), 0, clone(rule));
    this.persist(next, null);
    return rule;
  }

  calculate(simContext) {
    const usableRules = this.getCalculationRules();
    return E.calculate(usableRules, simContext, this.getProviders());
  }
}

export const pricingStorage = new PricingStorage();
export default pricingStorage;

