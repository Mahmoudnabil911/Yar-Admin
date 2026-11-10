import { beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error -- plain JS module
import { PAGE_ACCESS, roleCan, appRoleOf, auth, canSeePage } from "@/yar/auth/access.js";
// @ts-expect-error -- plain JS module
import { resolvePage } from "@/yar/app/App.jsx";

const employee = { id: "staff-noor", name: "نور", role: "bookings", status: "active", permissions: ["bookings"] };
const admin = { id: "staff-ahmed", name: "أحمد", role: "admin", status: "active", permissions: [] };

describe("role & page access", () => {
  it("booking employee sees exactly four operational pages", () => {
    expect([...PAGE_ACCESS.booking_employee].sort()).toEqual(["bookings", "inbox", "overview", "supplier-credit"]);
  });
  it("employee cannot open staff, reports, pricing or provider-ops", () => {
    for (const p of ["staff", "reports", "pricing", "provider-ops", "content", "hotels"]) {
      expect(canSeePage(p, "booking_employee")).toBe(false);
      expect(canSeePage(p, "admin")).toBe(true);
    }
  });
  it("gateways page is not available to anyone", () => {
    expect(canSeePage("gateways", "admin")).toBe(false);
  });
  it("employee may issue, collect and review receipts", () => {
    for (const a of ["booking.issue", "booking.cancel", "payment.collect", "payment.review", "booking.export", "supplier.view", "inquiry.view", "inquiry.note", "inquiry.status", "inquiry.assign", "inquiry.read", "inquiry.followup"]) {
      expect(roleCan("booking_employee", a)).toBe(true);
    }
  });
  it("employee may not refund, top up or return supplier credit", () => {
    for (const a of ["payment.refund", "supplier.topup", "supplier.return", "staff.manage", "overview.management_kpis", "inquiry.sensitive"]) {
      expect(roleCan("booking_employee", a)).toBe(false);
      expect(roleCan("admin", a)).toBe(true);
    }
  });
  it("legacy roles map safely; ambiguous ones need review", () => {
    expect(appRoleOf({ role: "owner" })).toBe("admin");
    expect(appRoleOf({ role: "bookings" })).toBe("booking_employee");
    expect(appRoleOf({ role: "accounting" })).toBeNull();
    expect(appRoleOf({ role: "support" })).toBeNull();
  });
  it("legacy ?page=payments and ?page=gateways redirect to bookings", () => {
    expect(resolvePage("payments", "/")).toBe("bookings");
    expect(resolvePage("gateways", "/")).toBe("bookings");
    expect(resolvePage(null, "/hotels")).toBe("hotels");
  });
});

describe("service-layer enforcement", () => {
  beforeEach(() => { localStorage.clear(); auth.signOut(); });

  it("blocks manual supplier top-up, credit return and refund for employees", async () => {
    // @ts-expect-error -- plain JS module
    const { operationsStorage } = await import("@/yar/services/storage/operationsStorage.js");
    const { hashPassword, ACCOUNT_KEY } = await import('@/yar/accounts/repository.js');
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({version:2, users:[{...employee,role:'booking_employee',phoneE164:'+9647701234567',sessionVersion:0,credential:await hashPassword('ValidPassword12')}],requests:[],notifications:[],audit:[],throttle:{}}));
    await auth.signIn('07701234567', 'ValidPassword12');
    expect(() => operationsStorage.depositSupplierCredit({ providerId: "x", currency: "USD", amount: 10, reference: "R" })).toThrow(/مدير النظام/);
    expect(() => operationsStorage.restoreSupplierCredit("b1", {})).toThrow(/مدير النظام/);
    expect(() => operationsStorage.recordRefund("b1", {})).toThrow(/مدير النظام/);
  });

  it("refuses to disable the last active admin", async () => {
    // @ts-expect-error -- plain JS module
    const { staffStorage } = await import("@/yar/services/storage/staffStorage.js");
    const { hashPassword, ACCOUNT_KEY } = await import('@/yar/accounts/repository.js');
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({version:2, users:[{...admin,phoneE164:'+9647831400500',sessionVersion:0,credential:await hashPassword('ValidPassword12')}],requests:[],notifications:[],audit:[],throttle:{}}));
    await auth.signIn('07831400500', 'ValidPassword12');
    staffStorage.staff = [{ ...admin, permissions: ["bookings", "staff"] }, employee];
    expect(() => staffStorage.setStatus("staff-ahmed", "inactive")).toThrow(/آخر مدير/);
    expect(() => staffStorage.upsert({ ...admin, role: "bookings" })).toThrow(/آخر مدير/);
  });
});
