import React, { useState, useMemo } from 'react';
import { pricingEngine as E } from '../../services/models';
import { Icon } from '../../components/ui/Icon';

const currencyLabels = { IQD: 'د.ع', USD: '$' };

function money(value, currency) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)} ${currencyLabels[currency] || ''}`;
}

export default function PricingSimulator({ rules, providers }) {
  const [sim, setSim] = useState({
    cost: '100000',
    service: 'flight',
    providerId: 'all',
    currency: 'IQD',
    date: E.today(),
    ...E.normalizeFlightScope(),
  });

  const availableProviders = useMemo(() => {
    return providers.filter(
      p => p.status === 'published' && p.operatingEnabled !== false && p.serviceType === sim.service
    );
  }, [providers, sim.service]);

  // If selected provider is not available for chosen service, reset to 'all'
  const effectiveProviderId = useMemo(() => {
    if (sim.providerId === 'all') return 'all';
    return availableProviders.some(p => p.id === sim.providerId) ? sim.providerId : 'all';
  }, [sim.providerId, availableProviders]);

  const calculationRules = useMemo(() => {
    return rules.filter(rule => !E.validate(rule, rules, providers));
  }, [rules, providers]);

  const result = useMemo(() => {
    if (sim.cost.trim() === '') return null;
    const numCost = Number(sim.cost);
    if (!Number.isFinite(numCost) || numCost < 0) {
      return { error: 'أدخل تكلفة صالحة للمزوّد أكبر من أو تساوي صفر.' };
    }
    try {
      return E.calculate(
        calculationRules,
        { ...sim, providerId: effectiveProviderId, cost: numCost },
        providers
      );
    } catch (err) {
      return { error: err.message || 'راجع تكلفة المزوّد والخدمة والعملة وتاريخ الاختبار.' };
    }
  }, [calculationRules, sim, effectiveProviderId, providers]);

  const handleServiceChange = e => {
    const nextService = e.target.value;
    setSim(s => ({
      ...s,
      service: nextService,
      providerId: 'all',
      ...(nextService !== 'flight' ? E.normalizeFlightScope() : {}),
    }));
  };

  const handleCurrencyChange = e => {
    const nextCurrency = e.target.value;
    setSim(s => ({
      ...s,
      currency: nextCurrency,
      cost: nextCurrency === 'USD' ? '100' : '100000',
    }));
  };

  return (
    <aside className="panel pr-simulator" aria-labelledby="pr-simulator-title">
      <div className="pr-sim-heading">
        <span className="pr-sim-icon">
          <Icon name="receipt" />
        </span>
        <div>
          <h2 id="pr-simulator-title">جرّب السعر</h2>
          <p>النتيجة تعتمد على القواعد المحفوظة</p>
        </div>
      </div>

      <div className="pr-sim-grid">
        <label className="pr-field pr-wide" htmlFor="pr-sim-cost">
          <span>تكلفة المزوّد</span>
          <div className="pr-cost-input">
            <input
              id="pr-sim-cost"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={sim.cost}
              onChange={e => setSim(s => ({ ...s, cost: e.target.value }))}
            />
            <span>{currencyLabels[sim.currency]}</span>
          </div>
        </label>

        <label className="pr-field" htmlFor="pr-sim-service">
          <span>الخدمة</span>
          <select id="pr-sim-service" value={sim.service} onChange={handleServiceChange}>
            {Object.entries(E.services)
              .filter(([k]) => k !== 'all')
              .map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
          </select>
        </label>

        <label className="pr-field" htmlFor="pr-sim-currency">
          <span>العملة</span>
          <select id="pr-sim-currency" value={sim.currency} onChange={handleCurrencyChange}>
            <option value="IQD">دينار عراقي · IQD</option>
            <option value="USD">دولار أمريكي · USD</option>
          </select>
        </label>

        <label className="pr-field pr-wide" htmlFor="pr-sim-provider">
          <span>المزوّد</span>
          <select
            id="pr-sim-provider"
            value={effectiveProviderId}
            onChange={e => setSim(s => ({ ...s, providerId: e.target.value }))}
          >
            <option value="all">جميع المزوّدين</option>
            {availableProviders.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {sim.service === 'flight' && (
          <div className="pr-form-grid pr-wide">
            <p className="pr-date-note pr-wide">
              نطاق الطيران اختياري. الحقل الفارغ يشمل جميع القيم؛ المسار اتجاهي، ولا يُستعلم عن شركات الطيران عبر API.
            </p>
            <label className="pr-field" htmlFor="pr-sim-routeFrom">
              <span>مدينة المغادرة</span>
              <select
                id="pr-sim-routeFrom"
                value={sim.routeFrom || ''}
                onChange={e => setSim(s => ({ ...s, routeFrom: e.target.value }))}
              >
                <option value="">كل المدن</option>
                {Object.entries(E.routeCities).map(([code, city]) => (
                  <option key={code} value={code}>
                    {city} · {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="pr-field" htmlFor="pr-sim-routeTo">
              <span>مدينة الوصول</span>
              <select
                id="pr-sim-routeTo"
                value={sim.routeTo || ''}
                onChange={e => setSim(s => ({ ...s, routeTo: e.target.value }))}
              >
                <option value="">كل المدن</option>
                {Object.entries(E.routeCities).map(([code, city]) => (
                  <option key={code} value={code}>
                    {city} · {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="pr-field" htmlFor="pr-sim-carrier">
              <span>رمز شركة الطيران</span>
              <input
                id="pr-sim-carrier"
                type="text"
                dir="ltr"
                maxLength="24"
                placeholder="مثال: IA"
                value={sim.carrier || ''}
                onChange={e => setSim(s => ({ ...s, carrier: e.target.value.toUpperCase() }))}
              />
              <small>أحرف إنجليزية وأرقام فقط، حتى 12 خانة.</small>
            </label>

            <label className="pr-field" htmlFor="pr-sim-cabin">
              <span>المقصورة</span>
              <select
                id="pr-sim-cabin"
                value={sim.cabin || ''}
                onChange={e => setSim(s => ({ ...s, cabin: e.target.value }))}
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

        <label className="pr-field pr-wide" htmlFor="pr-sim-date">
          <span>تاريخ الاختبار · توقيت بغداد</span>
          <input
            id="pr-sim-date"
            type="date"
            value={sim.date}
            onChange={e => setSim(s => ({ ...s, date: e.target.value }))}
          />
        </label>
      </div>

      <div className="pr-result" aria-live="polite" aria-atomic="true">
        {sim.cost.trim() === '' ? (
          <p className="pr-sim-empty">أدخل تكلفة المزوّد لعرض نتيجة الحساب.</p>
        ) : result?.error ? (
          <div className="pr-error" role="alert">
            {result.error}
          </div>
        ) : result ? (
          <>
            <div className="pr-breakdown">
              <div className="pr-breakdown-line">
                <span>تكلفة المزوّد</span>
                <strong>
                  <bdi>{money(result.cost, sim.currency)}</bdi>
                </strong>
              </div>
              <div className="pr-breakdown-line plus">
                <span>إضافة هامش الربح</span>
                <strong>
                  <bdi>{money(result.markupAmount, sim.currency)}</bdi>
                </strong>
              </div>
              <div className="pr-breakdown-line">
                <span>السعر الأصلي</span>
                <strong>
                  <bdi>{money(result.original, sim.currency)}</bdi>
                </strong>
              </div>
              <div className="pr-breakdown-line minus">
                <span>الخصم الفعلي</span>
                <strong>
                  <bdi>{money(result.discountAmount, sim.currency)}</bdi>
                </strong>
              </div>
              <div className="pr-breakdown-line total">
                <span>السعر النهائي</span>
                <strong>
                  <bdi>{money(result.final, sim.currency)}</bdi>
                </strong>
              </div>
              <div className={`pr-breakdown-line ${result.net < 0 ? 'negative' : 'net'}`}>
                <span>الهامش بعد الخصم</span>
                <strong>
                  <bdi>{money(result.net, sim.currency)}</bdi>
                </strong>
              </div>
            </div>

            <div className="pr-applied">
              <p>
                <span>هامش الربح:</span> {result.markupRule?.name || 'لم تطابق قاعدة سارية'}
              </p>
              <p>
                <span>الخصم:</span> {result.discountRule?.name || 'لم تطابق قاعدة سارية'}
              </p>
            </div>

            <div className="pr-customer-preview">
              <span className="pr-preview-label">معاينة السعر للمسافر</span>
              <div className="pr-preview-price">
                {result.discountAmount > 0 && (
                  <>
                    <del>
                      <bdi>{money(result.original, sim.currency)}</bdi>
                    </del>
                    <span className="pr-discount-badge">
                      خصم{' '}
                      {result.original > 0
                        ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
                            (result.discountAmount / result.original) * 100
                          )
                        : 0}
                      %
                    </span>
                  </>
                )}
                <strong>
                  <bdi>{money(result.final, sim.currency)}</bdi>
                </strong>
              </div>
              <small>قيمة توضيحية للمحاكاة المحلية</small>
            </div>

            {result.belowCost && (
              <div className="pr-warning" role="status">
                <Icon name="clock" />
                <div>
                  <strong>السعر النهائي أقل من تكلفة المزوّد</strong>
                  <p>الخصم ينتج خسارة في هذه الحالة. راجع القاعدة قبل استخدامها في نظام فعلي.</p>
                </div>
              </div>
            )}

            {result.discountExceeded && (
              <p className="pr-limit-note">
                قيمة الخصم تتجاوز السعر الأصلي؛ اقتُصر الخصم الفعلي على قيمة السعر ليبقى السعر النهائي صفرًا.
              </p>
            )}
          </>
        ) : null}
      </div>

      <p className="pr-sim-footnote">
        تُستثنى القواعد التي تحتاج مراجعة من الحساب. لا يوجد تحويل عملات؛ تُستخدم قواعد العملة المختارة فقط، دون مزامنة مع
        أسعار المزوّد أو تطبيق المسافرين.
      </p>
    </aside>
  );
}

