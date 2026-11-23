import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suppliersApi } from '@/yar/services/api/suppliersApi';
import { EN } from '@/yar/i18n/en';

describe('suppliersApi & Supplier Credit translations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches supplier balances via getSuppliers (API 065)', async () => {
    const mockData = {
      items: [
        { id: 1, name: 'Airline Supplier A', balance_usd: 1500, currency: 'USD' },
        { id: 2, name: 'Hotel Bedbank B', balance_usd: 85, currency: 'USD' },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation successful' },
        error: null,
      }),
    });

    const res = await suppliersApi.getSuppliers();
    expect(res.items).toHaveLength(2);
    expect(res.items[0].name).toBe('Airline Supplier A');
    expect(res.items[0].balance_usd).toBe(1500);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/suppliers'),
      expect.any(Object)
    );
  });

  it('fetches supplier ledger via getSupplierLedger (API 066)', async () => {
    const mockData = {
      supplier_id: 5,
      balance_usd: 1250,
      currency: 'USD',
      items: [
        { id: 101, type: 'deposit', amount_usd: 1500, balance_after_usd: 1500, reference: 'DEP-101' },
        { id: 102, type: 'issue', amount_usd: 250, balance_after_usd: 1250, reference: 'TKT-202', booking_id: 55 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation successful' },
        error: null,
      }),
    });

    const res = await suppliersApi.getSupplierLedger(5, 100);
    expect(res.supplier_id).toBe(5);
    expect(res.balance_usd).toBe(1250);
    expect(res.items).toHaveLength(2);
    expect(res.items?.[1].booking_id).toBe(55);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/suppliers/5/ledger?limit=100'),
      expect.any(Object)
    );
  });

  it('tops up supplier balance via topUpSupplier (API 064)', async () => {
    const mockData = {
      ledger_id: 205,
      balance_usd: 2500,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation successful' },
        error: null,
      }),
    });

    const res = await suppliersApi.topUpSupplier(7, {
      amount_usd: 1000,
      reference: 'BANK-TOPUP-99',
    });

    expect(res.ledger_id).toBe(205);
    expect(res.balance_usd).toBe(2500);

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('/api/v1/admin/suppliers/7/topup');
    const body = JSON.parse(callArgs[1].body);
    expect(body).toEqual({
      amount_usd: 1000,
      reference: 'BANK-TOPUP-99',
    });
  });

  it('returns supplier debit via returnSupplierDebit (API 063)', async () => {
    const mockData = {
      id: 301,
      balance_usd: 1300,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation successful' },
        error: null,
      }),
    });

    const res = await suppliersApi.returnSupplierDebit(7, {
      booking_id: 88,
      amount_usd: 200,
      reference: 'RET-REF-88',
    });

    expect(res.id).toBe(301);
    expect(res.balance_usd).toBe(1300);

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('/api/v1/admin/suppliers/7/return');
    const body = JSON.parse(callArgs[1].body);
    expect(body).toEqual({
      booking_id: 88,
      amount_usd: 200,
      reference: 'RET-REF-88',
    });
  });

  it('creates supplier via createSupplier (API 068)', async () => {
    const mockCreated = {
      id: 10,
      name: 'New Aviation Provider',
      code: 'SUP_010',
      service_type: 'flight',
      active: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: mockCreated,
        message: { ar: 'تم إنشاء المورّد بنجاح', en: 'Supplier created' },
        error: null,
      }),
    });

    const res = await suppliersApi.createSupplier({
      name: 'New Aviation Provider',
      code: 'SUP_010',
      service_type: 'flight',
      email: 'flight@example.com',
      phone: '+9647700000000',
    });

    expect(res.id).toBe(10);
    expect(res.name).toBe('New Aviation Provider');

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('/api/v1/admin/suppliers');
    expect(callArgs[1].method).toBe('POST');
    const body = JSON.parse(callArgs[1].body);
    expect(body.name).toBe('New Aviation Provider');
    expect(body.code).toBe('SUP_010');
  });

  it('updates supplier via updateSupplier (API 062)', async () => {
    const mockUpdated = {
      id: 10,
      name: 'Updated Name',
      active: false,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockUpdated,
        message: { ar: 'تم تعديل المورّد', en: 'Supplier updated' },
        error: null,
      }),
    });

    const res = await suppliersApi.updateSupplier(10, {
      name: 'Updated Name',
      active: false,
    });

    expect(res.id).toBe(10);
    expect(res.name).toBe('Updated Name');

    const callArgs = (global.fetch as any).mock.calls[0];
    expect(callArgs[0]).toContain('/api/v1/admin/suppliers/10');
    expect(callArgs[1].method).toBe('PATCH');
    const body = JSON.parse(callArgs[1].body);
    expect(body.name).toBe('Updated Name');
    expect(body.active).toBe(false);
  });

  it('has comprehensive Arabic to English translations for supplier credit page', () => {
    const requiredKeys = [
      'تحديث البيانات من الخادم',
      'تحديث الكشف',
      'أرصدة المورّدين بالدولار منفصلة عن تحصيل العملاء، ولا تُجمع العملات.',
      'جاري تحميل أرصدة الموردين من الخادم...',
      'جاري تحميل كشف الحساب من الخادم...',
      'تعذر تحميل أرصدة الموردين من الخادم.',
      'تعذر تحميل كشف حساب المورّد من الخادم.',
      'لا توجد حسابات موردين مسجلة حتى الآن.',
      'لا توجد حركات مسجلة لهذا المورّد حتى الآن.',
      'كشف حركة أرصدة الموردين',
      'اضغط على «كشف الحساب» أمام أي مورّد في الجدول أعلاه لعرض وتدقيق كشف حركاته المباشرة (API 066).',
      'حساب المورّد · رصيد مسبق الدفع (API 066)',
      'مدين · خصم',
      'دائن · شحن',
      'المرجع / الطلب',
      'صُدّر كشف أرصدة المورّدين بنجاح.',
      'إضافة رصيد بالدولار لحساب المورّد في سجلات النظام (API 064).',
      'المبلغ بالدولار',
      'يبقى كل رصيد بعملته (USD). شحن الرصيد يرفع الرصيد المتاح لإصدار التذاكر وتأكيد الخدمات.',
      'جاري شحن الرصيد...',
      'تم شحن رصيد المورّد بنجاح.',
      'تعذر شحن رصيد المورد.',
      'إنشاء حساب مورّد جديد على الخادم (API 068).',
      'كود المورّد (Code)',
      'طريقة الربط',
      'يدوي (Manual)',
      'واجهة برمجية (API)',
      'القناة (Channel)',
      'بيئة تجريبية (Test)',
      'بيئة الإنتاج (Production)',
      'المدن المغطاة',
      'ملاحظات إضافية',
      'جاري الحفظ على الخادم...',
      'حفظ المورّد الجديد',
      'تم إنشاء المورّد بنجاح على الخادم.',
      'تعذر إنشاء المورّد على الخادم.',
      'إدارة المورّدين (API 068)',
      'إضافة مورّد جديد',
      'إضافة مورّد',
    ];

    for (const key of requiredKeys) {
      expect(EN[key], `Missing English translation for: ${key}`).toBeDefined();
      expect(typeof EN[key]).toBe('string');
      expect(EN[key].length).toBeGreaterThan(0);
    }
  });
});
