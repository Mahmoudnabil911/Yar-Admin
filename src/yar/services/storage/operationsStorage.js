import { assignmentUsers } from '../../accounts/repository';
import { publishOperation } from '../../accounts/repository';
import { assertCan, actor } from '../../auth/access';
import { operationsModel as M, supplierCreditModel as C, finalDemo as YARFinalDemo, mockData } from '../models';
import { catalogStorage } from './catalogStorage';
import { fxStorage } from './fxStorage';
import { usdToIqd } from '../fxRate';

const STORAGE = 'YAR_ADMIN_OPERATIONS_V1';
const clone = v => JSON.parse(JSON.stringify(v));

class OperationsStorage {
  constructor() {
    this.records = null;
    this.ledger = [];
    this.savedRaw = null;
    this.storageBlocked = false;
    this.notice = '';
    this.listeners = new Set();
    this.ensure();
  }

  getContext(staffId = '', staffName = '') {
    const a = actor();
    return {
      providers: catalogStorage.getRecords('providers'),
      staff: assignmentUsers(),
      at: new Date().toISOString(),
      // Operations are attributed to the signed-in mock user.
      staffId: staffId || a.staffId || 'staff-ahmed',
      staffName: staffName || a.staffName || 'أحمد الهمداني'
    };
  }

  ensure() {
    if (this.records) return;
    let raw;
    const context = this.getContext();
    try {
      raw = localStorage.getItem(STORAGE);
      this.savedRaw = raw;
      if (raw) {
        const saved = JSON.parse(raw);
        this.records = M.hydrate(saved.version === 2 ? saved.records : saved);
        this.ledger = C ? C.hydrate(saved.version === 2 ? saved.creditLedger : [], this.records) : [];
      } else {
        const initialBookings = mockData?.bookings || [];
        this.records = M.fromLegacy(initialBookings, context);
        this.ledger = [];
        const p = context.providers.find(p => p.serviceType === 'flight' && p.status === 'published');
        if (C && p) {
          this.ledger = C.deposit(this.records, [], {
            providerId: p.id,
            currency: 'USD',
            amount: 1000,
            reference: 'DEMO-OPENING-CREDIT-1000',
            note: 'رصيد توضيحي افتتاحي للمعاينة فقط؛ لا يمثل إيداعًا فعليًا.'
          }, context);
        }
      }
    } catch (err) {
      this.records = M.fromLegacy(mockData?.bookings || [], context);
      this.ledger = [];
      this.storageBlocked = !!raw;
      this.notice = 'تعذر استعادة سجل العمليات. حُفظ السجل الأصلي دون استبداله؛ إجراءات الحفظ متوقفة حتى مراجعة بيانات المتصفح.';
    }

    if (!this.storageBlocked && YARFinalDemo) {
      try {
        const demo = YARFinalDemo.build(this.records, this.ledger, context);
        if (demo.added) {
          this.commit(demo);
          this.notice = `أضيفت ${demo.added} طلبات اختبار نهائي وهمية؛ حُفظت بياناتك السابقة دون تغيير.`;
        }
      } catch (error) {
        this.notice = 'تعذر إضافة أمثلة الاختبار: ' + error.message;
      }
    }

    this.sync();
    this.initialized = true;
  }

  commit(candidate) {
    if (this.storageBlocked) throw new Error(this.notice);
    const records = Array.isArray(candidate) ? candidate : candidate.records;
    const ledger = Array.isArray(candidate) ? this.ledger : candidate.ledger;
    const checked = M.hydrate(records);
    const credit = C ? C.hydrate(ledger, checked) : ledger;
    const saved = JSON.stringify({ version: 2, records: checked, creditLedger: credit });

    try {
      localStorage.setItem(STORAGE, saved);
      this.savedRaw = saved;
      const previous = this.records || [];
      this.records = checked;
      this.ledger = credit;
      this.notice = '';
      this.sync();
      this.notify();
      if (this.initialized) publishOperation(previous, checked);
    } catch (err) {
      throw new Error('فشل الحفظ في التخزين المحلي للمتصفح.');
    }
  }

  sync() {
    if (typeof window !== 'undefined' && window.YAR_DEMO?.bookings) {
      window.YAR_DEMO.bookings.splice(0, window.YAR_DEMO.bookings.length, ...clone(this.records));
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

  getBookings() {
    this.ensure();
    return clone(this.records);
  }

  getCreditLedger() {
    this.ensure();
    return clone(this.ledger);
  }

  getBooking(id) {
    this.ensure();
    return clone(this.records.find(r => r.id === id) || null);
  }

  createBooking(input, staffContext = {}) {
    assertCan('booking.create');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    // Customer side is always IQD; supplier net is USD converted with today's admin rate (frozen on the booking).
    const { supplierNetUsd, ...rest } = input;
    if (rest.currency !== 'IQD') throw new Error('سعر العميل وفواتيره بالدينار العراقي فقط.');
    const today = fxStorage.todayRate();
    if (!today) throw new Error('يجب أن يسجّل مدير النظام سعر صرف الدولار لليوم قبل إنشاء حجز جديد.');
    const usd = Number(supplierNetUsd);
    if (!Number.isFinite(usd) || usd <= 0 || M.money(usd, 'USD') !== usd) throw new Error('أدخل صافي المورّد بالدولار (حتى منزلتين عشريتين) أكبر من صفر.');
    const next = M.create(this.records, { ...rest, cost: usdToIqd(usd, today.rate) }, context);
    next[0].supplierNet = { currency: 'USD', amount: usd, rate: today.rate, rateDate: today.date, rateId: today.id };
    next[0].timeline.push({ id: `${next[0].id}-fx`, at: context.at, type: 'fx', note: `صافي المورّد ${usd} USD × سعر ${today.rate} = ${next[0].pricing.cost} IQD (سعر ${today.date})`, staffId: context.staffId, staffName: context.staffName });
    this.commit(next);
    return next[0];
  }

  updateDetails(id, input, staffContext = {}) {
    assertCan('booking.edit');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.updateDetails(this.records, id, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  transitionStatus(id, newStatus, input = {}, staffContext = {}) {
    assertCan('booking.transition');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.transition(this.records, id, newStatus, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  assignStaff(id, staffId, staffContext = {}) {
    assertCan('booking.assign');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.assign(this.records, id, staffId, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  addNote(id, note, staffContext = {}) {
    assertCan('booking.note');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.addNote(this.records, id, note, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  attachDocument(id, input, staffContext = {}) {
    assertCan('booking.edit');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.attachDocument(this.records, id, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  recordPayment(id, input, staffContext = {}) {
    assertCan('payment.collect');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.recordPayment(this.records, id, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  reviewPayment(id, paymentId, status, note, staffContext = {}) {
    assertCan('payment.review');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.reviewPayment(this.records, id, paymentId, status, note, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  recordRefund(id, input, staffContext = {}) {
    assertCan('payment.refund');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.refund(this.records, id, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  settleSupplier(id, input, staffContext = {}) {
    assertCan('supplier.settle');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const next = M.settle(this.records, id, input, context);
    this.commit(next);
    return next.find(r => r.id === id);
  }

  depositSupplierCredit(input, staffContext = {}) {
    assertCan('supplier.topup');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    if (input.currency !== 'USD') throw new Error('حساب المورّد وشحن رصيده بالدولار فقط.');
    const nextLedger = C.deposit(this.records, this.ledger, input, context);
    this.commit({ records: this.records, ledger: nextLedger });
  }

  issueWithSupplierCredit(bookingId, billing, staffContext = {}) {
    assertCan('booking.issue');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const record = this.records.find(r => r.id === bookingId);
    if (record?.supplierNet && billing.currency !== 'USD') throw new Error('خصم المورّد لهذا الحجز بالدولار حسب صافي المورّد المحفوظ.');
    const result = C.issue(this.records, this.ledger, bookingId, record?.supplierNet ? { ...billing, confirmCurrency: true } : billing, context);
    this.commit(result);
  }

  restoreSupplierCredit(bookingId, input, staffContext = {}) {
    assertCan('supplier.return');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const result = C.restore(this.records, this.ledger, bookingId, input, context);
    this.commit(result);
  }

  addSupplierStatementDemo(providerId, staffContext = {}) {
    assertCan('supplier.demo');
    this.ensure();
    const context = { ...this.getContext(), ...staffContext };
    const result = C.demo(this.records, this.ledger, providerId, context);
    this.commit(result);
  }

  filter(filters) {
    this.ensure();
    return M.filter(this.records, filters);
  }

  report(filters) {
    this.ensure();
    return M.report(this.records, filters);
  }

  csv(rows) {
    return M.csv(rows);
  }
}

export const operationsStorage = new OperationsStorage();
export default operationsStorage;

