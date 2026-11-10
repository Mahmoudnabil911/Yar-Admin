import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from '../../lib/router';
import { audienceData as D } from '../../services/models';
import { audienceStorage } from '../../services/storage/audienceStorage';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import UserDetailsDrawer from './UserDetailsDrawer';
import BehaviorInsightsTab from '../behavior/BehaviorInsightsTab';

const platforms = { all: 'كل المنصات', ios: 'iOS', android: 'Android' };
const statuses = { active: 'نشط', suspended: 'موقوف محليًا' };
const audienceTabs = [
  { key: 'users', label: 'المستخدمون المسجلون', icon: 'users' },
  { key: 'visitors', label: 'الزوار', icon: 'globe' },
  { key: 'reports', label: 'التقارير والتحليل', icon: 'chart' },
  { key: 'insights', label: 'الطلب والاهتمامات', icon: 'search' },
];

function maskedPhone(value) {
  const text = String(value || '');
  if (/[Xx*]/.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  return digits ? `07XX XXX XX${digits.slice(-2)}` : 'غير متاح';
}

function percent(value) {
  return value == null || !Number.isFinite(value)
    ? '—'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;
}

function num(val) {
  return new Intl.NumberFormat('en-US').format(Number(val) || 0);
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default function AudiencePage({ onOpenBooking }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    return audienceStorage.subscribe(() => setTick(t => t + 1));
  }, []);

  const today = useMemo(() => D.today(), []);

  const tabParam = searchParams.get('audienceTab');
  const [tab, setTab] = useState(
    audienceTabs.some(t => t.key === tabParam) ? tabParam : 'users'
  );

  const [period, setPeriod] = useState('30');
  const [startDate, setStartDate] = useState(D.shiftDate(today, -29));
  const [endDate, setEndDate] = useState(today);
  const [platform, setPlatform] = useState('all');
  const [periodError, setPeriodError] = useState('');

  // User tab state
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const demoData = audienceStorage.getRawDemoData();

  const handleTabChange = newTab => {
    setTab(newTab);
    setUserPage(1);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('audienceTab', newTab);
      return p;
    });
  };

  const handlePeriodChange = e => {
    const val = e.target.value;
    setPeriod(val);
    if (val !== 'custom') {
      const newEnd = today;
      const newStart = D.shiftDate(today, val === '7' ? -6 : -29);
      setStartDate(newStart);
      setEndDate(newEnd);
      setPeriodError('');
      setUserPage(1);
    }
  };

  const handleApplyPeriod = e => {
    e.preventDefault();
    if (!validDate(startDate) || !validDate(endDate)) {
      setPeriodError('حدّد تاريخ بداية ونهاية صالحين.');
      return;
    }
    if (startDate > endDate) {
      setPeriodError('يجب أن يسبق تاريخ البداية تاريخ النهاية أو يساويه.');
      return;
    }
    if (endDate > today) {
      setPeriodError('اختر فترة تنتهي اليوم أو قبله.');
      return;
    }
    const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1;
    if (days > 90) {
      setPeriodError('اختر فترة لا تتجاوز 90 يومًا.');
      return;
    }
    setPeriodError('');
    setUserPage(1);
  };

  const filters = useMemo(() => {
    return { startDate, endDate, platform };
  }, [startDate, endDate, platform]);

  const report = useMemo(() => {
    try {
      return D.report(demoData, filters);
    } catch {
      return null;
    }
  }, [demoData, filters]);

  const usersList = useMemo(() => {
    const statusOverrides = audienceStorage.getAllStatuses();
    return D.listUsers(demoData, {
      ...filters,
      query,
      city,
      status,
      statuses: statusOverrides,
    });
  }, [demoData, filters, query, city, status, tick]);

  const citiesList = useMemo(() => {
    return [...new Set(demoData.users.map(u => u.city))].sort((a, b) => a.localeCompare(b, 'ar'));
  }, [demoData]);

  // CSV Exports
  const downloadCSV = (name, rows) => {
    try {
      const csvStr =
        '\ufeff' +
        rows
          .map(r =>
            r
              .map(val => {
                let text = String(val ?? '');
                if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
                return `"${text.replace(/"/g, '""')}"`;
              })
              .join(',')
          )
          .join('\r\n');
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('صُدّرت بيانات المثال وفق المرشحات الحالية.');
    } catch {
      showToast('تعذر إنشاء ملف التصدير في هذا المتصفح.', 'error');
    }
  };

  const handleExportUsers = () => {
    if (!usersList.length) return showToast('لا توجد حسابات مطابقة لتصديرها.');
    downloadCSV(`YAR-demo-users-${startDate}-${endDate}.csv`, [
      [
        'الاسم',
        'الهاتف المقنّع',
        'المدينة',
        'إنشاء الحساب',
        'المنصة',
        'الحالة المحلية',
        'عدد الطلبات لكل الفترات',
        'آخر نشاط لكل الفترات',
        'بداية فترة التسجيل',
        'نهاية فترة التسجيل',
      ],
      ...usersList.map(u => [
        u.name,
        maskedPhone(u.phone),
        u.city,
        u.createdAt,
        platforms[u.platform],
        statuses[audienceStorage.getEffectiveStatus(u)],
        u.requestCount,
        u.lastActivity || '',
        startDate,
        endDate,
      ]),
    ]);
  };

  const handleExportVisitors = () => {
    if (!report) return;
    const rows = [
      ['نوع التجميع', 'البند', 'العدد', 'الحصة من الجلسات المجهولة %', 'بداية الفترة', 'نهاية الفترة', 'المنصة المطبقة'],
      ['ملخص', 'جلسات مجهولة', report.anonymousSessions, '', startDate, endDate, platforms[platform]],
      ['ملخص', 'أجهزة متصفح مجهولة', report.anonymousDevices, '', startDate, endDate, platforms[platform]],
      ['ملخص', 'جلسات بحساب مسجل', report.identifiedSessions, '', startDate, endDate, platforms[platform]],
      ['ملخص', 'أجهزة مجهولة عائدة', report.returningAnonymousDevices, '', startDate, endDate, platforms[platform]],
      ...report.sources.map(g => [
        'المصدر',
        g.label,
        g.anonymousSessions,
        report.anonymousSessions ? Number(((g.anonymousSessions / report.anonymousSessions) * 100).toFixed(2)) : '',
        startDate,
        endDate,
        platforms[platform],
      ]),
      ...report.platforms.map(g => [
        'المنصة',
        g.label,
        g.anonymousSessions,
        report.anonymousSessions ? Number(((g.anonymousSessions / report.anonymousSessions) * 100).toFixed(2)) : '',
        startDate,
        endDate,
        platforms[platform],
      ]),
    ];
    downloadCSV(`YAR-demo-visitors-${startDate}-${endDate}.csv`, rows);
  };

  const handleExportReport = () => {
    if (!report) return;
    downloadCSV(`YAR-demo-report-${startDate}-${endDate}.csv`, [
      [
        'التاريخ',
        'الجلسات',
        'الحسابات الجديدة',
        'الطلبات المرسلة',
        'معدل إرسال الطلب من الجلسات %',
        'المنصة المطبقة',
      ],
      ...report.trend.map(day => [
        day.date,
        day.sessions,
        day.newAccounts,
        day.requests,
        day.sessions ? Number(((day.requests / day.sessions) * 100).toFixed(2)) : '',
        platforms[platform],
      ]),
    ]);
  };

  // Trend chart rendering calculations
  const trendChart = useMemo(() => {
    if (!report) return null;
    const points = report.trend || [];
    const max = Math.max(1, ...points.map(p => Math.max(p.sessions, p.newAccounts, p.requests)));
    const x = index => (points.length === 1 ? 328 : 43 + (index * 570) / Math.max(1, points.length - 1));
    const y = val => 158 - (val / max) * 124;

    const area = points.length
      ? `M${x(0)} 158 ${points.map((p, i) => `L${x(i).toFixed(2)} ${y(p.sessions).toFixed(2)}`).join(' ')} L${x(
          points.length - 1
        )} 158 Z`
      : '';

    const labelIndexes = [
      ...new Set([
        0,
        Math.floor((points.length - 1) / 4),
        Math.floor((points.length - 1) / 2),
        Math.floor(((points.length - 1) * 3) / 4),
        points.length - 1,
      ]),
    ].filter(i => i >= 0 && i < points.length);

    return { points, max, x, y, area, labelIndexes };
  }, [report]);

  return (
    <div className="aud-page">
      <div className="page-heading aud-heading">
        <div>
          <div className="eyebrow">الجمهور والتحليل</div>
          <h1 id="audience-title" tabIndex="-1">
            المستخدمون والزوار
          </h1>
          <p>راجع الحسابات المسجلة ونشاط الجلسات ومسار إرسال الطلبات في بيانات مثال محلية.</p>
        </div>
        <span className="aud-local-badge">
          <span className="tiny-dot green" />
          بيانات تجريبية · دون تتبّع فعلي
        </span>
      </div>

      {/* Period Toolbar */}
      <form className="panel aud-toolbar" onSubmit={handleApplyPeriod}>
        <label className="aud-field" htmlFor="aud-period">
          <span>الفترة</span>
          <select id="aud-period" value={period} onChange={handlePeriodChange}>
            <option value="7">آخر 7 أيام</option>
            <option value="30">آخر 30 يومًا</option>
            <option value="custom">فترة مخصصة</option>
          </select>
        </label>

        <div className="aud-date-filter">
          <label className="aud-field" htmlFor="aud-start">
            <span>من</span>
            <input
              id="aud-start"
              type="date"
              required
              max={today}
              value={startDate}
              disabled={period !== 'custom'}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>
          <label className="aud-field" htmlFor="aud-end">
            <span>إلى</span>
            <input
              id="aud-end"
              type="date"
              required
              max={today}
              value={endDate}
              disabled={period !== 'custom'}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <label className="aud-field" htmlFor="aud-platform">
          <span>المنصة</span>
          <select id="aud-platform" value={platform} onChange={e => setPlatform(e.target.value)}>
            {Object.entries(platforms).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button className="button secondary" type="submit">
          <Icon name="filter" />
          تطبيق الفترة
        </button>

        {periodError && (
          <div className="aud-filter-error" role="alert" tabIndex="-1">
            {periodError}
          </div>
        )}

        <p className="aud-period-note">
          الفترة المطبقة: {startDate} ← {endDate} · {platforms[platform]} · توقيت بغداد
        </p>
      </form>

      {audienceStorage.notice && (
        <div className="aud-storage-notice" role="status">
          {audienceStorage.notice}
        </div>
      )}

      {/* Tabs */}
      <div className="aud-tabs" role="tablist" aria-label="أقسام الجمهور">
        {audienceTabs.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? 'selected' : ''}
            onClick={() => handleTabChange(t.key)}
          >
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div id="aud-tab-content" role="tabpanel">
        {tab === 'users' && (
          <section className="panel aud-panel">
            <div className="aud-panel-heading">
              <div>
                <h2>المستخدمون المسجلون</h2>
                <p>تُحدّد الفترة حسب تاريخ إنشاء الحساب. عدد الطلبات وآخر نشاط يشملان كل فترات المثال.</p>
              </div>
              <button className="button secondary" type="button" onClick={handleExportUsers}>
                <Icon name="download" />
                تصدير المستخدمين
              </button>
            </div>

            <div className="aud-user-filters">
              <label className="aud-search">
                <Icon name="search" />
                <input
                  type="search"
                  placeholder="ابحث بالاسم أو رقم الهاتف المقنّع أو المدينة…"
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    setUserPage(1);
                  }}
                />
              </label>

              <label className="aud-field" htmlFor="aud-city">
                <span className="sr-only">المدينة</span>
                <select
                  id="aud-city"
                  value={city}
                  onChange={e => {
                    setCity(e.target.value);
                    setUserPage(1);
                  }}
                >
                  <option value="all">كل المدن</option>
                  {citiesList.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="aud-field" htmlFor="aud-status">
                <span className="sr-only">الحالة</span>
                <select
                  id="aud-status"
                  value={status}
                  onChange={e => {
                    setStatus(e.target.value);
                    setUserPage(1);
                  }}
                >
                  <option value="all">كل الحالات</option>
                  <option value="active">نشط</option>
                  <option value="suspended">موقوف محليًا</option>
                </select>
              </label>
            </div>

            <div className="table-scroll">
              {usersList.length ? (
                <table className="aud-user-table">
                  <caption className="sr-only">
                    الحسابات التي أُنشئت في الفترة المطبقة وفق البحث والمنصة والمدينة والحالة
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">المستخدم</th>
                      <th scope="col">الهاتف المقنّع</th>
                      <th scope="col">المدينة</th>
                      <th scope="col">إنشاء الحساب</th>
                      <th scope="col">المنصة</th>
                      <th scope="col">الحالة</th>
                      <th scope="col">الطلبات · كل الفترات</th>
                      <th scope="col">
                        <span className="sr-only">التفاصيل</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.slice((userPage - 1) * 8, userPage * 8).map(u => {
                      const effStatus = audienceStorage.getEffectiveStatus(u);
                      const initials = String(u.name).split(' ').map(p => p[0]).slice(0, 2).join('');
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="aud-user-name">
                              <span>{initials}</span>
                              <div>
                                <strong>{u.name}</strong>
                                <small>
                                  آخر نشاط: <bdi>{u.lastActivity || 'لا توجد جلسات'}</bdi>
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <bdi>{maskedPhone(u.phone)}</bdi>
                          </td>
                          <td>{u.city}</td>
                          <td>
                            <bdi>{u.createdAt}</bdi>
                          </td>
                          <td>{platforms[u.platform] || '—'}</td>
                          <td>
                            <span className={`aud-status ${effStatus}`}>{statuses[effStatus] || 'غير محدد'}</span>
                          </td>
                          <td>
                            <bdi>{num(u.requestCount)}</bdi>
                          </td>
                          <td>
                            <button
                              className="aud-user-open"
                              type="button"
                              onClick={() => {
                                setSelectedUserId(u.id);
                                setDrawerOpen(true);
                              }}
                              aria-label={`تفاصيل ${u.name}`}
                            >
                              <Icon name="chevronLeft" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="aud-empty">
                  <Icon name="users" />
                  <strong>لا توجد حسابات مطابقة</strong>
                  <p>غيّر الفترة أو البحث أو المرشحات.</p>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setCity('all');
                      setStatus('all');
                      setUserPage(1);
                    }}
                  >
                    مسح بحث المستخدمين ومرشحاتهم
                  </button>
                </div>
              )}
            </div>

            {usersList.length > 0 && (
              <div className="aud-pagination">
                <span>
                  عرض {(userPage - 1) * 8 + 1}–{Math.min(userPage * 8, usersList.length)} من {usersList.length} مستخدمًا
                </span>
                <div>
                  <button
                    type="button"
                    onClick={() => setUserPage(p => p - 1)}
                    disabled={userPage === 1}
                    aria-label="الصفحة السابقة"
                  >
                    <Icon name="back" />
                  </button>
                  <span>
                    {userPage} / {Math.max(1, Math.ceil(usersList.length / 8))}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUserPage(p => p + 1)}
                    disabled={userPage >= Math.ceil(usersList.length / 8)}
                    aria-label="الصفحة التالية"
                  >
                    <Icon name="chevronLeft" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === 'visitors' && report && (
          <div>
            <div className="aud-section-heading">
              <div>
                <h2>نشاط الزوار المجهولين</h2>
                <p>تُحدّد الفترة بتاريخ الجلسة، وتشمل المنصة المختارة.</p>
              </div>
              <button type="button" className="button secondary" onClick={handleExportVisitors}>
                <Icon name="download" />
                تصدير ملخص الزوار
              </button>
            </div>

            <div className="aud-metrics">
              <article className="aud-metric">
                <div>
                  <span>جلسات مجهولة</span>
                  <Icon name="globe" />
                </div>
                <strong>
                  <bdi>{num(report.anonymousSessions)}</bdi>
                </strong>
                <p>جلسات دون حساب مسجل</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>أجهزة متصفح مجهولة</span>
                  <Icon name="layers" />
                </div>
                <strong>
                  <bdi>{num(report.anonymousDevices)}</bdi>
                </strong>
                <p>معرّفات متصفح مميزة في الجلسات المجهولة</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>جلسات بحساب مسجل</span>
                  <Icon name="users" />
                </div>
                <strong>
                  <bdi>{num(report.identifiedSessions)}</bdi>
                </strong>
                <p>للمقارنة ضمن إجمالي جلسات الفترة</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>أجهزة مجهولة عائدة</span>
                  <Icon name="back" />
                </div>
                <strong>
                  <bdi>{num(report.returningAnonymousDevices)}</bdi>
                </strong>
                <p>لها جلسة أقدم من بداية الفترة في بيانات المثال</p>
              </article>
            </div>

            <p className="aud-definition">
              هذه أرقام مجمّعة. «الجهاز» معرّف متصفح افتراضي ولا يساوي عدد الأشخاص؛ قد يستخدم شخص واحد عدة أجهزة. الجهاز
              العائد ظهر في جلسة سابقة لبداية الفترة ضمن بيانات المثال المتاحة.
            </p>

            <div className="aud-two-columns">
              <section className="panel aud-panel aud-breakdown">
                <div className="aud-panel-heading">
                  <div>
                    <h2>مصادر الجلسات المجهولة</h2>
                    <p>الحصة من الجلسات المجهولة في الفترة</p>
                  </div>
                </div>
                {report.sources.map(row => {
                  const share = report.anonymousSessions > 0 ? (row.anonymousSessions / report.anonymousSessions) * 100 : null;
                  return (
                    <div key={row.label} className="aud-breakdown-row">
                      <div>
                        <strong>{row.label}</strong>
                        <small>جلسات بلا حساب</small>
                      </div>
                      <bdi>{num(row.anonymousSessions)}</bdi>
                      <span>{percent(share)}</span>
                      <div className="aud-breakdown-track">
                        <span style={{ width: `${Math.min(100, safeNumber(share)).toFixed(2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </section>

              <section className="panel aud-panel aud-breakdown">
                <div className="aud-panel-heading">
                  <div>
                    <h2>منصات الجلسات المجهولة</h2>
                    <p>الحصة من الجلسات المجهولة في الفترة</p>
                  </div>
                </div>
                {report.platforms.map(row => {
                  const share = report.anonymousSessions > 0 ? (row.anonymousSessions / report.anonymousSessions) * 100 : null;
                  return (
                    <div key={row.label} className="aud-breakdown-row">
                      <div>
                        <strong>{row.label}</strong>
                        <small>جلسات بلا حساب</small>
                      </div>
                      <bdi>{num(row.anonymousSessions)}</bdi>
                      <span>{percent(share)}</span>
                      <div className="aud-breakdown-track">
                        <span style={{ width: `${Math.min(100, safeNumber(share)).toFixed(2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>

            <div className="aud-cohort-note">
              إجمالي جلسات الفترة: <bdi>{num(report.sessions)}</bdi> = <bdi>{num(report.anonymousSessions)}</bdi> جلسة
              مجهولة + <bdi>{num(report.identifiedSessions)}</bdi> جلسة بحساب مسجل.
            </div>
          </div>
        )}

        {tab === 'reports' && report && trendChart && (
          <div>
            <div className="aud-section-heading">
              <div>
                <h2>التقارير والتحليل</h2>
                <p>مقاييس الفترة والمنصة المطبقتين، دون تأثر بمرشحات قائمة المستخدمين أو حالاتهم المحلية.</p>
              </div>
              <button type="button" className="button secondary" onClick={handleExportReport}>
                <Icon name="download" />
                تصدير التقرير اليومي
              </button>
            </div>

            <div className="aud-metrics aud-report-metrics">
              <article className="aud-metric">
                <div>
                  <span>حسابات جديدة</span>
                  <Icon name="users" />
                </div>
                <strong>
                  <bdi>{num(report.newAccounts)}</bdi>
                </strong>
                <p>تاريخ إنشاء الحساب داخل الفترة</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>حسابات نشطة</span>
                  <Icon name="check" />
                </div>
                <strong>
                  <bdi>{num(report.activeAccounts)}</bdi>
                </strong>
                <p>حسابات مميزة لها جلسة داخل الفترة</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>الجلسات</span>
                  <Icon name="globe" />
                </div>
                <strong>
                  <bdi>{num(report.sessions)}</bdi>
                </strong>
                <p>جلسات مجهولة وبحساب مسجل</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>طلبات مرسلة</span>
                  <Icon name="receipt" />
                </div>
                <strong>
                  <bdi>{num(report.requests)}</bdi>
                </strong>
                <p>جلسات وصلت إلى إرسال طلب</p>
              </article>

              <article className="aud-metric">
                <div>
                  <span>معدل إرسال الطلب</span>
                  <Icon name="chart" />
                </div>
                <strong>
                  <bdi>{percent(report.requestRate)}</bdi>
                </strong>
                <p>الطلبات المرسلة ÷ إجمالي الجلسات</p>
              </article>
            </div>

            {/* SVG Trend Chart */}
            <section className="panel aud-panel aud-trend">
              <div className="aud-panel-heading">
                <div>
                  <h2>النشاط عبر الأيام</h2>
                  <p>الجلسات والحسابات الجديدة والطلبات المرسلة</p>
                </div>
                <div className="aud-chart-legend">
                  <span className="sessions">الجلسات</span>
                  <span className="accounts">حسابات جديدة</span>
                  <span className="requests">إرسال طلب</span>
                </div>
              </div>

              <div className="aud-chart">
                <svg viewBox="0 0 640 190" role="img" aria-label="النشاط اليومي خلال الفترة المطبقة">
                  {[0, 0.5, 1].map(ratio => {
                    const lineY = trendChart.y(trendChart.max * ratio);
                    return (
                      <React.Fragment key={ratio}>
                        <line className="aud-chart-grid" x1="43" x2="613" y1={lineY} y2={lineY} />
                        <text className="aud-chart-tick" x="32" y={lineY + 4} textAnchor="end">
                          {num(Math.round(trendChart.max * ratio))}
                        </text>
                      </React.Fragment>
                    );
                  })}

                  <path className="aud-chart-area" d={trendChart.area} />

                  {[
                    ['sessions', 'sessions'],
                    ['newAccounts', 'accounts'],
                    ['requests', 'requests'],
                  ].map(([key, className]) => (
                    <polyline
                      key={key}
                      className={`aud-chart-line ${className}`}
                      points={trendChart.points
                        .map((p, i) => `${trendChart.x(i).toFixed(2)},${trendChart.y(p[key]).toFixed(2)}`)
                        .join(' ')}
                      fill="none"
                    />
                  ))}

                  {trendChart.labelIndexes.map(i => (
                    <text
                      key={i}
                      className="aud-chart-tick"
                      x={trendChart.x(i).toFixed(2)}
                      y="181"
                      textAnchor="middle"
                    >
                      {trendChart.points[i].date.slice(5)}
                    </text>
                  ))}
                </svg>
              </div>

              <details className="aud-trend-table">
                <summary>عرض الأرقام اليومية في جدول</summary>
                <div className="table-scroll">
                  <table>
                    <caption className="sr-only">
                      النشاط اليومي من {startDate} إلى {endDate}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">اليوم</th>
                        <th scope="col">الجلسات</th>
                        <th scope="col">حسابات جديدة</th>
                        <th scope="col">إرسال طلب</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendChart.points.map(p => (
                        <tr key={p.date}>
                          <th scope="row">
                            <bdi>{p.date}</bdi>
                          </th>
                          <td>{num(p.sessions)}</td>
                          <td>{num(p.newAccounts)}</td>
                          <td>{num(p.requests)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>

            <div className="aud-two-columns">
              {/* Funnel */}
              <section className="panel aud-panel aud-funnel">
                <div className="aud-panel-heading">
                  <div>
                    <h2>مسار الوصول إلى الطلب</h2>
                    <p>التقدم خلال الجلسة نفسها؛ كل جلسة تُحسب مرة في كل مرحلة بلغتها.</p>
                  </div>
                </div>
                {report.funnel.map((stage, i) => (
                  <div key={i} className="aud-funnel-row">
                    <span className="aud-funnel-number">{String(i + 1).padStart(2, '0')}</span>
                    <div className="aud-funnel-copy">
                      <strong>{i === 4 ? 'إرسال طلب' : stage.label}</strong>
                      <small>
                        {i === 0
                          ? 'نقطة بداية مسار الجلسات'
                          : `${percent(stage.previousRate)} من جلسات المرحلة السابقة`}{' '}
                        · {percent(stage.overallRate)} من إجمالي الجلسات
                      </small>
                      <div className="aud-funnel-track">
                        <span style={{ width: `${Math.min(100, safeNumber(stage.overallRate)).toFixed(2)}%` }} />
                      </div>
                    </div>
                    <bdi>{num(stage.count)}</bdi>
                  </div>
                ))}
                <p className="aud-definition">
                  المرحلة الأخيرة تعني إرسال طلب، وتشمل حالات الانتظار والإلغاء في بيانات المثال؛ لا تمثّل عدد الحجوزات
                  المؤكدة.
                </p>
              </section>

              {/* Service Breakdown */}
              <section className="panel aud-panel aud-breakdown">
                <div className="aud-panel-heading">
                  <div>
                    <h2>النشاط حسب الخدمة</h2>
                    <p>الحصة من إجمالي الجلسات في الفترة</p>
                  </div>
                </div>
                {report.services.map(row => {
                  const share = report.sessions > 0 ? (row.sessions / report.sessions) * 100 : null;
                  return (
                    <div key={row.label} className="aud-breakdown-row">
                      <div>
                        <strong>{row.label}</strong>
                        <small>جلسات</small>
                      </div>
                      <bdi>{num(row.sessions)}</bdi>
                      <span>{percent(share)}</span>
                      <div className="aud-breakdown-track">
                        <span style={{ width: `${Math.min(100, safeNumber(share)).toFixed(2)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </section>
            </div>

            <p className="aud-definition">
              الحساب الجديد يُحسب بتاريخ التسجيل، والحساب النشط بتاريخ الجلسة. معدل إرسال الطلب = الجلسات التي أرسلت طلبًا
              ÷ إجمالي جلسات الفترة؛ تُعرض «—» عندما لا توجد جلسات. متوسط مدة الجلسة:{' '}
              <bdi>
                {report.sessions
                  ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(report.avgDurationSec)
                  : '—'}
              </bdi>{' '}
              ثانية.
            </p>
          </div>
        )}

        {tab === 'insights' && <BehaviorInsightsTab filters={filters} />}
      </div>

      <p className="aud-local-note">
        ملخص النشاط: 24 حسابًا و180 جلسة افتراضية خلال 30 يومًا. «الطلب والاهتمامات» يستخدم سجل أحداث تجريبيًا مستقلًا
        للشرح. لا تُرسل الواجهة أحداث تتبّع أو طلبات تحليل إلى الشبكة.
      </p>

      {/* User Details Drawer */}
      <UserDetailsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userId={selectedUserId}
        onOpenBooking={onOpenBooking}
      />
    </div>
  );
}

