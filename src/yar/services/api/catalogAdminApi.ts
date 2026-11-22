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
  city?: string | false;
  country?: string | false;
  address?: string | false;
  description?: string | false;
  stars?: number;
  facilities?: Record<string, unknown> | false;
  gallery?: Record<string, unknown> | false;
  check_in_time?: string | false;
  check_out_time?: string | false;
  cancellation_policy?: string | false;
  active?: boolean;
  published?: boolean;
  supplier_id?: number | false;
  [key: string]: unknown;
}

export interface AdminRoomItem {
  id: number;
  hotel_id: number;
  name: string;
  code?: string | false;
  description?: string | false;
  view_type?: string | false;
  beds?: string | false;
  occupancy?: number;
  units_total?: number;
  amenities?: Record<string, unknown> | false;
  gallery?: Record<string, unknown> | false;
  cancellation_policy?: string | false;
  active?: boolean;
  [key: string]: unknown;
}

export interface AdminRoomRateItem {
  id: number;
  room_id?: number;
  name?: string;
  date_from?: string | false;
  date_to?: string | false;
  meal_plan?: string | false;
  price_usd?: number;
  supplier_cost_usd?: number;
  refundability?: string | false;
  cancellation_policy?: string | false;
  min_stay_nights?: number | string | false;
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
   * API 070 | إنشاء الفنادق | POST /api/v1/admin/hotels
   */
  async createHotel(payload: {
    name: string;
    city?: string;
    country?: string;
    address?: string;
    description?: string;
    stars?: number;
    facilities?: Record<string, unknown>;
    gallery?: Record<string, unknown>;
    check_in_time?: string;
    check_out_time?: string;
    cancellation_policy?: string;
    published?: boolean;
    active?: boolean;
    supplier_id?: number;
  }): Promise<AdminHotelItem> {
    const baseUrl = getApiBaseUrl();
    const body: Record<string, unknown> = {
      name: payload.name,
      active: payload.active !== undefined ? payload.active : true,
      published: payload.published !== undefined ? payload.published : true,
    };
    if (payload.city) body.city = payload.city;
    if (payload.country) body.country = payload.country;
    if (payload.address) body.address = payload.address;
    if (payload.description) body.description = payload.description;
    if (payload.stars !== undefined) body.stars = payload.stars;
    if (payload.facilities) body.facilities = payload.facilities;
    if (payload.gallery) body.gallery = payload.gallery;
    if (payload.check_in_time) body.check_in_time = payload.check_in_time;
    if (payload.check_out_time) body.check_out_time = payload.check_out_time;
    if (payload.cancellation_policy) body.cancellation_policy = payload.cancellation_policy;
    if (payload.supplier_id) body.supplier_id = payload.supplier_id;

    const res = await fetch(`${baseUrl}/api/v1/admin/hotels`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الفندق على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id, active: body.active as boolean, published: body.published as boolean };
  },

  /**
   * API 071 | تعديل الفنادق | PATCH /api/v1/admin/hotels/{record_id}
   */
  async updateHotel(recordId: number, payload: Partial<AdminHotelItem>): Promise<{ id: number }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/hotels/${recordId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل بيانات الفندق على الخادم.');
  },

  /**
   * API 072 | عرض غرف الفنادق | GET /api/v1/admin/rooms
   */
  async getRooms(params?: { hotel_id?: number }): Promise<{ items: AdminRoomItem[] }> {
    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}/api/v1/admin/rooms`;
    if (params?.hotel_id) {
      url += `?hotel_id=${encodeURIComponent(String(params.hotel_id))}`;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminRoomItem[] }>(res, 'فشل جلب الغرف.');
  },

  /**
   * API 073 | إنشاء غرف الفنادق | POST /api/v1/admin/rooms
   */
  async createRoom(payload: {
    hotel_id: number;
    name: string;
    code?: string;
    description?: string;
    view_type?: string;
    beds?: string;
    occupancy?: number;
    units_total?: number;
    amenities?: Record<string, unknown>;
    gallery?: Record<string, unknown>;
    cancellation_policy?: string;
    active?: boolean;
  }): Promise<AdminRoomItem> {
    const baseUrl = getApiBaseUrl();
    const body: Record<string, unknown> = {
      hotel_id: payload.hotel_id,
      name: payload.name,
      units_total: payload.units_total || 10,
      occupancy: payload.occupancy || 2,
      active: payload.active !== undefined ? payload.active : true,
    };
    if (payload.code) body.code = payload.code;
    if (payload.description) body.description = payload.description;
    if (payload.view_type) body.view_type = payload.view_type;
    if (payload.beds) body.beds = payload.beds;
    if (payload.amenities) body.amenities = payload.amenities;
    if (payload.gallery) body.gallery = payload.gallery;
    if (payload.cancellation_policy) body.cancellation_policy = payload.cancellation_policy;

    const res = await fetch(`${baseUrl}/api/v1/admin/rooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الغرفة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id };
  },

  /**
   * API 074 | تعديل غرف الفنادق | PATCH /api/v1/admin/rooms/{record_id}
   */
  async updateRoom(recordId: number, payload: Partial<AdminRoomItem>): Promise<{ id: number }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/rooms/${recordId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل بيانات الغرفة على الخادم.');
  },

  /**
   * API 075 | عرض أسعار وتوافر الغرف | GET /api/v1/admin/room-rates
   */
  async getRoomRates(params?: { room_id?: number }): Promise<{ items: AdminRoomRateItem[] }> {
    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}/api/v1/admin/room-rates`;
    if (params?.room_id) {
      url += `?room_id=${encodeURIComponent(String(params.room_id))}`;
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ items: AdminRoomRateItem[] }>(res, 'فشل جلب أسعار الغرف.');
  },

  /**
   * API 076 | إنشاء أسعار وتوافر الغرف | POST /api/v1/admin/room-rates
   */
  async createRoomRate(payload: {
    room_id: number;
    name: string;
    date_from?: string;
    date_to?: string;
    meal_plan?: string;
    price_usd: number;
    supplier_cost_usd?: number;
    refundability?: string;
    cancellation_policy?: string;
    min_stay_nights?: number | string;
    active?: boolean;
  }): Promise<AdminRoomRateItem> {
    const baseUrl = getApiBaseUrl();
    const body: Record<string, unknown> = {
      room_id: payload.room_id,
      name: payload.name,
      price_usd: payload.price_usd,
      active: payload.active !== undefined ? payload.active : true,
    };
    if (payload.date_from) body.date_from = payload.date_from;
    if (payload.date_to) body.date_to = payload.date_to;
    if (payload.meal_plan) body.meal_plan = payload.meal_plan;
    if (payload.supplier_cost_usd !== undefined) body.supplier_cost_usd = payload.supplier_cost_usd;
    if (payload.refundability) body.refundability = payload.refundability;
    if (payload.cancellation_policy) body.cancellation_policy = payload.cancellation_policy;
    if (payload.min_stay_nights !== undefined) body.min_stay_nights = payload.min_stay_nights;

    const res = await fetch(`${baseUrl}/api/v1/admin/room-rates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء سعر الغرفة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { ...payload, id, active: body.active as boolean };
  },

  /**
   * API 077 | تعديل أسعار وتوافر الغرف | PATCH /api/v1/admin/room-rates/{record_id}
   */
  async updateRoomRate(recordId: number, payload: Partial<AdminRoomRateItem>): Promise<{ id: number }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/admin/room-rates/${recordId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل سعر الغرفة على الخادم.');
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
