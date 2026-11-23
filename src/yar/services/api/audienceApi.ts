import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface AudienceCustomer {
  id: number;
  name?: string;
  role?: string;
  phone?: string | false | null;
  active?: boolean;
  verified?: boolean;
  [key: string]: unknown;
}

export interface BehaviorReport {
  sample_size?: number | Record<string, unknown> | null;
  sample_limited?: boolean | number | string | Record<string, unknown> | null;
  event_counts?: Record<string, number | Record<string, unknown>> | null;
  top_sections?: Array<Record<string, unknown>> | Record<string, number> | null;
  synthetic_data?: boolean;
  [key: string]: unknown;
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok && (response.status === 502 || response.status === 504)) {
    throw new ApiAuthError(
      'الخادم غير متاح حالياً.',
      'Server unavailable.',
      'bad_gateway',
      response.status,
    );
  }
  let envelope: any;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiAuthError(
      'تعذر معالجة استجابة الخادم.',
      'Could not parse server response.',
      'invalid_response',
      response.status,
    );
  }
  if (!response.ok || !envelope?.success) {
    throw new ApiAuthError(
      envelope?.message?.ar || fallback,
      envelope?.message?.en || fallback,
      envelope?.error?.code || `http_${response.status}`,
      response.status,
    );
  }
  return envelope.data as T;
}

export const audienceApi = {
  async getAudience(limit = 300): Promise<{ items: AudienceCustomer[] }> {
    const query = new URLSearchParams({ limit: String(Math.min(300, Math.max(1, limit))) });
    return read(
      await fetchWithAuth(`${getApiBaseUrl()}/api/v1/admin/audience?${query.toString()}`),
      'تعذر جلب ملخص الجمهور.',
    );
  },
  async getBehaviorReport(): Promise<BehaviorReport> {
    return read(
      await fetchWithAuth(`${getApiBaseUrl()}/api/v1/admin/reports/behavior`),
      'تعذر جلب تقرير سلوك المستخدمين.',
    );
  },
  async updateUser(
    id: number,
    patch: { name?: string; active?: boolean },
  ): Promise<{ id: number; role?: string; active?: boolean }> {
    return read(
      await fetchWithAuth(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
      'تعذر تحديث بيانات المستخدم.',
    );
  },
};
