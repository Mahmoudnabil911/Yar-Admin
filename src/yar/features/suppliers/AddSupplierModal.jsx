import React, { useState } from 'react';
import { suppliersApi } from '../../services/api/suppliersApi';
import { useToast } from '../../components/ui/Toast';

export function AddSupplierModal({ onClose, onCreated }) {
  const toast = useToast();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [serviceType, setServiceType] = useState('flight');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [priority, setPriority] = useState(1);
  const [integration, setIntegration] = useState('manual');
  const [channel, setChannel] = useState('manual');
  const [coverageCities, setCoverageCities] = useState('');
  const [environment, setEnvironment] = useState('test');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('اسم المورّد مطلوب.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await suppliersApi.createSupplier({
        name: name.trim(),
        code: code.trim() || undefined,
        service_type: serviceType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        priority: Number(priority) || 1,
        integration,
        channel,
        coverage_cities: coverageCities.trim() || undefined,
        environment,
        notes: notes.trim() || undefined,
        active: true,
        operating_enabled: true,
      });

      toast('تم إنشاء المورّد بنجاح على الخادم.');
      onCreated?.(res);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'تعذر إنشاء المورّد على الخادم.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ops-supplier-create-modal">
      <p className="ops-note" style={{ marginBottom: 16 }}>
        إنشاء حساب مورّد جديد على الخادم (API 068).
      </p>

      {errorMsg && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
          {errorMsg}
        </div>
      )}

      <form className="ops-form-grid" onSubmit={handleSubmit}>
        <label className="ops-field wide">
          <span>اسم المورّد *</span>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="مثال: شركة أفق للطيران"
            required
            disabled={submitting}
          />
        </label>

        <label className="ops-field">
          <span>كود المورّد (Code)</span>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="مثال: SUP_001"
            disabled={submitting}
          />
        </label>

        <label className="ops-field">
          <span>نوع الخدمة</span>
          <select value={serviceType} onChange={e => setServiceType(e.target.value)} disabled={submitting}>
            <option value="flight">طيران (Flight)</option>
            <option value="hotel">فنادق (Hotel)</option>
            <option value="car">نقل وسيارات (Transfer)</option>
            <option value="tour">جولات سياحية (Tour)</option>
            <option value="package">باقات سفر (Package)</option>
          </select>
        </label>

        <label className="ops-field">
          <span>البريد الإلكتروني</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="supplier@example.com"
            disabled={submitting}
          />
        </label>

        <label className="ops-field">
          <span>رقم الهاتف</span>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+964..."
            disabled={submitting}
          />
        </label>

        <label className="ops-field">
          <span>طريقة الربط</span>
          <select value={integration} onChange={e => setIntegration(e.target.value)} disabled={submitting}>
            <option value="manual">يدوي (Manual)</option>
            <option value="api">واجهة برمجية (API)</option>
          </select>
        </label>

        <label className="ops-field">
          <span>القناة (Channel)</span>
          <select value={channel} onChange={e => setChannel(e.target.value)} disabled={submitting}>
            <option value="manual">Manual</option>
            <option value="gds">GDS</option>
            <option value="ndc">NDC</option>
            <option value="direct">Direct</option>
          </select>
        </label>

        <label className="ops-field">
          <span>بيئة التشغيل</span>
          <select value={environment} onChange={e => setEnvironment(e.target.value)} disabled={submitting}>
            <option value="test">بيئة تجريبية (Test)</option>
            <option value="production">بيئة الإنتاج (Production)</option>
          </select>
        </label>

        <label className="ops-field">
          <span>الأولوية</span>
          <input
            type="number"
            min="1"
            max="10"
            value={priority}
            onChange={e => setPriority(e.target.value)}
            disabled={submitting}
          />
        </label>

        <label className="ops-field wide">
          <span>المدن المغطاة</span>
          <input
            type="text"
            value={coverageCities}
            onChange={e => setCoverageCities(e.target.value)}
            placeholder="مثال: بغداد، أربيل، النجف، طهران"
            disabled={submitting}
          />
        </label>

        <label className="ops-field wide">
          <span>ملاحظات إضافية</span>
          <textarea
            rows="2"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="أي ملاحظات حول المورّد أو اتفاقية التشغيل..."
            disabled={submitting}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }} className="wide">
          <button type="submit" className="button primary" style={{ flex: 1 }} disabled={submitting}>
            {submitting ? 'جاري الحفظ على الخادم...' : 'حفظ المورّد الجديد'}
          </button>
          <button type="button" className="button secondary" onClick={onClose} disabled={submitting}>
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddSupplierModal;

