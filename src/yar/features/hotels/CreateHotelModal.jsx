import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

export function CreateHotelModal({
  isOpen,
  open,
  onClose,
  hotelToEdit = null,
  onSaved
}) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();

  const isEditing = Boolean(hotelToEdit && hotelToEdit.id);

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [stars, setStars] = useState(5);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [published, setPublished] = useState(true);
  const [active, setActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Populate fields when editing or opening
  useEffect(() => {
    if (hotelToEdit) {
      setName(hotelToEdit.name || '');
      setCity(hotelToEdit.city || '');
      setCountry(hotelToEdit.country || '');
      setAddress(hotelToEdit.address || '');
      setDescription(hotelToEdit.description || '');
      setStars(Number(hotelToEdit.stars) || 5);
      setCheckInTime(hotelToEdit.check_in_time || '');
      setCheckOutTime(hotelToEdit.check_out_time || '');
      setCancellationPolicy(hotelToEdit.cancellation_policy || '');
      setPublished(hotelToEdit.published !== false);
      setActive(hotelToEdit.active !== false);
    } else {
      setName('');
      setCity('');
      setCountry('');
      setAddress('');
      setDescription('');
      setStars(5);
      setCheckInTime('');
      setCheckOutTime('');
      setCancellationPolicy('');
      setPublished(true);
      setActive(true);
    }
    setErrorMsg('');
  }, [hotelToEdit, isModalOpen]);

  if (!isModalOpen) return null;

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      if (!name.trim()) {
        throw new Error('يرجى كتابة اسم الفندق.');
      }

      const payload = {
        name: name.trim(),
        stars: Math.max(1, Math.min(5, Number(stars) || 5)),
        published: Boolean(published),
        active: Boolean(active),
      };

      if (city.trim()) payload.city = city.trim();
      if (country.trim()) payload.country = country.trim();
      if (address.trim()) payload.address = address.trim();
      if (description.trim()) payload.description = description.trim();
      if (checkInTime.trim()) payload.check_in_time = checkInTime.trim();
      if (checkOutTime.trim()) payload.check_out_time = checkOutTime.trim();
      if (cancellationPolicy.trim()) payload.cancellation_policy = cancellationPolicy.trim();

      if (isEditing) {
        // API 071 | PATCH /api/v1/admin/hotels/{id}
        await catalogAdminApi.updateHotel(hotelToEdit.id, payload);
        toast(`تم تحديث بيانات ${payload.name} بنجاح.`);
        await onSaved?.({ ...hotelToEdit, ...payload });
      } else {
        // API 070 | POST /api/v1/admin/hotels
        const created = await catalogAdminApi.createHotel(payload);
        toast(`تم إضافة ${created.name} إلى السيرفر بنجاح برقم #${created.id}.`);
        await onSaved?.(created);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الفندق على الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow={isEditing ? 'تعديل فندق' : 'إضافة فندق'}
      title={isEditing ? `تعديل ${hotelToEdit.name}` : 'إضافة فندق جديد'}
    >
      <div className="ops-create-modal" style={{ padding: '4px 0' }}>
        <p className="ops-note" style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>
          {isEditing
            ? 'تُحدث التعديلات مباشرة في قاعدة بيانات النظام عبر واجهة الربط المباشرة.'
            : 'يتم حفظ الفندق مباشرة في قاعدة بيانات النظام ليكون متاحاً للحجوزات فوراً.'}
        </p>

        {errorMsg && (
          <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--c-ef4444)', borderRadius: 8, color: 'var(--c-ef4444)', fontSize: 13 }}>
            <strong>خطأ: </strong> {errorMsg}
          </div>
        )}

        <form className="ops-form-grid" onSubmit={handleSubmit}>
          {/* Hotel Name */}
          <label className="ops-field wide">
            <span>اسم الفندق<span className="required-mark">*</span></span>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="مثال: فندق قصر الرافدين الدولي"
              required
            />
          </label>

          {/* City & Country */}
          <label className="ops-field">
            <span>المدينة</span>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="مثال: بغداد، النجف، كربلاء، القاهرة..."
            />
          </label>

          <label className="ops-field">
            <span>الدولة</span>
            <input
              type="text"
              value={country}
              onChange={e => setCountry(e.target.value)}
              placeholder="مثال: العراق، مصر، إيران..."
            />
          </label>

          {/* Stars */}
          <label className="ops-field">
            <span>تصنيف النجوم<span className="required-mark">*</span></span>
            <select
              value={stars}
              onChange={e => setStars(Number(e.target.value))}
            >
              <option value="5">★★★★★ (5 نجوم)</option>
              <option value="4">★★★★ (4 نجوم)</option>
              <option value="3">★★★ (3 نجوم)</option>
              <option value="2">★★ (نجمتان)</option>
              <option value="1">★ (نجمة واحدة)</option>
            </select>
          </label>

          {/* Times */}
          <label className="ops-field">
            <span>وقت الدخول</span>
            <input
              type="text"
              value={checkInTime}
              onChange={e => setCheckInTime(e.target.value)}
              placeholder="مثال: 14:00"
            />
          </label>

          <label className="ops-field">
            <span>وقت الخروج</span>
            <input
              type="text"
              value={checkOutTime}
              onChange={e => setCheckOutTime(e.target.value)}
              placeholder="مثال: 12:00"
            />
          </label>

          {/* Address */}
          <label className="ops-field wide">
            <span>العنوان التفصيلي</span>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="اسم الشارع أو المنطقة أو المعلم القريب"
            />
          </label>

          {/* Description */}
          <label className="ops-field wide">
            <span>وصف الفندق</span>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="اكتب نبذة عن الفندق والمرافق والموقع..."
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </label>

          {/* Cancellation Policy */}
          <label className="ops-field wide">
            <span>سياسة الإلغاء</span>
            <input
              type="text"
              value={cancellationPolicy}
              onChange={e => setCancellationPolicy(e.target.value)}
              placeholder="مثال: إلغاء مجاني حتى 48 ساعة قبل موعد الوصول"
            />
          </label>

          {/* Status Checkboxes */}
          <div className="ops-field wide" style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={published}
                onChange={e => setPublished(e.target.checked)}
              />
              <span>منشور للعملاء</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
              />
              <span>نشط في النظام</span>
            </label>
          </div>

          {/* Actions */}
          <div className="ops-form-actions wide" style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جاري الحفظ...' : isEditing ? 'حفظ التعديلات' : 'تأكيد وإضافة الفندق'}
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
}

export default CreateHotelModal;

