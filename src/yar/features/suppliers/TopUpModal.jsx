import React, { useState } from 'react';
import { suppliersApi } from '../../services/api/suppliersApi';
import { useToast } from '../../components/ui/Toast';

export function TopUpModal({ initialProviderId = '', initialCurrency = 'USD', providers = [], onClose, onDone }) {
  const toast = useToast();

  // ONLY real providers passed from API
  const availableProviders = Array.isArray(providers) ? providers : [];

  const [providerId, setProviderId] = useState(String(initialProviderId || ''));
  // Supplier accounts are funded in USD
  const currency = 'USD';
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const numAmount = Number(amount);
      if (!providerId) throw new Error('اختر المورّد.');
      if (!Number.isFinite(numAmount) || numAmount <= 0) throw new Error('أدخل مبلغ إيداع صالح.');
      if (!reference.trim()) throw new Error('أدخل مرجع إيداع الرصيد.');

      setSubmitting(true);
      await suppliersApi.topUpSupplier(providerId, {
        amount_usd: numAmount,
        reference: reference.trim(),
      });

      toast('تم شحن رصيد المورّد بنجاح.');
      onDone?.(providerId, currency);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'تعذر شحن رصيد المورد.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-deposit-modal">
      <p className="ops-note" style={{ marginBottom: 16 }}>
        إضافة رصيد بالدولار لحساب المورّد في سجلات النظام (API 064).
      </p>

      {errorMsg && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      {availableProviders.length === 0 ? (
        <div className="ops-form-error wide" style={{ marginBottom: 16 }}>
          لا يوجد موردون مسجلون على الخادم حالياً. يرجى إضافة مورّد أولاً باستخدام زر «إضافة مورّد».
        </div>
      ) : (
        <form className="ops-form-grid" onSubmit={handleSubmit}>
          <label className="ops-field wide">
            <span>المورّد</span>
            <select value={providerId} onChange={e => setProviderId(e.target.value)} required disabled={submitting}>
              <option value="">اختر المورّد</option>
              {availableProviders.map(p => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>عملة الرصيد</span>
            <input value="دولار أمريكي · USD" readOnly />
          </label>

          <label className="ops-field">
            <span>مبلغ الإيداع ($)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="المبلغ بالدولار"
              required
              disabled={submitting}
            />
          </label>

          <label className="ops-field wide">
            <span>مرجع الإيداع</span>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="مثال: BANK-DEP-9921"
              required
              disabled={submitting}
            />
          </label>

          <label className="ops-field wide">
            <span>ملاحظة اختيارية</span>
            <textarea
              rows="2"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="ملاحظات حول التحويل أو الحساب"
              disabled={submitting}
            />
          </label>

          <p className="ops-note wide">
            يبقى كل رصيد بعملته (USD). شحن الرصيد يرفع الرصيد المتاح لإصدار التذاكر وتأكيد الخدمات.
          </p>

          <button type="submit" className="button primary wide" style={{ marginTop: 10 }} disabled={submitting}>
            {submitting ? 'جاري شحن الرصيد...' : 'تسجيل شحن الرصيد'}
          </button>
        </form>
      )}
    </div>
  );
}

export default TopUpModal;
