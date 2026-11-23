/**
 * YAR Odoo 18 Auth API client (OpenAPI 3.0.1 - yar_core v18.0.2.3.0)
 * Base URL: https://yar-odoo.samaalrosha.com
 */

export interface BilingualMessage {
  ar: string;
  en: string;
}

export interface ApiError {
  code: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: BilingualMessage;
  error: ApiError | null;
}

export interface YarUser {
  id: number | string;
  name: string;
  phone: string | false | null;
  role: 'admin' | 'booking_employee' | 'customer';
  verified: boolean;
  email?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: YarUser;
}

export interface LoginPayload {
  login?: string;
  phone?: string;
  password?: string;
}

export interface OtpRequestPayload {
  phone: string;
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface PasswordRequestPayload {
  phone: string;
}

export interface PasswordConfirmPayload {
  phone: string;
  code: string;
  new_password: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  password: string;
  email?: string;
}

export interface GenericDataResponse {
  [key: string]: unknown;
}

export class ApiAuthError extends Error {
  readonly code: string;
  readonly ar: string;
  readonly en: string;
  readonly status: number;

  constructor(ar: string, en: string, code = 'api_error', status = 400) {
    super(en || ar);
    this.name = 'ApiAuthError';
    this.code = code;
    this.ar = ar;
    this.en = en;
    this.status = status;
  }
}

export interface StoredAuthTokens extends AuthTokens {
  saved_at?: number;
  expires_at?: number;
}

export const TOKENS_KEY = 'YAR_AUTH_TOKENS_V1';

export function getStoredTokens(): StoredAuthTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  const expiresIn = typeof tokens.expires_in === 'number' && tokens.expires_in > 0 ? tokens.expires_in : 900;
  const enriched: StoredAuthTokens = {
    ...tokens,
    saved_at: Date.now(),
    // Mark token expired 60 seconds earlier than 900s to proactively refresh before server rejects it
    expires_at: Date.now() + Math.max(60, expiresIn - 60) * 1000,
  };
  localStorage.setItem(TOKENS_KEY, JSON.stringify(enriched));
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  cachedMeUser = null;
  lastMeTime = 0;
  mePromise = null;
  localStorage.removeItem(TOKENS_KEY);
}

export function getAccessToken(): string | null {
  return getStoredTokens()?.access_token || null;
}

export function getRefreshToken(): string | null {
  return getStoredTokens()?.refresh_token || null;
}

export function isAccessTokenExpired(): boolean {
  const stored = getStoredTokens();
  if (!stored || !stored.access_token) return true;
  if (stored.expires_at && Date.now() >= stored.expires_at) return true;
  return false;
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken() || getRefreshToken());
}

let refreshPromise: Promise<AuthTokens> | null = null;

/**
 * Concurrency-safe singleton token refresh.
 * Because Odoo implements single-use rotating refresh tokens (replay revokes session),
 * all concurrent 401 requests MUST share the same in-flight refresh promise!
 */
export async function requestTokenRefresh(overrideRefreshToken?: string): Promise<AuthTokens> {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = overrideRefreshToken || getRefreshToken();
  if (!refreshToken) {
    clearStoredTokens();
    throw new ApiAuthError('جلسة التجديد منتهية أو غير صالحة.', 'Refresh token missing.', 'no_refresh_token', 401);
  }

  refreshPromise = (async () => {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const nextTokens = await handleResponse<AuthTokens>(res);
      setStoredTokens(nextTokens);
      return nextTokens;
    } catch (err) {
      clearStoredTokens();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Universal authenticated fetch wrapper.
 * 1. Attaches Authorization: Bearer <token>.
 * 2. Proactively refreshes if token is expired or close to expiring (within 60s).
 * 3. Intercepts 401 responses, executes single-flight token rotation, and replays the request once.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getAccessToken();
  const refreshToken = getRefreshToken();

  // Proactive refresh if access token expired but we have a valid refresh token
  if ((!token || isAccessTokenExpired()) && refreshToken) {
    try {
      const refreshed = await requestTokenRefresh();
      token = refreshed.access_token;
    } catch {
      // Proactive refresh failed; proceed and let server respond
    }
  }

  const buildHeaders = (authToken: string | null): Record<string, string> => {
    const h: Record<string, string> = {};
    if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => { h[k] = v; });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => { h[k] = v; });
    } else if (options.headers && typeof options.headers === 'object') {
      Object.assign(h, options.headers);
    }

    if (authToken && !h['Authorization'] && !h['authorization']) {
      h['Authorization'] = `Bearer ${authToken}`;
    }
    if (!h['Content-Type'] && !h['content-type'] && !(options.body instanceof FormData)) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  };

  const method = (options.method || 'GET').toUpperCase();
  const canRetryRead = (method === 'GET' || method === 'HEAD') && !options.body;
  const send = (authToken: string | null) => fetch(url, {
    ...options,
    headers: buildHeaders(authToken),
  });
  let res: Response;
  let retriedRead = false;
  try {
    res = await send(token);
  } catch (err) {
    if (!canRetryRead) throw err;
    retriedRead = true;
    await new Promise(resolve => setTimeout(resolve, 700));
    res = await send(token);
  }

  // The local Vite proxy can receive a transient upstream socket hang-up.
  // Retry only idempotent reads; never replay booking writes or other mutations.
  if (canRetryRead && !retriedRead && (res.status === 502 || res.status === 504)) {
    await new Promise(resolve => setTimeout(resolve, 700));
    res = await send(token);
  }

  // If 401 Unauthorized, attempt rotation and retry once
  if (res.status === 401 && getRefreshToken()) {
    try {
      const refreshed = await requestTokenRefresh();
      res = await fetch(url, {
        ...options,
        headers: buildHeaders(refreshed.access_token),
      });
    } catch {
      // Refresh failed; return original 401 response
      return res;
    }
  }

  return res;
}

const DEFAULT_BASE_URL = 'https://yar-odoo.samaalrosha.com';

export function getApiBaseUrl(): string {
  // In Node/Vitest test environments, relative URLs cause undici fetch errors.
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return DEFAULT_BASE_URL;
  }
  if (typeof window === 'undefined') {
    return DEFAULT_BASE_URL;
  }
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: Record<string, string> }).env : undefined;
  const envVal = metaEnv?.VITE_API_BASE_URL;
  return envVal !== undefined ? envVal : DEFAULT_BASE_URL;
}

async function handleResponse<T>(res: Response): Promise<T> {
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await res.json();
  } catch {
    if (res.status === 502 || res.status === 504) {
      throw new ApiAuthError(
        'الخادم غير متاح حالياً أو يواجه ضغطاً، يرجى المحاولة بعد دقيقة.',
        'Server is temporarily busy or unavailable; please retry in a minute.',
        'bad_gateway',
        res.status
      );
    }
    if (res.status === 503) {
      throw new ApiAuthError(
        'الخدمة مشغولة حالياً، يرجى الانتظار قليلاً والمحاولة مجدداً.',
        'Service temporarily busy, please try again in a moment.',
        'service_unavailable',
        res.status
      );
    }
    throw new ApiAuthError(
      'تعذر معالجة استجابة الخادم.',
      'Server response could not be parsed.',
      'parse_error',
      res.status
    );
  }

  if (!envelope.success || envelope.error) {
    const code = envelope.error?.code || `http_${res.status}`;
    const ar = envelope.message?.ar || 'حدث خطأ أثناء معالجة الطلب.';
    const en = envelope.message?.en || 'An error occurred during the request.';
    throw new ApiAuthError(ar, en, code, res.status);
  }

  return envelope.data as T;
}

let mePromise: Promise<YarUser> | null = null;
let cachedMeUser: YarUser | null = null;
let lastMeTime = 0;

export const authApi = {
  /**
   * API 004 | JWT login for admin, employee or customer | تسجيل الدخول وإصدار JWT
   * POST /api/v1/auth/login
   */
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const tokens = await handleResponse<AuthTokens>(res);
    setStoredTokens(tokens);
    return tokens;
  },

  /**
   * API 012 | Read authenticated user role | بيانات المستخدم الحالي
   * GET /api/v1/auth/me
   */
  async getMe(overrideToken?: string, force = false): Promise<YarUser> {
    if (!overrideToken && !force && cachedMeUser && (Date.now() - lastMeTime < 30000)) {
      return cachedMeUser;
    }

    if (!overrideToken && mePromise) {
      return mePromise;
    }

    const run = async (): Promise<YarUser> => {
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/api/v1/auth/me`;
      let res: Response;

      if (overrideToken) {
        res = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${overrideToken}`,
          },
        });
      } else {
        res = await fetchWithAuth(url, {
          method: 'GET',
        });
      }

      const user = await handleResponse<YarUser>(res);
      cachedMeUser = user;
      lastMeTime = Date.now();
      return user;
    };

    if (overrideToken) {
      return run();
    }

    mePromise = run().finally(() => {
      mePromise = null;
    });

    return mePromise;
  },

  /**
   * API 009 | Rotate refresh token | تجديد الجلسة بتدوير Refresh Token
   * POST /api/v1/auth/refresh
   */
  async refreshToken(overrideRefreshToken?: string): Promise<AuthTokens> {
    return await requestTokenRefresh(overrideRefreshToken);
  },

  /**
   * API 011 | Revoke current JWT session | إنهاء الجلسة
   * POST /api/v1/auth/logout
   */
  async logout(overrideToken?: string): Promise<boolean> {
    const token = overrideToken || getAccessToken();
    const baseUrl = getApiBaseUrl();

    try {
      if (token) {
        await fetch(`${baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      // Ensure local cleanup even if network fails
      console.warn('[Auth] Server logout request failed:', err);
    } finally {
      clearStoredTokens();
    }

    return true;
  },

  /**
   * Request or resend verification OTP
   * POST /api/v1/auth/otp/request
   */
  async requestOtp(phone: string): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await handleResponse<{ request_accepted?: boolean }>(res);
    return Boolean(data?.request_accepted);
  },

  /**
   * Verify WhatsApp OTP and activate account
   * POST /api/v1/auth/otp/verify
   */
  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    await handleResponse<GenericDataResponse | null>(res);
    return true;
  },

  /**
   * Request password recovery via WhatsApp
   * POST /api/v1/auth/password/request
   */
  async requestPasswordReset(phone: string): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/password/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await handleResponse<{ request_accepted?: boolean }>(res);
    return Boolean(data?.request_accepted);
  },

  /**
   * Confirm password reset OTP
   * POST /api/v1/auth/password/confirm
   */
  async confirmPasswordReset(phone: string, code: string, newPassword: string): Promise<boolean> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/password/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        code,
        new_password: newPassword,
      }),
    });
    await handleResponse<GenericDataResponse | null>(res);
    return true;
  },

  /**
   * Register customer and send WhatsApp OTP
   * POST /api/v1/auth/register
   */
  async register(payload: RegisterPayload): Promise<GenericDataResponse | null> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await handleResponse<GenericDataResponse | null>(res);
  },

  /**
   * API 013 | Issue single-use WebSocket ticket | تذكرة اتصال Socket
   * POST /api/v1/auth/socket-ticket
   */
  async getSocketTicket(): Promise<GenericDataResponse | null> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/auth/socket-ticket`, {
      method: 'POST',
    });
    return await handleResponse<GenericDataResponse | null>(res);
  },
};
