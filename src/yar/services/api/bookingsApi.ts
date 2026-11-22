/**
 * YAR Odoo 18 Bookings API client
 * Endpoints:
 * - GET   /api/v1/bookings                  (API 038 | List bookings by role)
 * - POST  /api/v1/bookings                  (API 039 | Create idempotent priced booking)
 * - GET   /api/v1/bookings/:id              (API 040 | Read booking details)
 * - POST  /api/v1/bookings/:id/cancel       (API 041 | Cancel eligible unissued booking)
 * - PATCH /api/v1/bookings/:id/assign       (API 042 | Assign booking to staff)
 */

import { getApiBaseUrl, getAccessToken, ApiAuthError } from './authApi';

export interface BookingCustomer {
  id?: number | string;
  name: string;
  phone?: string;
  email?: string;
}

export interface BookingPricing {
  total: number;
  currency: 'IQD' | 'USD';
  paid?: number;
  balance?: number;
  cost?: number;
  margin?: number;
}

export interface BookingRecord {
  id: number;
  reference: string;
  service_type: 'hotel' | 'package' | 'car' | 'transfer' | 'tour' | 'flight';
  state: 'pending' | 'processing' | 'confirmed' | 'issued' | 'cancelled';
  quantity?: number;
  adults?: number;
  children?: number;
  customer_id?: number;
  customer_name?: string;
  customer_phone?: string;
  service_id?: number | null;
  service_option_id?: number | null;
  hotel_rate_id?: number | null;
  total_iqd: number;
  currency: 'IQD';
  fx_rate_snapshot?: number;
  fx_date?: string;
  collected_iqd?: number;
  refunded_iqd?: number;
  due_iqd?: number;
  provider_reference?: string | null;
  ticket_reference?: string | null;
  supplier_id?: number | null;
  supplier_cost_usd?: number | null;
  supplier_currency?: 'USD';
  assigned_to?: number | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface BookingItem extends Partial<BookingRecord> {
  customer?: BookingCustomer | string;
  service?: 'flight' | 'hotel' | 'package' | 'car' | 'transfer' | 'tour';
  route?: string;
  status?: 'draft' | 'awaiting' | 'processing' | 'confirmed' | 'issued' | 'cancelled';
  payment_status?: 'unpaid' | 'partial' | 'paid' | 'refunded';
  pricing?: BookingPricing;
  amount?: number;
  date?: string;
  assigned?: string;
  provider?: string;
  rawId?: number;
}

export interface ListBookingsParams {
  limit?: number;
  offset?: number;
  status?: string;
  service?: string;
  customer?: string;
}

export interface ListBookingsData {
  items: BookingRecord[];
  total?: number;
}

export interface CreateBookingPayload {
  service_type: 'hotel' | 'package' | 'car' | 'transfer' | 'tour';
  service_id?: number;
  service_option_id?: number;
  hotel_rate_id?: number;
  checkin?: string;
  checkout?: string;
  quantity?: number;
  adults?: number;
  children?: number;
  departure_at?: string;
  return_at?: string;
  request_key?: string;
  customer_id?: number;
}

async function handleBookingResponse<T>(res: Response): Promise<T> {
  if (!res.ok && (res.status === 502 || res.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', res.status);
  }
  const json = await res.json();
  if (!json.success) {
    const code = json.error?.code || `http_${res.status}`;
    const ar = json.message?.ar || 'حدث خطأ في استرجاع الحجوزات.';
    const en = json.message?.en || 'Failed to process bookings request.';
    throw new ApiAuthError(ar, en, code, res.status);
  }
  return json.data as T;
}

function generateRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
}

export const bookingsApi = {
  /**
   * Helper: Map backend BookingRecord to dashboard format
   */
  mapRecordToRow(record: BookingRecord): BookingItem {
    const stateMap: Record<string, 'awaiting' | 'processing' | 'confirmed' | 'issued' | 'cancelled'> = {
      pending: 'awaiting',
      processing: 'processing',
      confirmed: 'confirmed',
      issued: 'issued',
      cancelled: 'cancelled',
    };

    const status = stateMap[record.state] || 'awaiting';
    const isPaid = (record.due_iqd === 0 && (record.total_iqd || 0) > 0) || (record.collected_iqd || 0) >= (record.total_iqd || 0);

    return {
      ...record,
      id: record.reference || `YAR-BK-${record.id}`,
      rawId: record.id,
      customer: record.customer_name || `عميل #${record.customer_id || record.id}`,
      phone: record.customer_phone || '07XX XXX XX99',
      service: record.service_type || 'hotel',
      route: record.service_type === 'hotel' ? 'حجز فندقي' : record.service_type,
      detail: record.quantity ? `${record.quantity} وحدة` : '',
      date: record.created_at ? record.created_at.slice(0, 10) : record.fx_date || new Date().toISOString().slice(0, 10),
      source: 'app',
      amount: record.total_iqd || 0,
      currency: 'IQD',
      status,
      payment: isPaid ? 'paid' : 'pending',
      assigned: record.assigned_to ? `موظف #${record.assigned_to}` : 'غير مسند',
      provider: record.provider_reference || 'مزوّد YAR',
      pricing: {
        total: record.total_iqd || 0,
        currency: 'IQD',
        cost: record.supplier_cost_usd || 0,
        paid: record.collected_iqd || 0,
        balance: record.due_iqd || 0,
      },
    };
  },

  /**
   * API 038 | List bookings by role | قائمة الحجوزات حسب الصلاحيات
   * GET /api/v1/bookings
   */
  async listBookings(params: ListBookingsParams = {}): Promise<ListBookingsData> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.status) query.set('status', params.status);
    if (params.service) query.set('service', params.service);

    const queryString = query.toString();
    const url = `${baseUrl}/api/v1/bookings${queryString ? `?${queryString}` : ''}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
    });
    return await handleBookingResponse<ListBookingsData>(res);
  },

  /**
   * API 039 | Create idempotent priced booking | إنشاء حجز بسعر الخادم
   * POST /api/v1/bookings
   */
  async createBooking(payload: CreateBookingPayload): Promise<BookingRecord> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const requestKey = payload.request_key || generateRequestKey();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Idempotency-Key': requestKey,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const body = {
      ...payload,
      request_key: requestKey,
    };

    const res = await fetch(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    return await handleBookingResponse<BookingRecord>(res);
  },

  /**
   * API 040 | Read booking details | تفاصيل الحجز
   * GET /api/v1/bookings/:id
   */
  async getBooking(id: number | string): Promise<BookingRecord> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
    });
    return await handleBookingResponse<BookingRecord>(res);
  },

  /**
   * API 041 | Cancel eligible unissued booking | إلغاء حجز غير صادر
   * POST /api/v1/bookings/:id/cancel
   */
  async cancelBooking(id: number | string, reason = ''): Promise<BookingRecord> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason }),
    });
    return await handleBookingResponse<BookingRecord>(res);
  },

  /**
   * API 042 | Assign booking to staff | تعيين الحجز لموظف
   * PATCH /api/v1/bookings/:id/assign
   */
  async assignBooking(id: number | string, staffUserId: number): Promise<BookingRecord> {
    const baseUrl = getApiBaseUrl();
    const token = getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ staff_user_id: staffUserId }),
    });
    return await handleBookingResponse<BookingRecord>(res);
  },
};
