import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { Drawer } from '../../components/ui/Drawer';
import { bookingsApi } from '../../services/api/bookingsApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

function toLocalDateTimeInput(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toLocalDateInput(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function CreateBookingModal({ isOpen, open, onClose, onCreated, onSuccess }) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();

  const [serviceType, setServiceType] = useState('package');
  const [customerId, setCustomerId] = useState('');

  // Available data from Odoo backend
  const [usersList, setUsersList] = useState([]);
  const [roomRates, setRoomRates] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [optionsList, setOptionsList] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [roomRatesError, setRoomRatesError] = useState('');
  const [catalogLoadError, setCatalogLoadError] = useState('');

  // Hotel specific fields
  const [hotelRateId, setHotelRateId] = useState('');
  const [checkin, setCheckin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDateInput(d);
  });
  const [checkout, setCheckout] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return toLocalDateInput(d);
  });

  // Services / Packages / Cars / Tours / Transfers
  const [serviceId, setServiceId] = useState('');
  const [serviceOptionId, setServiceOptionId] = useState('');
  const [departureAt, setDepartureAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    return toLocalDateTimeInput(d);
  });
  const [returnAt, setReturnAt] = useState('');

  // Common counters
  const [quantity, setQuantity] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch live catalog items and users when modal opens
  useEffect(() => {
    if (!isModalOpen) return;
    let cancelled = false;

    async function loadBackendData() {
      setIsLoadingCatalog(true);
      try {
        const [usersRes, ratesRes, servicesRes, optionsRes] = await Promise.allSettled([
          catalogAdminApi.getUsers(),
          catalogAdminApi.getRoomRates(),
          catalogAdminApi.getServices(),
          catalogAdminApi.getServiceOptions(),
        ]);

        if (!cancelled) {
          const failures = [usersRes, ratesRes, servicesRes, optionsRes].filter(result => result.status === 'rejected');
          setCatalogLoadError(failures.length ? 'تعذر تحميل بعض بيانات العملاء أو الخدمات. أعد المحاولة قبل إنشاء الحجز.' : '');
          if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.items)) {
            const verifiedCustomers = usersRes.value.items.filter(user => user.role === 'customer' && user.verified === true && user.active !== false);
            setUsersList(verifiedCustomers);
            setCustomerId(current => verifiedCustomers.some(user => String(user.id) === String(current)) ? current : '');
          }
          if (ratesRes.status === 'fulfilled' && Array.isArray(ratesRes.value?.items)) {
            const activeRates = ratesRes.value.items.filter(rate => rate.active !== false && rate.published !== false);
            setRoomRates(activeRates);
            setRoomRatesError('');
            setHotelRateId(current => activeRates.some(rate => String(rate.id) === String(current)) ? current : '');
          } else if (ratesRes.status === 'rejected') {
            setRoomRates([]);
            setHotelRateId('');
            setRoomRatesError(ratesRes.reason instanceof Error ? ratesRes.reason.message : 'تعذر تحميل أسعار الغرف.');
          }
          if (servicesRes.status === 'fulfilled' && Array.isArray(servicesRes.value?.items)) {
            setServicesList(servicesRes.value.items);
          }
          if (optionsRes.status === 'fulfilled' && Array.isArray(optionsRes.value?.items)) {
            setOptionsList(optionsRes.value.items);
          }
        }
      } catch (err) {
        console.warn('Could not load backend options:', err);
      } finally {
        if (!cancelled) setIsLoadingCatalog(false);
      }
    }

    loadBackendData();
    return () => { cancelled = true; };
  }, [isModalOpen]);

  // Update selected serviceId when serviceType changes
  useEffect(() => {
    const matching = servicesList.filter(s => s.service_type === serviceType && s.active !== false && s.published !== false);
    setServiceId(current => matching.some(service => String(service.id) === String(current)) ? current : '');
  }, [serviceType, servicesList]);

  if (!isModalOpen) return null;

  const handleReloadRoomRates = async () => {
    setIsLoadingCatalog(true);
    setRoomRatesError('');
    try {
      const result = await catalogAdminApi.getRoomRates(undefined, true);
      const activeRates = (result.items || []).filter(rate => rate.active !== false && rate.published !== false);
      setRoomRates(activeRates);
      setHotelRateId('');
    } catch (err) {
      setRoomRatesError(err instanceof Error ? err.message : 'تعذر تحميل أسعار الغرف.');
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const payload = {
        service_type: serviceType,
        quantity: Math.max(1, Number(quantity) || 1),
        adults: Math.max(1, Number(adults) || 1),
        children: Math.max(0, Number(children) || 0),
      };

      if (customerId && customerId.trim()) {
        const parsedCust = parseInt(customerId.trim(), 10);
        if (!isNaN(parsedCust) && parsedCust > 0) {
          if (!usersList.some(user => String(user.id) === String(parsedCust))) {
            throw new Error('اختر عميلاً موثقاً من القائمة أو اترك الحقل فارغاً.');
          }
          payload.customer_id = parsedCust;
        }
      }

      if (serviceType === 'hotel') {
        if (!roomRates.some(rate => String(rate.id) === String(hotelRateId))) throw new Error('اختر سعر غرفة موجوداً من القائمة أو أعد تحميل أسعار الغرف.');
        if (!checkin || !checkout) throw new Error('يرجى تحديد تاريخ الوصول والمغادرة.');
        if (checkin >= checkout) throw new Error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول.');
        
        payload.hotel_rate_id = parseInt(hotelRateId, 10);
        payload.checkin = checkin;
        payload.checkout = checkout;
      } else {
        if (!serviceId) throw new Error('يرجى اختيار الخدمة المطلوبة.');
        if (!departureAt) throw new Error('يرجى تحديد موعد الانطلاق.');
        if (returnAt && returnAt <= departureAt) {
          throw new Error('موعد العودة يجب أن يكون بعد موعد الانطلاق.');
        }

        payload.service_id = parseInt(serviceId, 10);
        payload.departure_at = departureAt;
        if (serviceOptionId && serviceOptionId.trim()) {
          payload.service_option_id = parseInt(serviceOptionId, 10);
        }
        if (returnAt && returnAt.trim()) {
          payload.return_at = returnAt;
        }
      }

      // Execute live creation via API 039
      const createdRecord = await bookingsApi.createBooking(payload);

      toast(`تم إنشاء الحجز على السيرفر بنجاح برقم ${createdRecord.reference || createdRecord.id}.`);
      window.dispatchEvent(new CustomEvent('yar:bookings-updated', { detail: createdRecord }));
      (onSuccess || onCreated)?.(createdRecord);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال الحجز إلى الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const matchingServices = servicesList.filter(s => s.service_type === serviceType && s.active !== false && s.published !== false);
  const matchingOptions = optionsList.filter(o => String(o.service_id) === String(serviceId) && o.active !== false && o.published !== false);

  const serviceTypeLabels = {
    package: 'باقة سفر متكاملة',
    tour: 'جولة سياحية',
    transfer: 'نقل واستقبال',
    car: 'تأجير سيارة',
    hotel: 'حجز فندقي',
  };

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow="حجز جديد"
      title="إدخال حجز جديد"
    >
      <div className="ops-create-modal" style={{ padding: '4px 0' }}>
        <p className="ops-note" style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: 'var(--muted)' }}>
          يتم تسجيل الحجز مباشرة في قاعدة البيانات، وتُحسب الأسعار وسعر صرف العملات والخصومات آلياً.
        </p>

        {errorMsg && (
          <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--c-ef4444)', borderRadius: 8, color: 'var(--c-ef4444)', fontSize: 13 }}>
            <strong>خطأ: </strong> {errorMsg}
          </div>
        )}
        {catalogLoadError && <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>{catalogLoadError}</div>}

        <form className="ops-form-grid" onSubmit={handleSubmit}>
          {/* Service Type */}
          <label className="ops-field wide">
            <span>نوع الخدمة<span className="required-mark">*</span></span>
            <select
              value={serviceType}
              onChange={e => setServiceType(e.target.value)}
              style={{ fontWeight: 600 }}
            >
              <option value="package">باقة سفر متكاملة</option>
              <option value="hotel">حجز فندقي</option>
              <option value="tour">جولة سياحية</option>
              <option value="transfer">نقل واستقبال</option>
              <option value="car">تأجير سيارة</option>
            </select>
          </label>

          {/* Customer Dropdown */}
          <label className="ops-field wide">
            <span>حساب العميل (اختياري)</span>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
            >
              <option value="">حجز مباشر باسم الإدارة (افتراضي)</option>
              {usersList.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
              يمكنك اختيار حساب عميل مسجل، أو تركه باسم الإدارة.
            </small>
          </label>

          {/* Hotel Specific Fields */}
          {serviceType === 'hotel' ? (
            <>
              <div className="ops-field wide" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>سعر الغرفة<span className="required-mark">*</span></span>
                </div>

                {roomRates.length > 0 ? (
                  <select
                    value={hotelRateId}
                    onChange={e => setHotelRateId(e.target.value)}
                    required
                  >
                    <option value="">-- اختر الغرفة من القائمة --</option>
                    {roomRates.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name || 'غرفة فندقية'} {r.price_usd ? `(${r.price_usd} دولار)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <small style={{ color: 'var(--c-ef4444)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      {roomRatesError || 'لا توجد أسعار غرف محمّلة. يجب اختيار سعر غرفة موجود على الخادم؛ لا يمكن إدخال رقم يدوي.'}
                    </small>
                    {roomRatesError && <button type="button" className="quiet-button" onClick={handleReloadRoomRates} disabled={isLoadingCatalog}>
                      {isLoadingCatalog ? 'جاري إعادة التحميل...' : 'إعادة تحميل أسعار الغرف'}
                    </button>}
                  </div>
                )}
              </div>

              <label className="ops-field">
                <span>تاريخ الوصول<span className="required-mark">*</span></span>
                <input
                  type="date"
                  value={checkin}
                  onChange={e => setCheckin(e.target.value)}
                  required
                />
              </label>

              <label className="ops-field">
                <span>تاريخ المغادرة<span className="required-mark">*</span></span>
                <input
                  type="date"
                  value={checkout}
                  onChange={e => setCheckout(e.target.value)}
                  required
                />
              </label>
            </>
          ) : (
            /* Service / Package / Tour / Transfer / Car Fields */
            <>
              <div className="ops-field wide" style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>الخدمة المطلوبة<span className="required-mark">*</span></span>
                </div>

                {matchingServices.length > 0 ? (
                  <select
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                    required
                  >
                    <option value="">-- اختر الخدمة من القائمة --</option>
                    {matchingServices.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.city ? `· ${s.city}` : ''} {s.price_usd ? `(${s.price_usd} دولار)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <small style={{ color: 'var(--c-ef4444)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      لا توجد خدمة نشطة من نوع «{serviceTypeLabels[serviceType]}» في الخادم. أضف الخدمة من إدارة الخدمات ثم أعد المحاولة.
                    </small>
                  </div>
                )}
              </div>

              {/* Service Option Dropdown */}
              <label className="ops-field wide">
                <span>الخيارات الإضافية (اختياري)</span>
                {matchingOptions.length > 0 ? (
                  <select
                    value={serviceOptionId}
                    onChange={e => setServiceOptionId(e.target.value)}
                  >
                    <option value="">بدون خيارات إضافية (افتراضي)</option>
                    {matchingOptions.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} {o.price_usd ? `(+${o.price_usd} دولار)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="ops-note">لا توجد خيارات نشطة لهذه الخدمة.</span>
                )}
              </label>

              <label className="ops-field">
                <span>موعد الانطلاق<span className="required-mark">*</span></span>
                <input
                  type="datetime-local"
                  value={departureAt}
                  onChange={e => setDepartureAt(e.target.value)}
                  required
                />
              </label>

              <label className="ops-field">
                <span>موعد العودة (اختياري)</span>
                <input
                  type="datetime-local"
                  value={returnAt}
                  min={departureAt || undefined}
                  onChange={e => setReturnAt(e.target.value)}
                />
              </label>
            </>
          )}

          {/* Counts */}
          <label className="ops-field">
            <span>{serviceType === 'hotel' ? 'عدد الغرف' : 'الكمية'}<span className="required-mark">*</span></span>
            <input
              type="number"
              min="1"
              max="20"
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value))}
              required
            />
          </label>

          <label className="ops-field">
            <span>عدد البالغين<span className="required-mark">*</span></span>
            <input
              type="number"
              min="1"
              max="50"
              value={adults}
              onChange={e => setAdults(Number(e.target.value))}
              required
            />
          </label>

          <label className="ops-field wide">
            <span>عدد الأطفال</span>
            <input
              type="number"
              min="0"
              max="20"
              value={children}
              onChange={e => setChildren(Number(e.target.value))}
            />
          </label>

          {/* Submit Buttons */}
          <div className="ops-form-actions wide" style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
              disabled={isSubmitting || Boolean(catalogLoadError)}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ الحجز'}
            </button>
          </div>
        </form>
      </div>
    </Drawer>
  );
}

export default CreateBookingModal;
