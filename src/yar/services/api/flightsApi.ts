/**
 * YAR Odoo 18 Flight / PartoCRS API client
 * Endpoints:
 * - GET  /api/v1/flights/status              (API 127 | حالة ربط الطيران)
 * - GET  /api/v1/app/airports                (API 018 | بحث المطارات)
 * - POST /api/v1/flights/<op>                (APIs 128-150, 155 | عمليات الطيران)
 */

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface FlightStatusData {
  provider?: string;
  provider_version?: string;
  flights_configured: boolean;
  flight_search_enabled: boolean;
  flight_booking_enabled: boolean;
  flight_ticketing_enabled: boolean;
  cancellation_and_refunds_enabled: boolean;
  live_results: boolean;
  mock_results: boolean;
  environment: string;
  required_to_enable?: string[];
  supported_operations?: string[];
  [key: string]: unknown;
}

export interface AirportItem {
  id?: number;
  code: string;
  name?: string;
  city?: string;
  country?: string;
  [key: string]: unknown;
}

const OPERATION_PATH_MAP: Record<string, string> = {
  AirAveragePrice: '/api/v1/flights/AirAveragePrice',
  AirFareAnywhereSearch: '/api/v1/flights/AirFareAnywhereSearch',
  AirFareFamily: '/api/v1/flights/AirFareFamily',
  AirFareLookUp: '/api/v1/flights/AirFareLookUp',
  AirFareLookUpBulk: '/api/v1/flights/AirFareLookUpBulk',
  AirFareLookUpCalendar: '/api/v1/flights/AirFareLookUpCalendar',
  AirSplittedSearch: '/api/v1/flights/AirSplittedSearch',
  AirTravelRestriction: '/api/v1/flights/AirTravelRestriction',
  AirBaggages: '/api/v1/flights/baggage',
  AirLowFareSearch: '/api/v1/flights/search',
  AirRules: '/api/v1/flights/rules',
  AirRevalidate: '/api/v1/flights/revalidate',
  AirBook: '/api/v1/flights/book',
  AirBookingData: '/api/v1/flights/booking-data',
  AirCancel: '/api/v1/flights/cancel',
  AirRefund: '/api/v1/flights/refund',
  AirRefundDisplay: '/api/v1/flights/refund-display',
  AirOrderTicket: '/api/v1/flights/ticket',
  AirPayLaterDetail: '/api/v1/flights/AirPayLaterDetail',
  AirRefundOfflineRequest: '/api/v1/flights/AirRefundOfflineRequest',
  UpdateAirBookingData: '/api/v1/flights/UpdateAirBookingData',
};

async function parseEnvelope<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok && (res.status === 502 || res.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', res.status);
  }
  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new ApiAuthError('تعذر معالجة استجابة الخادم.', 'Invalid server response.', 'invalid_response', res.status);
  }
  if (!res.ok || !json?.success) {
    throw new ApiAuthError(
      json?.message?.ar || fallbackMsg,
      json?.message?.en || fallbackMsg,
      json?.error?.code || `http_${res.status}`,
      res.status
    );
  }
  return json.data as T;
}

export const flightsApi = {
  /**
   * API 127 | PartoCRS flight availability status | حالة ربط الطيران
   * GET /api/v1/flights/status
   */
  async getFlightStatus(): Promise<FlightStatusData> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/v1/flights/status`, {
      method: 'GET',
    });
    return parseEnvelope<FlightStatusData>(res, 'تعذر التحقق من حالة ربط الطيران.');
  },

  /**
   * API 018 | Airport lookup | بحث المطارات
   * GET /api/v1/app/airports
   */
  async searchAirports(q = '', limit = 50, offset = 0): Promise<{ items: AirportItem[]; results_are_flights?: boolean }> {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/v1/app/airports?${params.toString()}`, {
      method: 'GET',
    });
    const data = await parseEnvelope<{ items?: AirportItem[]; results_are_flights?: boolean }>(
      res,
      'تعذر جلب قائمة المطارات.'
    );
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      results_are_flights: data?.results_are_flights,
    };
  },

  /**
   * APIs 128-150 / 155 | Execute a PartoCRS flight operation on the backend
   */
  async callPartoOperation<T = any>(operation: string, payload: Record<string, unknown>): Promise<T> {
    const path = OPERATION_PATH_MAP[operation] || `/api/v1/flights/${encodeURIComponent(operation)}`;
    const res = await fetchWithAuth(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseEnvelope<T>(res, `تعذر تنفيذ عملية الطيران (${operation}).`);
  },
};

