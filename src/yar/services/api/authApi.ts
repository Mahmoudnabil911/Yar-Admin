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

export const TOKENS_KEY = 'YAR_AUTH_TOKENS_V1';

export function getStoredTokens(): AuthTokens | null {
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
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearStoredTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKENS_KEY);
}

export function getAccessToken(): string | null {
  return getStoredTokens()?.access_token || null;
}

export function getRefreshToken(): string | null {
  return getStoredTokens()?.refresh_token || null;
}

const DEFAULT_BASE_URL = 'https://yar-odoo.samaalrosha.com';

export function getApiBaseUrl(): string {
  // In browser/dev, VITE_API_BASE_URL is intentionally '' (empty) so all /api/* requests
  // go through the Vite proxy (dev) or SSR proxy (prod) → avoids CORS preflight rejection.
  // We MUST check for undefined explicitly: empty string '' is a valid "use proxy" signal.
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & { env?: Record<string, string> }).env : undefined;
  const envVal = metaEnv?.VITE_API_BASE_URL;
  return envVal !== undefined ? envVal : DEFAULT_BASE_URL;
}

async function handleResponse<T>(res: Response): Promise<T> {
  let envelope: ApiEnvelope<T>;
  try {
    envelope = await res.json();
  } catch {
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
  async getMe(overrideToken?: string): Promise<YarUser> {
    const token = overrideToken || getAccessToken();
    if (!token) {
      throw new ApiAuthError('رمز المصادقة غير متوفر.', 'Authentication token missing.', 'no_token', 401);
    }

    const baseUrl = getApiBaseUrl();
    let res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    // If access token expired (401), try to refresh token automatically
    if (res.status === 401 && !overrideToken) {
      const refreshed = await this.refreshToken().catch(() => null);
      if (refreshed) {
        res = await fetch(`${baseUrl}/api/v1/auth/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${refreshed.access_token}`,
          },
        });
      }
    }

    return await handleResponse<YarUser>(res);
  },

  /**
   * API 009 | Rotate refresh token | تجديد الجلسة بتدوير Refresh Token
   * POST /api/v1/auth/refresh
   */
  async refreshToken(overrideRefreshToken?: string): Promise<AuthTokens> {
    const refreshToken = overrideRefreshToken || getRefreshToken();
    if (!refreshToken) {
      clearStoredTokens();
      throw new ApiAuthError('جلسة التجديد منتهية أو غير صالحة.', 'Refresh token missing.', 'no_refresh_token', 401);
    }

    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    try {
      const nextTokens = await handleResponse<AuthTokens>(res);
      setStoredTokens(nextTokens);
      return nextTokens;
    } catch (err) {
      clearStoredTokens();
      throw err;
    }
  },

  /**
   * API 011 | Revoke current JWT session | إنهاء الجلسة
   * POST /api/v1/auth/logout
   */
  async logout(): Promise<void> {
    const token = getAccessToken();
    const baseUrl = getApiBaseUrl();

    if (token) {
      try {
        await fetch(`${baseUrl}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore network errors on logout to ensure local cleanup
      }
    }

    clearStoredTokens();
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
    const token = getAccessToken();
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/socket-ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    return await handleResponse<GenericDataResponse | null>(res);
  },
};
