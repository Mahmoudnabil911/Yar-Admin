/**
 * YAR Odoo 18 Foreign Exchange (FX) Rate API client
 * Endpoints:
 * - GET  /api/v1/admin/fx (API 111 | Read historical daily FX rates)
 * - POST /api/v1/admin/fx (API 112 | Set daily USD to IQD exchange rate)
 */

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface FxRateItem {
  id: number;
  date: string;
  rate_iqd_per_usd: number;
  set_by: number;
  note: string;
}

export interface FxRatesData {
  items: FxRateItem[];
  today: string;
  today_available: boolean;
}

export interface FxRatesResponse {
  success: boolean;
  data: FxRatesData;
  message: {
    ar: string;
    en: string;
  };
  error: { code: string } | null;
  time_zone?: string;
}

export interface SetFxRatePayload {
  rate_iqd_per_usd: number;
}

export interface SetFxRateData {
  date: string;
  rate_iqd_per_usd: number;
}

export interface SetFxRateResponse {
  success: boolean;
  data: SetFxRateData;
  message: {
    ar: string;
    en: string;
  };
  error: { code: string } | null;
  time_zone?: string;
}

async function handleFxResponse<T>(res: Response): Promise<T> {
  if (!res.ok && (res.status === 502 || res.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', res.status);
  }
  const json = await res.json();
  if (!json.success) {
    const code = json.error?.code || `http_${res.status}`;
    const ar = json.message?.ar || 'حدث خطأ في معالجة سعر الصرف.';
    const en = json.message?.en || 'Failed to process FX rate request.';
    throw new ApiAuthError(ar, en, code, res.status);
  }
  return json.data as T;
}

export const fxApi = {
  /**
   * API 111 | Read historical daily FX rates | سجل أسعار الصرف اليومية
   * GET /api/v1/admin/fx
   */
  async getRates(): Promise<FxRatesData> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/fx`, {
      method: 'GET',
    });
    return await handleFxResponse<FxRatesData>(res);
  },

  /**
   * API 112 | Set daily USD to IQD exchange rate | تحديد سعر صرف اليوم
   * POST /api/v1/admin/fx
   */
  async setRate(rate_iqd_per_usd: number): Promise<SetFxRateData> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/fx`, {
      method: 'POST',
      body: JSON.stringify({ rate_iqd_per_usd }),
    });
    return await handleFxResponse<SetFxRateData>(res);
  },
};

