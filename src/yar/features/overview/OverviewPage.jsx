import { uiLocale } from '../../i18n/prefs';
import OverviewWidget from '../../inbox/OverviewWidget';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { operationsModel as M, mockData } from '../../services/models';
import { can } from '../../auth/access';
import { useSession } from '../../auth/useSession';

export function OverviewPage({ onNavigate, onOpenBooking, searchQuery = '' }) {
  const session = useSession();
  const isAdmin = can('overview.management_kpis');
  const canManageCatalog = can('catalog.manage');
  const [period, setPeriod] = useState('today');
  const [service, setService] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [chartMode, setChartMode] = useState('bookings'); // 'bookings' or 'revenue'
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const periodBtnRef = useRef(null);
  const addBtnRef = useRef(null);

  // Subscribe to storage updates
  const [bookings, setBookings] = useState(() => operationsStorage.getBookings());
  const [providers, setProviders] = useState(() => catalogStorage.getRecords('providers'));

  useEffect(() => {
    const unsubOps = operationsStorage.subscribe(() => {
      setBookings(operationsStorage.getBookings());
    });
    const unsubCat = catalogStorage.subscribe(() => {
      setProviders(catalogStorage.getRecords('providers'));
    });
    return () => {
      unsubOps();
      unsubCat();
    };
  }, []);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (periodBtnRef.current && !periodBtnRef.current.contains(e.target)) {
        setShowPeriodMenu(false);
      }
      if (addBtnRef.current && !addBtnRef.current.contains(e.target)) {
        setShowAddMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayStr = useMemo(() => M.today(), []);
  const todayBaghdadFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(uiLocale(), { timeZone: 'Asia/Baghdad', dateStyle: 'full' }).format(new Date());
    } catch {
      return 'الخميس، 5 تشرين الثاني 2026';
    }
  }, []);

  const numFormat = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const num = val => numFormat.format(Number(val) || 0);

  // Flight suppliers
  const flightSuppliers = useMemo(() => {
    return providers.filter(p => p.serviceType === 'flight' && p.status !== 'archived').map((p, i) => {
      const channelLabel = { ndc: 'NDC', gds: 'GDS', direct: 'API', manual: 'يدوي' }[p.channel] || 'API';
      let conn = p.operatingEnabled === false ? 'paused' : p.status === 'published' ? (p.connectionState || 'offline') : 'offline';
      return {
        id: p.id,
        name: p.name,
        source: channelLabel,
        connection: conn,
        responseMs: i ? 1860 : 420,
        successRate: i ? 94.8 : 99.2,
        operatingEnabled: p.operatingEnabled !== false
      };
    });
  }, [providers]);

  // Filtering for metrics & table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Period filter
      if (period === 'today' && b.date !== todayStr) return false;
      // Service filter
      if (service !== 'all' && b.service !== service) return false;
      // Status filter
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      // Payment filter
      if (paymentFilter !== 'all') {
        const pStatus = b.payment || (M.paymentStatus(b) === 'paid' ? 'paid' : 'pending');
        if (pStatus !== paymentFilter) return false;
      }
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().replace(/[أإآ]/g, 'ا');
        const text = [b.id, b.customer, b.route, b.detail, b.assigned, b.provider].join(' ').toLowerCase().replace(/[أإآ]/g, 'ا');
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, period, service, statusFilter, paymentFilter, searchQuery, todayStr]);

  // Metric totals
  const metrics = useMemo(() => {
    const activePeriodBookings = bookings.filter(b => period !== 'today' || b.date === todayStr);
    const nonCancelled = activePeriodBookings.filter(b => b.status !== 'cancelled');

    const totalCount = activePeriodBookings.length;
    const awaitingCount = activePeriodBookings.filter(b => b.status === 'awaiting').length;

    // Financial revenue in IQD
    const iqdRows = nonCancelled.filter(b => b.currency === 'IQD' || !b.currency);
    const paidIqd = iqdRows.reduce((sum, b) => {
      const bal = M.balances(b);
      return sum + bal.collected;
    }, 0);

    const pendingRows = iqdRows.filter(b => {
      const bal = M.balances(b);
      return bal.balance > 0;
    });
    const pendingAmount = pendingRows.reduce((sum, b) => sum + M.balances(b).balance, 0);

    return {
      totalCount,
      awaitingCount,
      revenue: paidIqd,
      pendingCount: pendingRows.length,
      pendingAmount
    };
  }, [bookings, period, todayStr]);

  // Table pagination
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPageSafe = Math.min(page, totalPages);
  const startIdx = (currentPageSafe - 1) * pageSize;
  const pageRows = filteredBookings.slice(startIdx, startIdx + pageSize);

  // Weekly chart data
  const chartData = useMemo(() => {
    return mockData?.weeklyTrend || [
      { date: '2026-10-30', label: 'الجمعة', revenue: 1120000, bookings: 7 },
      { date: '2026-10-31', label: 'السبت', revenue: 1680000, bookings: 10 },
      { date: '2026-11-01', label: 'الأحد', revenue: 1320000, bookings: 8 },
      { date: '2026-11-02', label: 'الاثنين', revenue: 2010000, bookings: 12 },
      { date: '2026-11-03', label: 'الثلاثاء', revenue: 1840000, bookings: 11 },
      { date: '2026-11-04', label: 'الأربعاء', revenue: 2360000, bookings: 14 },
      { date: todayStr, label: 'الخميس', revenue: metrics.revenue, bookings: metrics.totalCount }
    ];
  }, [todayStr, metrics.revenue, metrics.totalCount]);

  const chartMax = useMemo(() => {
    const key = chartMode === 'bookings' ? 'bookings' : 'revenue';
    return Math.max(...chartData.map(d => d[key] || 0), 1);
  }, [chartData, chartMode]);

  const chartTotal = useMemo(() => {
    const key = chartMode === 'bookings' ? 'bookings' : 'revenue';
    return chartData.reduce((sum, d) => sum + (d[key] || 0), 0);
  }, [chartData, chartMode]);

  // Export CSV
  const handleExport = () => {
    const rows = [
      ['رقم الحجز', 'العميل', 'الخدمة', 'المسار', 'المبلغ', 'العملة', 'الدفع', 'الحالة', 'التاريخ'],
      ...filteredBookings.map(b => [
        b.id,
        b.customer,
        M.services[b.service] || b.service,
        b.route,
        b.amount,
        b.currency || 'IQD',
        M.paymentStatus(b) === 'paid' ? 'مدفوع' : 'غير مدفوع',
        M.statuses[b.status] || b.status,
        b.date
      ])
    ];
    const csvContent = M.csv(rows);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `YAR-overview-bookings-${todayStr}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleToggleProvider = (id, currentEnabled) => {
    try {
      catalogStorage.updateProvider(id, { operatingEnabled: !currentEnabled });
    } catch (err) {
      alert(err.message);
    }
  };

  const resetFilters = () => {
    setStatusFilter('all');
    setPaymentFilter('all');
    setService('all');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'all' || paymentFilter !== 'all';

  return (
    <div id="overview-view">
      <OverviewWidget onNavigate={onNavigate} />
      <div className="page-heading">
        <div>
          <div className="eyebrow">{todayBaghdadFormatted}</div>
          <h1><span>صباح الخير،</span> <span data-no-translate>{session?.name}</span> <span className="greeting-mark">✦</span></h1>
          <p>كل ما تحتاجه لإدارة رحلات اليوم، في مكان واحد.</p>
        </div>
        <div className="heading-actions">
          <div style={{ position: 'relative' }} ref={periodBtnRef}>
            <button
              type="button"
              className="button secondary period-button"
              id="period-button"
              aria-expanded={showPeriodMenu}
              onClick={() => setShowPeriodMenu(s => !s)}
            >
              <i data-icon="calendar">
                <Icon name="calendar" />
              </i>
              <span id="period-label">{period === 'today' ? 'اليوم' : 'آخر 7 أيام'}</span>
              <i data-icon="chevronDown">
                <Icon name="chevronDown" />
              </i>
            </button>
            {showPeriodMenu && (
              <div className="popover date-popover" id="period-menu" style={{ display: 'block' }}>
                <button
                  type="button"
                  data-period="today"
                  className={period === 'today' ? 'selected' : ''}
                  onClick={() => { setPeriod('today'); setPage(1); setShowPeriodMenu(false); }}
                >
                  اليوم<span>{todayStr}</span>
                </button>
                <button
                  type="button"
                  data-period="week"
                  className={period === 'week' ? 'selected' : ''}
                  onClick={() => { setPeriod('week'); setPage(1); setShowPeriodMenu(false); }}
                >
                  آخر 7 أيام<span>حسب تاريخ إنشاء الطلب</span>
                </button>
              </div>
            )}
          </div>

          {canManageCatalog && (
          <div style={{ position: 'relative' }} ref={addBtnRef}>
            <button
              type="button"
              className="button primary"
              id="add-button"
              aria-expanded={showAddMenu}
              onClick={() => setShowAddMenu(s => !s)}
            >
              <i data-icon="plus">
                <Icon name="plus" />
              </i>
              إضافة بيانات
            </button>
            {showAddMenu && (
              <div className="popover add-popover" id="add-menu" style={{ display: 'block' }}>
                <div className="popover-title">ماذا تريد أن تضيف؟</div>
                <button type="button" onClick={() => { setShowAddMenu(false); onNavigate('hotels', 'new'); }}>
                  <i data-icon="hotel"><Icon name="hotel" /></i>فندق جديد
                </button>
                <button type="button" onClick={() => { setShowAddMenu(false); onNavigate('packages', 'new'); }}>
                  <i data-icon="bag"><Icon name="bag" /></i>باقة سياحية
                </button>
                <button type="button" onClick={() => { setShowAddMenu(false); onNavigate('cars', 'new'); }}>
                  <i data-icon="car"><Icon name="car" /></i>سيارة أو خدمة نقل
                </button>
                <button type="button" onClick={() => { setShowAddMenu(false); onNavigate('tours', 'new'); }}>
                  <i data-icon="map"><Icon name="map" /></i>جولة سياحية
                </button>
                <button type="button" onClick={() => { setShowAddMenu(false); onNavigate('providers', 'new'); }}>
                  <i data-icon="swap"><Icon name="swap" /></i>مزوّد خدمة
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {metrics.awaitingCount > 0 && (
        <section className="attention-bar" aria-label="طلبات تحتاج متابعة">
          <div className="attention-symbol">
            <i data-icon="clock"><Icon name="clock" /></i>
          </div>
          <div>
            <strong><span id="attention-count">{metrics.awaitingCount}</span> حجوزات بانتظار التأكيد</strong>
            <span>راجع الطلبات وأكمل الإجراءات مع فريقك.</span>
          </div>
          <button
            type="button"
            className="text-action"
            id="review-pending"
            onClick={() => {
              setStatusFilter('awaiting');
              setPage(1);
            }}
          >
            متابعة الطلبات
            <i data-icon="back"><Icon name="back" /></i>
          </button>
        </section>
      )}

      <section className="metrics" aria-label="ملخص العمل">
        <button
          type="button"
          className="metric"
          data-metric="bookings"
          onClick={resetFilters}
        >
          <div className="metric-top">
            <span>إجمالي الحجوزات</span>
            <span className="metric-icon"><i data-icon="ticket"><Icon name="ticket" /></i></span>
          </div>
          <div className="metric-value" id="metric-bookings">{metrics.totalCount}</div>
          <div className="metric-foot">
            <span className="tiny-dot green"></span>
            <span id="metric-bookings-note">جميع الخدمات</span>
            <svg className="spark" viewBox="0 0 84 22" aria-hidden="true">
              <path d="M1 20 L14 15 L24 17 L36 8 L47 11 L58 5 L69 8 L83 1"/>
            </svg>
          </div>
        </button>

        <button
          type="button"
          className="metric"
          data-metric="paid"
          onClick={() => { setPaymentFilter('paid'); setPage(1); }}
        >
          <div className="metric-top">
            <span>المبالغ المحصّلة</span>
            <span className="metric-icon"><i data-icon="wallet"><Icon name="wallet" /></i></span>
          </div>
          <div className="metric-value money">
            <bdi id="metric-revenue">{num(metrics.revenue)}</bdi>
            <small>د.ع</small>
          </div>
          <div className="metric-foot">
            <span className="tiny-dot green"></span>
            <span>صافي التحصيل · العملات منفصلة</span>
          </div>
        </button>

        <button
          type="button"
          className="metric"
          data-metric="awaiting"
          onClick={() => { setStatusFilter('awaiting'); setPage(1); }}
        >
          <div className="metric-top">
            <span>بانتظار التأكيد</span>
            <span className="metric-icon amber"><i data-icon="clock"><Icon name="clock" /></i></span>
          </div>
          <div className="metric-value" id="metric-awaiting">{metrics.awaitingCount}</div>
          <div className="metric-foot">
            <span className="tiny-dot amber"></span>
            <span>تحتاج متابعة الفريق</span>
          </div>
        </button>

        <button
          type="button"
          className="metric"
          data-metric="pending"
          onClick={() => { setPaymentFilter('pending'); setPage(1); }}
        >
          <div className="metric-top">
            <span>بانتظار الدفع</span>
            <span className="metric-icon"><i data-icon="receipt"><Icon name="receipt" /></i></span>
          </div>
          <div className="metric-value" id="metric-pending">{metrics.pendingCount}</div>
          <div className="metric-foot">
            <span>إجمالي</span>
            <bdi id="metric-pending-amount">{num(metrics.pendingAmount)} د.ع</bdi>
          </div>
        </button>
      </section>

      {isAdmin && <ManagementKpis bookings={bookings} />}

      <div className="workspace-grid">
        <section className="panel bookings-panel" aria-labelledby="bookings-title">
          <div className="panel-heading">
            <div>
              <h2 id="bookings-title">آخر الحجوزات</h2>
              <p>تابع طلبات العملاء وحالة كل إجراء.</p>
            </div>
            <button
              type="button"
              className="quiet-button"
              id="export-button"
              onClick={handleExport}
            >
              <i data-icon="download"><Icon name="download" /></i>
              تصدير
            </button>
          </div>

          <div className="table-toolbar">
            <div className="service-tabs" role="group" aria-label="نوع الخدمة">
              <button
                type="button"
                className={service === 'all' ? 'selected' : ''}
                onClick={() => { setService('all'); setPage(1); }}
              >
                الكل<span id="all-count">{filteredBookings.length}</span>
              </button>
              <button
                type="button"
                className={service === 'flight' ? 'selected' : ''}
                onClick={() => { setService('flight'); setPage(1); }}
              >
                الطيران
              </button>
              <button
                type="button"
                className={service === 'hotel' ? 'selected' : ''}
                onClick={() => { setService('hotel'); setPage(1); }}
              >
                الفنادق
              </button>
              <button
                type="button"
                className={service === 'package' ? 'selected' : ''}
                onClick={() => { setService('package'); setPage(1); }}
              >
                الباقات
              </button>
              <button
                type="button"
                className={service === 'transfer' ? 'selected' : ''}
                onClick={() => { setService('transfer'); setPage(1); }}
              >
                النقل
              </button>
              <button
                type="button"
                className={service === 'tour' ? 'selected' : ''}
                onClick={() => { setService('tour'); setPage(1); }}
              >
                الجولات
              </button>
            </div>

            <button
              type="button"
              className="filter-button"
              id="filter-button"
              aria-label="تصفية الحجوزات"
              aria-expanded={showFilterPanel}
              onClick={() => setShowFilterPanel(s => !s)}
            >
              <i data-icon="filter"><Icon name="filter" /></i>
              <span>تصفية</span>
              {hasActiveFilters && <span className="filter-dot"></span>}
            </button>
          </div>

          {hasActiveFilters && (
            <div className="active-filters" id="active-filters">
              <span id="active-filter-label">
                {statusFilter !== 'all' && `الحالة: ${M.statuses[statusFilter] || statusFilter}`}
                {statusFilter !== 'all' && paymentFilter !== 'all' && ' · '}
                {paymentFilter !== 'all' && `الدفع: ${{ paid: 'مدفوع', pending: 'بانتظار الدفع', review: 'قيد المراجعة' }[paymentFilter]}`}
              </span>
              <button type="button" id="clear-filter" onClick={resetFilters}>
                مسح التصفية
                <i data-icon="close"><Icon name="close" /></i>
              </button>
            </div>
          )}

          {showFilterPanel && (
            <div className="filter-panel" id="filter-panel">
              <label>
                حالة الحجز
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                >
                  <option value="all">جميع الحالات</option>
                  <option value="awaiting">بانتظار التأكيد</option>
                  <option value="processing">قيد المعالجة</option>
                  <option value="issued">مؤكد</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </label>
              <label>
                حالة الدفع
                <select
                  id="payment-filter"
                  value={paymentFilter}
                  onChange={e => { setPaymentFilter(e.target.value); setPage(1); }}
                >
                  <option value="all">جميع المدفوعات</option>
                  <option value="paid">مدفوع</option>
                  <option value="pending">بانتظار الدفع</option>
                  <option value="review">قيد المراجعة</option>
                </select>
              </label>
            </div>
          )}

          <div className="table-scroll">
            {pageRows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>الحجز / العميل</th>
                    <th>الخدمة والوجهة</th>
                    <th>المبلغ</th>
                    <th>الدفع</th>
                    <th>الحالة</th>
                    <th><span className="sr-only">تفاصيل</span></th>
                  </tr>
                </thead>
                <tbody id="booking-rows">
                  {pageRows.map(b => {
                    const initials = b.initials || b.customer.slice(0, 2);
                    const pStatus = b.payment || (M.paymentStatus(b) === 'paid' ? 'paid' : 'pending');
                    const paymentLabel = { paid: 'مدفوع', pending: 'بانتظار الدفع', review: 'قيد المراجعة' }[pStatus] || pStatus;
                    const statusClass = b.status;
                    const statusLabel = M.statuses[b.status] || b.status;
                    const serviceIcon = { flight: 'plane', hotel: 'hotel', package: 'bag', transfer: 'car', tour: 'map' }[b.service] || 'ticket';

                    return (
                      <tr key={b.id}>
                        <td>
                          <div className="customer-cell">
                            <span className="customer-initial">{initials}</span>
                            <div>
                              <strong className="customer-name">{b.customer}</strong>
                              <span className="booking-id">{b.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="service-route">
                            <i data-icon={serviceIcon}><Icon name={serviceIcon} /></i>
                            <span>{b.route}</span>
                          </div>
                          <small className="service-detail">{b.detail}</small>
                        </td>
                        <td>
                          <div className="row-amount">
                            <bdi>{num(b.amount)}</bdi>
                            <small>{b.currency === 'USD' ? '$' : 'د.ع'}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`payment-status ${pStatus}`}>
                            <span className="tiny-dot"></span>
                            {paymentLabel}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="row-open"
                            aria-label={`تفاصيل ${b.customer}`}
                            onClick={() => onOpenBooking(b.id)}
                          >
                            <i data-icon="chevronLeft"><Icon name="chevronLeft" /></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state" id="empty-state">
                <i data-icon="search"><Icon name="search" /></i>
                <strong>لا توجد حجوزات مطابقة</strong>
                <p>جرّب اسمًا أو رقم حجز آخر، أو امسح التصفية.</p>
                <button type="button" className="button secondary" id="reset-search" onClick={resetFilters}>
                  عرض جميع الحجوزات
                </button>
              </div>
            )}
          </div>

          <div className="table-footer">
            <span id="result-count" aria-live="polite">
              {filteredBookings.length > 0
                ? `عرض ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredBookings.length)} من ${filteredBookings.length} حجزًا`
                : 'لا توجد نتائج'}
            </span>
            <div className="pagination">
              <button
                type="button"
                aria-label="الصفحة السابقة"
                id="prev-page"
                disabled={currentPageSafe === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <i data-icon="back"><Icon name="back" /></i>
              </button>
              <span id="page-number">{currentPageSafe}</span>
              <button
                type="button"
                aria-label="الصفحة التالية"
                id="next-page"
                disabled={currentPageSafe === totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <i data-icon="chevronLeft"><Icon name="chevronLeft" /></i>
              </button>
            </div>
          </div>
        </section>

        <aside className="insights">
          <section className="panel providers-panel" aria-labelledby="providers-title">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">الاتصالات</div>
                <h2 id="providers-title">مزوّدو الطيران</h2>
              </div>
              <span className="provider-count">{flightSuppliers.length}</span>
            </div>
            <div className="provider-summary">
              <span className="tiny-dot green"></span>
              <span id="provider-summary">مصادر متعددة، إدارة واحدة</span>
            </div>

            <div id="provider-list">
              {flightSuppliers.map(s => {
                const mark = s.name.charAt(0);
                const isPaused = !s.operatingEnabled || s.connection === 'paused';
                return (
                  <div className="provider-row" key={s.id}>
                    <div className="provider-mark">{mark}</div>
                    <div className="provider-copy">
                      <strong>{s.name}</strong>
                      <small>{s.source} · {s.connection === 'offline' ? 'غير متاح' : `${s.responseMs} مللي ثانية`}</small>
                    </div>
                    <div className={`provider-state ${isPaused ? 'offline' : s.connection}`}>
                      <span className="tiny-dot"></span>
                      <span>{isPaused ? 'متوقف' : s.connection === 'slow' ? 'بطيء' : s.connection === 'offline' ? 'غير متاح' : 'نشط'}</span>
                    </div>
                    {canManageCatalog && (
                    <button
                      type="button"
                      className="quiet-button"
                      style={{ marginInlineStart: 6, fontSize: 11, padding: '3px 7px' }}
                      onClick={() => handleToggleProvider(s.id, s.operatingEnabled)}
                    >
                      {isPaused ? 'تفعيل' : 'إيقاف'}
                    </button>
                    )}
                  </div>
                );
              })}
            </div>

            {canManageCatalog && (
            <button
              type="button"
              className="provider-manage"
              id="manage-providers"
              onClick={() => onNavigate('provider-ops')}
            >
              عرض حالة المزوّدين
              <i data-icon="chevronLeft"><Icon name="chevronLeft" /></i>
            </button>
            )}
          </section>

          <section className="panel chart-panel" aria-labelledby="chart-title">
            <div className="panel-heading compact">
              <div>
                <div className="section-kicker">آخر 7 أيام</div>
                <h2 id="chart-title">حركة الحجوزات</h2>
              </div>
              <button
                type="button"
                className="icon-button chart-toggle"
                id="chart-toggle"
                aria-label="عرض المبالغ المحصلة"
                onClick={() => setChartMode(m => m === 'bookings' ? 'revenue' : 'bookings')}
              >
                <i data-icon="swap"><Icon name="swap" /></i>
              </button>
            </div>

            <div className="chart-total">
              <strong id="chart-total">{num(chartTotal)}</strong>
              <span id="chart-unit">{chartMode === 'bookings' ? 'حجزًا' : 'د.ع'}</span>
              
            </div>

            <div id="weekly-chart" className="weekly-chart">
              <svg className="chart-svg" viewBox="0 0 240 90" aria-hidden="true">
                {chartData.map((d, i) => {
                  const val = chartMode === 'bookings' ? d.bookings : d.revenue;
                  const barHeight = Math.max(4, Math.round((val / chartMax) * 70));
                  const x = 12 + i * 32;
                  const y = 80 - barHeight;
                  const isCurrent = i === chartData.length - 1;
                  return (
                    <g key={d.date}>
                      <rect
                        x={x}
                        y={y}
                        width={20}
                        height={barHeight}
                        rx={3}
                        fill={isCurrent ? 'var(--c-3b5931)' : 'var(--c-b2c7aa)'}
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="chart-days">
                {chartData.map(d => (
                  <span key={d.date} style={{ fontSize: 11 }}>{d.label}</span>
                ))}
              </div>
            </div>

            <div className="chart-legend">
              <span className="tiny-dot green"></span>
              <span id="chart-legend">
                {chartMode === 'bookings' ? 'عدد الحجوزات لكل يوم' : 'إجمالي المبالغ المحصلة لكل يوم'}
              </span>
            </div>
          </section>
        </aside>
      </div>

      <footer className="page-footer">
        <span>
          <span className="tiny-dot green"></span>
          آخر تحديث: <bdi>10:30</bdi> بتوقيت بغداد
        </span>
        <span>YAR · رفيقك في كل رحلة</span>
      </footer>
    </div>
  );
}

export default OverviewPage;


/** Admin-only profitability & internal cost (from saved price snapshots; currencies never summed). */
function ManagementKpis({ bookings }) {
  const totals = useMemo(() => {
    const out = {};
    for (const b of bookings) {
      if (b.status === 'cancelled' || !b.pricing) continue;
      const c = b.currency || 'IQD';
      out[c] = out[c] || { margin: 0, cost: 0, count: 0 };
      out[c].margin += Number(b.pricing.margin) || 0;
      out[c].cost += Number(b.pricing.cost) || 0;
      out[c].count += 1;
    }
    return out;
  }, [bookings]);
  const fmt = (v, c) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: c === 'USD' ? 2 : 0, minimumFractionDigits: c === 'USD' ? 2 : 0 }).format(v)} ${c === 'USD' ? '$' : 'د.ع'}`;
  const currencies = Object.keys(totals).sort();
  return (
    <section className="panel mgmt-kpis" aria-labelledby="mgmt-title">
      <div className="panel-heading compact">
        <div>
          <div className="section-kicker">للمدير فقط · الربحية والتكلفة الداخلية</div>
          <h2 id="mgmt-title">مؤشرات الإدارة</h2>
        </div>
      </div>
      <div className="mgmt-grid">
        {currencies.map(c => (
          <React.Fragment key={c}>
            <div className="mgmt-item">
              <span>الهامش النظري المحفوظ · <bdi>{c}</bdi></span>
              <strong><bdi>{fmt(totals[c].margin, c)}</bdi></strong>
            </div>
            <div className="mgmt-item">
              <span>تكلفة المورّدين المحفوظة · <bdi>{c}</bdi></span>
              <strong><bdi>{fmt(totals[c].cost, c)}</bdi></strong>
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="ops-note">من لقطات أسعار الطلبات غير الملغاة · كل عملة منفصلة</p>
    </section>
  );
}
