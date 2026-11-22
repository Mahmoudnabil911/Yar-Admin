import { beforeEach, describe, it, expect, vi } from 'vitest';
import { authApi, getStoredTokens, clearStoredTokens, ApiAuthError } from '@/yar/services/api/authApi';
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
});

