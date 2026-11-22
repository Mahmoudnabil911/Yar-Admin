/**
 * YAR Odoo 18 Reports & Overview API client
 * API 114 | Dashboard booking summary | ملخص الحجوزات للوحة الإدارة
 * Endpoint: GET /api/v1/reports/overview
 */

import { getApiBaseUrl, getAccessToken, ApiAuthError } from './authApi';

export interface DashboardSummaryData {
  booking_count: number;
  pending_count: number;
  issued_count: number;
  sales_total_iqd: number;
  supplier_cost_total_usd: number;
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

export const reportsApi = {
  /**
   * API 114 | Dashboard booking summary | ملخص الحجوزات للوحة الإدارة
   * GET /api/v1/reports/overview
   */
  async getDashboardSummary(): Promise<DashboardSummaryData> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/v1/reports/overview`, {
      method: 'GET',
      headers,
    });
    return await handleReportsResponse<DashboardSummaryData>(res);
  },
};

