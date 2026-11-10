import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { operationsModel as M, supplierCreditModel as C } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { can } from '../../auth/access';

// Offline collection only: card / wallet imply an electronic gateway and are not offered for new entries.
const MANUAL_METHODS = ['office', 'bank'];

export function PaymentDetailsModal({ bookingId, onBackToBooking, onNavigate }) {
  const toast = useToast();
  const booking = operationsStorage.getBooking(bookingId);
  const ledger = operationsStorage.getCreditLedger();

  const [errorMsg, setErrorMsg] = useState('');
  const canRefund = can('payment.refund');
  const canReturn = can('supplier.return');

  // Collect form state
  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('office');
  const [collectStatus, setCollectStatus] = useState('review');
  const [collectReference, setCollectReference] = useState('');
  const [collectNote, setCollectNote] = useState('');

  // Review note state per payment
  const [reviewNotes, setReviewNotes] = useState({});

  // Refund form state
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [refundNote, setRefundNote] = useState('');

  // Supplier credit return state
  const [returnAmount, setReturnAmount] = useState('');
  const [returnReference, setReturnReference] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returnConfirmed, setReturnConfirmed] = useState(false);

  if (!booking) return null;

  const b = M.balances(booking);
  const currency = booking.currency || 'IQD';
  const isFlight = booking.service === 'flight';
  const isClosed = ['cancelled', 'rejected'].includes(booking.status);
  const step = currency === 'USD' ? '0.01' : '1';

  const numFormat = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0
  });
  const money = val => `${numFormat.format(Number(val) || 0)} ${currency === 'USD' ? '$' : 'د.ع'}`;
  // Supplier amounts are shown in the supplier's own currency (USD for new bookings).
  const moneyIn = (val, cur) => `${new Intl.NumberFormat('en-US', { minimumFractionDigits: cur === 'USD' ? 2 : 0, maximumFractionDigits: cur === 'USD' ? 2 : 0 }).format(Number(val) || 0)} ${cur === 'USD' ? '$' : 'د.ع'}`;

  // Supplier credit charge
  const supplierCharge = ledger.find(e => e.type === 'issue' && e.bookingId === booking.id);
  const creditRefundable = C ? C.refundable(ledger, booking.id) : 0;
  const currentSupplierBalance = C ? C.balance(ledger, booking.providerId, supplierCharge?.currency || currency) : 0;

  const handleRecordPayment = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const amount = isFlight ? b.balance : Number(collectAmount);
      operationsStorage.recordPayment(booking.id, {
        amount,
        method: collectMethod,
        status: collectStatus,
        reference: collectReference,
        note: collectNote
      });
      toast('حُفظت حركة التحصيل المحلية.');
      setCollectAmount('');
      setCollectReference('');
      setCollectNote('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleReviewPayment = (paymentId, decision) => {
    setErrorMsg('');
    try {
      const note = reviewNotes[paymentId] || '';
      operationsStorage.reviewPayment(booking.id, paymentId, decision, note);
      toast('حُفظ قرار مراجعة الإيصال.');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleRefund = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      operationsStorage.recordRefund(booking.id, {
        amount: Number(refundAmount),
        reference: refundReference,
        note: refundNote
      });
      toast('سُجّل الاسترداد المحلي.');
      setRefundAmount('');
      setRefundReference('');
      setRefundNote('');
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleCreditReturn = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      operationsStorage.restoreSupplierCredit(booking.id, {
        amount: Number(returnAmount),
        reference: returnReference,
        note: returnNote,
        confirmed: returnConfirmed
      });
      toast('سُجّل الإرجاع إلى رصيد المورّد.');
      setReturnAmount('');
      setReturnReference('');
      setReturnNote('');
      setReturnConfirmed(false);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="ops-finance-content">
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="button secondary"
          onClick={onBackToBooking}
        >
          <i data-icon="back"><Icon name="back" /></i>
          تفاصيل الطلب
        </button>

      </div>

      <div className="ops-detail-header" style={{ marginBottom: 16 }}>
        <h3>{booking.customer} · {currency}</h3>
        <p className="ops-warning">
          جميع الحركات تسجيل محلي فقط؛ لا تُحصّل الأموال ولا تُرسل استردادات أو مدفوعات فعلية.
        </p>
      </div>

      {errorMsg && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      <div className="ops-money-lines" style={{ marginBottom: 20 }}>
        <div>
          <span>سعر الطلب</span>
          <strong><bdi>{money(booking.amount)}</bdi></strong>
        </div>
        <div>
          <span>إجمالي المحصّل</span>
          <strong><bdi>{money(b.collected)}</bdi></strong>
        </div>
        <div>
          <span>المسترد للعميل</span>
          <strong><bdi>{money(b.refunded)}</bdi></strong>
        </div>
        <div>
          <span>صافي المحصّل</span>
          <strong><bdi>{money(b.netCollected)}</bdi></strong>
        </div>
      </div>

      {/* Receipts & Collection */}
      <section className="ops-section">
        <h3>الإيصالات والتحصيل</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 15 }}>
          {booking.payments.length > 0 ? (
            booking.payments.map(p => (
              <article className="ops-card" key={p.id} style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{money(p.amount)} · {M.methods[p.method] || p.method}</strong>
                  <span className={`status ${p.status === 'accepted' ? 'issued' : p.status === 'review' ? 'processing' : 'cancelled'}`}>
                    {p.status === 'accepted' ? 'مقبول' : p.status === 'review' ? 'للمراجعة' : 'مرفوض'}
                  </span>
                </div>
                <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--muted)' }}>
                  مرجع: {p.reference} {p.note && `· ${p.note}`}
                </p>
                {p.status === 'review' && (
                  <div className="ops-form-grid" style={{ marginTop: 8 }}>
                    <label className="ops-field wide">
                      <span>ملاحظة / سبب الرفض</span>
                      <input
                        type="text"
                        value={reviewNotes[p.id] || ''}
                        onChange={e => setReviewNotes({ ...reviewNotes, [p.id]: e.target.value })}
                        placeholder="سبب الرفض أو ملاحظة الاعتماد"
                      />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="button primary"
                        onClick={() => handleReviewPayment(p.id, 'accepted')}
                      >
                        اعتماد الإيصال
                      </button>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={() => handleReviewPayment(p.id, 'rejected')}
                      >
                        رفض الإيصال
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          ) : (
            <p className="ops-note">لا توجد إيصالات.</p>
          )}
        </div>

        {!isClosed && b.balance > 0 ? (
          <form id="ops-collect" className="ops-form-grid" onSubmit={handleRecordPayment}>
            <label className="ops-field">
              <span>{isFlight ? `دفع التذكرة الكامل (${currency})` : `مبلغ الحركة (${currency})`}</span>
              <input
                type="number"
                min={step}
                step={step}
                value={isFlight ? b.balance : collectAmount}
                readOnly={isFlight}
                onChange={e => setCollectAmount(e.target.value)}
                required
              />
            </label>

            {isFlight && (
              <p className="ops-note wide">
                التذكرة تُدفع بالكامل قبل الإصدار. المبلغ ثابت؛ في السجل القديم غير المكتمل يُسجّل الباقي كله لإكمال الدفع.
              </p>
            )}

            <label className="ops-field">
              <span>طريقة الدفع</span>
              <select value={collectMethod} onChange={e => setCollectMethod(e.target.value)}>
                {Object.entries(M.methods).filter(([k]) => MANUAL_METHODS.includes(k)).map(([k, v]) => (
                  <option key={k} value={k}>{k === 'bank' ? 'تحويل بنكي' : v}</option>
                ))}
              </select>
            </label>

            <label className="ops-field wide">
              <span>معالجة الإيصال</span>
              <select value={collectStatus} onChange={e => setCollectStatus(e.target.value)}>
                <option value="review">إيصال للمراجعة</option>
                <option value="accepted">تحصيل مقبول</option>
                <option value="rejected">إيصال مرفوض</option>
              </select>
            </label>

            <label className="ops-field wide">
              <span>مرجع الإيصال / العملية</span>
              <input
                type="text"
                value={collectReference}
                onChange={e => setCollectReference(e.target.value)}
                placeholder="مرجع إيصال التحصيل أو رقم الحوالة"
                required
              />
            </label>

            <label className="ops-field wide">
              <span>ملاحظة</span>
              <textarea
                rows="2"
                value={collectNote}
                onChange={e => setCollectNote(e.target.value)}
              />
            </label>

            <button type="submit" className="button primary wide">
              تسجيل حركة التحصيل المحلية
            </button>
          </form>
        ) : (
          <p className="ops-note">لا يوجد دفع جديد مطلوب؛ الطلب مدفوع بالكامل أو مغلق.</p>
        )}
      </section>

      {/* Refunds */}
      <section className="ops-section">
        <h3>استردادات العميل</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {booking.refunds.length > 0 ? (
            booking.refunds.map(r => (
              <p key={r.id} style={{ fontSize: 12, margin: 0 }}>
                {money(r.amount)} · مرجع: {r.reference} · {r.note}
              </p>
            ))
          ) : (
            <p className="ops-note">لم يُسجّل استرداد؛ الإلغاء وحده لا يعيد المال.</p>
          )}
        </div>

        {booking.status === 'cancelled' && b.refundable > 0 && !canRefund ? (
          <p className="ops-note perm-note" role="note">تسجيل الاسترداد متاح لمدير النظام فقط.</p>
        ) : booking.status === 'cancelled' && b.refundable > 0 ? (
          <form id="ops-refund" className="ops-form-grid" onSubmit={handleRefund}>
            <label className="ops-field">
              <span>مبلغ الاسترداد ({currency})</span>
              <input
                type="number"
                min={step}
                max={b.refundable}
                step={step}
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
                placeholder={`حتى ${money(b.refundable)}`}
                required
              />
            </label>

            <label className="ops-field">
              <span>مرجع الاسترداد</span>
              <input
                type="text"
                value={refundReference}
                onChange={e => setRefundReference(e.target.value)}
                placeholder="مرجع التحويل المسترد"
                required
              />
            </label>

            <label className="ops-field wide">
              <span>سبب الاسترداد</span>
              <textarea
                rows="2"
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
                required
              />
            </label>

            <button type="submit" className="button secondary wide">
              تسجيل استرداد محلي
            </button>
          </form>
        ) : (
          <p className="ops-note">يتطلب الاسترداد حالة «ملغي» ورصيد تحصيل متاح.</p>
        )}
      </section>

      {/* Supplier Pre-paid Credit */}
      <section className="ops-section">
        <h3>حساب المورّد · رصيد مسبق الدفع</h3>
        {supplierCharge ? (
          <>
            <div className="ops-money-lines" style={{ marginBottom: 12 }}>
              <div>
                <span>خصم الإصدار من الرصيد</span>
                <strong><bdi>{moneyIn(supplierCharge.amount, supplierCharge.currency)}</bdi></strong>
              </div>
              <div>
                <span>أُعيد إلى الرصيد</span>
                <strong><bdi>{moneyIn(M.money(supplierCharge.amount - creditRefundable, supplierCharge.currency), supplierCharge.currency)}</bdi></strong>
              </div>
              <div>
                <span>الرصيد الحالي لدى المورّد</span>
                <strong><bdi>{moneyIn(currentSupplierBalance, supplierCharge.currency)}</bdi></strong>
              </div>
            </div>
            <p className="ops-note">
              مرجع الخصم: <bdi>{supplierCharge.reference}</bdi>. الإلغاء لا يعيد الرصيد تلقائيًا، واسترداد الزبون مستقل عن حساب المورّد.
            </p>
            <button
              type="button"
              className="button secondary"
              onClick={() => onNavigate('supplier-credit')}
            >
              عرض كشف حساب المورّد
            </button>

            {booking.status === 'cancelled' && creditRefundable > 0 && !canReturn && (
              <p className="ops-note perm-note" role="note">إرجاع الرصيد إلى المورّد متاح لمدير النظام فقط.</p>
            )}
            {booking.status === 'cancelled' && creditRefundable > 0 && canReturn && (
              <form id="credit-return" className="ops-form-grid" style={{ marginTop: 15 }} onSubmit={handleCreditReturn}>
                <label className="ops-field">
                  <span>المبلغ الذي أعاده المورّد ({supplierCharge.currency})</span>
                  <input
                    type="number"
                    min={supplierCharge.currency === 'USD' ? '0.01' : '1'}
                    max={creditRefundable}
                    step={supplierCharge.currency === 'USD' ? '0.01' : '1'}
                    value={returnAmount}
                    onChange={e => setReturnAmount(e.target.value)}
                    required
                  />
                </label>
                <label className="ops-field">
                  <span>مرجع إرجاع الرصيد</span>
                  <input
                    type="text"
                    value={returnReference}
                    onChange={e => setReturnReference(e.target.value)}
                    required
                  />
                </label>
                <label className="ops-field wide">
                  <span>سبب / تفاصيل الإرجاع</span>
                  <textarea
                    rows="2"
                    value={returnNote}
                    onChange={e => setReturnNote(e.target.value)}
                    required
                  />
                </label>
                <label className="ops-field wide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={returnConfirmed}
                    onChange={e => setReturnConfirmed(e.target.checked)}
                    required
                  />
                  <span>تأكدت أن المورّد أعاد هذا المبلغ إلى الرصيد.</span>
                </label>
                <button type="submit" className="button secondary wide">
                  تسجيل إرجاع إلى الرصيد
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <p className="ops-note">
              {booking.issuedAt
                ? 'سجل إصدار سابق لتفعيل نظام الرصيد؛ لم نخصمه بأثر رجعي حتى لا يتكرر الخصم.'
                : 'لم يُخصم رصيد لهذا الطلب. يُخصم عند الإصدار بعد التحقق من كفاية الرصيد.'}
            </p>
            {booking.providerId && (
              <button
                type="button"
                className="button secondary"
                onClick={() => onNavigate('supplier-credit')}
              >
                عرض رصيد المورّد
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default PaymentDetailsModal;

