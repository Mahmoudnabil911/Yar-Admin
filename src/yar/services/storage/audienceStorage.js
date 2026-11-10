import { audienceData as D, behaviorData as B } from '../models';

const STORAGE = 'YAR_ADMIN_AUDIENCE_STATUS_V1';

class AudienceStorage {
  constructor() {
    this.today = D.today();
    this.data = D.createDemo(this.today);
    this.behaviorDemo = B.createDemo(this.data, this.today);
    this.statuses = {};
    this.notice = '';
    this.listeners = new Set();
    this.init();
  }

  init() {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw !== null) {
        const saved = JSON.parse(raw);
        if (saved?.version === 1 && saved.statuses && typeof saved.statuses === 'object') {
          const userIds = new Set(this.data.users.map(u => u.id));
          for (const [id, status] of Object.entries(saved.statuses)) {
            if (userIds.has(id) && ['active', 'suspended'].includes(status)) {
              this.statuses[id] = status;
            }
          }
        }
      }
    } catch {
      this.notice = 'تعذر قراءة حالات المستخدمين المحلية. تُعرض حالات بيانات المثال الأساسية.';
    }
  }

  persist() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ version: 1, statuses: this.statuses }));
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

  setStatus(userId, status) {
    if (!['active', 'suspended'].includes(status)) return;
    this.statuses[userId] = status;
    this.persist();
  }

  getEffectiveStatus(user) {
    return this.statuses[user?.id] || user?.status || 'active';
  }

  getAllStatuses() {
    return { ...this.statuses };
  }

  getRawDemoData() {
    return this.data;
  }

  getBehaviorFixture() {
    if (!this.behaviorDemo) {
      this.behaviorDemo = B.createDemo(this.data, this.today);
    }
    return this.behaviorDemo;
  }

  getUsers(filters = {}) {
    return D.listUsers(this.data, { ...filters, statuses: this.statuses });
  }

  getUserDetail(userId) {
    const detail = D.userDetail(this.data, userId);
    if (detail?.user && this.statuses[userId]) {
      detail.user.status = this.statuses[userId];
    }
    return detail;
  }

  getAudienceReport(period) {
    return D.report(this.data, period);
  }

  getBehaviorReport(filters) {
    return B.report(this.getBehaviorFixture(), filters);
  }
}

export const audienceStorage = new AudienceStorage();
export default audienceStorage;
