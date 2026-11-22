import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingsApi } from '@/yar/services/api/bookingsApi';

describe('bookingsApi client (API 038, 039, 040, 041, 042)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('lists bookings with pagination parameters (API 038)', async () => {
    const mockBookingsData = {
      items: [
        {
          id: 101,
          reference: 'YAR-2026-001',
          service_type: 'hotel',
          state: 'confirmed',
          total_iqd: 250000,
          currency: 'IQD',
          customer_name: 'Ali Ahmed',
        },
      ],
      total: 1,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockBookingsData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
        error: null,
      }),
    });

    const res = await bookingsApi.listBookings({ limit: 20, offset: 0 });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].reference).toBe('YAR-2026-001');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/bookings?limit=20&offset=0'),
      expect.any(Object)
    );
  });

  it('creates an idempotent booking with request_key (API 039)', async () => {
    const mockCreated = {
      id: 102,
      reference: 'YAR-BK-102',
      service_type: 'hotel',
      state: 'pending',
      total_iqd: 150000,
      currency: 'IQD',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: mockCreated,
        message: { ar: 'تم إنشاء الحجز بنجاح', en: 'Booking created' },
        error: null,
      }),
    });

    const res = await bookingsApi.createBooking({
      service_type: 'hotel',
      quantity: 1,
      adults: 2,
      children: 0,
    });

    expect(res.id).toBe(102);
    expect(res.state).toBe('pending');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/bookings'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      })
    );
  });

  it('fetches single booking details (API 040)', async () => {
    const mockDetail = {
      id: 101,
      reference: 'YAR-2026-001',
      service_type: 'hotel',
      state: 'confirmed',
      total_iqd: 250000,
      currency: 'IQD',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockDetail,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
        error: null,
      }),
    });

    const res = await bookingsApi.getBooking(101);
    expect(res.id).toBe(101);
    expect(res.state).toBe('confirmed');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/bookings/101'),
      expect.any(Object)
    );
  });

  it('cancels an unissued booking (API 041)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 101, state: 'cancelled' },
        message: { ar: 'تم الإلغاء بنجاح', en: 'Cancelled' },
        error: null,
      }),
    });

    const res = await bookingsApi.cancelBooking(101, 'طلب العميل');
    expect(res.state).toBe('cancelled');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/bookings/101/cancel'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('assigns booking to staff (API 042)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 101, assigned_to: 5 },
        message: { ar: 'تم التعيين بنجاح', en: 'Assigned' },
        error: null,
      }),
    });

    const res = await bookingsApi.assignBooking(101, 5);
    expect(res.assigned_to).toBe(5);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/bookings/101/assign'),
      expect.objectContaining({
        method: 'PATCH',
      })
    );
  });
});
