/**
 * YAR Odoo 18 Reports & Overview API client
 * API 113 | Booking aggregates by state/service | تحليلات الحجوزات
 * API 114 | Dashboard booking summary | ملخص الحجوزات للوحة الإدارة
 */

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface DashboardSummaryData {
  booking_count: number;
  pending_count: number;
  issued_count: number;
  sales_total_iqd: number;
  supplier_cost_total_usd: number;
}

export interface BookingsReportData {
  count: number;
  by_state: {
    pending?: number;
    processing?: number;
    confirmed?: number;
    issued?: number;
    cancelled?: number;
    [key: string]: number | undefined;
  };
  by_service: {
    flight?: number;
    hotel?: number;
    package?: number;
    car?: number;
    transfer?: number;
    tour?: number;
    [key: string]: number | undefined;
  };
  sales_iqd: number;
  supplier_cost_usd: number;
  collected_iqd: number;
}

export interface DashboardSummaryResponse {
  success: boolean;
  data: DashboardSummaryData;
  message: {
    ar: string;
    en: string;
  };
  error: { code: string } | null;
  time_zone?: string;
}

async function handleReportsResponse<T>(res: Response): Promise<T> {
  if (!res.ok && (res.status === 502 || res.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', res.status);
  }
  const json = await res.json();
  if (!json.success) {
    const code = json.error?.code || `http_${res.status}`;
    const ar = json.message?.ar || 'حدث خطأ في جلب تقرير الحجوزات.';
    const en = json.message?.en || 'Failed to fetch dashboard booking summary.';
    throw new ApiAuthError(ar, en, code, res.status);
  }
  return json.data as T;
}

let overviewPromise: Promise<DashboardSummaryData> | null = null;
let cachedOverview: DashboardSummaryData | null = null;
let lastOverviewTime = 0;

let bookingsReportPromise: Promise<BookingsReportData> | null = null;
let cachedBookingsReport: BookingsReportData | null = null;
let lastBookingsReportTime = 0;

export const reportsApi = {
  /**
   * API 114 | Dashboard booking summary | ملخص الحجوزات للوحة الإدارة
   * GET /api/v1/reports/overview
   */
  async getDashboardSummary(force = false): Promise<DashboardSummaryData> {
    if (!force && cachedOverview && (Date.now() - lastOverviewTime < 10000)) {
      return cachedOverview;
    }

    if (!force && overviewPromise) {
      return overviewPromise;
    }

    overviewPromise = (async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/reports/overview`, {
        method: 'GET',
      });
      const data = await handleReportsResponse<DashboardSummaryData>(res);
      cachedOverview = data;
      lastOverviewTime = Date.now();
      return data;
    })().finally(() => {
      overviewPromise = null;
    });

    return overviewPromise;
  },

  /**
   * API 113 | Booking aggregates by state/service | تحليلات الحجوزات
   * GET /api/v1/reports/bookings
   */
  async getBookingsReport(force = false): Promise<BookingsReportData> {
    if (!force && cachedBookingsReport && (Date.now() - lastBookingsReportTime < 10000)) {
      return cachedBookingsReport;
    }

    if (!force && bookingsReportPromise) {
      return bookingsReportPromise;
    }

    bookingsReportPromise = (async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/reports/bookings`, {
        method: 'GET',
      });
      const data = await handleReportsResponse<BookingsReportData>(res);
      cachedBookingsReport = data;
      lastBookingsReportTime = Date.now();
      return data;
    })().finally(() => {
      bookingsReportPromise = null;
    });

    return bookingsReportPromise;
  },
};
