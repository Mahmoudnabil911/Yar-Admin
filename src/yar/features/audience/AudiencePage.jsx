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
const count = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);
const nameOf = (item) => String(item?.name || item?.customer_name || item?.display_name || '—');
const idOf = (item) => Number(item?.id ?? item?.user_id ?? item?.customer_id);
const itemsOf = (data) =>
  Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

function ErrorState({ error, retry, title = 'تعذر جلب البيانات' }) {
  return (
    <div className="aud-empty aud-error-state" role="alert">
      <Icon name="layers" />
      <strong>{title}</strong>
      <p>{error}</p>
      {retry && (
        <button className="button secondary" type="button" onClick={retry}>
          <Icon name="layers" /> إعادة المحاولة
        </button>
      )}
    </div>
  );
}

function LoadingState({ label = 'جاري التحميل...' }) {
  return (
    <div className="aud-loading" role="status">
      <div className="aud-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default function AudiencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const tabParam = searchParams.get('audienceTab');
  const [tab, setTab] = useState(tabs.some((item) => item.key === tabParam) ? tabParam : 'users');
  const [users, setUsers] = useState([]);
  const [audience, setAudience] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [active, setActive] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const loadData = useCallback(async () => {
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
      setError(e?.ar || e?.message || 'تعذر جلب البيانات من الخادم.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (tabParam && tabs.some((item) => item.key === tabParam) && tabParam !== tab) {
      setTab(tabParam);
      setPage(1);
      setQuery('');
    }
  }, [tabParam, tab]);

  // Tab 1: Dashboard Users (Admin & Booking Employees from API 092)
  const dashboardUsers = useMemo(() => {
    return users.filter((u) => u.role === 'admin' || u.role === 'booking_employee');
  }, [users]);

  const filteredDashboardUsers = useMemo(() => {
    return dashboardUsers.filter((user) => {
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
    });
  }, [dashboardUsers, query, role, active]);

  // Tab 2: App Users & Customers (Customers from API 115 & API 092)
  const appCustomers = useMemo(() => {
    const byId = new Map();
    // Start with customers from API 092
    users
      .filter((u) => u.role === 'customer' || !u.role)
      .forEach((u) => {
        byId.set(idOf(u), { ...u });
      });
    // Merge or append customer audience summaries from API 115
    audience.forEach((item) => {
      const id = idOf(item);
      const existing = byId.get(id) || {};
      byId.set(id, {
        ...existing,
        ...item,
        bookingCount:
          item.booking_count ??
          item.bookings_count ??
          item.bookingCount ??
          existing.booking_count ??
          null,
      });
    });
    return Array.from(byId.values());
  }, [users, audience]);

  const filteredAppCustomers = useMemo(() => {
    return appCustomers.filter((customer) => {
      const matchesQuery =
        !query ||
        [customer.name, customer.phone, customer.id].some((value) =>
          String(value || '')
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        );
      return matchesQuery && (active === 'all' || String(Boolean(customer.active)) === active);
    });
  }, [appCustomers, query, active]);

  const currentList = tab === 'users' ? filteredDashboardUsers : filteredAppCustomers;
  const pageCount = Math.max(1, Math.ceil(currentList.length / 10));

  const changeTab = (key) => {
    setTab(key);
    setPage(1);
    setQuery('');
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
      await loadData();
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
          <p>إدارة مستخدمي لوحة التحكم وعملاء التطبيق ومتابعة تقارير النشاط والاهتمامات.</p>
        </div>
        <span className="aud-local-badge">
          <span className="tiny-dot green" /> بيانات مباشرة
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
        {/* TAB 1: المستخدمون المسجلون (Dashboard Users - API 092) */}
        {tab === 'users' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>مستخدمو لوحة التحكم</h2>
                <p>حسابات المديرين وموظفي الحجوزات المصرح لهم بالدخول إلى لوحة الإدارة.</p>
              </div>
              <button className="button secondary" type="button" onClick={loadData}>
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
                  <option value="all">كل أدوار الإدارة</option>
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

            {loading ? (
              <LoadingState label="جاري تحميل مستخدمي لوحة التحكم..." />
            ) : error ? (
              <ErrorState error={error} retry={loadData} title="تعذر جلب المستخدمين" />
            ) : (
              <div className="table-scroll">
                {filteredDashboardUsers.length ? (
                  <table className="aud-user-table">
                    <thead>
                      <tr>
                        <th>المستخدم</th>
                        <th>الهاتف</th>
                        <th>الدور</th>
                        <th>الحالة</th>
                        <th>التحقق</th>
                        <th>التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDashboardUsers.slice((page - 1) * 10, page * 10).map((user) => (
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
                            <span className={`aud-status ${user.active ? 'active' : 'suspended'}`}>
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
            )}

            {!loading && !error && filteredDashboardUsers.length > 0 && (
              <div className="aud-pagination">
                <span>
                  عرض {(page - 1) * 10 + 1}–{Math.min(page * 10, filteredDashboardUsers.length)} من{' '}
                  {filteredDashboardUsers.length}
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

        {/* TAB 2: الزوار (عملاء ومستخدمو التطبيق - API 115 & API 092) */}
        {tab === 'visitors' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>عملاء ومستخدمو التطبيق</h2>
                <p>قائمة عملاء ومستخدمي تطبيق المسافر المسجلين وسجل حجوزاتهم.</p>
              </div>
              <button className="button secondary" type="button" onClick={loadData}>
                <Icon name="layers" /> تحديث
              </button>
            </div>

            <div className="aud-user-filters">
              <label className="aud-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="ابحث باسم العميل أو رقم الهاتف أو المعرّف…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
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

            {loading ? (
              <LoadingState label="جاري تحميل مستخدمي التطبيق..." />
            ) : error ? (
              <ErrorState error={error} retry={loadData} title="تعذر جلب مستخدمي التطبيق" />
            ) : (
              <div className="table-scroll">
                {filteredAppCustomers.length ? (
                  <table className="aud-user-table">
                    <thead>
                      <tr>
                        <th>العميل</th>
                        <th>الهاتف</th>
                        <th>الحالة</th>
                        <th>التحقق</th>
                        <th>الحجوزات</th>
                        <th>التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppCustomers.slice((page - 1) * 10, page * 10).map((customer) => (
                        <tr key={idOf(customer)}>
                          <td>
                            <div className="aud-user-name">
                              <span>{nameOf(customer).slice(0, 2)}</span>
                              <div>
                                <strong>{nameOf(customer)}</strong>
                                <small>#{idOf(customer)}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <bdi>{customer.phone || '—'}</bdi>
                          </td>
                          <td>
                            <span
                              className={`aud-status ${customer.active ? 'active' : 'suspended'}`}
                            >
                              {customer.active ? 'نشط' : 'غير نشط'}
                            </span>
                          </td>
                          <td>
                            {customer.verified === true
                              ? 'موثّق'
                              : customer.verified === false
                                ? 'غير موثّق'
                                : '—'}
                          </td>
                          <td>
                            {customer.bookingCount == null ? '—' : count(customer.bookingCount)}
                          </td>
                          <td>
                            <button
                              className="aud-user-open"
                              type="button"
                              onClick={() => setSelected(customer)}
                              aria-label={`تفاصيل ${nameOf(customer)}`}
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
                    <Icon name="globe" />
                    <strong>لا يوجد عملاء أو مستخدمو تطبيق</strong>
                    <p>لم يتم العثور على حسابات عملاء مسجلة حالياً.</p>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && filteredAppCustomers.length > 0 && (
              <div className="aud-pagination">
                <span>
                  عرض {(page - 1) * 10 + 1}–{Math.min(page * 10, filteredAppCustomers.length)} من{' '}
                  {filteredAppCustomers.length}
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

        {/* TAB 3: التقارير والتحليل (قيد التطوير في الـ Backend) */}
        {tab === 'reports' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>التقارير والتحليل</h2>
                <p>تحليلات وإحصاءات استخدام التطبيق ومؤشرات العمليات.</p>
              </div>
            </div>
            <div className="aud-empty">
              <Icon name="chart" />
              <strong>التقارير والتحليلات قيد التطوير</strong>
              <p>لم يتم تجهيز خوارزميات وتحليلات التقارير بعد من قِبل مطور الـ Backend.</p>
            </div>
          </section>
        )}

        {/* TAB 4: الطلب والاهتمامات (قيد التجهيز في الـ Backend) */}
        {tab === 'insights' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>الطلب والاهتمامات</h2>
                <p>تحليل سلوك واهتمامات مستخدمي التطبيق والأكثر طلباً.</p>
              </div>
            </div>
            <div className="aud-empty">
              <Icon name="search" />
              <strong>تحليلات الطلب والاهتمامات قيد التجهيز</strong>
              <p>
                سيتم ربط هذا القسم فور اكتمال خوارزميات تحليل طلبات واهتمامات مستخدمي التطبيق في الـ
                Backend.
              </p>
            </div>
          </section>
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
