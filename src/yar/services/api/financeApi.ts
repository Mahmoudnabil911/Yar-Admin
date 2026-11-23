import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';
import { invalidateBookingsCache } from './bookingsApi';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}${path}`, init);
  if (!response.ok && (response.status === 502 || response.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', response.status);
  }
  const envelope = await response.json();
  if (!envelope.success) {
    throw new ApiAuthError(
      envelope.message?.ar || 'تعذر تنفيذ العملية المالية.',
      envelope.message?.en || 'Finance request failed.',
      envelope.error?.code || `http_${response.status}`,
      response.status,
    );
  }
  return envelope.data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const financeApi = {
  async listReceipts(bookingId: number | string) {
    const query = new URLSearchParams({ booking_id: String(bookingId), limit: '300' });
    const data = await request<{ items?: unknown[] }>(`/api/v1/finance/receipts?${query}`);
    return Array.isArray(data?.items) ? data.items : [];
  },
  async createReceipt(payload: { booking_id: number; amount_iqd: number; method: 'office' | 'bank'; payment_reference: string }) {
    invalidateBookingsCache();
    const result = await request('/api/v1/finance/receipts', json('POST', payload));
    invalidateBookingsCache();
    return result;
  },
  async reviewReceipt(id: number | string, payload: { approve: boolean; note?: string }) {
    invalidateBookingsCache();
    const result = await request(`/api/v1/finance/receipts/${encodeURIComponent(id)}/review`, json('POST', payload));
    invalidateBookingsCache();
    return result;
  },
  async listRefunds() {
    const data = await request<{ items?: unknown[] }>('/api/v1/finance/refunds?limit=300');
    return Array.isArray(data?.items) ? data.items : [];
  },
  async createRefund(payload: { booking_id: number; amount_iqd: number; reason: string }) {
    invalidateBookingsCache();
    const result = await request('/api/v1/finance/refunds', json('POST', payload));
    invalidateBookingsCache();
    return result;
  },
  async approveRefund(id: number | string, payment_reference: string) {
    invalidateBookingsCache();
    const result = await request(`/api/v1/finance/refunds/${encodeURIComponent(id)}/approve`, json('POST', { payment_reference }));
    invalidateBookingsCache();
    return result;
  },
};
