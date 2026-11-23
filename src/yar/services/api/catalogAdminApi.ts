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

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

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

interface CachedItem<T> {
  data: T;
  time: number;
}
const catalogCache = new Map<string, CachedItem<unknown>>();
const catalogInFlight = new Map<string, Promise<unknown>>();

export function invalidateCatalogCache(): void {
  catalogCache.clear();
  catalogInFlight.clear();
}

async function fetchCatalogWithDeduplication<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs = 10000,
  force = false
): Promise<T> {
  if (!force) {
    const cached = catalogCache.get(cacheKey) as CachedItem<T> | undefined;
    if (cached && Date.now() - cached.time < ttlMs) {
      return cached.data;
    }
    const inFlight = catalogInFlight.get(cacheKey) as Promise<T> | undefined;
    if (inFlight) {
      return inFlight;
    }
  }

  const promise = fetcher().then((data) => {
    catalogCache.set(cacheKey, { data, time: Date.now() });
    return data;
  }).finally(() => {
    catalogInFlight.delete(cacheKey);
  });

  catalogInFlight.set(cacheKey, promise);
  return promise;
}

export const catalogAdminApi = {
  /**
   * API 069 | عرض الفنادق
   */
  async getHotels(force = false): Promise<{ items: AdminHotelItem[] }> {
    return fetchCatalogWithDeduplication('hotels', async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/hotels`, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminHotelItem[] }>(res, 'فشل جلب قائمة الفنادق.');
    }, 10000, force);
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
    invalidateCatalogCache();
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

    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/hotels`, {
      method: 'POST',
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
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/hotels/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل بيانات الفندق على الخادم.');
  },

  /**
   * API 072 | عرض غرف الفنادق | GET /api/v1/admin/rooms
   */
  async getRooms(params?: { hotel_id?: number }, force = false): Promise<{ items: AdminRoomItem[] }> {
    const cacheKey = `rooms_${params?.hotel_id || 'all'}`;
    return fetchCatalogWithDeduplication(cacheKey, async () => {
      const baseUrl = getApiBaseUrl();
      let url = `${baseUrl}/api/v1/admin/rooms`;
      if (params?.hotel_id) {
        url += `?hotel_id=${encodeURIComponent(String(params.hotel_id))}`;
      }
      const res = await fetchWithAuth(url, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminRoomItem[] }>(res, 'فشل جلب الغرف.');
    }, 10000, force);
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
    invalidateCatalogCache();
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

    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/rooms`, {
      method: 'POST',
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
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/rooms/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل بيانات الغرفة على الخادم.');
  },

  /**
   * API 075 | عرض أسعار وتوافر الغرف | GET /api/v1/admin/room-rates
   */
  async getRoomRates(params?: { room_id?: number }, force = false): Promise<{ items: AdminRoomRateItem[] }> {
    const cacheKey = `rates_${params?.room_id || 'all'}`;
    return fetchCatalogWithDeduplication(cacheKey, async () => {
      const baseUrl = getApiBaseUrl();
      let url = `${baseUrl}/api/v1/admin/room-rates`;
      if (params?.room_id) {
        url += `?room_id=${encodeURIComponent(String(params.room_id))}`;
      }
      const res = await fetchWithAuth(url, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminRoomRateItem[] }>(res, 'فشل جلب أسعار الغرف.');
    }, 10000, force);
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
    invalidateCatalogCache();
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

    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/room-rates`, {
      method: 'POST',
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
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/room-rates/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل سعر الغرفة على الخادم.');
  },

  /**
   * API 078 | عرض الباقات والنقل والجولات والسيارات
   */
  async getServices(force = false): Promise<{ items: AdminServiceItem[] }> {
    return fetchCatalogWithDeduplication('services', async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/services`, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminServiceItem[] }>(res, 'فشل جلب قائمة الخدمات.');
    }, 10000, force);
  },

  /**
   * API 079 | إنشاء خدمة جديدة
   */
  async createService(payload: {
    name: string;
    service_type: 'package' | 'tour' | 'transfer' | 'car' | string;
    description?: string;
    city?: string;
    pickup_location?: string;
    dropoff_location?: string;
    duration_minutes?: number;
    capacity?: number;
    price_usd: number;
    supplier_cost_usd?: number;
    supplier_id?: number;
    published?: boolean;
    active?: boolean;
  }): Promise<AdminServiceItem> {
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/services`, {
      method: 'POST',
      body: JSON.stringify({
        active: true,
        published: true,
        ...payload,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء الخدمة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { active: true, published: true, ...payload, id };
  },

  /**
   * API 080 | تعديل الباقات والنقل والجولات والسيارات | PATCH /api/v1/admin/services/{record_id}
   */
  async updateService(recordId: number, payload: Partial<AdminServiceItem>): Promise<{ id: number }> {
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/services/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل بيانات الخدمة على الخادم.');
  },

  /**
   * API 081 | عرض خيارات الخدمات
   */
  async getServiceOptions(force = false): Promise<{ items: AdminServiceOptionItem[] }> {
    return fetchCatalogWithDeduplication('service_options', async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/service-options`, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminServiceOptionItem[] }>(res, 'فشل جلب خيارات الخدمات.');
    }, 10000, force);
  },

  /**
   * API 082 | إنشاء خيارات الخدمات | POST /api/v1/admin/service-options
   */
  async createServiceOption(payload: {
    service_id: number;
    name: string;
    price_usd: number;
    supplier_cost_usd?: number;
    capacity?: number;
    nights?: number;
    hotel_id?: number;
    position?: number;
    active?: boolean;
  }): Promise<AdminServiceOptionItem> {
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/service-options`, {
      method: 'POST',
      body: JSON.stringify({
        active: true,
        ...payload,
      }),
    });
    const data = await handleResponse<{ id: number } | number>(res, 'فشل إنشاء خيار الخدمة على الخادم.');
    const id = typeof data === 'object' && data !== null && 'id' in data ? data.id : (data as number);
    return { active: true, ...payload, id };
  },

  /**
   * API 083 | تعديل خيارات الخدمات | PATCH /api/v1/admin/service-options/{record_id}
   */
  async updateServiceOption(recordId: number, payload: Partial<AdminServiceOptionItem>): Promise<{ id: number }> {
    invalidateCatalogCache();
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/service-options/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return await handleResponse<{ id: number }>(res, 'فشل تعديل خيار الخدمة على الخادم.');
  },

  /**
   * API 092 | عرض حسابات النظام والعملاء
   */
  async getUsers(force = false): Promise<{ items: AdminUserItem[] }> {
    return fetchCatalogWithDeduplication('users', async () => {
      const baseUrl = getApiBaseUrl();
      const res = await fetchWithAuth(`${baseUrl}/api/v1/admin/users`, {
        method: 'GET',
      });
      return await handleResponse<{ items: AdminUserItem[] }>(res, 'فشل جلب قائمة العملاء والمستخدمين.');
    }, 10000, force);
  },
};
