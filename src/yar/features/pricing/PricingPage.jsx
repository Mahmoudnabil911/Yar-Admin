import React, { useState, useEffect, useMemo } from 'react';
import { pricingStorage } from '../../services/storage/pricingStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { pricingEngine as E } from '../../services/models';
import { Icon } from '../../components/ui/Icon';
import Drawer from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import PricingSimulator from './PricingSimulator';
import PricingRuleModal from './PricingRuleModal';

const kindLabels = { markup: 'هامش ربح', discount: 'خصم' };
const statusLabels = { active: 'سارية', disabled: 'متوقفة', scheduled: 'مجدولة', expired: 'منتهية', 'needs-review': 'تحتاج مراجعة' };
const currencyLabels = { IQD: 'د.ع', USD: '$' };

function money(value, currency) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'USD' ? 2 : 0,
    maximumFractionDigits: currency === 'USD' ? 2 : 0,
  }).format(value)} ${currencyLabels[currency] || ''}`;
}

function ruleValue(rule) {
  return rule.mode === 'percent'
    ? `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rule.value)}%`
    : money(rule.value, rule.currency);
}

function comparable(value) {
  return String(value).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
}

function dateText(rule) {
  if (!rule.startDate && !rule.endDate) return 'دون حد زمني';
  if (!rule.startDate) return `حتى ${rule.endDate}`;
  if (!rule.endDate) return `من ${rule.startDate}`;
  return `${rule.startDate} ← ${rule.endDate}`;
}

export default function PricingPage() {
  const { showToast } = useToast();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return pricingStorage.subscribe(() => setTick(t => t + 1));
  }, []);

  const [tab, setTab] = useState('markup'); // 'markup' | 'discount'
  const [query, setQuery] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState(null);

  const rules = pricingStorage.getRules();
  const providers = catalogStorage.getRecords('providers');

  const scopeText = rule => {
    const pName =
      rule.providerId === 'all'
        ? 'جميع المزوّدين'
        : providers.find(p => p.id === rule.providerId)?.name || 'مزوّد غير متاح';
    const sName = E.services[rule.service] || rule.service;
    const parts = [sName, pName, rule.currency];

    const scope = E.normalizeFlightScope(rule);
    if (scope.routeFrom || scope.routeTo) {
      parts.push(`${scope.routeFrom || 'أي مغادرة'} → ${scope.routeTo || 'أي وصول'}`);
    }
    if (scope.carrier) {
      parts.push(`شركة ${scope.carrier}`);
    }
    if (scope.cabin) {
      parts.push(E.cabins[scope.cabin] || scope.cabin);
    }
    return parts.join(' · ');
  };

  const filteredRules = useMemo(() => {
    const kindRules = rules.filter(r => r.kind === tab);
    const q = comparable(query);
    if (!q) return kindRules;
    return kindRules.filter(r =>
      comparable(`${r.name} ${scopeText(r)} ${dateText(r)}`).includes(q)
    );
  }, [rules, tab, query, providers]);

  const handleOpenAdd = () => {
    setSelectedRule({
      id: '',
      kind: tab,
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
    setModalOpen(true);
  };

  const handleOpenEdit = r => {
    setSelectedRule(JSON.parse(JSON.stringify(r)));
    setModalOpen(true);
  };

  const handleSaveRule = ruleRecord => {
    try {
      pricingStorage.saveRule(ruleRecord);
      setModalOpen(false);
      showToast('حُفظت قاعدة التسعير في هذا المتصفح.');
    } catch (err) {
      showToast(err.message || 'تعذر حفظ القاعدة.', 'error');
    }
  };

  const handleToggle = r => {
    try {
      pricingStorage.toggleRule(r.id);
      showToast(r.enabled ? 'أُوقفت القاعدة في المحاكاة.' : 'فُعّلت القاعدة في المحاكاة.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteConfirm = () => {
    if (!ruleToDelete) return;
    try {
      pricingStorage.deleteRule(ruleToDelete.id);
      setDeleteDrawerOpen(false);
      showToast('مُسحت قاعدة التسعير. يمكنك التراجع عن المسح.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRestore = () => {
    try {
      pricingStorage.restoreDeleted();
      showToast('استُعيدت القاعدة كما كانت.');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const today = E.today();

  return (
    <div className="pr-page">
      <div className="page-heading pr-heading">
        <div>
          <div className="eyebrow">إدارة التسعير</div>
          <h1 id="pricing-title" tabIndex="-1">
            الأسعار والخصومات
          </h1>
          <p>نظّم هامش الربح والعروض حسب الخدمة والمزوّد، وراجع أثرها على السعر قبل اعتمادها في عملك.</p>
        </div>
        <span className="pr-local-badge">
          <span className="tiny-dot green" />
          محاكاة محفوظة في هذا المتصفح
        </span>
      </div>

      <div className="pr-layout">
        {/* Rules Panel */}
        <section className="panel pr-rules-panel" aria-label="قواعد التسعير">
          {/* Tabs */}
          <div className="pr-tabs" role="tablist" aria-label="نوع قواعد التسعير">
            <button
              type="button"
              id="pr-tab-markup"
              role="tab"
              aria-selected={tab === 'markup'}
              className={tab === 'markup' ? 'selected' : ''}
              onClick={() => setTab('markup')}
            >
              <Icon name="wallet" />
              هوامش الربح
            </button>
            <button
              type="button"
              id="pr-tab-discount"
              role="tab"
              aria-selected={tab === 'discount'}
              className={tab === 'discount' ? 'selected' : ''}
              onClick={() => setTab('discount')}
            >
              <Icon name="tag" />
              الخصومات
            </button>
          </div>

          <div id="pr-rules-content" role="tabpanel">
            <div className="pr-toolbar">
              <div>
                <h2>قواعد التسعير</h2>
                <p>
                  {filteredRules.length} {tab === 'markup' ? 'قاعدة هامش ربح' : 'قاعدة خصم'}
                </p>
              </div>
              <button className="button primary" type="button" onClick={handleOpenAdd}>
                <Icon name="plus" />
                إضافة {kindLabels[tab]}
              </button>
            </div>

            <label className="pr-search">
              <Icon name="search" />
              <input
                type="search"
                aria-label="البحث في قواعد التسعير"
                placeholder="ابحث باسم القاعدة أو الخدمة أو المزوّد…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </label>

            {pricingStorage.notice && (
              <div className="pr-notice" role="status">
                {pricingStorage.notice}
              </div>
            )}

            {pricingStorage.deleted && (
              <div className="pr-undo" role="status">
                <span>مُسحت قاعدة «{pricingStorage.deleted.rule.name}».</span>
                <button className="button secondary" type="button" onClick={handleRestore}>
                  التراجع عن المسح
                </button>
              </div>
            )}

            <div className="pr-rule-list">
              {filteredRules.length ? (
                filteredRules.map(r => {
                  const hasError = E.validate(r, rules, providers);
                  const statusKey = hasError ? 'needs-review' : E.status(r, today);
                  return (
                    <article key={r.id} className="pr-rule-row">
                      <span className="pr-rule-icon">
                        <Icon name={r.kind === 'markup' ? 'wallet' : 'tag'} />
                      </span>
                      <div className="pr-rule-copy">
                        <strong>{r.name}</strong>
                        <p>{scopeText(r)}</p>
                        <small>
                          <bdi>{dateText(r)}</bdi> · توقيت بغداد
                        </small>
                      </div>
                      <div className="pr-rule-value">
                        <strong>
                          <bdi>{ruleValue(r)}</bdi>
                        </strong>
                        <small>{r.mode === 'percent' ? 'نسبة مئوية' : 'مبلغ ثابت'}</small>
                      </div>
                      <span className={`pr-status ${statusKey}`}>{statusLabels[statusKey] || 'تحتاج مراجعة'}</span>
                      <div className="pr-rule-actions">
                        <div className="pr-action-buttons">
                          <button
                            className="pr-edit"
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            aria-label={`تعديل ${r.name}`}
                          >
                            <Icon name="layers" />
                            تعديل
                          </button>
                          <button
                            className="pr-edit pr-delete"
                            type="button"
                            onClick={() => {
                              setRuleToDelete(r);
                              setDeleteDrawerOpen(true);
                            }}
                            aria-label={`مسح ${r.name}`}
                          >
                            <Icon name="close" />
                            مسح
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`pr-switch${r.enabled ? ' is-on' : ''}`}
                          role="switch"
                          aria-checked={r.enabled}
                          aria-label={`تفعيل ${r.name}`}
                          onClick={() => handleToggle(r)}
                        >
                          <span />
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="pr-empty">
                  <Icon name={tab === 'markup' ? 'wallet' : 'tag'} />
                  <strong>{query ? 'لا توجد قواعد مطابقة' : 'لا توجد قواعد في هذا القسم'}</strong>
                  <p>{query ? 'جرّب اسمًا أو نطاقًا آخر للبحث.' : 'أضف قاعدة وحدّد الخدمة والمزوّد والعملة.'}</p>
                </div>
              )}
            </div>
          </div>

          <div className="pr-scope-note">
            <Icon name="layers" />
            <p>
              تُطبّق قاعدة واحدة للهامش وقاعدة واحدة للخصم: المزوّد المحدد أولًا، ثم الخدمة، ثم القاعدة العامة. داخل
              المستوى نفسه تتقدم القاعدة ذات الحقول المحددة الأكثر للمسار والشركة والمقصورة. يُمنع تعادل الأولوية في نطاق
              متقاطع، ويُحسب الخصم بعد إضافة الهامش.
            </p>
          </div>
        </section>

        {/* Live Simulator Aside */}
        <PricingSimulator rules={rules} providers={providers} />
      </div>

      {/* Add / Edit Drawer */}
      <PricingRuleModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        rule={selectedRule}
        rules={rules}
        providers={providers}
        onSave={handleSaveRule}
      />

      {/* Delete Confirmation Drawer */}
      <Drawer
        isOpen={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        title="مسح قاعدة التسعير"
        badgeText="مراجعة القاعدة قبل المسح"
      >
        {ruleToDelete && (
          <>
            <div className="pr-delete-card">
              <h3>{ruleToDelete.name}</h3>
              <p>{scopeText(ruleToDelete)}</p>
              <strong>
                <bdi>{ruleValue(ruleToDelete)}</bdi>
              </strong>
            </div>
            <p className="drawer-note">
              ستُزال هذه القاعدة من التسعير والمحاكاة للطلبات الجديدة. أسعار الحجوزات السابقة المحفوظة تبقى كما هي.
              يمكنك التراجع عن آخر مسح من صفحة القواعد.
            </p>
            <div className="pr-form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                className="button pr-delete-confirm"
                type="button"
                onClick={handleDeleteConfirm}
              >
                تأكيد المسح
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => setDeleteDrawerOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

