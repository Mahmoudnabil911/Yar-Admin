import React, { useState, useEffect, useMemo } from 'react';
import { contentStorage } from '../../services/storage/contentStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { contentModel as M } from '../../services/models';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import ContentEditorDrawer from './ContentEditorDrawer';

const HERO = '/assets/content/tehran-airplane-window-v2.png';

const tabs = {
  home: 'الرئيسية والعروض',
  destinations: 'الوجهات المميزة',
  notifications: 'الإشعارات',
  faqs: 'الأسئلة الشائعة',
  support: 'الدعم والتواصل',
};

const states = {
  published: 'منشور في المعاينة',
  changes: 'منشور مع تعديلات مسودة',
  draft: 'مسودة',
  scheduled: 'مجدول',
  expired: 'منتهي',
  archived: 'مؤرشف',
};

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

function num(val) {
  return new Intl.NumberFormat('en-US').format(Number(val) || 0);
}

function normalizeSearch(val) {
  return String(val || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي');
}

export default function ContentPage() {
  const { showToast } = useToast();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return contentStorage.subscribe(() => setTick(t => t + 1));
  }, []);

  const [tab, setTab] = useState('home');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState('banners');
  const [editingRecord, setEditingRecord] = useState(null);

  const records = contentStorage.getRecords();
  const packages = catalogStorage.getRecords('packages');

  const kind = tab === 'home' ? 'banners' : tab;
  const singleton = type => records.find(r => r.kind === type);
  const working = r => r?.draft || r?.published || {};
  const titleOf = r => {
    const payload = working(r);
    return payload.title || payload.question || payload.city || 'محتوى بلا عنوان';
  };

  const linkedPrice = payload => {
    const linked = packages.find(item => item.id === payload.packageId && item.status === 'published');
    if (!linked || !['5', '7'].includes(payload.nights)) return '';
    const field = payload.nights === '5' ? 'price5USD' : 'price7USD';
    const prices = (Array.isArray(linked.hotelOptions) ? linked.hotelOptions : [])
      .map(opt => Number(opt[field]))
      .filter(p => Number.isFinite(p) && p > 0);
    return prices.length
      ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(Math.min(...prices))
      : '';
  };

  const effective = type => {
    return M.live(records, type, M.today()).filter(
      r => type !== 'banners' || r.payload.target !== 'package' || linkedPrice(r.payload)
    );
  };

  const stateBadge = r => {
    const s = M.stateOf(r, M.today());
    return (
      <span className={`cms-state ${s}`}>
        <span />
        {states[s] || 'مسودة'}
      </span>
    );
  };

  // List rows for current kind
  const { allRows, activeRows, rows } = useMemo(() => {
    if (tab === 'support') return { allRows: [], activeRows: [], rows: [] };
    const all = records.filter(r => r.kind === kind).sort((a, b) => a.order - b.order);
    const active = all.filter(r => !r.archived);
    const q = normalizeSearch(query);
    const filtered = all.filter(
      r =>
        (filter === 'all' || M.stateOf(r, M.today()) === filter) &&
        (!q || normalizeSearch(JSON.stringify(working(r))).includes(q))
    );
    return { allRows: all, activeRows: active, rows: filtered };
  }, [records, kind, tab, filter, query, tick]);

  const handleOpenAdd = () => {
    setEditingType(kind);
    setEditingRecord(null);
    setDrawerOpen(true);
  };

  const handleOpenEdit = (type, rec) => {
    setEditingType(type);
    setEditingRecord(rec);
    setDrawerOpen(true);
  };

  const handleSave = (payload, publish) => {
    try {
      const context = { packages };
      const beforeIds = new Set(records.map(i => i.id));
      let candidate = M.saveDraft(records, editingType, editingRecord?.id || null, payload, context);
      const saved = editingRecord
        ? candidate.find(i => i.id === editingRecord.id)
        : candidate.find(i => i.kind === editingType && !beforeIds.has(i.id));

      if (!saved) throw new Error('تعذر تحديد مسودة المحتوى المحفوظة.');
      if (publish) candidate = M.publish(candidate, saved.id, context);

      contentStorage.commit(candidate);
      setDrawerOpen(false);
      showToast(
        publish
          ? 'نُشرت النسخة في المعاينة المحلية.'
          : 'حُفظت المسودة محليًا، وبقيت النسخة المنشورة كما هي.'
      );
    } catch (err) {
      throw err;
    }
  };

  const handleDiscardDraft = () => {
    if (!editingRecord) return;
    try {
      const next = M.discardDraft(records, editingRecord.id);
      contentStorage.commit(next);
      setDrawerOpen(false);
      showToast('أُزيلت التعديلات المسودة؛ بقيت النسخة المنشورة.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handlePublishDirect = r => {
    try {
      const context = { packages };
      const next = M.publish(records, r.id, context);
      contentStorage.commit(next);
      showToast('نُشرت المسودة في المعاينة المحلية.');
    } catch (err) {
      handleOpenEdit(r.kind, r);
      showToast(err.message, 'error');
    }
  };

  const handleArchive = r => {
    try {
      const next = M.archive(records, r.id);
      contentStorage.commit(next);
      showToast('أُرشف المحتوى محليًا، ويمكن استعادته كمسودة.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRestore = r => {
    try {
      const next = M.restore(records, r.id);
      contentStorage.commit(next);
      showToast('أُعيد المحتوى كمسودة. انشره لإظهاره في المعاينة.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleMove = (r, delta) => {
    try {
      const next = M.move(records, r.id, delta);
      contentStorage.commit(next);
      showToast('حُدّث ترتيب المحتوى في المعاينة.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Preview interactive handlers
  const handleCtaClick = (target, msg = '') => {
    if (target === 'whatsapp') {
      showToast(msg ? `معاينة رسالة الدعم: ${msg}` : 'محاكاة فتح محادثة دعم عبر واتساب.');
    } else if (target === 'phone') {
      showToast('محاكاة الاتصال برقم الدعم.');
    } else {
      showToast(`محاكاة فتح ${targets[target] || 'القسم'} داخل التطبيق.`);
    }
  };

  const home = singleton('home');
  const support = singleton('support');

  return (
    <div className="cms-page">
      <div className="page-heading cms-heading">
        <div>
          <div className="eyebrow">إدارة محتوى التطبيق</div>
          <h1 id="content-title" tabIndex="-1">
            محتوى التطبيق
          </h1>
          <p>حرّر المحتوى واحتفظ بمسوداتك، ثم انشر النسخة التي تريد إظهارها في المعاينة المحلية.</p>
        </div>
        <span className="cms-local-badge">
          <span className="tiny-dot green" />
          محفوظ في هذا المتصفح
        </span>
      </div>

      {contentStorage.notice && (
        <div className="cms-notice" role="status">
          {contentStorage.notice}
        </div>
      )}

      {/* Tabs */}
      <div className="cms-tabs" role="tablist" aria-label="أقسام المحتوى">
        {Object.entries(tabs).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'selected' : ''}
            onClick={() => {
              setTab(key);
              setFilter('all');
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="cms-layout">
        {/* Main Content Area */}
        <div id="cms-main" className="cms-main" role="tabpanel">
          {tab === 'support' ? (
            <section className="panel cms-support-settings">
              <div className="cms-section-heading">
                <div>
                  <h2>الدعم والتواصل</h2>
                  <p>نقطة واحدة لبيانات الدعم التي تظهر داخل التطبيق.</p>
                </div>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => handleOpenEdit('support', support)}
                >
                  <Icon name="layers" />
                  تعديل بيانات الدعم
                </button>
              </div>

              {support && stateBadge(support)}
              <h3>{working(support).title || 'الدعم والتواصل'}</h3>
              <p>{working(support).body || 'أضف وصفًا يساعد المسافر على الوصول إلى فريقك.'}</p>

              <dl className="cms-support-details">
                <div>
                  <dt>واتساب</dt>
                  <dd>
                    <bdi>{working(support).whatsapp || 'غير محدد'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>الهاتف</dt>
                  <dd>
                    <bdi>{working(support).phone || 'غير محدد'}</bdi>
                  </dd>
                </div>
                <div>
                  <dt>أوقات العمل</dt>
                  <dd>{working(support).hours || 'لم تُحدد أوقات عمل'}</dd>
                </div>
              </dl>

              <p className="cms-section-note">
                تغيير الأرقام أو النصوص يحتاج نشرًا صريحًا في المعاينة. تجربة الزر لا تفتح اتصالًا أو ترسل رسالة.
              </p>
            </section>
          ) : (
            <>
              {tab === 'home' && (
                <section className="panel cms-home-settings">
                  <div className="cms-section-heading">
                    <div>
                      <h2>مقدمة الرئيسية</h2>
                      <p>النص قابل للتحرير، وصورة الواجهة المعتمدة ثابتة.</p>
                    </div>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => handleOpenEdit('home', home)}
                    >
                      <Icon name="layers" />
                      تعديل النص
                    </button>
                  </div>

                  <div className="cms-locked-hero">
                    <div className="cms-media">
                      <img src={HERO} alt="نافذة طائرة تطل على طهران" />
                    </div>
                    <div>
                      <span className="cms-lock-label">
                        <Icon name="check" />
                        الصورة المعتمدة
                      </span>
                      <h3>{working(home).title || 'عنوان الرئيسية'}</h3>
                      <p>{working(home).tagline || ''}</p>
                      {home && stateBadge(home)}
                    </div>
                  </div>
                </section>
              )}

              <section className="panel cms-list-panel">
                <div className="cms-section-heading">
                  <div>
                    <h2>{tab === 'home' ? 'البنرات والعروض' : tabs[tab]}</h2>
                    <p>
                      {num(rows.length)} من {num(allRows.length)} مادة · {num(effective(kind).length)} ظاهرة في المعاينة
                    </p>
                  </div>
                  <button className="button primary" type="button" onClick={handleOpenAdd}>
                    <Icon name="plus" />
                    إضافة{' '}
                    {kind === 'banners'
                      ? 'بنر'
                      : kind === 'destinations'
                      ? 'وجهة'
                      : kind === 'notifications'
                      ? 'إشعار'
                      : 'سؤال'}
                  </button>
                </div>

                <div className="cms-toolbar">
                  <label className="cms-search">
                    <Icon name="search" />
                    <input
                      type="search"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="ابحث في عنوان المحتوى أو نصه…"
                    />
                  </label>

                  <label className="cms-filter-label">
                    <span className="sr-only">حالة المحتوى</span>
                    <select value={filter} onChange={e => setFilter(e.target.value)}>
                      <option value="all">كل الحالات</option>
                      {Object.entries(states).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="cms-list">
                  {rows.length ? (
                    rows.map(record => {
                      const payload = working(record);
                      const index = activeRows.findIndex(item => item.id === record.id);
                      const description = payload.body || payload.answer || '';
                      const publishedRef =
                        record.kind === 'banners' &&
                        record.published?.target === 'package' &&
                        !linkedPrice(record.published);
                      const draftRef =
                        record.kind === 'banners' &&
                        record.draft?.target === 'package' &&
                        !linkedPrice(record.draft);
                      const referenceNote = publishedRef
                        ? 'الباقة المرتبطة أو سعرها غير متاح حاليًا؛ يبقى البنر محفوظًا ولا يظهر في معاينة التطبيق.'
                        : draftRef
                        ? 'رابط الباقة في المسودة يحتاج مراجعة قبل النشر.'
                        : '';

                      const meta =
                        record.kind === 'faqs'
                          ? faqCategories[payload.category]
                          : record.kind === 'notifications'
                          ? `${notificationCategories[payload.category] || ''} · ${audiences[payload.audience] || ''}`
                          : record.kind === 'destinations'
                          ? payload.city
                          : payload.target === 'package'
                          ? `باقة مرتبطة · ${payload.nights || '—'} ليالٍ`
                          : targets[payload.target] || '';

                      return (
                        <article
                          key={record.id}
                          className={`cms-card${referenceNote ? ' cms-needs-review' : ''}`}
                        >
                          {['banners', 'destinations'].includes(record.kind) ? (
                            <div className="cms-media cms-card-media">
                              {payload.image ? (
                                <img
                                  src={payload.image.startsWith('assets/') ? `/${payload.image}` : payload.image}
                                  alt={payload.imageAlt || titleOf(record)}
                                  loading="lazy"
                                />
                              ) : (
                                <span className="cms-image-fallback">
                                  <Icon name="layers" />
                                  لم تُحدد صورة
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="cms-card-symbol">
                              <Icon name={record.kind === 'faqs' ? 'help' : 'bell'} />
                            </span>
                          )}

                          <div className="cms-card-copy">
                            <div className="cms-card-title">
                              <h3>{titleOf(record)}</h3>
                              {stateBadge(record)}
                            </div>
                            <p>
                              {description.slice(0, 150)}
                              {description.length > 150 ? '…' : ''}
                            </p>
                            <small>
                              {meta}
                              {payload.startDate || payload.endDate ? (
                                <>
                                  {' '}
                                  ·{' '}
                                  <bdi>
                                    {payload.startDate || 'بداية مفتوحة'} ← {payload.endDate || 'نهاية مفتوحة'}
                                  </bdi>
                                </>
                              ) : null}
                            </small>
                            {referenceNote && (
                              <p className="cms-reference-warning">
                                <strong>يحتاج مراجعة:</strong> {referenceNote}
                              </p>
                            )}
                          </div>

                          <div className="cms-card-actions">
                            {record.archived ? (
                              <button
                                type="button"
                                className="cms-restore"
                                onClick={() => handleRestore(record)}
                              >
                                <Icon name="back" />
                                استعادة كمسودة
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="cms-edit"
                                  onClick={() => handleOpenEdit(record.kind, record)}
                                >
                                  <Icon name="layers" />
                                  تعديل
                                </button>
                                {record.draft && (
                                  <button
                                    type="button"
                                    className="cms-publish"
                                    onClick={() => handlePublishDirect(record)}
                                  >
                                    نشر المسودة
                                  </button>
                                )}
                                <div className="cms-order-actions">
                                  <button
                                    type="button"
                                    disabled={index <= 0}
                                    onClick={() => handleMove(record, -1)}
                                    aria-label={`رفع ترتيب ${titleOf(record)}`}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index >= activeRows.length - 1}
                                    onClick={() => handleMove(record, 1)}
                                    aria-label={`خفض ترتيب ${titleOf(record)}`}
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleArchive(record)}
                                    aria-label={`أرشفة ${titleOf(record)}`}
                                  >
                                    <Icon name="trash" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="cms-empty">
                      <Icon name="layers" />
                      <strong>لا يوجد محتوى مطابق</strong>
                      <p>غيّر البحث أو الحالة، أو أضف مادة جديدة.</p>
                    </div>
                  )}
                </div>
              </section>

              <p className="cms-section-note">
                الترتيب يغيّر تسلسل المحتوى داخل هذه المعاينة. حفظ المسودة يحافظ على النسخة المنشورة حتى تختار «نشر في
                المعاينة».
              </p>
            </>
          )}
        </div>

        {/* Live App Device Preview Aside */}
        <aside className="cms-preview" aria-label="معاينة المحتوى المنشور">
          <div className="cms-preview-heading">
            <div>
              <h2>معاينة التطبيق</h2>
              <p>النسخ المنشورة والسارية اليوم فقط</p>
            </div>
            <span>
              <bdi>{M.today()}</bdi>
            </span>
          </div>

          <div className="cms-device">
            <div className="cms-device-header">
              <img src="/assets/yar-logo.svg" alt="YAR" />
              <span>معاينة محلية</span>
            </div>

            <div className="cms-preview-content">
              {tab === 'home' ? (
                <>
                  {effective('home')[0] && (
                    <section className="cms-app-hero">
                      <div className="cms-media">
                        <img src={HERO} alt="نافذة طائرة تطل على طهران" />
                      </div>
                      <div>
                        <h3>{effective('home')[0].payload.title || 'عنوان الرئيسية'}</h3>
                        <p>{effective('home')[0].payload.tagline || ''}</p>
                      </div>
                    </section>
                  )}

                  {effective('banners').length ? (
                    <>
                      <h3 className="cms-preview-section-title">باقات وعروض مختارة</h3>
                      {effective('banners').map(item => {
                        const price = item.payload.target === 'package' ? linkedPrice(item.payload) : '';
                        const imgSrc = item.payload.image?.startsWith('assets/')
                          ? `/${item.payload.image}`
                          : item.payload.image;
                        return (
                          <article key={item.id} className="cms-app-banner">
                            <div className="cms-media">
                              <img src={imgSrc} alt={item.payload.imageAlt || item.payload.title} />
                            </div>
                            <div>
                              <h3>{item.payload.title || 'عنوان العرض'}</h3>
                              <p>{item.payload.body || ''}</p>
                              {item.payload.target === 'package' && (
                                <div className="cms-package-price">
                                  {price ? (
                                    <>
                                      <strong>
                                        من <bdi>{price} $</bdi>
                                      </strong>
                                      <small>{item.payload.nights} ليالٍ · للشخص عند حجز شخصين</small>
                                    </>
                                  ) : (
                                    <small>سعر الباقة المرتبطة غير متاح حاليًا</small>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                disabled={item.payload.target === 'package' && !price}
                                onClick={() => handleCtaClick(item.payload.target || 'packages')}
                              >
                                {item.payload.buttonLabel || 'عرض التفاصيل'}
                                <Icon name="chevronLeft" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </>
                  ) : (
                    <p className="cms-preview-empty">لا توجد عروض منشورة وسارية اليوم.</p>
                  )}
                </>
              ) : (
                <>
                  {effective(tab).length ? (
                    effective(tab).map(item => {
                      const p = item.payload;
                      const imgSrc = p.image?.startsWith('assets/') ? `/${p.image}` : p.image;
                      if (tab === 'destinations') {
                        return (
                          <article key={item.id} className="cms-app-destination">
                            <div className="cms-media">
                              <img src={imgSrc} alt={p.imageAlt || p.city} />
                            </div>
                            <div>
                              <span>{p.city || 'وجهة'}</span>
                              <h3>{p.title || 'عنوان الوجهة'}</h3>
                              <p>{p.body || ''}</p>
                              <button type="button" onClick={() => handleCtaClick('destination')}>
                                اكتشف الوجهة
                                <Icon name="chevronLeft" />
                              </button>
                            </div>
                          </article>
                        );
                      }
                      if (tab === 'notifications') {
                        return (
                          <article key={item.id} className="cms-app-notification">
                            <span>
                              <Icon name="bell" />
                              {notificationCategories[p.category] || 'إشعار'}
                            </span>
                            <h3>{p.title || 'عنوان الإشعار'}</h3>
                            <p>{p.body || ''}</p>
                            <small>{audiences[p.audience] || 'الجميع'}</small>
                            {p.target && p.target !== 'none' && (
                              <button type="button" onClick={() => handleCtaClick(p.target)}>
                                فتح في المعاينة
                                <Icon name="chevronLeft" />
                              </button>
                            )}
                          </article>
                        );
                      }
                      if (tab === 'faqs') {
                        return (
                          <details key={item.id} className="cms-app-faq">
                            <summary>{p.question || 'السؤال'}</summary>
                            <p>{p.answer || 'الإجابة'}</p>
                          </details>
                        );
                      }
                      // support
                      return (
                        <section key={item.id} className="cms-app-support">
                          <span className="cms-support-mark">
                            <Icon name="help" />
                          </span>
                          <h3>{p.title || 'الدعم والتواصل'}</h3>
                          <p>{p.body || ''}</p>
                          {p.whatsapp && (
                            <button
                              type="button"
                              onClick={() => handleCtaClick('whatsapp', p.message || '')}
                            >
                              {p.buttonLabel || 'تواصل عبر واتساب'}
                              <bdi>+{p.whatsapp}</bdi>
                            </button>
                          )}
                          {p.phone && (
                            <button type="button" onClick={() => handleCtaClick('phone')}>
                              اتصل بنا <bdi>+{p.phone}</bdi>
                            </button>
                          )}
                          {p.hours && <small>{p.hours}</small>}
                        </section>
                      );
                    })
                  ) : (
                    <p className="cms-preview-empty">لا يوجد محتوى منشور وسارٍ في هذا القسم اليوم.</p>
                  )}
                </>
              )}
            </div>
          </div>

          <p className="cms-preview-note">
            المسودات والمؤرشف والمحتوى خارج فترة العرض لا يظهر هنا. الأزرار محاكاة داخل المعاينة، والإشعارات لا تُرسل
            إلى المستخدمين.
          </p>
        </aside>
      </div>

      {/* Editor Drawer */}
      <ContentEditorDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        type={editingType}
        record={editingRecord}
        onSave={handleSave}
        onDiscard={handleDiscardDraft}
      />
    </div>
  );
}

