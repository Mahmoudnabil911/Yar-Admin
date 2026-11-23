import { uiLocale } from '../../i18n/prefs';
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/ConfirmDialog';
import { bookingsApi } from '../../services/api/bookingsApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

export function BookingDrawer({ bookingId, onOpenFinance, onNavigate }) {
  const toast = useToast();
  const confirm = useConfirm();

  const [errorMsg, setErrorMsg] = useState('');
  const [remoteRecord, setRemoteRecord] = useState(null);
  const booking = remoteRecord ? bookingsApi.mapRecordToRow(remoteRecord) : null;
  const isRemoteBooking = true;
  const [remoteTimeline, setRemoteTimeline] = useState([]);
  const [remoteNotes, setRemoteNotes] = useState([]);
  const [remoteStaff, setRemoteStaff] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteVoucher, setRemoteVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setRemoteLoading(true);
    Promise.allSettled([bookingsApi.getBooking(bookingId), bookingsApi.getTimeline(bookingId), bookingsApi.getNotes(bookingId), catalogAdminApi.getUsers()])
      .then(([record, timeline, notes, staff]) => {
        if (!active) return;
        if (record.status === 'fulfilled') setRemoteRecord(record.value);
        else setErrorMsg(record.reason?.ar || record.reason?.message || 'تعذر تحميل الحجز.');
        if (timeline.status === 'fulfilled') setRemoteTimeline(timeline.value);
        if (notes.status === 'fulfilled') setRemoteNotes(notes.value);
        if (staff.status === 'fulfilled') setRemoteStaff((staff.value.items || []).filter(user => ['admin', 'booking_employee'].includes(user.role) && user.active === true));
      })
      .finally(() => { if (active) setRemoteLoading(false); });
    return () => { active = false; };
  }, [bookingId]);
  useEffect(() => {
    if (remoteRecord) setAssignedId(remoteRecord.assigned_to == null ? '' : String(remoteRecord.assigned_to));
  }, [remoteRecord]);

  // State transition
  const allowedTransitions = useMemo(() => {
    if (!booking) return [];
    return {
      awaiting: ['processing', 'cancelled'],
      processing: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'issued', 'cancelled'],
      issued: [],
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

  // Follow-up & Assignment
  const [assignedId, setAssignedId] = useState(() => booking?.assignedId || '');
  const [followupNote, setFollowupNote] = useState('');

  if (!booking) return <div className="ops-note" role="status">{remoteLoading ? 'جاري تحميل بيانات الحجز...' : (errorMsg || 'تعذر تحميل الحجز.')}</div>;

  const b = { collected: Number(booking.collected_iqd) || 0, refunded: Number(booking.refunded_iqd) || 0, netCollected: (Number(booking.collected_iqd) || 0) - (Number(booking.refunded_iqd) || 0), balance: Number(booking.due_iqd) || 0, supplierPaid: 0 };
  const pStatus = b.balance <= 0 && Number(booking.total_iqd) > 0 ? 'paid' : 'pending';
  const currency = booking.currency || 'IQD';

  const numFormat = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0
  });
  const money = val => `${numFormat.format(Number(val) || 0)} ${currency === 'USD' ? '$' : 'د.ع'}`;

  // Eligible staff with bookings permission
  const eligibleStaff = remoteStaff;

  const handleReadVoucher = async () => {
    setVoucherLoading(true);
    setErrorMsg('');
    try {
      setRemoteVoucher(await bookingsApi.getVoucher(booking.rawId));
    } catch (err) {
      setErrorMsg(err.message || 'تعذر تحميل القسيمة.');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleTransition = async e => {
    e.preventDefault();
    setErrorMsg('');
    if (targetStatus === 'cancelled' || targetStatus === 'issued') {
      const ok = await confirm({
        title: 'تأكيد الإجراء',
        message: targetStatus === 'cancelled'
          ? 'سيُرسل طلب إلغاء الحجز إلى الخادم. تأكد من مراجعة حالة التحصيل والاسترداد.'
          : isRemoteBooking ? 'سيصدر الخادم قسيمة الحجز إذا استوفى شروط الإصدار.' : 'سيتم خصم تكلفة المورّد من رصيده مسبق الدفع.',
        danger: targetStatus === 'cancelled',
      });
      if (!ok) return;
    }
    try {
      if (isRemoteBooking) {
        let updatedRecord;
        if (targetStatus === 'issued') updatedRecord = await bookingsApi.issueBooking(booking.rawId);
        else if (targetStatus === 'cancelled') updatedRecord = await bookingsApi.cancelBooking(booking.rawId, transitionReason);
        else if (targetStatus === 'processing') updatedRecord = await bookingsApi.updateWorkflow(booking.rawId, 'processing');
        else if (targetStatus === 'confirmed') updatedRecord = await bookingsApi.updateWorkflow(booking.rawId, 'confirmed');
        else throw new Error('الحالة المطلوبة غير مدعومة.');
        setRemoteRecord(updatedRecord);
        setRemoteTimeline(await bookingsApi.getTimeline(booking.rawId));
        window.dispatchEvent(new CustomEvent('yar:bookings-updated'));
        toast(`تم تحديث حالة الحجز على الخادم إلى ${({ confirmed: 'مؤكد', ...M.statuses })[targetStatus] || targetStatus}.`);
        return;
      } else {
        throw new Error('الحالة المطلوبة غير مدعومة.');
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleSaveNoteAndAssign = async e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (isRemoteBooking && assignedId !== booking.assignedId) {
        if (!assignedId) throw new Error('إلغاء تعيين الموظف غير متاح من الـAPI.');
        const updatedRecord = await bookingsApi.assignBooking(booking.rawId, Number(assignedId));
        setRemoteRecord(updatedRecord);
        setAssignedId(String(updatedRecord.assigned_to || assignedId));
      }
      if (isRemoteBooking && followupNote.trim()) {
        await bookingsApi.addNote(booking.rawId, followupNote.trim());
        setRemoteNotes(await bookingsApi.getNotes(booking.rawId));
        setFollowupNote('');
      }
      if (isRemoteBooking) window.dispatchEvent(new CustomEvent('yar:bookings-updated'));
      toast(isRemoteBooking ? 'حُفظت المتابعة والإسناد على الخادم.' : 'حُفظت المتابعة والإسناد.');
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
          <span className={`status ${booking.status}`}>{({ confirmed: 'مؤكد', ...M.statuses })[booking.status] || booking.status}</span>
          <span className={`payment-status ${pStatus}`}>
            <span className="tiny-dot"></span>
            {{ paid: 'مدفوع', pending: 'بانتظار الدفع', review: 'قيد المراجعة' }[pStatus] || pStatus}
          </span>
        </div>
        <p style={{ margin: '4px 0', fontSize: 13, color: 'var(--ink)' }}>
          {M.services[booking.service] || booking.service} · مرجع الحجز {booking.reference}
        </p>
        <small style={{ color: 'var(--muted)', fontSize: 12 }}>
          رقم العميل: {booking.customer_id ?? '—'} · الهاتف: {booking.phone || '—'} · تاريخ الإنشاء: {booking.date || '—'}
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
          <div><span>السعر النهائي المحفوظ</span><strong><bdi>{money(booking.total_iqd)}</bdi></strong></div>
          <div><span>المحصّل</span><strong><bdi>{money(booking.collected_iqd)}</bdi></strong></div>
          <div><span>المسترد</span><strong><bdi>{money(booking.refunded_iqd)}</bdi></strong></div>
          <div><span>المتبقي</span><strong><bdi>{money(booking.due_iqd)}</bdi></strong></div>
          {booking.supplier_cost_usd != null && <div><span>تكلفة المورّد</span><strong><bdi>{Number(booking.supplier_cost_usd).toLocaleString('en-US')} USD</bdi></strong></div>}
          {booking.fx_rate_snapshot != null && <div><span>سعر الصرف المحفوظ</span><strong><bdi dir="ltr">1 USD = {Number(booking.fx_rate_snapshot).toLocaleString('en-US')} IQD · {booking.fx_date || '—'}</bdi></strong></div>}
        </div>
        <p className="ops-note" style={{ marginBottom: 12 }}>الأسعار والأرصدة مأخوذة من سجل الحجز في الخادم.</p>
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

      <section className="ops-section">
        <h3>تفاصيل الخدمة</h3>
        <dl className="ops-info" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, margin: '10px 0' }}>
          <div><dt>النوع</dt><dd>{booking.service_type}</dd></div>
          <div><dt>معرّف الخدمة</dt><dd>{booking.service_id ?? '—'}</dd></div>
          <div><dt>معرّف الخيار</dt><dd>{booking.service_option_id ?? '—'}</dd></div>
          <div><dt>معرّف سعر الغرفة</dt><dd>{booking.hotel_rate_id ?? '—'}</dd></div>
          <div><dt>تاريخ الوصول</dt><dd>{booking.checkin || '—'}</dd></div>
          <div><dt>تاريخ المغادرة</dt><dd>{booking.checkout || '—'}</dd></div>
          <div><dt>موعد الانطلاق</dt><dd>{booking.departure_at || '—'}</dd></div>
          <div><dt>موعد العودة</dt><dd>{booking.return_at || '—'}</dd></div>
          <div><dt>الكمية</dt><dd>{booking.quantity ?? '—'}</dd></div>
          <div><dt>البالغون / الأطفال</dt><dd>{booking.adults ?? '—'} / {booking.children ?? '—'}</dd></div>
          <div><dt>مرجع المزوّد</dt><dd>{booking.provider_reference || '—'}</dd></div>
          <div><dt>مرجع التذكرة</dt><dd>{booking.ticket_reference || '—'}</dd></div>
        </dl>
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
                  <option key={s} value={s}>{({ confirmed: 'مؤكد', ...M.statuses })[s] || s}</option>
                ))}
              </select>
            </label>

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
              {isRemoteBooking ? 'تطبيق الإجراء على الخادم' : 'تطبيق الإجراء المحلي'}
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
        {isRemoteBooking && booking.status === 'issued' && (
          <button type="button" className="button secondary" onClick={handleReadVoucher} disabled={voucherLoading}>
            {voucherLoading ? 'جاري تحميل القسيمة...' : 'عرض قسيمة الحجز'}
          </button>
        )}
        {remoteVoucher && <pre dir="auto" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(remoteVoucher, null, 2)}</pre>}
        <ol className="ops-timeline" style={{ paddingInlineStart: 16, margin: 0 }}>
          {(isRemoteBooking ? remoteTimeline : (booking.timeline || [])).slice().reverse().map((event, idx) => (
            <li key={event.id || idx} style={{ marginBottom: 12 }}>
              <strong style={{ display: 'block', fontSize: 12 }}>{event.note || event.body || event.state || event.action || 'تحديث حالة الحجز'}</strong>
              <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                <bdi>{new Date(event.at || event.created_at || event.createdAt || Date.now()).toLocaleString(uiLocale(), { timeZone: 'Asia/Baghdad' })}</bdi> · {event.staffName || event.actor_name || ''}
              </small>
            </li>
          ))}
        </ol>
        {remoteLoading && <p className="ops-note">جاري تحميل سجل الخادم...</p>}
        {isRemoteBooking && remoteNotes.length > 0 && <div style={{ marginTop: 14 }}><strong>ملاحظات داخلية</strong>{remoteNotes.map((note, index) => <p key={note.id || index} className="ops-note">{note.body || note.note || note.text}</p>)}</div>}
      </section>
    </div>
  );
}

export default BookingDrawer;

