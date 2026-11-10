import React, { useState, useEffect, useMemo } from 'react';
import { pricingEngine as E } from '../../services/models';
import { normalize } from '../../services/storage/pricingStorage';
import Drawer from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';

const kindLabels = { markup: 'هامش ربح', discount: 'خصم' };
const flightScopeKeys = ['routeFrom', 'routeTo', 'carrier', 'cabin'];

export default function PricingRuleModal({
  isOpen,
  onClose,
  rule,
  rules,
  providers,
  onSave,
}) {
  const [formData, setFormData] = useState({
    id: '',
    kind: 'markup',
    name: '',
    service: 'all',
    providerId: 'all',
    currency: 'IQD',
    mode: 'percent',
    value: '',
    startDate: '',
    endDate: '',
    enabled: true,
    routeFrom: '',
    routeTo: '',
    carrier: '',
    cabin: '',
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (rule) {
      setFormData({
        id: rule.id || '',
        kind: rule.kind || 'markup',
        name: rule.name || '',
        service: rule.service || 'all',
        providerId: rule.providerId || 'all',
        currency: rule.currency || 'IQD',
        mode: rule.mode || 'percent',
        value: rule.value == null || Number.isNaN(rule.value) ? '' : String(rule.value),
        startDate: rule.startDate || '',
        endDate: rule.endDate || '',
        enabled: rule.enabled !== false,
        routeFrom: rule.routeFrom || '',
        routeTo: rule.routeTo || '',
        carrier: rule.carrier || '',
        cabin: rule.cabin || '',
      });
      setError('');
    }
  }, [rule]);

  const availableProviders = useMemo(() => {
    if (formData.service === 'all') return [];
    return providers.filter(
      p => p.status === 'published' && p.operatingEnabled !== false && p.serviceType === formData.service
    );
  }, [providers, formData.service]);

  const scopeText = useMemo(() => {
    const pName =
      formData.providerId === 'all'
        ? 'جميع المزوّدين'
        : providers.find(p => p.id === formData.providerId)?.name || 'مزوّد غير متاح';
    const sName = E.services[formData.service] || formData.service;
    const parts = [sName, pName, formData.currency];

    if (formData.service === 'flight') {
      if (formData.routeFrom || formData.routeTo) {
        parts.push(`${formData.routeFrom || 'أي مغادرة'} → ${formData.routeTo || 'أي وصول'}`);
      }
      if (formData.carrier) {
        parts.push(`شركة ${formData.carrier}`);
      }
      if (formData.cabin) {
        parts.push(E.cabins[formData.cabin] || formData.cabin);
      }
    }
    return parts.join(' · ');
  }, [formData, providers]);

  const handleSubmit = e => {
    e.preventDefault();
    const record = normalize({
      ...formData,
      id: formData.id || `price-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      value: formData.value === '' ? NaN : Number(formData.value),
    });

    const err = E.validate(record, rules, providers);
    if (err) {
      setError(err);
      return;
    }

    onSave(record);
  };

  const isFixed = formData.mode === 'fixed';
  const valueLabel = isFixed ? `المبلغ الثابت · ${formData.currency}` : 'النسبة المئوية · %';
  const valueHelp = isFixed
    ? `يُحتسب المبلغ بـ ${formData.currency} دون تحويل عملات.`
    : formData.kind === 'discount'
    ? 'نسبة أكبر من 0 وحتى 100%.'
    : 'نسبة أكبر من 0 وحتى 1000%.';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${formData.id ? 'تعديل' : 'إضافة'} ${kindLabels[formData.kind]}`}
      badgeText="إعداد قاعدة تسعير"
    >
      <p className="drawer-note pr-form-note">
        حدّد نطاق {kindLabels[formData.kind]} وعملته. المبلغ الثابت يُحتسب بالعملة المحددة، والنسبة تُطبّق على تكلفة
        المزوّد للهامش أو على السعر الأصلي للخصم.
      </p>

      <form id="pr-rule-form" className="pr-form form-stack" onSubmit={handleSubmit}>
        {error && (
          <div className="pr-error" role="alert" tabIndex="-1">
            {error}
          </div>
        )}

        <div className="pr-form-grid">
          <label className="pr-field pr-wide" htmlFor="pr-rule-name">
            <span>
              اسم القاعدة <span className="required-mark">*</span>
            </span>
            <input
              id="pr-rule-name"
              required
              maxLength="80"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: هامش الطيران العام"
            />
          </label>

          <label className="pr-field" htmlFor="pr-rule-service">
            <span>الخدمة</span>
            <select
              id="pr-rule-service"
              value={formData.service}
              onChange={e => {
                const s = e.target.value;
                setFormData({
                  ...formData,
                  service: s,
                  providerId: 'all',
                  ...(s !== 'flight' ? { routeFrom: '', routeTo: '', carrier: '', cabin: '' } : {}),
                });
              }}
            >
              {Object.entries(E.services).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="pr-field" htmlFor="pr-rule-currency">
            <span>عملة القاعدة</span>
            <select
              id="pr-rule-currency"
              value={formData.currency}
              onChange={e => setFormData({ ...formData, currency: e.target.value })}
            >
              <option value="IQD">دينار عراقي · IQD</option>
              <option value="USD">دولار أمريكي · USD</option>
            </select>
          </label>

          <label className="pr-field pr-wide" htmlFor="pr-rule-provider">
            <span>المزوّد</span>
            <select
              id="pr-rule-provider"
              value={formData.providerId}
              onChange={e => setFormData({ ...formData, providerId: e.target.value })}
            >
              <option value="all">جميع المزوّدين</option>
              {availableProviders.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <small>يظهر المزوّدون المنشورون للخدمة المختارة؛ القاعدة العامة تشمل جميع المزوّدين.</small>
          </label>

          {formData.service === 'flight' && (
            <div className="pr-form-grid pr-wide">
              <p className="pr-date-note pr-wide">
                نطاق الطيران اختياري. الحقل الفارغ يشمل جميع القيم؛ المسار اتجاهي، ولا يُستعلم عن شركات الطيران عبر API.
              </p>
              <label className="pr-field" htmlFor="pr-rule-routeFrom">
                <span>مدينة المغادرة</span>
                <select
                  id="pr-rule-routeFrom"
                  value={formData.routeFrom}
                  onChange={e => setFormData({ ...formData, routeFrom: e.target.value })}
                >
                  <option value="">كل المدن</option>
                  {Object.entries(E.routeCities).map(([code, city]) => (
                    <option key={code} value={code}>
                      {city} · {code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pr-field" htmlFor="pr-rule-routeTo">
                <span>مدينة الوصول</span>
                <select
                  id="pr-rule-routeTo"
                  value={formData.routeTo}
                  onChange={e => setFormData({ ...formData, routeTo: e.target.value })}
                >
                  <option value="">كل المدن</option>
                  {Object.entries(E.routeCities).map(([code, city]) => (
                    <option key={code} value={code}>
                      {city} · {code}
                    </option>
                  ))}
                </select>
              </label>

              <label className="pr-field" htmlFor="pr-rule-carrier">
                <span>رمز شركة الطيران</span>
                <input
                  id="pr-rule-carrier"
                  type="text"
                  dir="ltr"
                  maxLength="24"
                  placeholder="مثال: IA"
                  value={formData.carrier}
                  onChange={e => setFormData({ ...formData, carrier: e.target.value.toUpperCase() })}
                />
                <small>أحرف إنجليزية وأرقام فقط، حتى 12 خانة.</small>
              </label>

              <label className="pr-field" htmlFor="pr-rule-cabin">
                <span>المقصورة</span>
                <select
                  id="pr-rule-cabin"
                  value={formData.cabin}
                  onChange={e => setFormData({ ...formData, cabin: e.target.value })}
                >
                  <option value="">كل المقصورات</option>
                  {Object.entries(E.cabins).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className="pr-field" htmlFor="pr-rule-mode">
            <span>طريقة الحساب</span>
            <select
              id="pr-rule-mode"
              value={formData.mode}
              onChange={e => setFormData({ ...formData, mode: e.target.value })}
            >
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </label>

          <label className="pr-field" htmlFor="pr-rule-value">
            <span>{valueLabel}</span>
            <input
              id="pr-rule-value"
              type="number"
              step="any"
              min="0"
              max={isFixed ? '' : formData.kind === 'discount' ? '100' : '1000'}
              required
              inputMode="decimal"
              value={formData.value}
              onChange={e => setFormData({ ...formData, value: e.target.value })}
            />
            <small>{valueHelp}</small>
          </label>

          <label className="pr-field" htmlFor="pr-rule-start">
            <span>تاريخ البداية (اختياري)</span>
            <input
              id="pr-rule-start"
              type="date"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
            />
          </label>

          <label className="pr-field" htmlFor="pr-rule-end">
            <span>تاريخ النهاية (اختياري)</span>
            <input
              id="pr-rule-end"
              type="date"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
            />
          </label>

          <p className="pr-date-note pr-wide">
            التواريخ بتوقيت بغداد وتشمل يومي البداية والنهاية. اترك التاريخ فارغًا لفتح الحد المقابل.
          </p>
        </div>

        <p className="pr-form-scope">النطاق: {scopeText}</p>

        <div className="pr-form-actions">
          <button className="button primary" type="submit">
            <Icon name="check" />
            حفظ القاعدة
          </button>
          <button className="button secondary" type="button" onClick={onClose}>
            إلغاء
          </button>
        </div>

        <p className="pr-form-footnote">الحفظ محلي. لا ينشر عرضًا ولا يغيّر أسعارًا لدى المزوّدين.</p>
      </form>
    </Drawer>
  );
}

