import React, { useState, useEffect } from 'react';
import { useToast } from '../../components/ui/Toast';
import { Drawer } from '../../components/ui/Drawer';
import { bookingsApi } from '../../services/api/bookingsApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

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
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  // Hotel specific fields
  const [hotelRateId, setHotelRateId] = useState('');
  const [checkin, setCheckin] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [checkout, setCheckout] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  });

  // Services / Packages / Cars / Tours / Transfers
  const [serviceId, setServiceId] = useState('');
  const [serviceOptionId, setServiceOptionId] = useState('');
  const [departureAt, setDepartureAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(9, 0, 0, 0);
    return d.toISOString().slice(0, 16);
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
          if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value?.items)) {
            setUsersList(usersRes.value.items);
          }
          if (ratesRes.status === 'fulfilled' && Array.isArray(ratesRes.value?.items)) {
            setRoomRates(ratesRes.value.items);
            if (ratesRes.value.items.length > 0 && !hotelRateId) {
              setHotelRateId(String(ratesRes.value.items[0].id));
            }
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
    const matching = servicesList.filter(s => s.service_type === serviceType);
    if (matching.length > 0) {
      setServiceId(String(matching[0].id));
    } else {
      setServiceId('');
    }
  }, [serviceType, servicesList]);

  if (!isModalOpen) return null;

  // Quick helper to seed a demo hotel and room rate in Odoo
  const handleCreateDemoHotel = async () => {
    setIsCreatingDemo(true);
    setErrorMsg('');
    try {
      const hotel = await catalogAdminApi.createHotel({
        name: 'فندق قصر يار التجريبي',
        city: 'بغداد',
        country: 'العراق',
        stars: 5,
      });

      const rate = await catalogAdminApi.createRoomRate({
        room_id: hotel.id,
        name: 'غرفة ديلوكس مزدوجة مع إفطار',
        meal_plan: 'BB',
        price_usd: 120,
        supplier_cost_usd: 80,
      });

      toast(`تم إنشاء فندق وسعر غرفة جديد على السيرفر برقم #${rate.id}`);
      setRoomRates(prev => [rate, ...prev]);
      setHotelRateId(String(rate.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل إنشاء فندق تجريبي على السيرفر.');
    } finally {
      setIsCreatingDemo(false);
    }
  };

  // Quick helper to seed a demo service in Odoo
  const handleCreateDemoService = async () => {
    setIsCreatingDemo(true);
    setErrorMsg('');
    try {
      const serviceNames = {
        package: 'باقة اكتشاف العراق وسامراء 4 أيام',
        tour: 'جولة سياحية تاريخية في بغداد',
        transfer: 'استقبال وتوديع مطار بغداد الدولي',
        car: 'تأجير سيارة دفع رباعي مع سائق',
      };
      const name = serviceNames[serviceType] || 'خدمة سياحية تجريبية';

      const newService = await catalogAdminApi.createService({
        name,
        service_type: serviceType,
        city: 'بغداد',
        price_usd: 150,
        supplier_cost_usd: 100,
      });

      toast(`تم إنشاء ${name} على السيرفر برقم #${newService.id}`);
      setServicesList(prev => [newService, ...prev]);
      setServiceId(String(newService.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل إنشاء خدمة تجريبية على السيرفر.');
    } finally {
      setIsCreatingDemo(false);
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
          payload.customer_id = parsedCust;
        }
      }

      if (serviceType === 'hotel') {
        if (!hotelRateId) throw new Error('يرجى اختيار سعر الغرفة.');
        if (!checkin || !checkout) throw new Error('يرجى تحديد تاريخ الوصول والمغادرة.');
        if (checkin >= checkout) throw new Error('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول.');
        
        payload.hotel_rate_id = parseInt(hotelRateId, 10);
        payload.checkin = checkin;
        payload.checkout = checkout;
      } else {
        if (!serviceId) throw new Error('يرجى اختيار الخدمة المطلوبة.');
        if (!departureAt) throw new Error('يرجى تحديد موعد الانطلاق.');

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
      window.dispatchEvent(new CustomEvent('yar:bookings-updated'));
      (onSuccess || onCreated)?.(createdRecord);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء إرسال الحجز إلى الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const matchingServices = servicesList.filter(s => s.service_type === serviceType);
  const matchingOptions = optionsList.filter(o => String(o.service_id) === String(serviceId));

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

        <form className="ops-form-grid" onSubmit={handleSubmit}>
          {/* Service Type */}
          <label className="ops-field wide">
            <span>نوع الخدمة *</span>
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
              {usersList.map(u => {
                const roleLabel = u.role === 'admin' ? 'مدير' : u.role === 'employee' ? 'موظف' : 'عميل';
                return (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.phone ? `(${u.phone})` : ''} · {roleLabel}
                  </option>
                );
              })}
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
                  <span style={{ fontWeight: 600 }}>سعر الغرفة *</span>
                  {roomRates.length === 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={handleCreateDemoHotel}
                      disabled={isCreatingDemo}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      {isCreatingDemo ? 'جاري الإضافة...' : '+ إضافة فندق تجريبي'}
                    </button>
                  )}
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
                    <input
                      type="number"
                      min="1"
                      value={hotelRateId}
                      onChange={e => setHotelRateId(e.target.value)}
                      placeholder="أدخل معرّف سعر الغرفة أو اضغط الزر للإضافة"
                      required
                    />
                    <small style={{ color: 'var(--c-ef4444)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      لا توجد غرف مسجلة حالياً. اضغط على الزر أعلاه لإضافة غرفة تجريبية بنقرة واحدة.
                    </small>
                  </div>
                )}
              </div>

              <label className="ops-field">
                <span>تاريخ الوصول *</span>
                <input
                  type="date"
                  value={checkin}
                  onChange={e => setCheckin(e.target.value)}
                  required
                />
              </label>

              <label className="ops-field">
                <span>تاريخ المغادرة *</span>
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
                  <span style={{ fontWeight: 600 }}>الخدمة المطلوبة *</span>
                  {matchingServices.length === 0 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={handleCreateDemoService}
                      disabled={isCreatingDemo}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      {isCreatingDemo ? 'جاري الإضافة...' : `+ إضافة ${serviceTypeLabels[serviceType]} تجريبية`}
                    </button>
                  )}
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
                    <input
                      type="number"
                      min="1"
                      value={serviceId}
                      onChange={e => setServiceId(e.target.value)}
                      placeholder="أدخل معرّف الخدمة أو اضغط الزر للإضافة"
                      required
                    />
                    <small style={{ color: 'var(--c-ef4444)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      لا توجد خدمات من نوع «{serviceTypeLabels[serviceType]}» مسجلة حالياً. اضغط الزر أعلاه لإضافتها فوراً.
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
                  <input
                    type="number"
                    min="1"
                    value={serviceOptionId}
                    onChange={e => setServiceOptionId(e.target.value)}
                    placeholder="اختياري: أدخل رقم الخيار أو اتركه فارغاً"
                  />
                )}
              </label>

              <label className="ops-field">
                <span>موعد الانطلاق *</span>
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
                  onChange={e => setReturnAt(e.target.value)}
                />
              </label>
            </>
          )}

          {/* Counts */}
          <label className="ops-field">
            <span>{serviceType === 'hotel' ? 'عدد الغرف' : 'الكمية'} *</span>
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
            <span>عدد البالغين *</span>
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
              disabled={isSubmitting}
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
