import PartoFlightPanel from './PartoFlightPanel';
import { uiLocale } from '../../i18n/prefs';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { isAuthenticated } from '../../services/api/authApi';
import { suppliersApi } from '../../services/api/suppliersApi';
import { flightsApi } from '../../services/api/flightsApi';
import { bookingsApi } from '../../services/api/bookingsApi';

const STORAGE = 'YAR_ADMIN_PROVIDER_OPS_V1';

const connectionLabels = {
  healthy: 'متاح',
  slow: 'استجابة بطيئة',
  offline: 'غير متصل',
  manual: 'إدارة يدوية',
  unconfigured: 'غير مهيّأ',
  disabled: 'معطّل',
};

const simConnectionLabels = {
  healthy: 'متاح · محاكاة',
  slow: 'استجابة بطيئة · محاكاة',
  offline: 'غير متصل · محاكاة',
  manual: 'إدارة يدوية',
  unconfigured: 'غير مهيّأ',
  disabled: 'معطّل',
};

const operationLabels = {
  test: 'اختبار الربط',
  search: 'بحث',
  book: 'حجز',
  issue: 'إصدار',
  configure: 'تحديث الإعدادات',
  toggle: 'تغيير التشغيل',
};

const resultLabels = {
  healthy: 'نجاح الاختبار',
  slow: 'نجاح مع بطء',
  offline: 'تعذر الاتصال',
  success: 'محاكاة ناجحة',
  failed: 'محاكاة غير ناجحة',
  fallback: 'استخدام المزوّد البديل',
  updated: 'حُفظ بنجاح',
};

function mapServerSupplier(sup, fallbacks = {}) {
  const idStr = String(sup.id);
  const conn = sup.connection_state || (sup.integration === 'manual' ? 'manual' : 'unconfigured');
  return {
    id: idStr,
    name: sup.name || `مورّد #${sup.id}`,
    serviceType: sup.service_type || 'flight',
    integration: sup.integration || 'manual',
    channel: sup.channel || 'manual',
    environment: sup.environment || 'test',
    priority: sup.priority != null ? Number(sup.priority) : 1,
    operatingEnabled: sup.operating_enabled !== false,
    connectionState: conn,
    status: sup.active === false ? 'archived' : 'published',
    fallbackProviderId: fallbacks[idStr] || '',
  };
}

export function ProviderOpsPage({ searchQuery = '', onSearchChange, onNavigate }) {
  const toast = useToast();
  const hasAuth = isAuthenticated();

  const [providers, setProviders] = useState(() =>
    hasAuth ? [] : catalogStorage.getRecords('providers')
  );
  const [bookings, setBookings] = useState(() =>
    hasAuth ? [] : operationsStorage.getBookings()
  );
  const [flightStatus, setFlightStatus] = useState(null);
  const [loading, setLoading] = useState(hasAuth);
  const [savingConfig, setSavingConfig] = useState(false);

  const [filter, setFilter] = useState('all'); // 'all', 'enabled', 'disabled'

  // Persistent scenario overrides, fallback mappings, and logs
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.version === 1 && saved.scenarios && Array.isArray(saved.logs)) {
          return { fallbacks: {}, ...saved };
        }
      }
    } catch {
      // fallback
    }
    return { scenarios: {}, fallbacks: {}, logs: [] };
  });

  // Modal / Drawer state
  const [configDrawer, setConfigDrawer] = useState({ open: false, providerId: '' });
  const [detailDrawer, setDetailDrawer] = useState({ open: false, providerId: '' });
  const [drawerError, setDrawerError] = useState('');

  // Config form state
  const [cfgPriority, setCfgPriority] = useState('1');
  const [cfgEnv, setCfgEnv] = useState('test');
  const [cfgFallback, setCfgFallback] = useState('');

  // Detail / Sim state
  const [simScenario, setSimScenario] = useState('healthy');

  const savePrefs = useCallback((next) => {
    const payload = {
      version: 1,
      scenarios: next.scenarios || {},
      fallbacks: next.fallbacks || {},
      logs: (next.logs || []).slice(-300),
    };
    try {
      localStorage.setItem(STORAGE, JSON.stringify(payload));
      setPrefs(payload);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loadBackendData = useCallback(async () => {
    if (!isAuthenticated()) return;
    setLoading(true);
    try {
      const [supRes, statusRes, bookRes] = await Promise.all([
        suppliersApi.listAdminSuppliers().catch(() => suppliersApi.getSuppliers()),
        flightsApi.getFlightStatus().catch(() => null),
        bookingsApi.listBookings({ limit: 200 }).catch(() => ({ items: [] })),
      ]);

      const supItems = Array.isArray(supRes?.items) ? supRes.items : [];
      setProviders(supItems.map((s) => mapServerSupplier(s, prefs.fallbacks)));

      if (statusRes) setFlightStatus(statusRes);

      const bookItems = Array.isArray(bookRes?.items) ? bookRes.items : [];
      setBookings(
        bookItems.map((b) => ({
          id: b.id,
          providerId: b.supplier_id ? String(b.supplier_id) : '',
          serviceType: b.service_type || '',
        }))
      );
    } catch {
      // keep existing state on transient error
    } finally {
      setLoading(false);
    }
  }, [prefs.fallbacks]);

  useEffect(() => {
    if (hasAuth) {
      loadBackendData();
      return undefined;
    }
    const unsubCat = catalogStorage.subscribe(() => setProviders(catalogStorage.getRecords('providers')));
    const unsubOps = operationsStorage.subscribe(() => setBookings(operationsStorage.getBookings()));
    return () => {
      unsubCat();
      unsubOps();
    };
  }, [hasAuth, loadBackendData]);

  const addLog = (providerId, operation, result, message, usedProviderId = '') => {
    const log = {
      id: `provider-log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      providerId,
      operation,
      result,
      message,
      usedProviderId,
      at: new Date().toISOString(),
    };
    savePrefs({ scenarios: prefs.scenarios, fallbacks: prefs.fallbacks, logs: [...prefs.logs, log] });
    return log;
  };

  // Flight providers sorted by priority
  const flightProviders = useMemo(() => {
    return providers
      .filter((p) => p.serviceType === 'flight')
      .sort((a, b) => (Number(a.priority) || 100) - (Number(b.priority) || 100) || a.name.localeCompare(b.name, 'ar'));
  }, [providers]);

  const isEnabled = (row) => Boolean(row && row.status === 'published' && row.operatingEnabled !== false);
  const getChannel = (row) => ({ ndc: 'NDC', gds: 'GDS', direct: 'API', other: 'API', manual: 'يدوي' }[row.channel] || 'API');
  const getConnection = (row) => {
    if (row.integration === 'manual') return 'manual';
    if (prefs.scenarios[row.id]) return prefs.scenarios[row.id];
    if (hasAuth && flightStatus) {
      return flightStatus.flights_configured && flightStatus.flight_search_enabled ? 'healthy' : 'offline';
    }
    return ['healthy', 'slow', 'offline'].includes(row.connectionState) ? row.connectionState : 'offline';
  };

  const activeConnLabels = hasAuth ? connectionLabels : simConnectionLabels;

  const filteredRows = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return flightProviders.filter((row) => {
      const enabled = isEnabled(row);
      if (filter === 'enabled' && !enabled) return false;
      if (filter === 'disabled' && enabled) return false;
      if (q) {
        const text = `${row.name} ${row.id} ${getChannel(row)} ${activeConnLabels[getConnection(row)] || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [flightProviders, filter, searchQuery, prefs.scenarios, hasAuth, flightStatus]);

  const counts = useMemo(() => {
    const total = flightProviders.length;
    const enabled = flightProviders.filter(isEnabled).length;
    const offline = flightProviders.filter((r) => isEnabled(r) && getConnection(r) === 'offline').length;
    const simOps = prefs.logs.filter((l) => ['search', 'book', 'issue'].includes(l.operation)).length;
    return { total, enabled, offline, simOps };
  }, [flightProviders, prefs, hasAuth, flightStatus]);

  const handleToggle = async (id, currentEnabled) => {
    const next = !currentEnabled;
    const p = flightProviders.find((item) => item.id === id);
    if (hasAuth) {
      try {
        await suppliersApi.updateSupplier(id, { operating_enabled: next });
        setProviders((prev) =>
          prev.map((item) => (item.id === id ? { ...item, operatingEnabled: next } : item))
        );
        addLog(id, 'toggle', 'updated', `${next ? 'تفعيل' : 'إيقاف'} تشغيل ${p?.name || id} على الخادم.`);
        toast(next ? 'فُعّل تشغيل المزوّد على الخادم.' : 'أُوقف تشغيل المزوّد على الخادم.');
      } catch (err) {
        toast(err.message || 'تعذر تحديث حالة التشغيل على الخادم.');
      }
      return;
    }

    try {
      catalogStorage.updateProvider(id, { operatingEnabled: next });
      addLog(id, 'toggle', 'updated', `${next ? 'تفعيل' : 'إيقاف'} تشغيل ${p?.name || id} في المحاكاة.`);
      toast(next ? 'فُعّل تشغيل المزوّد في المحاكاة.' : 'أُوقف تشغيل المزوّد في المحاكاة.');
    } catch (err) {
      toast(err.message);
    }
  };

  const openConfig = (id) => {
    const p = flightProviders.find((item) => item.id === id);
    if (!p) return;
    setCfgPriority(String(p.priority || 1));
    setCfgEnv(p.environment || 'test');
    setCfgFallback(p.fallbackProviderId || '');
    setDrawerError('');
    setConfigDrawer({ open: true, providerId: id });
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setDrawerError('');
    const prio = Number(cfgPriority);
    if (!Number.isInteger(prio) || prio < 1 || prio > 100) {
      setDrawerError('الأولوية يجب أن تكون رقمًا صحيحًا من 1 إلى 100.');
      return;
    }

    if (hasAuth) {
      setSavingConfig(true);
      try {
        await suppliersApi.updateSupplier(configDrawer.providerId, {
          priority: prio,
          environment: cfgEnv,
        });
        const nextFallbacks = { ...prefs.fallbacks, [configDrawer.providerId]: cfgFallback };
        savePrefs({ scenarios: prefs.scenarios, fallbacks: nextFallbacks, logs: prefs.logs });
        setProviders((prev) =>
          prev.map((item) =>
            item.id === configDrawer.providerId
              ? { ...item, priority: prio, environment: cfgEnv, fallbackProviderId: cfgFallback }
              : item
          )
        );
        addLog(
          configDrawer.providerId,
          'configure',
          'updated',
          `تحديث الأولوية إلى ${prio} والبيئة إلى ${cfgEnv === 'production' ? 'إنتاج' : 'اختبار'}${cfgFallback ? ' وتحديد مزوّد بديل.' : ' دون مزوّد بديل.'}`
        );
        toast('حُفظت إعدادات التشغيل على الخادم.');
        setConfigDrawer({ open: false, providerId: '' });
      } catch (err) {
        setDrawerError(err.message || 'تعذر حفظ الإعدادات على الخادم.');
      } finally {
        setSavingConfig(false);
      }
      return;
    }

    try {
      catalogStorage.updateProvider(configDrawer.providerId, {
        priority: prio,
        environment: cfgEnv,
        fallbackProviderId: cfgFallback,
      });
      addLog(
        configDrawer.providerId,
        'configure',
        'updated',
        `تحديث الأولوية إلى ${prio} والبيئة إلى ${cfgEnv === 'production' ? 'إنتاج · محاكاة' : 'اختبار · محاكاة'}${cfgFallback ? ' وتحديد مزوّد بديل.' : ' دون مزوّد بديل.'}`
      );
      toast('حُفظت إعدادات التشغيل في قائمة المزوّدين.');
      setConfigDrawer({ open: false, providerId: '' });
    } catch (err) {
      setDrawerError(err.message);
    }
  };

  const openDetail = (id) => {
    const p = flightProviders.find((item) => item.id === id);
    if (!p) return;
    setSimScenario(getConnection(p));
    setDrawerError('');
    setDetailDrawer({ open: true, providerId: id });
  };

  const handleApplyScenario = (newScenario) => {
    setSimScenario(newScenario);
    const nextScenarios = { ...prefs.scenarios, [detailDrawer.providerId]: newScenario };
    savePrefs({ scenarios: nextScenarios, fallbacks: prefs.fallbacks, logs: prefs.logs });
    toast(`تم تعيين حالة سيناريو الاتصال إلى: ${connectionLabels[newScenario] || newScenario}`);
  };

  const runSimOperation = async (operation) => {
    const p = flightProviders.find((item) => item.id === detailDrawer.providerId);
    if (!p) return;
    const conn = getConnection(p);

    if (operation === 'test') {
      if (hasAuth) {
        const started = performance.now();
        try {
          const st = await flightsApi.getFlightStatus();
          setFlightStatus(st);
          const ms = Math.round(performance.now() - started);
          const isReady = Boolean(st?.flights_configured && st?.flight_search_enabled);
          const res = !isReady ? 'offline' : ms > 1500 ? 'slow' : 'healthy';
          const msg = !isReady
            ? `الخادم متصل (${ms} مللي ثانية) لكن ربط الطيران غير مفعّل (${st?.environment || 'disabled'}).`
            : `اتصال سليم بـ ${p.name} عبر الخادم. زمن الاستجابة: ${ms} مللي ثانية.`;
          addLog(p.id, 'test', res, msg);
          toast(msg);
        } catch (err) {
          addLog(p.id, 'test', 'offline', `تعذر فحص حالة الربط من الخادم: ${err.message}`);
          toast(err.message || 'تعذر فحص الاتصال بالخادم.');
        }
        return;
      }

      const res = conn === 'offline' ? 'offline' : conn === 'slow' ? 'slow' : 'healthy';
      const msg =
        res === 'offline'
          ? `تعذر الاتصال بـ ${p.name}. زمن الاستجابة: غير متاح.`
          : res === 'slow'
          ? `تم الاتصال بـ ${p.name} مع زمن استجابة مرتفع: 1860 مللي ثانية.`
          : `اتصال سليم بـ ${p.name}. زمن الاستجابة: 420 مللي ثانية. نجاح 99.2%.`;
      addLog(p.id, 'test', res, msg);
      toast(msg);
      return;
    }

    // search / book / issue
    if (conn === 'offline') {
      const fallback = flightProviders.find((f) => f.id === p.fallbackProviderId && isEnabled(f));
      if (fallback) {
        addLog(
          p.id,
          operation,
          'fallback',
          `تعذر طلب ${operationLabels[operation]} من ${p.name}؛ تم التحويل تلقائيًا إلى المزوّد البديل ${fallback.name}.`,
          fallback.id
        );
        toast(`تم التحويل إلى المزوّد البديل: ${fallback.name}`);
      } else {
        addLog(
          p.id,
          operation,
          'failed',
          `فشل طلب ${operationLabels[operation]} على ${p.name} بسبب انقطاع الاتصال ودون توفر مزوّد بديل نشط.`
        );
        toast(`تعذر إتمام العملية على ${p.name}`);
      }
    } else {
      addLog(
        p.id,
        operation,
        'success',
        `تمت محاكاة ${operationLabels[operation]} بنجاح عبر ${p.name} (${getChannel(p)}).`
      );
      toast(`نجحت محاكاة ${operationLabels[operation]}`);
    }
  };

  const activeProvider = flightProviders.find(
    (p) => p.id === (configDrawer.providerId || detailDrawer.providerId)
  );
  const fallbackOptions = flightProviders.filter(
    (p) => p.id !== configDrawer.providerId && p.status === 'published'
  );
  const providerLogs = prefs.logs.filter(
    (l) => l.providerId === detailDrawer.providerId || l.usedProviderId === detailDrawer.providerId
  );

  return (
    <div className="pops-page ops-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">ربط تقني وتشغيل</div>
          <h1 id="provider-ops-title" tabIndex={-1}>ربط الطيران وواجهات </h1>
          <p>مراقبة سرعة الاستجابة وتشغيل الاتصال والمزوّد البديل ومحاكاة البحث والحجز والإصدار.</p>
        </div>
      </div>

      <p className="ops-notice">
        {hasAuth
          ? 'متصل بالخادم · بيانات حية'
          : 'معاينة تقنية محلية فقط · الاتصالات والقنوات تمثيلية، ولا توجد مفاتيح API أو طلبات خارجية.'}
      </p>

      <PartoFlightPanel flightStatus={flightStatus} />

      {/* 4 Stat chips */}
      <div className="ops-stats" style={{ marginBottom: 20 }}>
        <div className="ops-stat">
          <span>مزوّدو الطيران</span>
          <strong>{counts.total}</strong>
        </div>
        <div className="ops-stat">
          <span>المفعّلون حاليًا</span>
          <strong>{counts.enabled}</strong>
        </div>
        <div className="ops-stat">
          <span>{hasAuth ? 'غير متصل / معطّل' : 'سيناريو غير متصل'}</span>
          <strong style={{ color: counts.offline > 0 ? 'var(--c-924b42)' : 'inherit' }}>{counts.offline}</strong>
        </div>
        <div className="ops-stat">
          <span>{hasAuth ? 'عمليات الفحص المسجلة' : 'عمليات محاكاة مسجلة'}</span>
          <strong>{counts.simOps}</strong>
        </div>
      </div>

      <section className="panel ops-card">
        <div className="ops-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <label className="ops-search" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 400, background: 'var(--c-f7f9f3)', border: '1px solid var(--c-e2e9da)', borderRadius: 7, padding: '7px 12px' }}>
            <i data-icon="search"><Icon name="search" /></i>
            <input
              type="search"
              placeholder="ابحث باسم المزوّد أو القناة..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              style={{ border: 0, background: 'none', outline: 0, width: '100%', font: 'inherit', fontSize: 12, color: 'var(--green)' }}
            />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--c-ffffff)', fontSize: 12 }}
            >
              <option value="all">كل الحالات</option>
              <option value="enabled">المفعّلون فقط</option>
              <option value="disabled">المتوقفون فقط</option>
            </select>
          </div>
        </div>

        <div className="table-scroll">
          {loading ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--muted)' }}>
              جاري تحميل مزوّدي الطيران وحالة الربط من الخادم...
            </div>
          ) : filteredRows.length > 0 ? (
            <table className="ops-table pops-table">
              <thead>
                <tr>
                  <th>المزوّد</th>
                  <th>حالة الاتصال والسرعة</th>
                  <th>التشغيل</th>
                  <th>الأولوية والبديل</th>
                  <th>الحجوزات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const conn = getConnection(row);
                  const enabled = isEnabled(row);
                  const latest = prefs.logs.filter((l) => l.providerId === row.id && l.operation === 'test').at(-1);
                  const fallback = flightProviders.find((p) => p.id === row.fallbackProviderId);
                  const rowBookings = bookings.filter((b) => b.providerId === row.id);

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="pops-person">
                          <span>{row.name.charAt(0)}</span>
                          <div>
                            <strong>{row.name}</strong>
                            <small>
                              {getChannel(row)} ·{' '}
                              {row.environment === 'production'
                                ? hasAuth
                                  ? 'بيئة إنتاج'
                                  : 'بيئة إنتاج · محاكاة'
                                : hasAuth
                                ? 'بيئة اختبار'
                                : 'بيئة اختبار · محاكاة'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`pops-connection ${conn}`}>
                          <span></span>
                          {activeConnLabels[conn] || conn}
                        </span>
                        <small className="pops-sub">
                          {latest
                            ? `آخر اختبار: ${new Date(latest.at).toLocaleTimeString(uiLocale(), { timeZone: 'Asia/Baghdad', hour: '2-digit', minute: '2-digit' })}`
                            : 'لم يُنفذ اختبار بعد'}
                        </small>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`pops-switch ${enabled ? 'is-on' : ''}`}
                          role="switch"
                          aria-checked={enabled}
                          disabled={row.status !== 'published'}
                          onClick={() => handleToggle(row.id, enabled)}
                          title={row.status !== 'published' ? 'انشر المزوّد من إدارة الخدمات أولًا' : undefined}
                        >
                          <span></span>
                        </button>
                        <small className="pops-sub">
                          {row.status === 'published' ? (enabled ? 'مفعّل' : 'موقوف') : row.status === 'archived' ? 'مؤرشف' : 'مسودة'}
                        </small>
                      </td>
                      <td>
                        <strong>{row.priority || 1}</strong>
                        <small className="pops-sub">
                          {fallback ? `البديل: ${fallback.name}` : row.fallbackProviderId ? 'البديل غير متاح؛ راجع الإعدادات' : 'دون بديل محدد'}
                        </small>
                      </td>
                      <td>{rowBookings.length}</td>
                      <td>
                        <div className="pops-actions" style={{ display: 'flex', gap: 6 }}>
                          <button type="button" className="quiet-button" onClick={() => openDetail(row.id)}>
                            التشغيل والسجل
                          </button>
                          <button type="button" className="quiet-button" onClick={() => openConfig(row.id)}>
                            الإعدادات
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <i data-icon="search"><Icon name="search" /></i>
              <strong>لا توجد سجلات مطابقة</strong>
              <p>تأكد من وجود مزوّدي طيران منشورين في إدارة المزوّدين.</p>
            </div>
          )}
        </div>

        <div className="table-footer">
          <span>{filteredRows.length} من {flightProviders.length} مزوّدين · الأولوية 1 هي الأعلى</span>
        </div>
      </section>

      {/* Config Drawer */}
      {configDrawer.open && activeProvider && (
        <Drawer
          open={configDrawer.open}
          onClose={() => setConfigDrawer({ open: false, providerId: '' })}
          eyebrow={hasAuth ? 'إعدادات المزوّد · الخادم' : 'محاكاة ربط · دون اتصالات خارجية'}
          title="إعدادات تشغيل المزوّد"
        >
          <form className="pops-form" onSubmit={handleSaveConfig}>
            <div className="pops-profile" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--c-eaf0e2)', display: 'grid', placeItems: 'center', color: 'var(--green)' }}>
                <Icon name="plane" />
              </span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{activeProvider.name}</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>
                  {getChannel(activeProvider)} · {hasAuth ? 'متصل بالخادم' : 'محاكاة ربط'}
                </p>
              </div>
            </div>

            {drawerError && (
              <div className="form-error" role="alert" style={{ marginBottom: 14 }}>
                {drawerError}
              </div>
            )}

            <div className="ops-form-grid" style={{ marginBottom: 16 }}>
              <label className="ops-field">
                <span>أولوية الاختيار<span className="required-mark">*</span></span>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={cfgPriority}
                  onChange={(e) => setCfgPriority(e.target.value)}
                  required
                  disabled={savingConfig}
                />
              </label>

              <label className="ops-field">
                <span>البيئة</span>
                <select value={cfgEnv} onChange={(e) => setCfgEnv(e.target.value)} disabled={savingConfig}>
                  <option value="test">اختبار (Test)</option>
                  <option value="production">إنتاج (Production)</option>
                </select>
              </label>

              <label className="ops-field wide">
                <span>المزوّد البديل عند تعذر الطلب</span>
                <select value={cfgFallback} onChange={(e) => setCfgFallback(e.target.value)} disabled={savingConfig}>
                  <option value="">دون مزوّد بديل</option>
                  {fallbackOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.operatingEnabled === false ? '· موقوف' : ''} {f.integration === 'manual' ? '· يدوي' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="ops-note" style={{ marginBottom: 16 }}>
              الأولوية الأقل تُختار أولًا عند توجيه الطلبات. يُستخدم البديل المحدد إذا كان منشورًا ومفعّلًا.
            </p>

            <div className="pops-form-actions" style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="button primary" disabled={savingConfig}>
                <i><Icon name="check" /></i>
                {savingConfig ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setConfigDrawer({ open: false, providerId: '' })}
                disabled={savingConfig}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Drawer>
      )}

      {/* Detail / Simulator Drawer */}
      {detailDrawer.open && activeProvider && (
        <Drawer
          open={detailDrawer.open}
          onClose={() => setDetailDrawer({ open: false, providerId: '' })}
          eyebrow={hasAuth ? 'اختبار الربط والمحاكاة' : 'محاكاة الاستجابة والعمليات'}
          title={`${activeProvider.name} · التشغيل والسجل`}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, margin: '0 0 8px 0' }}>{hasAuth ? 'حالة الاتصال والاختبار' : 'سيناريو الاتصال التجريبي'}</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {['healthy', 'slow', 'offline'].map((sc) => (
                <button
                  key={sc}
                  type="button"
                  className={`button ${simScenario === sc ? 'primary' : 'secondary'}`}
                  style={{ fontSize: 12, minHeight: 34, padding: '4px 10px' }}
                  onClick={() => handleApplyScenario(sc)}
                >
                  {activeConnLabels[sc]}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button type="button" className="button secondary" onClick={() => runSimOperation('test')}>
                اختبار سرعة الاتصال
              </button>
              <button type="button" className="button secondary" onClick={() => runSimOperation('search')}>
                {hasAuth ? 'اختبار بحث طيران' : 'محاكاة بحث طيران'}
              </button>
              <button type="button" className="button secondary" onClick={() => runSimOperation('book')}>
                {hasAuth ? 'اختبار حجز تذكرة' : 'محاكاة حجز تذكرة'}
              </button>
              <button type="button" className="button secondary" onClick={() => runSimOperation('issue')}>
                {hasAuth ? 'اختبار إصدار تذكرة' : 'محاكاة إصدار تذكرة'}
              </button>
            </div>
          </div>

          <section className="ops-section">
            <h3>{hasAuth ? 'سجل العمليات والاختبارات' : 'سجل عمليات المحاكاة'}</h3>
            {providerLogs.length > 0 ? (
              <ol className="pops-timeline" style={{ paddingInlineStart: 16, margin: 0 }}>
                {providerLogs.slice().reverse().map((l) => (
                  <li key={l.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{operationLabels[l.operation] || l.operation}</strong>
                      <span className={`pops-result ${l.result}`}>
                        {resultLabels[l.result] || l.result}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0', fontSize: 12 }}>{l.message}</p>
                    <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                      <bdi>{new Date(l.at).toLocaleTimeString(uiLocale(), { timeZone: 'Asia/Baghdad' })}</bdi> · توقيت بغداد
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="pops-note">لا توجد إجراءات محاكاة مسجلة بعد.</p>
            )}
          </section>
        </Drawer>
      )}
    </div>
  );
}

export default ProviderOpsPage;
