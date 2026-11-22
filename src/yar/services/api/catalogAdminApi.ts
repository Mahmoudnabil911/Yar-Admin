/**
 * YAR Odoo 18 Admin Catalog & Users API client
 * Endpoints:
 * - GET  /api/v1/admin/hotels          (API 069 | عرض الفنادق)
 * - POST /api/v1/admin/hotels          (API 070 | إنشاء فندق)
 * - GET  /api/v1/admin/rooms           (API 072 | عرض الغرف)
 * - POST /api/v1/admin/rooms           (API 073 | إنشاء غرفة)
 * - GET  /api/v1/admin/room-rates      (API 075 | عرض أسعار وتوافر الغرف)
 * - POST /api/v1/admin/room-rates      (API 076 | إنشاء سعر وتوافر الغرفة)
 * - GET  /api/v1/admin/services        (API 078 | عرض الباقات والنقل والجولات والسيارات)
 * - POST /api/v1/admin/services        (API 079 | إنشاء خدمة جديدة)
 * - GET  /api/v1/admin/service-options (API 081 | عرض خيارات الخدمات)
 * - GET  /api/v1/admin/users           (API 092 | عرض حسابات النظام والعملاء)
 */

import { getApiBaseUrl, getAccessToken, ApiAuthError } from './authApi';

export interface AdminHotelItem {
  id: number;
  name: string;
  city?: string;
  country?: string;
  stars?: number;
  active?: boolean;
  published?: boolean;
  [key: string]: unknown;
}

export interface AdminRoomRateItem {
  id: number;
  room_id?: number;
  name?: string;
  meal_plan?: string;
  price_usd?: number;
  supplier_cost_usd?: number;
  active?: boolean;
  hotel_name?: string;
  [key: string]: unknown;
}

export interface AdminServiceItem {
  id: number;
  name: string;
  service_type: 'package' | 'tour' | 'transfer' | 'car' | string;
  city?: string;
  price_usd?: number;
  supplier_cost_usd?: number;
  active?: boolean;
  published?: boolean;
  [key: string]: unknown;
}

export interface AdminServiceOptionItem {
  id: number;
  service_id?: number;
  name: string;
  price_usd?: number;
  active?: boolean;
  [key: string]: unknown;
}

export interface AdminUserItem {
  id: number;
  name: string;
  role?: string;
  phone?: string;
  active?: boolean;
  verified?: boolean;
  [key: string]: unknown;
}

async function handleResponse<T>(res: Response, fallbackMsg: string): Promise<T> {
  if (!res.ok && (res.status === 502 || res.status === 504)) {
    throw new ApiAuthError('الخادم غير متاح حالياً.', 'Server unavailable.', 'bad_gateway', res.status);
  }
  const json = await res.json();
  if (!json.success) {
    const code = json.error?.code || `http_${res.status}`;
    const ar = json.message?.ar || fallbackMsg;
    const en = json.message?.en || fallbackMsg;
    throw new ApiAuthError(ar, en, code, res.status);
  }
  return json.data as T;
}

function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const catalogAdminApi = {
  /**
   * API 069 | عرض الفنادق
   */
  async getHotels(): Promise<{ items: AdminHotelItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/hotels`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminHotelItem[] }>(res, 'فشل جلب قائمة الفنادق.');
  },

  /**
   * API 070 | إنشاء فندق جديد
   */
  async createHotel(payload: { name: string; city?: string; country?: string; stars?: number }): Promise<AdminHotelItem> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/hotels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        active: true,
        published: true,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الفندق على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id, active: true, published: true };
  },

  /**
   * API 072 | عرض الغرف
   */
  async getRooms(): Promise<{ items: Array<{ id: number; hotel_id: number; name: string }> }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/rooms`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: Array<{ id: number; hotel_id: number; name: string }> }>(res, 'فشل جلب الغرف.');
  },

  /**
   * API 073 | إنشاء غرفة لفندق
   */
  async createRoom(payload: { hotel_id: number; name: string; units_total?: number; occupancy?: number }): Promise<{ id: number; hotel_id: number; name: string }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        units_total: payload.units_total || 10,
        occupancy: payload.occupancy || 2,
        active: true,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الغرفة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id };
  },

  /**
   * API 075 | عرض أسعار وتوافر الغرف
   */
  async getRoomRates(): Promise<{ items: AdminRoomRateItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/room-rates`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminRoomRateItem[] }>(res, 'فشل جلب أسعار الغرف.');
  },

  /**
   * API 076 | إنشاء باقة سعر للغرفة
   */
  async createRoomRate(payload: {
    room_id: number;
    name: string;
    meal_plan?: string;
    price_usd: number;
    supplier_cost_usd?: number;
  }): Promise<AdminRoomRateItem> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/room-rates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        active: true,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء سعر الغرفة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id, active: true };
  },

  /**
   * API 078 | عرض الباقات والنقل والجولات والسيارات
   */
  async getServices(): Promise<{ items: AdminServiceItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/services`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminServiceItem[] }>(res, 'فشل جلب قائمة الخدمات.');
  },

  /**
   * API 079 | إنشاء خدمة جديدة
   */
  async createService(payload: {
    name: string;
    service_type: 'package' | 'tour' | 'transfer' | 'car';
    city?: string;
    price_usd: number;
    supplier_cost_usd?: number;
  }): Promise<AdminServiceItem> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/services`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        ...payload,
        active: true,
        published: true,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الخدمة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id, active: true, published: true };
  },

  /**
   * API 081 | عرض خيارات الخدمات
   */
  async getServiceOptions(): Promise<{ items: AdminServiceOptionItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/service-options`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminServiceOptionItem[] }>(res, 'فشل جلب خيارات الخدمات.');
  },

  /**
   * API 092 | عرض حسابات النظام والعملاء
   */
  async getUsers(): Promise<{ items: AdminUserItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/users`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminUserItem[] }>(res, 'فشل جلب قائمة العملاء والمستخدمين.');
  },
};
