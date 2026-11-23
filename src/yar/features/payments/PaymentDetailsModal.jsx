import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { can } from '../../auth/access';
import { bookingsApi } from '../../services/api/bookingsApi';
import { financeApi } from '../../services/api/financeApi';
import { NumberInput } from '../../components/ui/NumberInput';

const money = value => `${new Intl.NumberFormat('en-US').format(Number(value) || 0)} د.ع`;
const stateLabel = state => ({ pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', paid: 'تم الصرف' }[state] || state || '—');

export function PaymentDetailsModal({ bookingId, onBackToBooking }) {
  const toast = useToast();
  const [booking, setBooking] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('office');
  const [paymentReference, setPaymentReference] = useState('');
  const [reviewNotes, setReviewNotes] = useState({});
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundReferences, setRefundReferences] = useState({});
  const canRefund = can('payment.refund');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [record, receiptRows, refundRows] = await Promise.all([
        bookingsApi.getBooking(bookingId),
        financeApi.listReceipts(bookingId),
        canRefund ? financeApi.listRefunds() : Promise.resolve([]),
      ]);
      setBooking(record);
      setReceipts(receiptRows);
      setRefunds(refundRows.filter(row => String(row.booking_id) === String(record.id)));
    } catch (error) {
      setErrorMsg(error?.ar || error?.message || 'تعذر تحميل التفاصيل المالية.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, canRefund]);

  useEffect(() => { load(); }, [load]);

  const run = async action => {
    setBusy(true);
    setErrorMsg('');
    try {
      await action();
      await load();
      window.dispatchEvent(new CustomEvent('yar:bookings-updated'));
      toast('تم حفظ العملية المالية على الخادم.');
      return true;
    } catch (error) {
      setErrorMsg(error?.ar || error?.message || 'تعذر تنفيذ العملية المالية.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitReceipt = event => {
    event.preventDefault();
    run(() => financeApi.createReceipt({
      booking_id: Number(booking.id), amount_iqd: Number(amount), method,
      payment_reference: paymentReference.trim(),
    })).then(ok => { if (ok) { setAmount(''); setPaymentReference(''); } });
  };

  const submitRefund = event => {
    event.preventDefault();
    run(() => financeApi.createRefund({ booking_id: Number(booking.id), amount_iqd: Number(refundAmount), reason: refundReason.trim() }))
      .then(ok => { if (ok) { setRefundAmount(''); setRefundReason(''); } });
  };

  if (loading && !booking) return <div className="ops-note" role="status">جاري تحميل بيانات الحجز والمدفوعات...</div>;
  if (!booking) return <div className="ops-form-error" role="alert">{errorMsg || 'تعذر العثور على الحجز في الخادم.'}</div>;

  const total = Number(booking.total_iqd) || 0;
  const collected = Number(booking.collected_iqd) || 0;
  const refunded = Number(booking.refunded_iqd) || 0;
  const due = Number(booking.due_iqd) || 0;

  return (
    <div className="ops-finance-content">
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <button type="button" className="button secondary" onClick={onBackToBooking}>
          <i data-icon="back"><Icon name="back" /></i> تفاصيل الطلب
        </button>
        <button type="button" className="quiet-button" onClick={load} disabled={loading}>تحديث</button>
      </div>
      <div className="ops-detail-header" style={{ marginBottom: 16 }}>
        <h3>{booking.customer_name || '—'} · IQD</h3>
        <p className="ops-note">الإيصالات والاستردادات تُقرأ وتُسجل مباشرة عبر واجهات الخادم.</p>
      </div>
      {errorMsg && <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>{errorMsg}</div>}
      <div className="ops-money-lines" style={{ marginBottom: 20 }}>
        <div><span>إجمالي الحجز</span><strong><bdi>{money(total)}</bdi></strong></div>
        <div><span>المحصّل المعتمد</span><strong><bdi>{money(collected)}</bdi></strong></div>
        <div><span>المسترد</span><strong><bdi>{money(refunded)}</bdi></strong></div>
        <div><span>المتبقي</span><strong><bdi>{money(due)}</bdi></strong></div>
      </div>

      <section className="ops-section">
        <h3>إيصالات التحصيل</h3>
        {receipts.length ? receipts.map(receipt => (
          <article className="ops-card" key={receipt.id} style={{ padding: 12, marginBottom: 8 }}>
            <strong>{money(receipt.amount_iqd)} · {receipt.method === 'bank' ? 'تحويل بنكي' : 'تحصيل مكتبي'}</strong>
            <span className={`status ${receipt.state === 'approved' ? 'issued' : receipt.state === 'pending' ? 'processing' : 'cancelled'}`} style={{ marginInlineStart: 8 }}>{stateLabel(receipt.state)}</span>
            <p className="ops-note">المرجع: {receipt.payment_reference || receipt.reference || '—'}{receipt.created_at ? ` · ${receipt.created_at}` : ''}</p>
            {receipt.state === 'pending' && (
              <div className="ops-form-grid">
                <label className="ops-field wide"><span>ملاحظة المراجعة</span><input value={reviewNotes[receipt.id] || ''} onChange={e => setReviewNotes({ ...reviewNotes, [receipt.id]: e.target.value })} /></label>
                <div className="wide" style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="button primary" disabled={busy} onClick={() => run(() => financeApi.reviewReceipt(receipt.id, { approve: true, note: reviewNotes[receipt.id] || '' }))}>اعتماد الإيصال</button>
                  <button type="button" className="button secondary" disabled={busy} onClick={() => run(() => financeApi.reviewReceipt(receipt.id, { approve: false, note: reviewNotes[receipt.id] || '' }))}>رفض الإيصال</button>
                </div>
              </div>
            )}
          </article>
        )) : <p className="ops-note">لا توجد إيصالات مسجلة لهذا الحجز.</p>}

        {due > 0 && booking.state !== 'cancelled' && (
          <form className="ops-form-grid" onSubmit={submitReceipt}>
            <label className="ops-field"><span>المبلغ بالدينار العراقي</span><NumberInput allowDecimals={false} min={1} max={due} required value={amount} onChange={e => setAmount(e.target.value)} placeholder="مثال: 1,500,000" /></label>
            <label className="ops-field"><span>طريقة التحصيل</span><select value={method} onChange={e => setMethod(e.target.value)}><option value="office">المكتب</option><option value="bank">تحويل بنكي</option></select></label>
            <label className="ops-field wide"><span>مرجع الإيصال</span><input required value={paymentReference} onChange={e => setPaymentReference(e.target.value)} /></label>
            <button className="button primary wide" disabled={busy}>تسجيل إيصال معلّق للمراجعة</button>
            <p className="ops-note wide">الإيصال الجديد يظل معلّقًا ولا يغيّر المبلغ المحصّل حتى اعتماده من موظف مخوّل.</p>
          </form>
        )}
      </section>

      <section className="ops-section">
        <h3>استردادات العميل</h3>
        {refunds.length ? refunds.map(refund => (
          <article className="ops-card" key={refund.id} style={{ padding: 12, marginBottom: 8 }}>
            <strong>{money(refund.amount_iqd)} · {stateLabel(refund.state)}</strong>
            <p className="ops-note">{refund.reason || '—'} · {refund.payment_reference || refund.reference || '—'}</p>
            {canRefund && refund.state === 'pending' && (
              <form className="ops-form-grid" onSubmit={event => { event.preventDefault(); run(() => financeApi.approveRefund(refund.id, refundReferences[refund.id] || '')); }}>
                <label className="ops-field wide"><span>مرجع الصرف بعد التحويل</span><input required value={refundReferences[refund.id] || ''} onChange={e => setRefundReferences({ ...refundReferences, [refund.id]: e.target.value })} /></label>
                <button className="button primary wide" disabled={busy}>تأكيد صرف الاسترداد</button>
              </form>
            )}
          </article>
        )) : <p className="ops-note">لا توجد طلبات استرداد لهذا الحجز.</p>}
        {canRefund && booking.state === 'cancelled' && collected - refunded > 0 && (
          <form className="ops-form-grid" onSubmit={submitRefund}>
            <label className="ops-field"><span>مبلغ الاسترداد IQD</span><NumberInput allowDecimals={false} min={1} max={collected - refunded} required value={refundAmount} onChange={e => setRefundAmount(e.target.value)} placeholder="مثال: 500,000" /></label>
            <label className="ops-field wide"><span>سبب الاسترداد</span><textarea required value={refundReason} onChange={e => setRefundReason(e.target.value)} /></label>
            <button className="button secondary wide" disabled={busy}>إنشاء طلب استرداد معلّق</button>
            <p className="ops-note wide">إنشاء الطلب لا يعني صرفه؛ يجب تسجيل مرجع التحويل عند اعتماده.</p>
          </form>
        )}
        {!canRefund && <p className="ops-note">إنشاء واعتماد الاستردادات متاحان لمدير النظام فقط، ويُتحقق من الصلاحية أيضًا على الخادم.</p>}
      </section>
    </div>
  );
}

export default PaymentDetailsModal;
