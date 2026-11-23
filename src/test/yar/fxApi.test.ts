import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fxApi } from '@/yar/services/api/fxApi';
import { reportsApi } from '@/yar/services/api/reportsApi';

describe('Live Odoo APIs: FX Rates and Overview Reports', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fxApi', () => {
    it('fetches historical daily FX rates (API 111)', async () => {
      const mockData = {
        items: [
          {
            id: 1,
            date: '2026-11-22',
            rate_iqd_per_usd: 95288.5911,
            set_by: 2,
            note: '',
          },
        ],
        today: '2026-11-22',
        today_available: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockData,
          message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
          error: null,
          time_zone: 'Asia/Baghdad',
        }),
      });

      const res = await fxApi.getRates();
      expect(res.today).toBe('2026-11-22');
      expect(res.today_available).toBe(true);
      expect(res.items[0].rate_iqd_per_usd).toBe(95288.5911);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/fx'),
        expect.any(Object)
      );
    });

    it('sets daily exchange rate (API 112)', async () => {
      const mockResponse = {
        date: '2026-11-22',
        rate_iqd_per_usd: 95288.5911,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockResponse,
          message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
          error: null,
          time_zone: 'Asia/Baghdad',
        }),
      });

      const res = await fxApi.setRate(95288.5911);
      expect(res.date).toBe('2026-11-22');
      expect(res.rate_iqd_per_usd).toBe(95288.5911);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/admin/fx'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ rate_iqd_per_usd: 95288.5911 }),
        })
      );
    });
  });

  describe('reportsApi', () => {
    it('fetches dashboard booking summary (API 114)', async () => {
      const mockSummary = {
        booking_count: 5,
        pending_count: 2,
        issued_count: 3,
        sales_total_iqd: 1500000,
        supplier_cost_total_usd: 950,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockSummary,
          message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
          error: null,
          time_zone: 'Asia/Baghdad',
        }),
      });

      const res = await reportsApi.getDashboardSummary();
      expect(res.booking_count).toBe(5);
      expect(res.sales_total_iqd).toBe(1500000);
      expect(res.supplier_cost_total_usd).toBe(950);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/overview'),
        expect.any(Object)
      );
    });

    it('fetches bookings report aggregates (API 113)', async () => {
      const mockReport = {
        count: 3,
        by_state: { confirmed: 1, cancelled: 2 },
        by_service: { hotel: 1, package: 1, tour: 1 },
        sales_iqd: 998580.0,
        supplier_cost_usd: 440.0,
        collected_iqd: 0.0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: mockReport,
          message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
          error: null,
          time_zone: 'Asia/Baghdad',
        }),
      });

      const res = await reportsApi.getBookingsReport(true);
      expect(res.count).toBe(3);
      expect(res.sales_iqd).toBe(998580.0);
      expect(res.by_service.hotel).toBe(1);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/bookings'),
        expect.any(Object)
      );
    });
  });
});

