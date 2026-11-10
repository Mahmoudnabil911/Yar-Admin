import React, { useState, useEffect, useMemo } from 'react';
import { contentModel as M } from '../../services/models';
import { catalogStorage } from '../../services/storage/catalogStorage';
import Drawer from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';

const HERO = '/assets/content/tehran-airplane-window-v2.png';
const targets = {
  packages: 'الباقات السياحية',
  package: 'باقة محددة',
  hotels: 'الفنادق',
  flights: 'الطيران',
  transfers: 'النقل',
  tours: 'الجولات السياحية',
  destination: 'الوجهات',
  help: 'المساعدة',
};

const faqCategories = {
  general: 'عام',
  flight: 'الطيران',
  hotel: 'الفنادق',
  package: 'الباقات',
  transfer: 'النقل',
  tour: 'الجولات',
  account: 'الحساب',
  payment: 'الدفع',
};

const notificationCategories = { offer: 'عرض', service: 'خدمة', info: 'معلومة' };
const audiences = { all: 'الجميع', registered: 'المستخدمون المسجلون', guests: 'الزوار' };
const cities = ['مشهد', 'طهران', 'شيراز', 'أصفهان', 'شمال إيران', 'ماسوله'];

const images = [
  { value: 'assets/content/mashhad.jpg', label: 'مشهد' },
  { value: 'assets/content/tehran.jpg', label: 'طهران' },
  { value: 'assets/content/shiraz.jpg', label: 'شيراز' },
  { value: 'assets/content/north.jpg', label: 'شمال إيران' },
  { value: 'assets/content/masuleh.jpg', label: 'ماسوله' },
];

export default function ContentEditorDrawer({
  isOpen,
  onClose,
  type,
  record,
  onSave,
  onDiscard,
}) {
  const [formData, setFormData] = useState({});
  const [imageLibraryChoice, setImageLibraryChoice] = useState('custom');
  const [showDraftPreview, setShowDraftPreview] = useState(false);
  const [error, setError] = useState('');

  const packages = catalogStorage.getRecords('packages');
  const publishedPackages = useMemo(() => packages.filter(p => p.status === 'published'), [packages]);

  useEffect(() => {
    if (isOpen) {
      const working = record?.draft || record?.published || {};
      const payload = M.normalizePayload(type, JSON.parse(JSON.stringify(working)));
      setFormData(payload);
      setError('');
      setShowDraftPreview(false);

      if (['banners', 'destinations'].includes(type)) {
        const isLib = images.some(img => img.value === payload.image);
        setImageLibraryChoice(isLib ? payload.image : 'custom');
      }
    }
  }, [isOpen, type, record]);

  const handleImageChoiceChange = e => {
    const val = e.target.value;
    setImageLibraryChoice(val);
    if (val !== 'custom') {
      setFormData(prev => ({ ...prev, image: val }));
    }
  };

  const handleSave = (publish = false) => {
    setError('');
    try {
      onSave(formData, publish);
    } catch (err) {
      setError(err.message || 'تعذر حفظ المحتوى.');
    }
  };

  const titleText =
    type === 'home'
      ? 'تحرير مقدمة الرئيسية'
      : type === 'support'
      ? 'تحرير الدعم والتواصل'
      : `${record ? 'تعديل' : 'إضافة'} ${
          type === 'banners'
            ? 'بنر'
            : type === 'destinations'
            ? 'وجهة مميزة'
            : type === 'notifications'
            ? 'إشعار'
            : 'سؤال شائع'
        }`;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      badgeText={M.kinds[type] || 'تحرير المحتوى'}
    >
      <p className="drawer-note">
        يمكن حفظ بيانات غير مكتملة كمسودة. النشر يراجع الحقول وينسخ النسخة المعتمدة إلى معاينة التطبيق؛ تبقى النسخة
        المنشورة الحالية كما هي عند حفظ المسودة.
      </p>

      <form
        id="cms-editor-form"
        className="cms-form"
        onSubmit={e => {
          e.preventDefault();
        }}
      >
        {error && (
          <div className="cms-form-error" role="alert" tabIndex="-1">
            {error}
          </div>
        )}

        <div className="cms-form-grid">
          {type === 'home' && (
            <>
              <label className="cms-field cms-wide" htmlFor="cms-field-title">
                <span>عنوان الرئيسية</span>
                <input
                  id="cms-field-title"
                  maxLength={80}
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-tagline">
                <span>النص التعريفي</span>
                <textarea
                  id="cms-field-tagline"
                  maxLength={160}
                  rows={3}
                  value={formData.tagline || ''}
                  onChange={e => setFormData({ ...formData, tagline: e.target.value })}
                />
              </label>

              <div className="cms-editor-locked cms-wide">
                <div className="cms-media">
                  <img src={HERO} alt="صورة الرئيسية المعتمدة" />
                </div>
                <span>صورة الرئيسية المعتمدة ثابتة.</span>
              </div>
            </>
          )}

          {type === 'support' && (
            <>
              <label className="cms-field cms-wide" htmlFor="cms-field-title">
                <span>عنوان الدعم</span>
                <input
                  id="cms-field-title"
                  maxLength={80}
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-body">
                <span>النص التعريفي</span>
                <textarea
                  id="cms-field-body"
                  maxLength={300}
                  rows={3}
                  value={formData.body || ''}
                  onChange={e => setFormData({ ...formData, body: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-whatsapp">
                <span>رقم واتساب · رمز الدولة والأرقام</span>
                <input
                  id="cms-field-whatsapp"
                  maxLength={25}
                  inputMode="tel"
                  dir="ltr"
                  value={formData.whatsapp || ''}
                  onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                />
                <small>رقم النشاط المعتمد: 9647831400500</small>
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-phone">
                <span>رقم الهاتف (اختياري)</span>
                <input
                  id="cms-field-phone"
                  maxLength={25}
                  inputMode="tel"
                  dir="ltr"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-buttonLabel">
                <span>نص زر التواصل</span>
                <input
                  id="cms-field-buttonLabel"
                  maxLength={40}
                  value={formData.buttonLabel || ''}
                  onChange={e => setFormData({ ...formData, buttonLabel: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-message">
                <span>نص الرسالة المقترحة</span>
                <textarea
                  id="cms-field-message"
                  maxLength={300}
                  rows={3}
                  value={formData.message || ''}
                  onChange={e => setFormData({ ...formData, message: e.target.value })}
                />
                <small>يظهر كإعداد محتوى فقط؛ لا تُرسل المعاينة رسائل.</small>
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-hours">
                <span>أوقات العمل (اختياري)</span>
                <input
                  id="cms-field-hours"
                  maxLength={120}
                  value={formData.hours || ''}
                  onChange={e => setFormData({ ...formData, hours: e.target.value })}
                />
              </label>
            </>
          )}

          {type === 'faqs' && (
            <>
              <label className="cms-field cms-wide" htmlFor="cms-field-category">
                <span>التصنيف</span>
                <select
                  id="cms-field-category"
                  value={formData.category || 'general'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {Object.entries(faqCategories).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-question">
                <span>السؤال</span>
                <input
                  id="cms-field-question"
                  maxLength={160}
                  value={formData.question || ''}
                  onChange={e => setFormData({ ...formData, question: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-answer">
                <span>الإجابة</span>
                <textarea
                  id="cms-field-answer"
                  maxLength={2000}
                  rows={6}
                  value={formData.answer || ''}
                  onChange={e => setFormData({ ...formData, answer: e.target.value })}
                />
              </label>
            </>
          )}

          {type === 'notifications' && (
            <>
              <label className="cms-field cms-wide" htmlFor="cms-field-title">
                <span>عنوان الإشعار</span>
                <input
                  id="cms-field-title"
                  maxLength={80}
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-body">
                <span>نص الإشعار</span>
                <textarea
                  id="cms-field-body"
                  maxLength={300}
                  rows={3}
                  value={formData.body || ''}
                  onChange={e => setFormData({ ...formData, body: e.target.value })}
                />
              </label>

              <label className="cms-field" htmlFor="cms-field-category">
                <span>نوع الإشعار</span>
                <select
                  id="cms-field-category"
                  value={formData.category || 'info'}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  {Object.entries(notificationCategories).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cms-field" htmlFor="cms-field-audience">
                <span>الجمهور المقصود</span>
                <select
                  id="cms-field-audience"
                  value={formData.audience || 'all'}
                  onChange={e => setFormData({ ...formData, audience: e.target.value })}
                >
                  {Object.entries(audiences).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-target">
                <span>وجهة الفتح</span>
                <select
                  id="cms-field-target"
                  value={formData.target || 'none'}
                  onChange={e => setFormData({ ...formData, target: e.target.value })}
                >
                  <option value="none">دون زر فتح</option>
                  {Object.entries(targets)
                    .filter(([val]) => val !== 'package')
                    .map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>

              <label className="cms-field" htmlFor="cms-field-start">
                <span>بداية العرض (اختياري)</span>
                <input
                  id="cms-field-start"
                  type="date"
                  value={formData.startDate || ''}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </label>

              <label className="cms-field" htmlFor="cms-field-end">
                <span>نهاية العرض (اختياري)</span>
                <input
                  id="cms-field-end"
                  type="date"
                  value={formData.endDate || ''}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </label>
              <p className="cms-date-note cms-wide">
                بتوقيت بغداد، ويشمل العرض يومي البداية والنهاية. التاريخ الفارغ يترك الحد المقابل مفتوحًا.
              </p>
            </>
          )}

          {['banners', 'destinations'].includes(type) && (
            <>
              {type === 'destinations' && (
                <label className="cms-field cms-wide" htmlFor="cms-field-city">
                  <span>الوجهة</span>
                  <select
                    id="cms-field-city"
                    value={formData.city || ''}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  >
                    <option value="">اختر وجهة</option>
                    {cities.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="cms-field cms-wide" htmlFor="cms-field-title">
                <span>العنوان</span>
                <input
                  id="cms-field-title"
                  maxLength={80}
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </label>

              <label className="cms-field cms-wide" htmlFor="cms-field-body">
                <span>وصف مختصر</span>
                <textarea
                  id="cms-field-body"
                  maxLength={300}
                  rows={3}
                  value={formData.body || ''}
                  onChange={e => setFormData({ ...formData, body: e.target.value })}
                />
              </label>

              {/* Image Picker */}
              <div className="cms-image-controls cms-wide">
                <label className="cms-field" htmlFor="cms-image-library">
                  <span>مصدر الصورة</span>
                  <select
                    id="cms-image-library"
                    value={imageLibraryChoice}
                    onChange={handleImageChoiceChange}
                  >
                    {images.map(img => (
                      <option key={img.value} value={img.value}>
                        مكتبة الصور · {img.label}
                      </option>
                    ))}
                    <option value="custom">رابط صورة HTTPS</option>
                  </select>
                </label>

                <label className="cms-field" htmlFor="cms-field-image">
                  <span>رابط الصورة أو مسارها</span>
                  <input
                    id="cms-field-image"
                    disabled={imageLibraryChoice !== 'custom'}
                    maxLength={3000}
                    value={formData.image || ''}
                    onChange={e => setFormData({ ...formData, image: e.target.value })}
                  />
                  <small>اختر من المكتبة أو أضف رابط HTTPS مباشرًا، دون بيانات دخول.</small>
                </label>

                <label className="cms-field" htmlFor="cms-field-imageAlt">
                  <span>وصف الصورة للقارئ</span>
                  <input
                    id="cms-field-imageAlt"
                    maxLength={160}
                    value={formData.imageAlt || ''}
                    onChange={e => setFormData({ ...formData, imageAlt: e.target.value })}
                  />
                </label>
              </div>

              {type === 'banners' && (
                <>
                  <label className="cms-field cms-wide" htmlFor="cms-field-buttonLabel">
                    <span>نص زر العرض</span>
                    <input
                      id="cms-field-buttonLabel"
                      maxLength={40}
                      value={formData.buttonLabel || ''}
                      onChange={e => setFormData({ ...formData, buttonLabel: e.target.value })}
                    />
                  </label>

                  <label className="cms-field cms-wide" htmlFor="cms-field-target">
                    <span>وجهة الزر</span>
                    <select
                      id="cms-field-target"
                      value={formData.target || 'packages'}
                      onChange={e => {
                        const nextTarget = e.target.value;
                        setFormData({
                          ...formData,
                          target: nextTarget,
                          ...(nextTarget !== 'package' ? { packageId: '', nights: '' } : { nights: '5' }),
                        });
                      }}
                    >
                      {Object.entries(targets).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {formData.target === 'package' && (
                    <div className="cms-package-link cms-wide">
                      <label className="cms-field" htmlFor="cms-field-packageId">
                        <span>الباقة المرتبطة</span>
                        <select
                          id="cms-field-packageId"
                          value={formData.packageId || ''}
                          onChange={e => setFormData({ ...formData, packageId: e.target.value })}
                        >
                          <option value="">اختر باقة منشورة</option>
                          {publishedPackages.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="cms-field" htmlFor="cms-field-nights">
                        <span>مدة الباقة</span>
                        <select
                          id="cms-field-nights"
                          value={formData.nights || '5'}
                          onChange={e => setFormData({ ...formData, nights: e.target.value })}
                        >
                          <option value="5">5 ليالٍ</option>
                          <option value="7">7 ليالٍ</option>
                        </select>
                      </label>

                      <p>
                        السعر مشتق من أقل سعر صحيح ضمن خيارات الفنادق للمدة المختارة في الباقة المنشورة، بالدولار
                        للشخص عند حجز شخصين. يُحرر السعر من صفحة الباقات.
                      </p>
                    </div>
                  )}
                </>
              )}

              <label className="cms-field" htmlFor="cms-field-start">
                <span>بداية العرض (اختياري)</span>
                <input
                  id="cms-field-start"
                  type="date"
                  value={formData.startDate || ''}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </label>

              <label className="cms-field" htmlFor="cms-field-end">
                <span>نهاية العرض (اختياري)</span>
                <input
                  id="cms-field-end"
                  type="date"
                  value={formData.endDate || ''}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </label>
              <p className="cms-date-note cms-wide">
                بتوقيت بغداد، ويشمل العرض يومي البداية والنهاية. التاريخ الفارغ يترك الحد المقابل مفتوحًا.
              </p>
            </>
          )}
        </div>

        {/* Live Draft Preview Toggle */}
        <button
          type="button"
          className="button secondary cms-preview-toggle"
          aria-expanded={showDraftPreview}
          onClick={() => setShowDraftPreview(v => !v)}
        >
          {showDraftPreview ? 'إخفاء معاينة التعديلات' : 'معاينة التعديلات الحالية'}
        </button>

        {showDraftPreview && (
          <section className="cms-draft-preview" aria-label="معاينة مسودة غير منشورة">
            <strong>معاينة التعديلات الحالية · غير منشورة</strong>
            <div>
              {/* Draft card rendering */}
              <article className="cms-card">
                <div className="cms-card-copy">
                  <div className="cms-card-title">
                    <h3>{formData.title || formData.question || formData.city || 'محتوى جديد'}</h3>
                    <span className="cms-state draft">
                      <span />
                      مسودة
                    </span>
                  </div>
                  <p>{formData.body || formData.answer || ''}</p>
                </div>
              </article>
            </div>
          </section>
        )}

        <div className="cms-form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => handleSave(false)}
          >
            حفظ كمسودة
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => handleSave(true)}
          >
            <Icon name="check" />
            نشر في المعاينة
          </button>
        </div>

        {record?.published && record?.draft && (
          <button
            type="button"
            className="cms-discard-draft"
            onClick={onDiscard}
          >
            تجاهل التعديلات المسودة المحفوظة
          </button>
        )}

        <p className="cms-form-note">
          النشر محلي داخل هذه المعاينة. لا يُرسل إشعارًا أو يغيّر محتوى تطبيق المسافرين الفعلي.
        </p>
      </form>
    </Drawer>
  );
}

