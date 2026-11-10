import { assignmentUsers, subscribeAccounts } from '../../accounts/repository';
import { assertCan, actor, appRoleOf } from '../../auth/access';
import { staffModel as M } from '../models';

const STORAGE = 'YAR_ADMIN_STAFF_V1';
const clone = value => JSON.parse(JSON.stringify(value));

class StaffStorage {
  constructor() {
    this.staff = [];
    this.logs = [];
    this.notice = '';
    this.listeners = new Set();
    this.init();
    subscribeAccounts(() => this.notify());
  }

  init() {
    let data = M.payload(M.seed, []);
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw !== null) {
        data = M.restore(JSON.parse(raw));
      }
    } catch {
      this.notice = 'تعذر استعادة الموظفين المحفوظين. تُعرض قائمة الموظفين الأساسية للمعاينة.';
    }
    this.staff = data.staff;
    this.logs = data.logs;
  }

  persist(data) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
      this.staff = clone(data.staff);
      this.logs = clone(data.logs);
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

  getStaff() {
    const accounts = assignmentUsers();
    return clone(this.staff.filter(s => !accounts.some(a => a.id === s.id)).map(s => ({...s,status:'inactive'})).concat(accounts));
  }

  getLogs() {
    return clone(this.logs);
  }

  /** Prevent removing/disabling the last active administrator. */
  guardLastAdmin(nextStaff) {
    if (!nextStaff.some(s => s.status === 'active' && appRoleOf(s) === 'admin')) {
      throw new Error('لا يمكن إيقاف أو تغيير دور آخر مدير نظام نشط.');
    }
  }

  upsert(candidate, by = actor().staffName || 'أحمد الهمداني') {
    assertCan('staff.manage');
    const preview = this.staff.filter(s => s.id !== candidate.id).concat([{ ...candidate, status: candidate.status || 'active' }]);
    this.guardLastAdmin(preview);
    const next = M.upsert(this.staff, this.logs, candidate, by);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية للمتصفح.');
    return next.staff.find(s => s.id === (candidate.id || next.staff[0].id));
  }

  setStatus(id, status, by = actor().staffName || 'أحمد الهمداني') {
    assertCan('staff.manage');
    this.guardLastAdmin(this.staff.map(s => (s.id === id ? { ...s, status } : s)));
    const next = M.setStatus(this.staff, this.logs, id, status, by);
    if (!this.persist(next)) throw new Error('تعذر الحفظ في مساحة التخزين المحلية للمتصفح.');
    return next.staff.find(s => s.id === id);
  }
}

export const staffStorage = new StaffStorage();
export default staffStorage;

