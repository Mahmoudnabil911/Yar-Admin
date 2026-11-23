import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { NumberInput } from '../../components/ui/NumberInput';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

export function CreatePackageModal({ isOpen, open, onClose, packageToEdit = null, onSaved }) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();

  const isEditing = Boolean(packageToEdit && packageToEdit.id);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [capacity, setCapacity] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [supplierCostUsd, setSupplierCostUsd] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [description, setDescription] = useState('');
  const [published, setPublished] = useState(true);
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (packageToEdit) {
      setName(packageToEdit.name || '');
      setCity(packageToEdit.city || '');
      setDurationDays(
        packageToEdit.duration_minutes ? String(Math.round(packageToEdit.duration_minutes / 1440)) : '',
      );
      setCapacity(packageToEdit.capacity != null ? String(packageToEdit.capacity) : '');
      setPriceUsd(packageToEdit.price_usd != null ? String(packageToEdit.price_usd) : '');
      setSupplierCostUsd(packageToEdit.supplier_cost_usd != null ? String(packageToEdit.supplier_cost_usd) : '');
      setPickupLocation(packageToEdit.pickup_location || '');
      setDropoffLocation(packageToEdit.dropoff_location || '');
      setDescription(packageToEdit.description || '');
      setPublished(packageToEdit.published !== false);
      setActive(packageToEdit.active !== false);
    } else {
      setName('');
      setCity('');
      setDurationDays('');
      setCapacity('');
      setPriceUsd('');
      setSupplierCostUsd('');
      setPickupLocation('');
      setDropoffLocation('');
      setDescription('');
      setPublished(true);
      setActive(true);
    }
    setErrorMsg('');
  }, [packageToEdit, isModalOpen]);

  if (!isModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (!name.trim()) {
        throw new Error('يرجى كتابة اسم الباقة السياحية.');
      }

      const payload = {
        name: name.trim(),
        service_type: 'package',
        city: city.trim() || undefined,
        duration_minutes: Number(durationDays) > 0 ? Number(durationDays) * 1440 : 10080,
        capacity: Number(capacity) > 0 ? Number(capacity) : 2,
        price_usd: Number(priceUsd) >= 0 ? Number(priceUsd) : 0,
        supplier_cost_usd: Number(supplierCostUsd) >= 0 ? Number(supplierCostUsd) : undefined,
        pickup_location: pickupLocation.trim() || undefined,
        dropoff_location: dropoffLocation.trim() || undefined,
        description: description.trim() || undefined,
        published: Boolean(published),
        active: Boolean(active),
      };

      if (isEditing) {
        // API 080 | PATCH /api/v1/admin/services/{id}
        await catalogAdminApi.updateService(packageToEdit.id, payload);
        toast(`تم تحديث باقة «${payload.name}» بنجاح.`);
        await onSaved?.({ ...packageToEdit, ...payload });
      } else {
        // API 079 | POST /api/v1/admin/services
        const created = await catalogAdminApi.createService(payload);
        toast(`تم إضافة باقة «${created.name}» إلى السيرفر بنجاح برقم #${created.id}.`);
        await onSaved?.(created);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الباقة على الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow={isEditing ? 'تعديل باقة سياحية' : 'إضافة باقة سياحية'}
      title={isEditing ? `تعديل ${packageToEdit.name}` : 'إضافة باقة سياحية جديدة '}
    >
      <div className="ops-create-modal" style={{ padding: '4px 0' }}>
        {errorMsg && (
          <div
            className="ops-form-error wide"
            role="alert"
            style={{
              marginBottom: 16,
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--c-ef4444)',
              borderRadius: 8,
              color: 'var(--c-ef4444)',
              fontSize: 13,
            }}
          >
            <strong>خطأ: </strong> {errorMsg}
          </div>
        )}

        <form className="ops-form-grid" onSubmit={handleSubmit}>
          {/* Package Name */}
          <label className="ops-field wide">
            <span>اسم الباقة السياحية *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: بكج إسطنبول وطرابزون 7 أيام شامل الطيران"
              required
            />
          </label>

          {/* City */}
          <label className="ops-field">
            <span>المدينة / الوجهة</span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="مثال: إسطنبول، طرابزون، دبي، أنطاليا..."
            />
          </label>

          {/* Duration Days */}
          <label className="ops-field">
            <span>المدة (أيام)</span>
            <NumberInput
              allowDecimals={false}
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="مثال: 7"
            />
          </label>

          {/* Price USD */}
          <label className="ops-field">
            <span>سعر البيع الافتراضي ($ USD) *</span>
            <NumberInput
              min={0}
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="مثال: 500"
              required
            />
          </label>

          {/* Supplier Cost USD */}
          <label className="ops-field">
            <span>تكلفة المورّد ($ USD)</span>
            <NumberInput
              min={0}
              value={supplierCostUsd}
              onChange={(e) => setSupplierCostUsd(e.target.value)}
              placeholder="مثال: 380"
            />
          </label>

          {/* Capacity */}
          <label className="ops-field">
            <span>سعة الأفراد / المقاعد</span>
            <NumberInput
              allowDecimals={false}
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="مثال: 2"
            />
          </label>

          {/* Pickup Location */}
          <label className="ops-field">
            <span>نقطة الانطلاق / الاستقبال</span>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="مثال: مطار إسطنبول الدولي"
            />
          </label>

          {/* Dropoff Location */}
          <label className="ops-field wide">
            <span>نقطة العودة / التوديع</span>
            <input
              type="text"
              value={dropoffLocation}
              onChange={(e) => setDropoffLocation(e.target.value)}
              placeholder="مثال: مطار بغداد الدولي"
            />
          </label>

          {/* Description */}
          <label className="ops-field wide">
            <span>وصف الباقة والأنشطة المشمولة</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="تفاصيل الإقامة بالفنادق، الجولات، الوجبات، وتذاكر الطيران..."
            />
          </label>

          {/* Toggles */}
          <div
            className="ops-field wide"
            style={{
              display: 'flex',
              gap: 24,
              padding: '12px 14px',
              background: 'var(--panel-alt, rgba(0,0,0,0.02))',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <span>منشور للعملاء في التطبيق والموقع</span>
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span>نشط وجاهز للعمليات والحجز</span>
            </label>
          </div>

          {/* Actions */}
          <div
            className="ops-form-actions wide"
            style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}
          >
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button type="submit" className="button primary" disabled={isSubmitting}>
              {isSubmitting
                ? 'جاري الحفظ على الخادم...'
                : isEditing
                  ? 'حفظ التعديلات'
                  : 'إضافة الباقة'}
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
}
