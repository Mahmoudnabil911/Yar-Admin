import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface SupplierBalanceItem {
  id: number | string;
  name: string;
  code?: string;
  balance_usd?: number;
  currency?: string;
  service_type?: string;
  active?: boolean;
  deposits?: number;
  issued?: number;
  returned?: number;
  email?: string;
  phone?: string;
  integration?: string;
  channel?: string;
  operating_enabled?: boolean;
  priority?: number | string;
  coverage_cities?: string;
  capabilities?: string[] | string;
  connection_state?: string;
  environment?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface SupplierLedgerItem {
  id: number | string;
  type?: 'deposit' | 'issue' | 'return' | string;
  amount_usd?: number;
  balance_after_usd?: number;
  reference?: string;
  booking_id?: number | null;
  created_at?: string;
  created_at_utc?: string;
  note?: string;
  staff_name?: string;
  [key: string]: unknown;
}

export interface SupplierLedgerResponse {
  supplier_id?: number | string | Record<string, unknown> | null;
  balance_usd?: number;
  currency?: string;
  items?: SupplierLedgerItem[];
  [key: string]: unknown;
}

export interface TopUpPayload {
  amount_usd: number;
  reference: string;
}

export interface TopUpResponse {
  ledger_id?: number;
  balance_usd?: number;
  [key: string]: unknown;
}

export interface ReturnPayload {
  booking_id: number;
  amount_usd: number;
  reference: string;
}

export interface ReturnResponse {
  id?: number;
  balance_usd?: number;
  [key: string]: unknown;
}

export interface CreateSupplierPayload {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  active?: boolean;
  service_type?: 'flight' | 'hotel' | 'car' | 'tour' | 'package' | string;
  integration?: 'manual' | 'api' | string;
  channel?: 'manual' | 'gds' | 'ndc' | 'other' | string;
  operating_enabled?: boolean;
  priority?: number | string;
  coverage_cities?: string;
  capabilities?: string[] | string;
  connection_state?: string;
  environment?: 'test' | 'production' | string;
  notes?: string;
}

async function request<T>(path: string, init?: RequestInit, fallbackMsg = 'تعذر تنفيذ العملية.'): Promise<T> {
  const response = await fetchWithAuth(`${getApiBaseUrl()}${path}`, init);
  if (!response.ok && (response.status === 502 || response.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', response.status);
  }
  let envelope: any;
  try {
    envelope = await response.json();
  } catch {
    throw new ApiAuthError('تعذر معالجة استجابة الخادم.', 'Could not parse server response.', 'invalid_response', response.status);
  }
  if (!response.ok || !envelope?.success) {
    throw new ApiAuthError(
      envelope?.message?.ar || fallbackMsg,
      envelope?.message?.en || fallbackMsg,
      envelope?.error?.code || `http_${response.status}`,
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

export const suppliersApi = {
  /**
   * API 065 | Read supplier balances in USD | أرصدة الموردين بالدولار
   * GET /api/v1/suppliers
   */
  async getSuppliers(): Promise<{ items: SupplierBalanceItem[] }> {
    const data = await request<{ items?: SupplierBalanceItem[] }>(
      '/api/v1/suppliers',
      undefined,
      'تعذر تحميل أرصدة الموردين من الخادم.'
    );
    return {
      items: Array.isArray(data?.items) ? data.items : [],
    };
  },

  /**
   * API 066 | Read supplier USD ledger | حركة رصيد المورد بالدولار
   * GET /api/v1/suppliers/{supplier_id}/ledger?limit=300
   */
  async getSupplierLedger(supplierId: number | string, limit = 300): Promise<SupplierLedgerResponse> {
    const lim = Math.min(300, Math.max(1, limit));
    const data = await request<SupplierLedgerResponse>(
      `/api/v1/suppliers/${encodeURIComponent(supplierId)}/ledger?limit=${lim}`,
      undefined,
      'تعذر تحميل كشف حركة رصيد المورد.'
    );
    return {
      ...data,
      items: Array.isArray(data?.items) ? data.items : [],
    };
  },

  /**
   * API 064 | Credit supplier USD balance | إضافة رصيد دولار للمورد
   * POST /api/v1/admin/suppliers/{supplier_id}/topup
   */
  async topUpSupplier(supplierId: number | string, payload: TopUpPayload): Promise<TopUpResponse> {
    return request<TopUpResponse>(
      `/api/v1/admin/suppliers/${encodeURIComponent(supplierId)}/topup`,
      json('POST', {
        amount_usd: Number(payload.amount_usd),
        reference: String(payload.reference || '').trim(),
      }),
      'تعذر شحن رصيد المورد.'
    );
  },

  /**
   * API 063 | Return previously issued supplier debit | إعادة مبلغ للمورد بعد الإلغاء
   * POST /api/v1/admin/suppliers/{supplier_id}/return
   */
  async returnSupplierDebit(supplierId: number | string, payload: ReturnPayload): Promise<ReturnResponse> {
    return request<ReturnResponse>(
      `/api/v1/admin/suppliers/${encodeURIComponent(supplierId)}/return`,
      json('POST', {
        booking_id: Number(payload.booking_id),
        amount_usd: Number(payload.amount_usd),
        reference: String(payload.reference || '').trim(),
      }),
      'تعذر إعادة المبلغ إلى رصيد المورد.'
    );
  },

  /**
   * API 067 | List suppliers admin | عرض الموردون
   * GET /api/v1/admin/suppliers
   */
  async listAdminSuppliers(): Promise<{ items: SupplierBalanceItem[] }> {
    const data = await request<{ items?: SupplierBalanceItem[] }>(
      '/api/v1/admin/suppliers',
      undefined,
      'تعذر تحميل قائمة الموردين من الخادم.'
    );
    return {
      items: Array.isArray(data?.items) ? data.items : [],
    };
  },

  /**
   * API 068 | Create supplier | إنشاء الموردون
   * POST /api/v1/admin/suppliers
   */
  async createSupplier(payload: CreateSupplierPayload): Promise<SupplierBalanceItem> {
    const body: Record<string, unknown> = {
      name: String(payload.name || '').trim(),
      active: payload.active ?? true,
      service_type: payload.service_type || 'flight',
      integration: payload.integration || 'manual',
      channel: payload.channel || 'manual',
      operating_enabled: payload.operating_enabled ?? true,
      priority: Number(payload.priority) || 1,
      environment: payload.environment || 'test',
      connection_state: payload.connection_state || 'unconfigured',
    };
    if (payload.code) body.code = String(payload.code).trim();
    if (payload.email) body.email = String(payload.email).trim();
    if (payload.phone) body.phone = String(payload.phone).trim();
    if (payload.coverage_cities) body.coverage_cities = String(payload.coverage_cities).trim();
    if (payload.capabilities) {
      body.capabilities = Array.isArray(payload.capabilities) ? payload.capabilities.join(',') : String(payload.capabilities);
    }
    if (payload.notes) body.notes = String(payload.notes).trim();

    return request<SupplierBalanceItem>(
      '/api/v1/admin/suppliers',
      json('POST', body),
      'تعذر إنشاء المورّد على الخادم.'
    );
  },

  /**
   * API 062 | Update supplier | تعديل الموردون
   * PATCH /api/v1/admin/suppliers/{record_id}
   */
  async updateSupplier(recordId: number | string, payload: Partial<CreateSupplierPayload>): Promise<SupplierBalanceItem> {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = String(payload.name).trim();
    if (payload.code !== undefined) body.code = String(payload.code).trim();
    if (payload.email !== undefined) body.email = String(payload.email).trim();
    if (payload.phone !== undefined) body.phone = String(payload.phone).trim();
    if (payload.active !== undefined) body.active = Boolean(payload.active);
    if (payload.service_type !== undefined) body.service_type = payload.service_type;
    if (payload.integration !== undefined) body.integration = payload.integration;
    if (payload.channel !== undefined) body.channel = payload.channel;
    if (payload.operating_enabled !== undefined) body.operating_enabled = Boolean(payload.operating_enabled);
    if (payload.priority !== undefined) body.priority = Number(payload.priority) || 1;
    if (payload.coverage_cities !== undefined) body.coverage_cities = String(payload.coverage_cities).trim();
    if (payload.capabilities !== undefined) {
      body.capabilities = Array.isArray(payload.capabilities) ? payload.capabilities.join(',') : String(payload.capabilities);
    }
    if (payload.connection_state !== undefined) body.connection_state = payload.connection_state;
    if (payload.environment !== undefined) body.environment = payload.environment;
    if (payload.notes !== undefined) body.notes = String(payload.notes).trim();

    return request<SupplierBalanceItem>(
      `/api/v1/admin/suppliers/${encodeURIComponent(recordId)}`,
      json('PATCH', body),
      'تعذر تعديل بيانات المورّد على الخادم.'
    );
  },
};
