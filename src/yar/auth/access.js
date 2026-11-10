import { currentAccount, subscribeAccounts, logout, login } from '../accounts/repository';
// Centralized role & permission model (mock / frontend-only authorization).
// NOT production security: there is no backend. Real enforcement must move server-side.

export const ROLES = { admin: 'admin', booking_employee: 'booking_employee' };

export const ALL_PAGES = [
  'overview', 'bookings', 'audience', 'supplier-credit', 'reports',
  'hotels', 'packages', 'cars', 'tours', 'providers', 'provider-ops',
  'pricing', 'content', 'staff', 'inbox',
];

export const PAGE_ACCESS = {
  admin: ALL_PAGES,
  booking_employee: ['overview', 'bookings', 'supplier-credit', 'inbox'],
};

// Operation-level permissions.
export const ACTIONS = {
  'inquiry.view': ['admin', 'booking_employee'],
  'inquiry.read': ['admin', 'booking_employee'],
  'inquiry.assign': ['admin', 'booking_employee'],
  'inquiry.status': ['admin', 'booking_employee'],
  'inquiry.note': ['admin', 'booking_employee'],
  'inquiry.followup': ['admin', 'booking_employee'],
  'inquiry.sensitive': ['admin'],
  'booking.view': ['admin', 'booking_employee'],
  'booking.create': ['admin', 'booking_employee'],
  'booking.edit': ['admin', 'booking_employee'],
  'booking.transition': ['admin', 'booking_employee'],
  'booking.assign': ['admin', 'booking_employee'],
  'booking.note': ['admin', 'booking_employee'],
  'booking.cancel': ['admin', 'booking_employee'],
  'booking.issue': ['admin', 'booking_employee'],
  'booking.export': ['admin', 'booking_employee'],
  'payment.collect': ['admin', 'booking_employee'],
  'payment.review': ['admin', 'booking_employee'],
  'payment.refund': ['admin'],
  'supplier.view': ['admin', 'booking_employee'],
  'supplier.export': ['admin', 'booking_employee'],
  'supplier.topup': ['admin'],
  'supplier.return': ['admin'],
  'supplier.settle': ['admin'],
  'supplier.demo': ['admin'],
  'overview.management_kpis': ['admin'],
  'staff.manage': ['admin'],
  'catalog.manage': ['admin'],
  'pricing.manage': ['admin'],
  'fx.manage': ['admin'],
  'content.manage': ['admin'],
  'data.transfer': ['admin'],
};

/** Map a stored staff record (with legacy roles) to an app role, or null when it needs admin review. */
export function appRoleOf(staff) {
  if (!staff) return null;
  if (staff.role === 'owner' || staff.role === 'admin') return 'admin';
  if (staff.role === 'bookings' || staff.role === 'booking_employee') return 'booking_employee';
  return null; // accounting / content / support → flagged for review, never auto-elevated
}

export const LEGACY_REVIEW_ROLES = ['accounting', 'content', 'support'];

const listeners = new Set();
let session = null;
function refresh() { const next = currentAccount(); if (JSON.stringify(next) === JSON.stringify(session)) return; session = next; listeners.forEach(l => l()); }
if (typeof window !== 'undefined') { refresh(); subscribeAccounts(refresh); window.addEventListener('focus', refresh); setInterval(refresh, 30000); }
export const auth = {
 get() { const next = currentAccount(); if (JSON.stringify(next) !== JSON.stringify(session)) session = next; return session; },
 subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
 async signIn(identifier, password) { await login(identifier, password); refresh(); return session; },
 signOut() { logout(); refresh(); },
};

export function roleCan(role, action) {
  return Boolean(role && (ACTIONS[action] || []).includes(role));
}
export function can(action) { return roleCan(auth.get()?.mustChangePassword ? null : session?.role, action); }
export function canSeePage(page, role = session?.role) {
  return Boolean(role && (PAGE_ACCESS[role] || []).includes(page));
}

export class PermissionError extends Error {
  constructor(action) {
    super(`غير مسموح: هذا الإجراء متاح لمدير النظام فقط. (${action})`);
    this.name = 'PermissionError';
    this.action = action;
  }
}

/** Service-layer guard: throws when the active session cannot perform an action. */
export function assertCan(action) {
  if (!can(action)) throw new PermissionError(action);
}

export function actor() {
  return session ? { staffId: session.staffId, staffName: session.name } : { staffId: '', staffName: '' };
}
