/**
 * YAR Odoo 18 Bookings API client
 * Endpoints:
 * - GET   /api/v1/bookings                  (API 038 | List bookings by role)
 * - POST  /api/v1/bookings                  (API 039 | Create idempotent priced booking)
 * - GET   /api/v1/bookings/:id              (API 040 | Read booking details)
 * - POST  /api/v1/bookings/:id/cancel       (API 041 | Cancel eligible unissued booking)
 * - PATCH /api/v1/bookings/:id/assign       (API 042 | Assign booking to staff)
 */

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

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
  id: number | string;
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
}

interface CachedBookings {
  data: ListBookingsData;
  time: number;
}

const bookingsCache = new Map<string, CachedBookings>();
const inFlightRequests = new Map<string, Promise<ListBookingsData>>();

export function invalidateBookingsCache(): void {
  bookingsCache.clear();
  inFlightRequests.clear();
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
      customer: record.customer_name || '',
      phone: record.customer_phone || '',
      service: record.service_type || 'hotel',
      route: '',
      detail: '',
      date: record.created_at ? record.created_at.slice(0, 10) : '',
      amount: record.total_iqd || 0,
      currency: 'IQD',
      status,
      payment: isPaid ? 'paid' : 'pending',
      assigned: record.assigned_to ? `#${record.assigned_to}` : '',
      assignedId: record.assigned_to ?? '',
      provider: record.supplier_id != null ? `#${record.supplier_id}` : '',
      pricing: {
        total: record.total_iqd || 0,
        currency: 'IQD',
        cost: record.supplier_cost_usd ?? null,
        paid: record.collected_iqd || 0,
        balance: record.due_iqd || 0,
      },
    };
  },

  /**
   * API 038 | List bookings by role | قائمة الحجوزات حسب الصلاحيات
   * GET /api/v1/bookings
   */
  async listBookings(params: ListBookingsParams = {}, force = false): Promise<ListBookingsData> {
    const baseUrl = getApiBaseUrl();
    const query = new URLSearchParams();
    if (params.limit != null) query.set('limit', String(params.limit));
    if (params.offset != null) query.set('offset', String(params.offset));
    if (params.status) query.set('status', params.status);

    const queryString = query.toString();
    const cacheKey = queryString || '__default__';

    if (!force) {
      const cached = bookingsCache.get(cacheKey);
      if (cached && Date.now() - cached.time < 10000) {
        return cached.data;
      }
      const inFlight = inFlightRequests.get(cacheKey);
      if (inFlight) {
        return inFlight;
      }
    }

    const promise = (async () => {
      const url = `${baseUrl}/api/v1/bookings${queryString ? `?${queryString}` : ''}`;
      const res = await fetchWithAuth(url, {
        method: 'GET',
      });
      const data = await handleBookingResponse<ListBookingsData>(res);
      bookingsCache.set(cacheKey, { data, time: Date.now() });
      return data;
    })().finally(() => {
      inFlightRequests.delete(cacheKey);
    });

    inFlightRequests.set(cacheKey, promise);
    return promise;
  },

  /**
   * API 039 | Create idempotent priced booking | إنشاء حجز بسعر الخادم
   * POST /api/v1/bookings
   */
  async createBooking(payload: CreateBookingPayload): Promise<BookingRecord> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const requestKey = payload.request_key || generateRequestKey();

    const headers: Record<string, string> = {
      'Idempotency-Key': requestKey,
    };

    const body = {
      ...payload,
      request_key: requestKey,
    };

    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const created = await handleBookingResponse<BookingRecord>(res);
    // A list request may have completed while this POST was in flight and
    // repopulated the cache with a pre-create snapshot.
    invalidateBookingsCache();
    return created;
  },

  /**
   * API 040 | Read booking details | تفاصيل الحجز
   * GET /api/v1/bookings/:id
   */
  async getBooking(id: number | string): Promise<BookingRecord> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return await handleBookingResponse<BookingRecord>(res);
  },

  /** API 043 | Issue an eligible paid booking and create its voucher. */
  async issueBooking(id: number | string): Promise<BookingRecord> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/issue`, { method: 'POST' });
    const record = await handleBookingResponse<BookingRecord>(res);
    invalidateBookingsCache();
    return record;
  },

  /** API 044 | Read the server workflow history. */
  async getTimeline(id: number | string): Promise<unknown[]> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/timeline`);
    const data = await handleBookingResponse<{ items?: unknown[] }>(res);
    return Array.isArray(data?.items) ? data.items : [];
  },

  /** API 045 | Move a booking to a server supported staff workflow state. */
  async updateWorkflow(id: number | string, state: 'processing' | 'confirmed'): Promise<BookingRecord> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/workflow`, {
      method: 'PATCH', body: JSON.stringify({ state }),
    });
    const record = await handleBookingResponse<BookingRecord>(res);
    invalidateBookingsCache();
    return record;
  },

  /** API 046 | Read internal booking notes. */
  async getNotes(id: number | string): Promise<unknown[]> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/notes`);
    const data = await handleBookingResponse<{ items?: unknown[] }>(res);
    return Array.isArray(data?.items) ? data.items : [];
  },

  /** API 047 | Add an internal booking note. */
  async addNote(id: number | string, body: string): Promise<unknown> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/notes`, {
      method: 'POST', body: JSON.stringify({ body }),
    });
    const result = await handleBookingResponse<unknown>(res);
    invalidateBookingsCache();
    return result;
  },

  /** API 049 | Read the issued voucher. */
  async getVoucher(id: number | string): Promise<unknown> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/voucher`);
    return handleBookingResponse<unknown>(res);
  },

  /**
   * API 041 | Cancel eligible unissued booking | إلغاء حجز غير صادر
   * POST /api/v1/bookings/:id/cancel
   */
  async cancelBooking(id: number | string, reason = ''): Promise<BookingRecord> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    const record = await handleBookingResponse<BookingRecord>(res);
    invalidateBookingsCache();
    return record;
  },

  /**
   * API 042 | Assign booking to staff | تعيين الحجز لموظف
   * PATCH /api/v1/bookings/:id/assign
   */
  async assignBooking(id: number | string, staffUserId: number): Promise<BookingRecord> {
    invalidateBookingsCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/bookings/${encodeURIComponent(id)}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ staff_user_id: staffUserId }),
    });
    const record = await handleBookingResponse<BookingRecord>(res);
    invalidateBookingsCache();
    return record;
  },
};
