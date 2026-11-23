import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audienceApi } from '@/yar/services/api/audienceApi';
import { EN } from '@/yar/i18n/en';

describe('audienceApi & Audience translations', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches customer audience list via getAudience (API 115)', async () => {
    const mockData = {
      items: [
        { id: 10, name: 'Customer A', booking_count: 3 },
        { id: 11, name: 'Customer B', booking_count: 0 },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: mockData,
        message: { ar: 'تمت العملية بنجاح', en: 'Operation completed' },
        error: null,
      }),
    });

    const res = await audienceApi.getAudience(100);
    expect(res.items).toHaveLength(2);
    expect(res.items[0].name).toBe('Customer A');
    expect(res.items[0].booking_count).toBe(3);
  });

  it('has comprehensive Arabic to English translations for audience page and empty states', () => {
    const requiredKeys = [
      'مستخدمو لوحة التحكم',
      'حسابات المديرين وموظفي الحجوزات المصرح لهم بالدخول إلى لوحة الإدارة.',
      'كل أدوار الإدارة',
      'جاري تحميل مستخدمي لوحة التحكم...',
      'عملاء ومستخدمو التطبيق',
      'قائمة عملاء ومستخدمي تطبيق المسافر المسجلين وسجل حجوزاتهم.',
      'ابحث باسم العميل أو رقم الهاتف أو المعرّف…',
      'جاري تحميل مستخدمي التطبيق...',
      'تعذر جلب مستخدمي التطبيق',
      'العميل',
      'لا يوجد عملاء أو مستخدمو تطبيق',
      'لم يتم العثور على حسابات عملاء مسجلة حالياً.',
      'تحليلات وإحصاءات استخدام التطبيق ومؤشرات العمليات.',
      'التقارير والتحليلات قيد التطوير',
      'لم يتم تجهيز خوارزميات وتحليلات التقارير بعد من قِبل مطور الـ Backend.',
      'تحليل سلوك واهتمامات مستخدمي التطبيق والأكثر طلباً.',
      'تحليلات الطلب والاهتمامات قيد التجهيز',
      'سيتم ربط هذا القسم فور اكتمال خوارزميات تحليل طلبات واهتمامات مستخدمي التطبيق في الـ Backend.',
      'تعذر جلب البيانات من الخادم.',
    ];

    for (const key of requiredKeys) {
      expect(EN[key], `Missing English translation for: ${key}`).toBeDefined();
      expect(typeof EN[key]).toBe('string');
      expect(EN[key].length).toBeGreaterThan(0);
    }
  });
});
