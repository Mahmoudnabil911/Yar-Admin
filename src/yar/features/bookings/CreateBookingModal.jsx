import React, { useState, useMemo } from 'react';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { audienceStorage } from '../../services/storage/audienceStorage';
import { pricingStorage } from '../../services/storage/pricingStorage';
import { operationsModel as M, pricingEngine as E } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { Drawer } from '../../components/ui/Drawer';
import HotelOfferPicker from '../hotels/HotelOfferPicker';
import { useFxRate, FxRateBanner } from '../fx/ExchangeRate';
import { usdToIqd, iqdToUsd } from '../../services/fxRate';

const serviceSchemas = {
  flight: { origin: 'مدينة المغادرة', destination: 'مدينة الوصول', carrier: 'شركة الطيران', cabin: 'درجة السفر', travelDate: 'تاريخ الذهاب', returnDate: 'تاريخ العودة (اختياري)' },
  hotel: { hotelName: 'الفندق', checkIn: 'الوصول', checkOut: 'المغادرة', rooms: 'أنواع الغرف وتوزيع الأشخاص' },
  package: { packageName: 'اسم الباقة / الفندق', nights: 'عدد الليالي', travelDate: 'تاريخ السفر' },
  transfer: { vehicle: 'السيارة', pickup: 'نقطة الاستقبال / خدمة الاستقبال والتوديع', travelDate: 'التاريخ', passengers: 'عدد الركاب' },
  tour: { tourName: 'الجولة', pickup: 'نقطة الانطلاق', travelDate: 'التاريخ', passengers: 'عدد الأشخاص' }
};

export function CreateBookingModal({ isOpen, open, onClose, onCreated, onSuccess }) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();
  const providers = catalogStorage.getRecords('providers');
  const customers = audienceStorage.getUsers().users || [];

  const [service, setService] = useState('flight');
  const [source, setSource] = useState('whatsapp');
  const [customerId, setCustomerId] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('07XX XXX XX99');
  const [date, setDate] = useState(() => M.today());
  // Customer price is always IQD; supplier net is entered in USD and converted with today's admin rate.
  const currency = 'IQD';
  const { rate: fx } = useFxRate();
  const [route, setRoute] = useState('');
  const [detail, setDetail] = useState('');
  const [providerId, setProviderId] = useState('');

  // Pricing inputs
  const [pricingMode, setPricingMode] = useState('manual'); // 'manual' or 'rules'
  const [cost, setCost] = useState('100'); // supplier net in USD
  const [markupMode, setMarkupMode] = useState('percent');
  const [markupValue, setMarkupValue] = useState('10');
  const [discountMode, setDiscountMode] = useState('percent');
  const [discountValue, setDiscountValue] = useState('0');

  // Service fields
  const [serviceInfo, setServiceInfo] = useState({});
  const [travellersText, setTravellersText] = useState('مسافر مثال 1 | DEMO-001');

  const [errorMsg, setErrorMsg] = useState('');

  // Eligible providers
  const eligibleProviders = useMemo(() => {
    return providers.filter(p =>
      p.status === 'published' &&
      p.operatingEnabled !== false &&
      (p.serviceType === service || (service === 'tour' && p.serviceType === 'transfer'))
    );
  }, [providers, service]);

  // When customer is selected, prefill name and phone
  const handleCustomerSelect = id => {
    setCustomerId(id);
    const found = customers.find(c => c.id === id);
    if (found) {
      setCustomer(found.name);
      setPhone(found.phone || '07XX XXX XX99');
    }
  };

  // Live pricing preview calculation
  const preview = useMemo(() => {
    try {
      if (!fx) return null;
      const numCost = usdToIqd(Number(cost) || 0, fx.rate);
      if (pricingMode === 'rules') {
        const usableRules = pricingStorage.getCalculationRules();
        const r = E.calculate(usableRules, {
          cost: numCost,
          currency,
          service,
          providerId,
          date,
          routeFrom: serviceInfo.origin,
          routeTo: serviceInfo.destination,
          carrier: serviceInfo.carrier,
          cabin: serviceInfo.cabin
        }, providers);
        return {
          cost: numCost,
          markupAmount: r.markupAmount,
          original: r.originalPrice,
          discountAmount: r.discountAmount,
          final: r.finalPrice,
          margin: r.finalPrice - numCost,
          ruleLabel: [r.markupRule?.name || 'دون زيادة', r.discountRule?.name || 'دون خصم'].join(' / ')
        };
      } else {
        const snap = M.snapshot({
          cost: numCost,
          markupMode,
          markupValue: Number(markupValue) || 0,
          discountMode,
          discountValue: Number(discountValue) || 0
        }, currency);
        return snap;
      }
    } catch {
      return null;
    }
  }, [cost, fx, currency, service, providerId, date, serviceInfo, pricingMode, markupMode, markupValue, discountMode, discountValue, providers]);

  const handleSubmit = e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      if (!fx) throw new Error('يجب أن يسجّل مدير النظام سعر صرف الدولار لليوم قبل إنشاء حجز جديد.');
      const usd = Number(cost);
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error('أدخل صافي المورّد بالدولار أكبر من صفر.');
      }
      if (!preview) throw new Error('راجع قيم التسعير.');
      const numCost = preview.cost;
      if (!customer.trim()) throw new Error('اكتب اسم العميل التجريبي.');
      if (!route.trim()) throw new Error('اكتب المسار أو الوجهة.');
      if (!detail.trim()) throw new Error('اكتب تفاصيل الطلب.');
      if (!providerId) throw new Error('اختر مزوّد الخدمة.');

      const travellers = travellersText.split(/\r?\n/).map(v => v.trim()).filter(Boolean).map(v => {
        const [name, passport = ''] = v.split('|');
        return { name: name.trim(), passport: passport.trim() };
      });

      let snapshotData;
      if (pricingMode === 'rules') {
        snapshotData = {
          cost: preview.cost,
          markupMode: 'fixed',
          markupValue: preview.markupAmount,
          discountMode: 'fixed',
          discountValue: preview.discountAmount,
          basis: 'rules-snapshot',
          ruleLabel: preview.ruleLabel
        };
      } else {
        snapshotData = {
          cost: numCost,
          markupMode,
          markupValue: Number(markupValue),
          discountMode,
          discountValue: Number(discountValue),
          basis: 'manual'
        };
      }

      const newBooking = operationsStorage.createBooking({
        service,
        source,
        customerId,
        customer,
        phone,
        date,
        currency,
        route,
        detail,
        providerId,
        serviceInfo,
        travellers,
        ...snapshotData,
        supplierNetUsd: usd
      });

      toast(`تم إنشاء الطلب ${newBooking.id} بنجاح.`);
      (onSuccess || onCreated)?.(newBooking);
      onClose();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (!isModalOpen) return null;

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow="حجز جديد · إدخال يدوي"
      title="إدخال طلب جديد"
    >
      <div className="ops-create-modal">
        <p className="ops-note" style={{ marginBottom: 16 }}>
          طلب وبيانات اتصال تجريبية فقط. لا تُفتح محادثة واتساب ولا يُرسل طلب خارجي. لقطة السعر تثبت عند الحفظ ولا تتغير مع القواعد لاحقًا.
        </p>

        {errorMsg && (
          <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        <form className="ops-form-grid" onSubmit={handleSubmit}>
        <label className="ops-field">
          <span>الخدمة</span>
          <select value={service} onChange={e => { setService(e.target.value); setProviderId(''); }}>
            {Object.entries(M.services).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>

        <label className="ops-field">
          <span>مصدر الطلب</span>
          <select value={source} onChange={e => setSource(e.target.value)}>
            <option value="whatsapp">واتساب</option>
            <option value="app">تطبيق YAR</option>
            <option value="office">المكتب</option>
          </select>
        </label>

        <label className="ops-field wide">
          <span>ربط بحساب تجريبي موجود (اختياري)</span>
          <select value={customerId} onChange={e => handleCustomerSelect(e.target.value)}>
            <option value="">عميل مثال جديد</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
            ))}
          </select>
        </label>

        <label className="ops-field wide">
          <span>اسم العميل التجريبي</span>
          <input
            type="text"
            maxLength={100}
            value={customer}
            onChange={e => setCustomer(e.target.value)}
            placeholder="اسم العميل"
            required
          />
        </label>

        <label className="ops-field wide">
          <span>هاتف مقنّع · مثال 07XX XXX XX99</span>
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
          />
        </label>

        <label className="ops-field">
          <span>تاريخ الطلب</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </label>

        <div className="ops-field">
          <span>عملة العميل</span>
          <div className="fx-line"><strong>دينار عراقي · IQD</strong><small>صافي المورّد بالدولار</small></div>
        </div>

        <label className="ops-field wide">
          <span>المسار / المدينة</span>
          <input
            type="text"
            value={route}
            onChange={e => setRoute(e.target.value)}
            placeholder="مثال: بغداد ← مشهد أو فندق حدائق الغيم"
            required
          />
        </label>

        <label className="ops-field wide">
          <span>تفاصيل الطلب</span>
          <textarea
            rows="2"
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="وصف تفصيلي للخدمة المطلوبة"
            required
          />
        </label>

        <label className="ops-field wide">
          <span>مزوّد الخدمة</span>
          <select value={providerId} onChange={e => setProviderId(e.target.value)} required>
            <option value="">اختر المزوّد</option>
            {eligibleProviders.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {/* Pricing Mode Section */}
        <div className="wide" style={{ border: '1px solid var(--border)', padding: 14, borderRadius: 8, background: 'var(--c-fafbf7)', margin: '8px 0' }}>
          <strong style={{ display: 'block', fontSize: 13, marginBottom: 10, color: 'var(--ink)' }}>
            إعداد التسعير
          </strong>
          {fx ? (
            <div className="fx-line" style={{ marginBottom: 12 }}>
              <span>سعر التحويل المعتمد اليوم</span>
              <strong><bdi dir="ltr">1 $ = {fx.rate.toLocaleString('en-US')} د.ع</bdi></strong>
            </div>
          ) : <FxRateBanner />}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="pricingMode"
                value="manual"
                checked={pricingMode === 'manual'}
                onChange={() => setPricingMode('manual')}
              />
              <span>تسعير يدوي مخصص</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="radio"
                name="pricingMode"
                value="rules"
                checked={pricingMode === 'rules'}
                onChange={() => setPricingMode('rules')}
              />
              <span>تطبيق قواعد التسعير الحالية</span>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="ops-field">
              <span>صافي المورّد (USD)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                dir="ltr"
                value={cost}
                onChange={e => setCost(e.target.value)}
                required
              />
            </label>

            {pricingMode === 'manual' && (
              <>
                <label className="ops-field">
                  <span>نوع الزيادة (Markup)</span>
                  <select value={markupMode} onChange={e => setMarkupMode(e.target.value)}>
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({currency})</option>
                  </select>
                </label>
                <label className="ops-field">
                  <span>قيمة الزيادة</span>
                  <input
                    type="number"
                    step="any"
                    value={markupValue}
                    onChange={e => setMarkupValue(e.target.value)}
                  />
                </label>

                <label className="ops-field">
                  <span>نوع الخصم (Discount)</span>
                  <select value={discountMode} onChange={e => setDiscountMode(e.target.value)}>
                    <option value="percent">نسبة مئوية (%)</option>
                    <option value="fixed">مبلغ ثابت ({currency})</option>
                  </select>
                </label>
                <label className="ops-field">
                  <span>قيمة الخصم</span>
                  <input
                    type="number"
                    step="any"
                    value={discountValue}
                    onChange={e => setDiscountValue(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>

          {preview && (
            <div className="ops-money-lines" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--c-e7ede2)' }}>
              <div>
                <span>صافي المورّد</span>
                <strong><bdi>{(Number(cost) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</bdi></strong>
              </div>
              <div>
                <span>التكلفة بالدينار (حسب سعر اليوم)</span>
                <strong>{preview.cost.toLocaleString('en-US')} {currency}</strong>
              </div>
              <div>
                <span>السعر الأصلي</span>
                <strong>{preview.original.toLocaleString('en-US')} {currency}</strong>
              </div>
              <div>
                <span>الخصم</span>
                <strong>{preview.discountAmount.toLocaleString('en-US')} {currency}</strong>
              </div>
              <div>
                <span>السعر النهائي للبيع</span>
                <strong style={{ color: 'var(--c-2d5327)' }}>{preview.final.toLocaleString('en-US')} {currency}</strong>
              </div>
              <div>
                <span>الهامش النظري</span>
                <strong style={{ color: preview.margin >= 0 ? 'var(--c-32602b)' : 'var(--c-8d473f)' }}>
                  {preview.margin.toLocaleString('en-US')} {currency}
                </strong>
              </div>
            </div>
          )}
        </div>

        {service === 'hotel' && <HotelOfferPicker onApply={({ snapshot, quote, plan, hotel, room, request, supplierCost }) => {
          if (!fx) { toast('يجب أن يسجّل مدير النظام سعر صرف الدولار لليوم قبل إنشاء حجز جديد.'); return; }
          const planCurrency = plan.currency || 'IQD';
          // Customer total in IQD; supplier net in USD (offer snapshot keeps the plan's own currency).
          const total = planCurrency === 'USD' ? usdToIqd(quote.total, fx.rate) : quote.total;
          const netUsd = supplierCost != null && supplierCost > 0 ? (planCurrency === 'USD' ? supplierCost : iqdToUsd(supplierCost, fx.rate)) : null;
          setRoute(`${hotel.city} · ${hotel.name}`);
          setDetail(`${request.rooms} × ${room.name} · ${plan.mealPlan} · ${quote.nights} ليالٍ`);
          setServiceInfo(prev => ({ ...prev, hotelName: hotel.name, checkIn: request.checkIn, checkOut: request.checkOut, rooms: `${request.rooms} × ${room.name} · ${request.adults} بالغين${request.children ? ` + ${request.children} أطفال` : ''} · ${plan.mealPlan}`, hotelOffer: snapshot }));
          if (netUsd != null && total >= usdToIqd(netUsd, fx.rate)) {
            setPricingMode('manual'); setCost(String(netUsd)); setMarkupMode('fixed'); setMarkupValue(String(total - usdToIqd(netUsd, fx.rate))); setDiscountMode('fixed'); setDiscountValue('0');
            toast('تم تطبيق العرض: تكلفة المورد وسعر البيع من خطة السعر.');
          } else {
            // No supplier cost in the rate plan: keep the selling total and ask staff to split cost/markup.
            const usdGuess = iqdToUsd(total, fx.rate);
            setPricingMode('manual'); setCost(String(usdGuess)); setMarkupMode('fixed'); setMarkupValue(String(Math.max(0, total - usdToIqd(usdGuess, fx.rate)))); setDiscountMode('fixed'); setDiscountValue('0');
            toast('تم تطبيق سعر العرض. تكلفة المورد غير محددة في خطة السعر؛ عدّل التكلفة والزيادة قبل الحفظ.');
          }
        }} />}

        {/* Dynamic schema fields */}
        {Object.entries(serviceSchemas[service] || {}).map(([key, label]) => (
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
          <span>المسافرون (اسم | جواز تجريبي في كل سطر)</span>
          <textarea
            rows="3"
            value={travellersText}
            onChange={e => setTravellersText(e.target.value)}
          />
        </label>

        <button type="submit" className="button primary wide" style={{ marginTop: 10 }} disabled={!fx}>
          حفظ الطلب والتسعير المحلي
        </button>
      </form>
    </div>
  </Drawer>
  );
}

export default CreateBookingModal;

