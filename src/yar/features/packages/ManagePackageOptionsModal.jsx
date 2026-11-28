import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { NumberInput } from '../../components/ui/NumberInput';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

export function ManagePackageOptionsModal({
  isOpen,
  open,
  onClose,
  packageItem,
  onUpdated,
}) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();

  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Option Form
  const [isAddingOption, setIsAddingOption] = useState(false);
  const [optName, setOptName] = useState('');
  const [optPriceUsd, setOptPriceUsd] = useState('');
  const [optSupplierCostUsd, setOptSupplierCostUsd] = useState('');
  const [optCapacity, setOptCapacity] = useState('');
  const [optNights, setOptNights] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOptions = async () => {
    if (!packageItem?.id) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await catalogAdminApi.getServiceOptions();
      const pkgOptions = (res.items || []).filter(
        (o) => Number(o.service_id) === Number(packageItem.id)
      );
      setOptions(pkgOptions);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تحميل خيارات الباقة.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && packageItem?.id) {
      loadOptions();
      setIsAddingOption(false);
    }
  }, [isModalOpen, packageItem?.id]);

  if (!isModalOpen || !packageItem) return null;

  const handleCreateOption = async (e) => {
    e.preventDefault();
    if (!optName.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        service_id: Number(packageItem.id),
        name: optName.trim(),
        price_usd: Number(optPriceUsd) > 0 ? Number(optPriceUsd) : Number(packageItem.price_usd || 0),
        supplier_cost_usd: Number(optSupplierCostUsd) > 0 ? Number(optSupplierCostUsd) : undefined,
        capacity: Number(optCapacity) > 0 ? Number(optCapacity) : 2,
        nights: Number(optNights) > 0 ? Number(optNights) : undefined,
        active: true,
      };

      // API 082 | POST /api/v1/admin/service-options
      const created = await catalogAdminApi.createServiceOption(payload);
      toast(`تمت إضافة الفئة «${created.name}» للباقة بنجاح.`);
      setOptName('');
      setOptPriceUsd('');
      setOptSupplierCostUsd('');
      setIsAddingOption(false);
      await loadOptions();
      await onUpdated?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'فشل حفظ الفئة على السيرفر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOptionActive = async (opt) => {
    try {
      const nextActive = !opt.active;
      // API 083 | PATCH /api/v1/admin/service-options/{record_id}
      await catalogAdminApi.updateServiceOption(opt.id, { active: nextActive });
      toast(nextActive ? `تم تفعيل فئة «${opt.name}».` : `تم تعطيل فئة «${opt.name}».`);
      await loadOptions();
      await onUpdated?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تحديث حالة الفئة.');
    }
  };

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow="خيارات وفئات الباقة السياحية"
      title={packageItem.name}
    >
      <div style={{ padding: '4px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          فئات الأسعار والإقامة التابعة لهذه الباقة السياحية على سيرفر Odoo (API 081 / 082 / 083).
        </p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--c-ef4444)',
              borderRadius: 8,
              color: 'var(--c-ef4444)',
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Existing Options List */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>الفئات المسجلة ({options.length})</h3>
            {!isAddingOption && (
              <button
                type="button"
                className="button primary"
                style={{ fontSize: 12, padding: '4px 12px', minHeight: 30 }}
                onClick={() => setIsAddingOption(true)}
              >
                + إضافة فئة / خيار جديد (API 082)
              </button>
            )}
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 13 }}>
              جاري جلب خيارات الباقة من الخادم...
            </div>
          ) : options.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'var(--panel-alt, rgba(0,0,0,0.02))',
                borderRadius: 8,
                border: '1px dashed var(--border)',
                color: 'var(--muted)',
                fontSize: 13,
              }}
            >
              لا توجد فئات فرعية مخصصة لهذه الباقة بعد. يتم الاعتماد على السعر الافتراضي للباقة ($
              {packageItem.price_usd || 0}).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {options.map((opt) => (
                <div
                  key={opt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{opt.name}</span>
                      <span
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: opt.active !== false ? 'var(--c-eef4e7)' : 'rgba(239, 68, 68, 0.1)',
                          color: opt.active !== false ? 'var(--c-36542a)' : 'var(--c-ef4444)',
                        }}
                      >
                        {opt.active !== false ? 'نشط' : 'معطل'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      سعر البيع: <strong>${opt.price_usd || 0}</strong>
                      {opt.nights ? ` · ${opt.nights} ليالي` : ''}
                      {opt.capacity ? ` · سعة ${opt.capacity} أشخاص` : ''}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button secondary"
                    style={{ fontSize: 11, padding: '2px 8px', minHeight: 26 }}
                    onClick={() => handleToggleOptionActive(opt)}
                  >
                    {opt.active !== false ? 'تعطيل' : 'تفعيل'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Option Form */}
        {isAddingOption && (
          <form
            onSubmit={handleCreateOption}
            style={{
              padding: 16,
              background: 'var(--panel-alt, rgba(0,0,0,0.02))',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>إضافة خيار أو فئة جديدة</h4>
            <div className="ops-form-grid">
              <label className="ops-field wide">
                <span>اسم الفئة / الغرفة / البرنامج<span className="required-mark">*</span></span>
                <input
                  type="text"
                  value={optName}
                  onChange={(e) => setOptName(e.target.value)}
                  placeholder="مثال: غرفة مزدوجة مطلة على البحر شامل الطيران والإفطار"
                  required
                />
              </label>

              <label className="ops-field">
                <span>سعر البيع بالدولار ($ USD)<span className="required-mark">*</span></span>
                <NumberInput
                  min={0}
                  value={optPriceUsd}
                  onChange={(e) => setOptPriceUsd(e.target.value)}
                  placeholder="مثال: 650"
                  required
                />
              </label>

              <label className="ops-field">
                <span>تكلفة المورد ($ USD)</span>
                <NumberInput
                  min={0}
                  value={optSupplierCostUsd}
                  onChange={(e) => setOptSupplierCostUsd(e.target.value)}
                  placeholder="مثال: 500"
                />
              </label>

              <label className="ops-field">
                <span>عدد الليالي</span>
                <NumberInput
                  allowDecimals={false}
                  min={1}
                  value={optNights}
                  onChange={(e) => setOptNights(e.target.value)}
                  placeholder="مثال: 6"
                />
              </label>

              <label className="ops-field">
                <span>سعة الأفراد</span>
                <NumberInput
                  allowDecimals={false}
                  min={1}
                  value={optCapacity}
                  onChange={(e) => setOptCapacity(e.target.value)}
                  placeholder="مثال: 2"
                />
              </label>

              <div className="ops-form-actions wide" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsAddingOption(false)}
                  disabled={isSubmitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ الفئة (API 082)'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Drawer>
  );
}

