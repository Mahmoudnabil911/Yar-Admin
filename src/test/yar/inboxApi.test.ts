import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inboxApi } from '@/yar/services/api/inboxApi';
import * as authModule from '@/yar/services/api/authApi';

describe('inboxApi client (APIs 120 - 126)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('API 120: getInquiries sends GET /api/v1/inbox and returns list of inquiries', async () => {
    const mockEnvelope = {
      success: true,
      data: {
        items: [
          {
            id: 1,
            subject: 'استفسار عن حجز',
            message: 'تفاصيل الرحلة',
            category: 'flights',
            status: 'new',
            customer_name: 'أحمد علي',
            customer_phone: '+9647831400500',
            created_at: '2026-11-23T19:00:00+03:00',
          },
        ],
      },
      message: { ar: 'تم بنجاح', en: 'Success' },
      error: null,
      time_zone: 'Asia/Baghdad',
    };

    vi.spyOn(authModule, 'fetchWithAuth').mockResolvedValue(
      new Response(JSON.stringify(mockEnvelope), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await inboxApi.getInquiries();
    expect(authModule.fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/inbox'),
      expect.objectContaining({ method: 'GET' })
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].subject).toBe('استفسار عن حجز');
  });

  it('API 121: submitInquiry sends POST /api/v1/inbox with payload', async () => {
    const mockEnvelope = {
      success: true,
      data: { id: 12, status: 'new' },
      message: { ar: 'تم الإنشاء بنجاح', en: 'Created' },
      error: null,
    };

    vi.spyOn(authModule, 'fetchWithAuth').mockResolvedValue(
      new Response(JSON.stringify(mockEnvelope), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await inboxApi.submitInquiry({
      subject: 'طلب باقة',
      message: 'أريد تفاصيل باقة إسطنبول',
      category: 'packages',
    });

    expect(authModule.fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/inbox'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('طلب باقة'),
      })
    );
    expect(res.id).toBe(12);
    expect(res.status).toBe('new');
  });

  it('API 122: replyToInquiry sends POST /api/v1/inbox/{id}/reply with body and internal flag', async () => {
    const mockEnvelope = {
      success: true,
      data: { message_id: 101 },
      message: { ar: 'تم الرد بنجاح', en: 'Replied' },
      error: null,
    };

    vi.spyOn(authModule, 'fetchWithAuth').mockResolvedValue(
      new Response(JSON.stringify(mockEnvelope), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await inboxApi.replyToInquiry(12, {
      body: 'تم التواصل مع الفندق لتأكيد الغرفة',
      internal: true,
    });

    expect(authModule.fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/inbox/12/reply'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('internal'),
      })
    );
    expect(res.message_id).toBe(101);
  });

  it('API 123: updateInquiryStatus sends PATCH /api/v1/inbox/{id}/status with new status', async () => {
    const mockEnvelope = {
      success: true,
      data: { id: 12, status: 'in_progress' },
      message: { ar: 'تم تحديث الحالة', en: 'Updated' },
      error: null,
    };

    vi.spyOn(authModule, 'fetchWithAuth').mockResolvedValue(
      new Response(JSON.stringify(mockEnvelope), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await inboxApi.updateInquiryStatus(12, 'in_progress');

    expect(authModule.fetchWithAuth).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/inbox/12/status'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      })
    );
    expect(res.status).toBe('in_progress');
  });

  it('API 124 & 125: getNotifications and markNotificationRead work correctly', async () => {
    vi.spyOn(authModule, 'fetchWithAuth')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { items: [{ id: 5, title: 'إشعار جديد' }] },
            message: { ar: 'نجاح', en: 'OK' },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: { read: true },
            message: { ar: 'تم تعيينه مقروءاً', en: 'Marked read' },
            error: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

    const notifications = await inboxApi.getNotifications();
    expect(notifications.items).toHaveLength(1);

    const markRes = await inboxApi.markNotificationRead(5);
    expect(markRes.read).toBe(true);
  });

  it('API 126: submitPublicContact sends unauthenticated POST /api/v1/public/contact', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 99, status: 'new' },
          message: { ar: 'تم استلام الرسالة', en: 'Received' },
          error: null,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const res = await inboxApi.submitPublicContact({
      name: 'زائر',
      subject: 'استفسار سياحي',
      message: 'هل تنظمون رحلات جماعية؟',
      phone: '+9647831400500',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/public/contact'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(res.id).toBe(99);
  });

  it('throws ApiAuthError on backend error envelope', async () => {
    vi.spyOn(authModule, 'fetchWithAuth').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          data: null,
          message: { ar: 'غير مصرح به', en: 'Forbidden' },
          error: { code: 'forbidden' },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    await expect(inboxApi.getInquiries()).rejects.toThrow('Forbidden');
  });
});

