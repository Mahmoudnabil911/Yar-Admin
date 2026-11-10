import React, { useState } from 'react';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { useToast } from '../../components/ui/Toast';

export function TopUpModal({ initialProviderId = '', initialCurrency = 'USD', onClose, onDone }) {
  const toast = useToast();
  const providers = catalogStorage.getRecords('providers').filter(p => p.status !== 'archived');

  const [providerId, setProviderId] = useState(initialProviderId);
  // Supplier accounts are funded in USD only; older IQD balances remain visible as history.
  const currency = 'USD';
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const numAmount = Number(amount);
      if (!providerId) throw new Error('اختر المورّد.');
      if (!Number.isFinite(numAmount) || numAmount <= 0) throw new Error('أدخل مبلغ إيداع صالح.');
      if (!reference.trim()) throw new Error('أدخل مرجع إيداع الرصيد.');

      operationsStorage.depositSupplierCredit({
        providerId,
        currency,
        amount: numAmount,
        reference: reference.trim(),
        note: note.trim()
      });

      toast('سُجّل شحن الرصيد المحلي.');
      onDone?.(providerId, currency);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="ops-deposit-modal">
      <p className="ops-warning" style={{ marginBottom: 16 }}>
        تسجيل إيداع تجريبي فقط. هذه المعاينة لا تحوّل أموالًا ولا تتصل بحساب المورّد.
      </p>

      {errorMsg && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      <form className="ops-form-grid" onSubmit={handleSubmit}>
        <label className="ops-field wide">
          <span>المورّد</span>
          <select value={providerId} onChange={e => setProviderId(e.target.value)} required>
            <option value="">اختر المورّد</option>
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="ops-field">
          <span>عملة الرصيد</span>
          <input value="دولار أمريكي · USD" readOnly />
        </label>

        <label className="ops-field">
          <span>مبلغ الإيداع</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="المبلغ"
            required
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
          />
        </label>

        <label className="ops-field wide">
          <span>ملاحظة اختيارية</span>
          <textarea
            rows="2"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="ملاحظات حول التحويل أو الحساب"
          />
        </label>

        <p className="ops-note wide">
          يبقى كل رصيد بعملته. مثال: شحن 1,000$ ثم إصدار بتكلفة 200$ يجعل الرصيد 800$. لا نخصم سعر البيع للزبون.
        </p>

        <button type="submit" className="button primary wide" style={{ marginTop: 10 }}>
          تسجيل شحن الرصيد
        </button>
      </form>
    </div>
  );
}

export default TopUpModal;

