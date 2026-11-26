import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { catalogAdminApi, invalidateCatalogCache } from '@/yar/services/api/catalogAdminApi';
import { setStoredTokens, clearStoredTokens } from '@/yar/services/api/authApi';

describe('Car Management & City Rates APIs (180, 181, 182, 183)', () => {
  beforeEach(() => {
    invalidateCatalogCache();
    setStoredTokens({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      token_type: 'Bearer',
      expires_in: 900,
      user: { id: 1, name: 'Admin', role: 'admin', phone: '+9647700000000' },
    });
  });

  afterEach(() => {
    clearStoredTokens();
    vi.restoreAllMocks();
  });

  it('fetches car city rates via GET /api/v1/admin/car-city-rates (API 181)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: 11,
                service_id: 5,
                city: 'مشهد',
                pickup_price_usd: 30,
                roundtrip_price_usd: 60,
                pickup_supplier_cost_usd: 25,
                roundtrip_supplier_cost_usd: 50,
                active: true,
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await catalogAdminApi.getCarCityRates({ limit: 100 }, true);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.city).toBe('مشهد');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/admin/car-city-rates?limit=100'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('creates and updates car city rates via POST (API 182) and PATCH (API 183)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: 42 } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { id: 42 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const created = await catalogAdminApi.createCarCityRate({
      service_id: 5,
      city: 'طهران',
      pickup_price_usd: 45,
      roundtrip_price_usd: 90,
      pickup_supplier_cost_usd: 0,
      roundtrip_supplier_cost_usd: 0,
      active: true,
    });
    expect(created.id).toBe(42);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/api/v1/admin/car-city-rates'),
      expect.objectContaining({ method: 'POST' })
    );

    const updated = await catalogAdminApi.updateCarCityRate(42, { active: false });
    expect(updated.id).toBe(42);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/v1/admin/car-city-rates/42'),
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('uploads service media as FormData via POST /api/v1/admin/services/{id}/media (API 180)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { url: '/media/car-1.webp' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const file = new Blob(['fake-image'], { type: 'image/webp' });
    await catalogAdminApi.uploadServiceMedia(5, file, 'camry-1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('/api/v1/admin/services/5/media');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });
});

