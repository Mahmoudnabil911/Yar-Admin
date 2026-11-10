import { describe, expect, it } from "vitest";
import { addRate, rateFor, latestRate, needsDailyUpdate, usdToIqd, iqdToUsd, normalizeRate } from "@/yar/services/fxRate";
// @ts-expect-error -- plain JS module
import { roleCan } from "@/yar/auth/access.js";

describe("daily USD → IQD exchange rate", () => {
  it("only the administrator can change the rate", () => {
    expect(roleCan("admin", "fx.manage")).toBe(true);
    expect(roleCan("booking_employee", "fx.manage")).toBe(false);
  });

  it("a day without a saved rate needs an update; saving one clears it", () => {
    const h = addRate([], { rate: 1310, date: "2026-11-09", setAt: "2026-11-09T06:00:00Z" });
    expect(needsDailyUpdate(h, "2026-11-10")).toBe(true);
    const next = addRate(h, { rate: 1320, date: "2026-11-10", setAt: "2026-11-10T06:00:00Z" });
    expect(needsDailyUpdate(next, "2026-11-10")).toBe(false);
    expect(rateFor(next, "2026-11-10")?.rate).toBe(1320);
  });

  it("yesterday's rate is never used as today's rate", () => {
    const h = addRate([], { rate: 1310, date: "2026-11-09" });
    expect(rateFor(h, "2026-11-10")).toBeNull();
    expect(latestRate(h)?.rate).toBe(1310);
  });

  it("the last update of the same day wins and earlier entries stay in history", () => {
    let h = addRate([], { rate: 1300, date: "2026-11-10", setAt: "2026-11-10T06:00:00Z" });
    h = addRate(h, { rate: 1315, date: "2026-11-10", setAt: "2026-11-10T09:00:00Z" });
    expect(h).toHaveLength(2);
    expect(rateFor(h, "2026-11-10")?.rate).toBe(1315);
  });

  it("supplier net in USD converts to whole dinars for the customer price", () => {
    expect(usdToIqd(100, 1310)).toBe(131000);
    expect(usdToIqd(12.35, 1310)).toBe(16179);
    expect(iqdToUsd(131000, 1310)).toBe(100);
  });

  it("rejects missing, fractional or unrealistic rates", () => {
    expect(() => normalizeRate("")).toThrow();
    expect(() => normalizeRate(1310.5)).toThrow();
    expect(() => normalizeRate(5)).toThrow();
    expect(normalizeRate("1,310")).toBe(1310);
  });
});
