import { uiLocale } from '../../i18n/prefs';
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { staffStorage } from '../../services/storage/staffStorage';
import { operationsModel as M, supplierCreditModel as C } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import HotelOfferSnapshot from '../hotels/HotelOfferSnapshot';

const serviceSchemas = {
  flight: { origin: 'مدينة المغادرة', destination: 'مدينة الوصول', carrier: 'شركة الطيران', cabin: 'درجة السفر', travelDate: 'تاريخ الذهاب', returnDate: 'تاريخ العودة (اختياري)' },
  hotel: { hotelName: 'الفندق', checkIn: 'الوصول', checkOut: 'المغادرة', rooms: 'أنواع الغرف وتوزيع الأشخاص' },
  package: { packageName: 'اسم الباقة / الفندق', nights: 'عدد الليالي', travelDate: 'تاريخ السفر' },
  transfer: { vehicle: 'السيارة', pickup: 'نقطة الاستقبال / خدمة الاستقبال والتوديع', travelDate: 'التاريخ', passengers: 'عدد الركاب' },
  tour: { tourName: 'الجولة', pickup: 'نقطة الانطلاق', travelDate: 'التاريخ', passengers: 'عدد الأشخاص' }
};

export function BookingDrawer({ bookingId, onOpenFinance, onNavigate }) {
  const toast = useToast();
  const confirm = useConfirm();
  const booking = operationsStorage.getBooking(bookingId);
  const providers = catalogStorage.getRecords('providers');
  const staffList = staffStorage.getStaff();
  const ledger = operationsStorage.getCreditLedger();

  const [errorMsg, setErrorMsg] = useState('');

  // Editable service details
  const [providerId, setProviderId] = useState(() => booking?.providerId || '');
  const [route, setRoute] = useState(() => booking?.route || '');
  const [detail, setDetail] = useState(() => booking?.detail || '');
  const [reference, setReference] = useState(() => booking?.reference || '');
  const [serviceInfo, setServiceInfo] = useState(() => booking?.serviceInfo || {});
  const [travellersText, setTravellersText] = useState(() => {
    return (booking?.travellers || []).map(p => p.name + (p.passport ? ' | ' + p.passport : '')).join('\n');
  });

  // State transition
  const allowedTransitions = useMemo(() => {
    if (!booking) return [];
    return {
      awaiting: ['processing', 'cancelled'],
      processing: ['issued', 'cancelled'],
      issued: ['cancelled'],
      cancelled: []
    }[booking.status] || [];
  }, [booking]);

  const [targetStatus, setTargetStatus] = useState(() => allowedTransitions[0] || '');
  // Keep the selected next action valid after a status change.
  useEffect(() => {
    if (!allowedTransitions.includes(targetStatus)) setTargetStatus(allowedTransitions[0] || '');
  }, [allowedTransitions, targetStatus]);
  const [transitionReason, setTransitionReason] = useState('');
  const [cancellationAck, setCancellationAck] = useState(false);

  // Supplier credit issue inputs
  // New bookings carry a USD supplier net; supplier deductions use it. Older bookings keep their original behaviour.
  const [creditCurrency, setCreditCurrency] = useState(() => booking?.supplierNet ? 'USD' : (booking?.currency || 'USD'));
  const [creditAmount, setCreditAmount] = useState(() => booking?.supplierNet?.amount ?? booking?.pricing?.cost ?? '');
  const [confirmCurrencyDiff, setConfirmCurrencyDiff] = useState(false);

  // Follow-up & Assignment
  const [assignedId, setAssignedId] = useState(() => booking?.assignedId || '');
  const [followupNote, setFollowupNote] = useState('');

  if (!booking) return null;

  const b = M.balances(booking);
  const pStatus = booking.payment || (M.paymentStatus(booking) === 'paid' ? 'paid' : 'pending');
  const currency = booking.currency || 'IQD';
  const isEditable = ['awaiting', 'processing'].includes(booking.status);

  const numFormat = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0
  });
  const money = val => `${numFormat.format(Number(val) || 0)} ${currency === 'USD' ? '$' : 'د.ع'}`;

  // Eligible providers for this service
  const serviceProviders = providers.filter(p =>
    p.status === 'published' &&
    p.operatingEnabled !== false &&
    (p.serviceType === booking.service || (booking.service === 'tour' && p.serviceType === 'transfer'))
  );

  // Eligible staff with bookings permission
  const eligibleStaff = staffList.filter(s =>
    s.status === 'active' && (s.role === 'admin' || (s.permissions || []).includes('bookings'))
  );

  const handleSaveDetails = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const travellers = travellersText.split(/\r?\n/).map(v => v.trim()).filter(Boolean).map(v => {
        const [name, passport = ''] = v.split('|');
        return { name: name.trim(), passport: passport.trim() };
      });

      operationsStorage.updateDetails(booking.id, {
        providerId,
        route,
        detail,
        reference,
        serviceInfo,
        travellers
      });
      toast('حُفظت تفاصيل الخدمة.');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleTransition = async e => {
    e.preventDefault();
    setErrorMsg('');
    if (targetStatus === 'cancelled' || targetStatus === 'issued') {
      const ok = await confirm({
        title: 'تأكيد الإجراء',
        message: targetStatus === 'cancelled'
          ? 'إلغاء الحجز لا يسترد أموال العميل ولا يعيد رصيد المورّد تلقائيًا.'
          : 'سيتم خصم تكلفة المورّد من رصيده مسبق الدفع.',
        danger: targetStatus === 'cancelled',
      });
      if (!ok) return;
    }
    try {
      if (targetStatus === 'issued') {
        // Run issue with supplier credit debit
        operationsStorage.issueWithSupplierCredit(booking.id, {
          currency: creditCurrency,
          amount: Number(creditAmount),
          confirmCurrency: confirmCurrencyDiff
        });
        toast('تم تأكيد وإصدار الطلب وخصم تكلفة المزوّد.');
      } else {
        operationsStorage.transitionStatus(booking.id, targetStatus, {
          reason: transitionReason,
          confirmPaidCancellation: cancellationAck
        });
        toast(`تم تغيير حالة الطلب إلى ${M.statuses[targetStatus] || targetStatus}.`);
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveNoteAndAssign = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (assignedId !== booking.assignedId) {
        operationsStorage.assignStaff(booking.id, assignedId);
      }
      if (followupNote.trim()) {
        operationsStorage.addNote(booking.id, followupNote.trim());
        setFollowupNote('');
      }
      toast('حُفظت المتابعة والإسناد.');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="ops-booking-drawer">
      {/* Header */}
      <div className="ops-detail-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>{booking.customer}</h3>
          <span style={{ fontSize: 12, color: 'var(--muted)', direction: 'ltr' }}>{booking.id}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '6px 0', alignItems: 'center' }}>
          <span className={`status ${booking.status}`}>{M.statuses[booking.status] || booking.status}</span>
          <span className={`payment-status ${pStatus}`}>
            <span className="tiny-dot"></span>
            {{ paid: 'مدفوع', pending: 'بانتظار الدفع', review: 'قيد المراجعة' }[pStatus] || pStatus}
          </span>
        </div>
        <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--ink)' }}>
          {M.services[booking.service] || booking.service} · {booking.route}
        </p>
        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
          المصدر: {{ app: 'تطبيق YAR', whatsapp: 'واتساب', office: 'المكتب' }[booking.source] || booking.source} · هاتف: {booking.phone} · تاريخ: {booking.date}
        </small>
      </div>

      {errorMsg && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      {/* Pricing Snapshot */}
      <section className="ops-section">
        <h3>لقطة السعر المحفوظة</h3>
        <div className="ops-money-lines" style={{ marginBottom: 12 }}>
          {booking.supplierNet && (
            <>
              <div>
                <span>صافي المورّد</span>
                <strong><bdi>{Number(booking.supplierNet.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</bdi></strong>
              </div>
              <div>
                <span>سعر التحويل المحفوظ</span>
                <strong><bdi dir="ltr">1 $ = {Number(booking.supplierNet.rate).toLocaleString('en-US')} د.ع · {booking.supplierNet.rateDate}</bdi></strong>
              </div>
            </>
          )}
          <div>
            <span>{booking.supplierNet ? 'تكلفة المورّد بالدينار' : 'تكلفة المزوّد'}</span>
            <strong><bdi>{money(booking.pricing.cost)}</bdi></strong>
          </div>
          <div>
            <span>الزيادة المحفوظة</span>
            <strong><bdi>{money(booking.pricing.markupAmount)}</bdi></strong>
          </div>
          <div>
            <span>السعر الأصلي</span>
            <strong><bdi>{money(booking.pricing.original)}</bdi></strong>
          </div>
          <div>
            <span>الخصم المطبق</span>
            <strong><bdi>{money(booking.pricing.discountAmount)}</bdi></strong>
          </div>
          <div>
            <span>السعر النهائي للبيع</span>
            <strong style={{ color: 'var(--c-2b5028)', fontSize: 14 }}><bdi>{money(booking.amount)}</bdi></strong>
          </div>
          <div>
            <span>الهامش النظري</span>
            <strong style={{ color: booking.pricing.margin >= 0 ? 'var(--c-3b6632)' : 'var(--c-924b42)' }}>
              <bdi>{money(booking.pricing.margin)}</bdi>
            </strong>
          </div>
        </div>
        <p className="ops-note" style={{ marginBottom: 12 }}>
          القاعدة المطبقة: {booking.pricing.ruleLabel || 'تسعير يدوي محفوظ وقت إنشاء الطلب'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button primary"
            onClick={onOpenFinance}
          >
            تفاصيل الدفع
          </button>
        </div>
      </section>

      {/* Service Details */}
      <section className="ops-section">
        <h3>تفاصيل الخدمة</h3>
        <p style={{ margin: '4px 0', fontSize: 13 }}>{booking.detail}</p>
        <p style={{ margin: '4px 0 12px 0', fontSize: 12, color: 'var(--muted)' }}>
          المزوّد: <strong>{booking.provider}</strong> · مرجع التأكيد: <bdi>{booking.reference || 'غير محدد'}</bdi>
        </p>

        {booking.service === 'hotel' && <HotelOfferSnapshot offer={booking.serviceInfo?.hotelOffer} />}
        {isEditable ? (
          <form className="ops-form-grid" onSubmit={handleSaveDetails}>
            <label className="ops-field wide">
              <span>المزوّد (مراجعة عند التأكيد)</span>
              <select value={providerId} onChange={e => setProviderId(e.target.value)}>
                <option value="">اختر المزوّد</option>
                {serviceProviders.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label className="ops-field wide">
              <span>المسار</span>
              <input
                type="text"
                value={route}
                onChange={e => setRoute(e.target.value)}
                required
              />
            </label>

            <label className="ops-field wide">
              <span>تفاصيل الطلب</span>
              <textarea
                rows="2"
                value={detail}
                onChange={e => setDetail(e.target.value)}
                required
              />
            </label>

            <label className="ops-field wide">
              <span>مرجع التأكيد / PNR</span>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="رقم الحجز أو PNR"
              />
            </label>

            {/* Service-specific schema fields */}
            {Object.entries(serviceSchemas[booking.service] || {}).map(([key, label]) => (
              <label className="ops-field" key={key}>
                <span>{label}</span>
                <input
                  type={/Date$|checkIn|checkOut/.test(key) ? 'date' : 'text'}
                  value={serviceInfo[key] || ''}
                  onChange={e => setServiceInfo({ ...serviceInfo, [key]: e.target.value })}
                />
              </label>
            ))}

            <label className="ops-field wide">
              <span>المسافرون · اسم | جواز تجريبي، كل مسافر بسطر</span>
              <textarea
                rows="3"
                value={travellersText}
                onChange={e => setTravellersText(e.target.value)}
                placeholder="أحمد علي | DEMO123&#10;نور كريم | DEMO124"
              />
            </label>

            <button type="submit" className="button secondary wide">
              حفظ التفاصيل دون تغيير السعر
            </button>
          </form>
        ) : (
          <div>
            <dl className="ops-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, margin: '10px 0' }}>
              {Object.entries(serviceSchemas[booking.service] || {}).map(([k, l]) => (
                <div key={k}>
                  <dt style={{ color: 'var(--muted)' }}>{l}:</dt>
                  <dd style={{ margin: 0, fontWeight: 500 }}>{serviceInfo[k] || 'غير مسجل في المثال'}</dd>
                </div>
              ))}
            </dl>
            <div style={{ fontSize: 12, marginTop: 8 }}>
              <strong>المسافرون:</strong>
              {booking.travellers?.length > 0 ? (
                booking.travellers.map((p, idx) => (
                  <div key={idx} style={{ color: 'var(--ink)' }}>
                    {p.name} {p.passport && `· جواز: ${p.passport}`}
                  </div>
                ))
              ) : (
                <p className="ops-note">تفاصيل المسافرين غير مرفقة في سجل المثال القديم.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Status Transition */}
      {allowedTransitions.length > 0 && (
        <section className="ops-section">
          <h3>معالجة الحالة</h3>
          <form className="ops-form-grid" onSubmit={handleTransition}>
            <label className="ops-field wide">
              <span>الإجراء التالي</span>
              <select value={targetStatus} onChange={e => setTargetStatus(e.target.value)}>
                {allowedTransitions.map(s => (
                  <option key={s} value={s}>{M.statuses[s] || s}</option>
                ))}
              </select>
            </label>

            {targetStatus === 'issued' && (
              <div className="wide" style={{ border: '1px solid var(--c-c9d8c4)', padding: 12, borderRadius: 8, background: 'var(--c-f5f9f3)', marginBottom: 10 }}>
                <strong style={{ fontSize: 12, color: 'var(--c-2d4d24)', display: 'block', marginBottom: 8 }}>
                  خصم تكلفة المزوّد من الرصيد مسبق الدفع
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label className="ops-field">
                    <span>عملة خصم المورّد</span>
                    {booking.supplierNet ? (
                      <input value="USD" readOnly dir="ltr" />
                    ) : (
                      <select value={creditCurrency} onChange={e => setCreditCurrency(e.target.value)}>
                        <option value="USD">USD</option>
                        <option value="IQD">IQD</option>
                      </select>
                    )}
                  </label>
                  <label className="ops-field">
                    <span>المبلغ المخصوم من الرصيد</span>
                    <input
                      type="number"
                      step="any"
                      value={creditAmount}
                      onChange={e => setCreditAmount(e.target.value)}
                      required
                    />
                  </label>
                </div>
                {booking.supplierNet && <p className="ops-note">يُخصم صافي المورّد بالدولار من رصيد المورّد؛ سعر العميل يبقى بالدينار.</p>}
                {!booking.supplierNet && creditCurrency !== booking.currency && (
                  <label className="ops-field wide" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={confirmCurrencyDiff}
                      onChange={e => setConfirmCurrencyDiff(e.target.checked)}
                      required
                    />
                    <span style={{ fontSize: 12 }}>أكّد قيمة الخصم بعملة المورّد؛ لا يوجد تحويل عملة تلقائي.</span>
                  </label>
                )}
              </div>
            )}

            {targetStatus === 'cancelled' && (
              <>
                <label className="ops-field wide">
                  <span>سبب الإلغاء</span>
                  <textarea
                    rows="2"
                    value={transitionReason}
                    onChange={e => setTransitionReason(e.target.value)}
                    required
                  />
                </label>
                {(b.collected > 0 || b.supplierPaid > 0) && (
                  <label className="ops-field wide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={cancellationAck}
                      onChange={e => setCancellationAck(e.target.checked)}
                      required
                    />
                    <span style={{ fontSize: 12 }}>
                      راجعت التحصيل ورصيد المورّد؛ الإلغاء لا يعيد الأموال أو الرصيد تلقائيًا.
                    </span>
                  </label>
                )}
              </>
            )}

            <button type="submit" className="button primary wide">
              تطبيق الإجراء المحلي
            </button>
          </form>
        </section>
      )}

      {/* Assignment & Follow-up */}
      <section className="ops-section">
        <h3>الإسناد والمتابعة</h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px 0' }}>
          المسؤول الحالي: <strong>{booking.assigned || 'غير مسند'}</strong>
        </p>

        <form className="ops-form-grid" onSubmit={handleSaveNoteAndAssign}>
          <label className="ops-field wide">
            <span>موظف نشط بصلاحية الحجوزات</span>
            <select value={assignedId} onChange={e => setAssignedId(e.target.value)}>
              <option value="">غير مسند</option>
              {eligibleStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </label>

          <label className="ops-field wide">
            <span>ملاحظة متابعة جديدة</span>
            <textarea
              rows="2"
              value={followupNote}
              onChange={e => setFollowupNote(e.target.value)}
              placeholder="اكتب ملاحظة لفريق المتابعة..."
            />
          </label>

          <button type="submit" className="button secondary wide">
            حفظ المتابعة
          </button>
        </form>
      </section>

      {/* Timeline */}
      <section className="ops-section">
        <h3>سجل المتابعة</h3>
        <ol className="ops-timeline" style={{ paddingInlineStart: 16, margin: 0 }}>
          {booking.timeline.slice().reverse().map(event => (
            <li key={event.id} style={{ marginBottom: 12 }}>
              <strong style={{ display: 'block', fontSize: 12 }}>{event.note}</strong>
              <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                <bdi>{new Date(event.at).toLocaleString(uiLocale(), { timeZone: 'Asia/Baghdad' })}</bdi> · {event.staffName}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export default BookingDrawer;

