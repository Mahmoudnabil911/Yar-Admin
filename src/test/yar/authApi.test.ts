import { beforeEach, describe, it, expect, vi } from 'vitest';
import { authApi, getStoredTokens, setStoredTokens, clearStoredTokens, ApiAuthError, fetchWithAuth } from '@/yar/services/api/authApi';
import * as R from '@/yar/accounts/repository';

describe('YAR Odoo 18 Auth API & Repository Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStoredTokens();
    vi.restoreAllMocks();
  });

  it('authenticates via authApi.login and stores tokens and user', async () => {
    const mockEnvelope = {
      success: true,
      data: {
        access_token: 'mock-access-token-jwt',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          id: 2,
          name: 'Administrator',
          phone: false,
          role: 'admin' as const,
          verified: false,
        },
      },
      message: {
        ar: 'تمت العملية بنجاح',
        en: 'Operation completed',
      },
      error: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockEnvelope,
    } as Response);

    const tokens = await authApi.login({ login: 'admin', password: 'secretpassword' });
    expect(tokens.access_token).toBe('mock-access-token-jwt');
    expect(tokens.user.name).toBe('Administrator');
    expect(tokens.user.role).toBe('admin');

    const stored = getStoredTokens();
    expect(stored?.access_token).toBe('mock-access-token-jwt');
    expect(stored?.refresh_token).toBe('mock-refresh-token');
  });

  it('throws ApiAuthError on invalid credentials with bilingual error', async () => {
    const mockErrorEnvelope = {
      success: false,
      data: null,
      message: {
        ar: 'بيانات الدخول غير صحيحة',
        en: 'Invalid credentials',
      },
      error: {
        code: 'invalid_credentials',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => mockErrorEnvelope,
    } as Response);

    await expect(authApi.login({ login: 'admin', password: 'wrong' })).rejects.toThrowError(ApiAuthError);
  });

  it('refreshes token via authApi.refreshToken', async () => {
    const mockRefreshEnvelope = {
      success: true,
      data: {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          id: 2,
          name: 'Administrator',
          phone: false,
          role: 'admin' as const,
          verified: false,
        },
      },
      message: {
        ar: 'تمت العملية بنجاح',
        en: 'Operation completed',
      },
      error: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockRefreshEnvelope,
    } as Response);

    const nextTokens = await authApi.refreshToken('old-refresh-token');
    expect(nextTokens.access_token).toBe('new-access-token');
    expect(getStoredTokens()?.access_token).toBe('new-access-token');
  });

  it('logs in via R.login with live API response and syncs currentAccount', async () => {
    const mockLoginEnvelope = {
      success: true,
      data: {
        access_token: 'live-access-token',
        refresh_token: 'live-refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
        user: {
          id: 2,
          name: 'Administrator',
          phone: '+9647831400500',
          role: 'admin' as const,
          verified: true,
        },
      },
      message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
      error: null,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockLoginEnvelope,
    } as Response);

    const user = await R.login('admin', '01&J2&AiC2}2');
    expect(user?.name).toBe('Administrator');
    expect(user?.role).toBe('admin');
    expect(R.currentAccount()?.staffId).toBe('2');

    R.logout();
    expect(R.currentAccount()).toBeNull();
    expect(getStoredTokens()).toBeNull();
  });

  it('calls authApi.getMe (API 012) with Bearer token', async () => {
    setStoredTokens({
      access_token: 'valid-test-access-token',
      refresh_token: 'valid-test-refresh-token',
      token_type: 'Bearer',
      expires_in: 900,
      user: {
        id: 2,
        name: 'Administrator',
        phone: false,
        role: 'admin',
        verified: true,
      },
    });

    const mockMeEnvelope = {
      success: true,
      data: {
        id: 2,
        name: 'Administrator Live',
        phone: '+9647831400500',
        role: 'admin',
        verified: true,
      },
      message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
      error: null,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockMeEnvelope,
    } as Response);

    const me = await authApi.getMe();
    expect(me.name).toBe('Administrator Live');
    expect(me.phone).toBe('+9647831400500');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-test-access-token',
        }),
      })
    );
  });

  it('automatically refreshes token on 401 via fetchWithAuth and retries request', async () => {
    setStoredTokens({
      access_token: 'expired-access-token',
      refresh_token: 'valid-refresh-token',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 2, name: 'Admin', phone: false, role: 'admin', verified: true },
    });

    const mockRefreshEnvelope = {
      success: true,
      data: {
        access_token: 'fresh-new-token',
        refresh_token: 'fresh-refresh-token',
        token_type: 'Bearer',
        expires_in: 900,
        user: { id: 2, name: 'Admin', phone: false, role: 'admin', verified: true },
      },
      message: { ar: 'تم التجديد', en: 'Refreshed' },
      error: null,
    };

    const mockDataEnvelope = {
      success: true,
      data: { items: [{ id: 1, name: 'Hotel 1' }] },
      message: { ar: 'نجاح', en: 'Success' },
      error: null,
    };

    const fetchMock = vi.fn();
    // 1st call: returns 401 Unauthorized
    fetchMock.mockResolvedValueOnce({
      status: 401,
      ok: false,
      json: async () => ({ success: false, error: { code: 'expired_token' } }),
    } as Response);
    // 2nd call: POST /api/v1/auth/refresh returns new tokens
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockRefreshEnvelope,
    } as Response);
    // 3rd call: retried original request with fresh-new-token returns 200
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => mockDataEnvelope,
    } as Response);

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock);

    const res = await fetchWithAuth('https://yar-odoo.samaalrosha.com/api/v1/admin/hotels');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.items).toHaveLength(1);
    expect(getStoredTokens()?.access_token).toBe('fresh-new-token');
  });

  it('deduplicates concurrent in-flight GET requests and returns independent cloned responses', async () => {
    setStoredTokens({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 900,
    });

    const mockPayload = { success: true, data: { items: [1, 2, 3] } };
    const fetchSpy = vi.fn().mockImplementation(async () => {
      // Simulate small network delay
      await new Promise(r => setTimeout(r, 20));
      return new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchSpy);

    // Call fetchWithAuth twice simultaneously for the same URL
    const [res1, res2] = await Promise.all([
      fetchWithAuth('https://yar-odoo.samaalrosha.com/api/v1/inbox'),
      fetchWithAuth('https://yar-odoo.samaalrosha.com/api/v1/inbox'),
    ]);

    // Network fetch was invoked only once
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Both callers can independently consume the body
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1).toEqual(mockPayload);
    expect(body2).toEqual(mockPayload);
  });
});

