import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '../../lib/router';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';
import { audienceApi } from '../../services/api/audienceApi';
import UserDetailsDrawer from './UserDetailsDrawer';

const tabs = [
  { key: 'users', label: 'المستخدمون المسجلون', icon: 'users' },
  { key: 'visitors', label: 'الزوار', icon: 'globe' },
  { key: 'reports', label: 'التقارير والتحليل', icon: 'chart' },
  { key: 'insights', label: 'الطلب والاهتمامات', icon: 'search' },
];
const roleLabels = { admin: 'مدير', booking_employee: 'موظف حجوزات', customer: 'عميل' };
const eventLabels = {
  screen_view: 'مشاهدة شاشة',
  catalog_view: 'مشاهدة كتالوج',
  search: 'بحث',
  banner_impression: 'ظهور إعلان',
  banner_click: 'نقر إعلان',
  booking_intent: 'نية حجز',
};
const count = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);
const displayValue = (value) =>
  value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const nameOf = (item) => String(item?.name || item?.customer_name || item?.display_name || '—');
const idOf = (item) => Number(item?.id ?? item?.user_id ?? item?.customer_id);
const itemsOf = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

function ErrorMessage({ error, retry }) {
  return (
    <div className="aud-storage-notice" role="alert">
      {error}
      <button className="button secondary" type="button" onClick={retry}>
        إعادة المحاولة
      </button>
    </div>
  );
}

function ReportPanel({ report, loading, error, onRefresh, title }) {
  if (loading) return <div className="panel aud-panel">جاري تحميل التقرير...</div>;
  if (error) return <ErrorMessage error={error} retry={onRefresh} />;
  if (!report) return <div className="panel aud-panel">لا تتوفر بيانات تقرير من الخادم.</div>;
  const eventRows = Object.entries(report.event_counts || {}).flatMap(([key, value]) => {
    if (value && typeof value === 'object')
      return Object.entries(value).map(([subkey, n]) => ({
        key: `${key}.${subkey}`,
        label: `${eventLabels[key] || key} · ${subkey}`,
        value: n,
      }));
    return [{ key, label: eventLabels[key] || key, value }];
  });
  const sections = Array.isArray(report.top_sections)
    ? report.top_sections
    : Object.entries(report.top_sections || {}).map(([name, value]) => ({ name, count: value }));
  return (
    <section className="panel aud-panel">
      <div className="aud-panel-heading">
        <div>
          <h2>{title}</h2>
          <p>ملخص مجمّع من API 118؛ لا يعرض سجلات أو أحداث أفراد.</p>
        </div>
        <button className="button secondary" type="button" onClick={onRefresh}>
          <Icon name="layers" /> تحديث
        </button>
      </div>
      {report.synthetic_data === true && (
        <p className="aud-storage-notice">الخادم يعلّم هذه النتائج كبيانات اصطناعية.</p>
      )}
      <div className="aud-metrics aud-api-report-metrics">
        <article className="aud-metric">
          <div>
            <span>حجم العينة</span>
            <Icon name="users" />
          </div>
          <strong>
            <bdi>{displayValue(report.sample_size)}</bdi>
          </strong>
        </article>
        <article className="aud-metric">
          <div>
            <span>العينة محدودة</span>
            <Icon name="filter" />
          </div>
          <strong>
            {typeof report.sample_limited === 'boolean'
              ? report.sample_limited
                ? 'نعم'
                : 'لا'
              : displayValue(report.sample_limited)}
          </strong>
        </article>
      </div>
      <div className="aud-two-columns aud-api-report-grid">
        <section className="panel aud-panel">
          <h3>الأحداث</h3>
          {eventRows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>الحدث</th>
                    <th>العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {eventRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>
                        {count(
                          typeof row.value === 'object'
                            ? Object.values(row.value).reduce((a, v) => a + (Number(v) || 0), 0)
                            : row.value,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>لا توجد أحداث مسجلة في التقرير.</p>
          )}
        </section>
        <section className="panel aud-panel">
          <h3>أكثر الأقسام نشاطًا</h3>
          {sections.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>القسم</th>
                    <th>العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((row, i) => (
                    <tr key={String(row.name || row.section || i)}>
                      <td>{row.name || row.section || row.key || '—'}</td>
                      <td>{count(row.count ?? row.events ?? row.total ?? row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>لا توجد أقسام في التقرير.</p>
          )}
        </section>
      </div>
      <p className="aud-definition">
        تقرير سلوك التطبيق مجمّع، بلا فترة أو منصة أو بيانات خام بحسب عقد الـAPI الحالي.
      </p>
    </section>
  );
}

export default function AudiencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const tabParam = searchParams.get('audienceTab');
  const [tab, setTab] = useState(tabs.some((item) => item.key === tabParam) ? tabParam : 'users');
  const [users, setUsers] = useState([]);
  const [audience, setAudience] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState('');
  const [reportError, setReportError] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [active, setActive] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [directory, audienceResult] = await Promise.all([
        catalogAdminApi.getUsers(true),
        audienceApi.getAudience(300),
      ]);
      setUsers(itemsOf(directory));
      setAudience(itemsOf(audienceResult));
    } catch (e) {
      setError(e?.ar || e?.message || 'تعذر جلب المستخدمين من الخادم.');
    } finally {
      setLoading(false);
    }
  }, []);
  const loadReport = useCallback(async () => {
    setReportLoading(true);
    setReportError('');
    try {
      setReport(await audienceApi.getBehaviorReport());
    } catch (e) {
      setReportError(e?.ar || e?.message || 'تعذر جلب تقرير السلوك من الخادم.');
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);
  useEffect(() => {
    if (tab !== 'users') loadReport();
  }, [tab, loadReport]);
  useEffect(() => {
    if (tab === 'users' && users.length && !selected) setSelected(null);
  }, [tab, users, selected]);

  const mergedUsers = useMemo(() => {
    const byId = new Map(audience.map((item) => [idOf(item), item]));
    return users.map((user) => {
      const summary = byId.get(idOf(user)) || {};
      return {
        ...summary,
        ...user,
        bookingCount:
          summary.booking_count ??
          summary.bookings_count ??
          summary.bookingCount ??
          summary.bookings ??
          null,
      };
    });
  }, [users, audience]);
  const filtered = useMemo(
    () =>
      mergedUsers.filter((user) => {
        const matchesQuery =
          !query ||
          [user.name, user.phone, user.id].some((value) =>
            String(value || '')
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
          );
        return (
          matchesQuery &&
          (role === 'all' || user.role === role) &&
          (active === 'all' || String(Boolean(user.active)) === active)
        );
      }),
    [mergedUsers, query, role, active],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));

  const changeTab = (key) => {
    setTab(key);
    setPage(1);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('audienceTab', key);
      return next;
    });
  };
  const updateSelected = async (patch) => {
    try {
      await audienceApi.updateUser(idOf(selected), patch);
      showToast('تم تحديث المستخدم في الخادم.');
      await loadUsers();
      setSelected((current) => (current ? { ...current, ...patch } : current));
    } catch (e) {
      showToast(e?.ar || e?.message || 'تعذر تحديث المستخدم.', 'error');
    }
  };

  return (
    <div className="aud-page">
      <div className="page-heading aud-heading">
        <div>
          <div className="eyebrow">الجمهور والتحليل</div>
          <h1 id="audience-title" tabIndex="-1">
            المستخدمون والزوار
          </h1>
          <p>بيانات الحسابات وملخص الجمهور وتقارير الأحداث من الخادم.</p>
        </div>
        <span className="aud-local-badge">
          <span className="tiny-dot green" /> بيانات مباشرة من الخادم
        </span>
      </div>
      <div className="aud-tabs" role="tablist" aria-label="أقسام الجمهور">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={tab === item.key ? 'selected' : ''}
            onClick={() => changeTab(item.key)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
      <div id="aud-tab-content" role="tabpanel">
        {tab === 'users' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>المستخدمون المسجلون</h2>
              </div>
              <button className="button secondary" type="button" onClick={loadUsers}>
                <Icon name="layers" /> تحديث
              </button>
            </div>
            <div className="aud-user-filters">
              <label className="aud-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="ابحث بالاسم أو رقم الهاتف أو المعرّف…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <label className="aud-field">
                <span className="sr-only">الدور</span>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">كل الأدوار</option>
                  <option value="customer">العملاء</option>
                  <option value="booking_employee">موظفو الحجوزات</option>
                  <option value="admin">المديرون</option>
                </select>
              </label>
              <label className="aud-field">
                <span className="sr-only">حالة الحساب</span>
                <select
                  value={active}
                  onChange={(e) => {
                    setActive(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">كل الحالات</option>
                  <option value="true">نشط</option>
                  <option value="false">غير نشط</option>
                </select>
              </label>
            </div>
            {error && <ErrorMessage error={error} retry={loadUsers} />}
            {loading ? (
              <div className="aud-empty">جاري تحميل المستخدمين...</div>
            ) : (
              !error && (
                <div className="table-scroll">
                  {filtered.length ? (
                    <table className="aud-user-table">
                      <thead>
                        <tr>
                          <th>المستخدم</th>
                          <th>الهاتف</th>
                          <th>الدور</th>
                          <th>الحالة</th>
                          <th>التحقق</th>
                          <th>الحجوزات</th>
                          <th>التفاصيل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice((page - 1) * 10, page * 10).map((user) => (
                          <tr key={idOf(user)}>
                            <td>
                              <div className="aud-user-name">
                                <span>{nameOf(user).slice(0, 2)}</span>
                                <div>
                                  <strong>{nameOf(user)}</strong>
                                  <small>#{idOf(user)}</small>
                                </div>
                              </div>
                            </td>
                            <td>
                              <bdi>{user.phone || '—'}</bdi>
                            </td>
                            <td>{roleLabels[user.role] || user.role || '—'}</td>
                            <td>
                              <span
                                className={`aud-status ${user.active ? 'active' : 'suspended'}`}
                              >
                                {user.active ? 'نشط' : 'غير نشط'}
                              </span>
                            </td>
                            <td>
                              {user.verified === true
                                ? 'موثّق'
                                : user.verified === false
                                  ? 'غير موثّق'
                                  : '—'}
                            </td>
                            <td>{user.bookingCount == null ? '—' : count(user.bookingCount)}</td>
                            <td>
                              <button
                                className="aud-user-open"
                                type="button"
                                onClick={() => setSelected(user)}
                                aria-label={`تفاصيل ${nameOf(user)}`}
                              >
                                <Icon name="chevronLeft" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="aud-empty">
                      <Icon name="users" />
                      <strong>لا توجد حسابات مطابقة</strong>
                      <p>غيّر البحث أو المرشحات.</p>
                    </div>
                  )}
                </div>
              )
            )}
            {!loading && !error && filtered.length > 0 && (
              <div className="aud-pagination">
                <span>
                  عرض {(page - 1) * 10 + 1}–{Math.min(page * 10, filtered.length)} من{' '}
                  {filtered.length}
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page <= 1}
                    aria-label="الصفحة السابقة"
                  >
                    <Icon name="back" />
                  </button>
                  <span>
                    {page} / {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= pageCount}
                    aria-label="الصفحة التالية"
                  >
                    <Icon name="chevronLeft" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        {tab === 'visitors' && (
          <>
            <div className="aud-storage-notice">
              الـAPI المتاح لا يعرض قائمة زوار أو جلسات فردية. المعروض أدناه هو ملخص أحداث مجمّع
              فقط.
            </div>
            <ReportPanel
              report={report}
              loading={reportLoading}
              error={reportError}
              onRefresh={loadReport}
              title="ملخص نشاط التطبيق"
            />
          </>
        )}
        {(tab === 'reports' || tab === 'insights') && (
          <ReportPanel
            report={report}
            loading={reportLoading}
            error={reportError}
            onRefresh={loadReport}
            title={
              tab === 'reports'
                ? 'تقارير وتحليل أحداث التطبيق'
                : 'الطلب والاهتمامات · أحداث التطبيق'
            }
          />
        )}
      </div>
      <UserDetailsDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onToggleActive={() => selected && updateSelected({ active: !selected.active })}
      />
    </div>
  );
}
