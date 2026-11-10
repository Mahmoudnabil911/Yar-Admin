import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { staffStorage } from '../../services/storage/staffStorage';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';

export function ReportsPage({ onNavigate, searchQuery = '', onSearchChange }) {
  const toast = useToast();

  const [bookings, setBookings] = useState(() => operationsStorage.getBookings());
  const [providers, setProviders] = useState(() => catalogStorage.getRecords('providers'));
  const [staffList, setStaffList] = useState(() => staffStorage.getStaff());

  const [filters, setFilters] = useState({
    service: 'all',
    currency: 'all',
    status: 'all',
    providerId: 'all',
    assignedId: 'all',
    source: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    const unsubOps = operationsStorage.subscribe(() => setBookings(operationsStorage.getBookings()));
    const unsubCat = catalogStorage.subscribe(() => setProviders(catalogStorage.getRecords('providers')));
    const unsubStaff = staffStorage.subscribe(() => setStaffList(staffStorage.getStaff()));
    return () => {
      unsubOps();
      unsubCat();
      unsubStaff();
    };
  }, []);

  const numFormat = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const num = val => numFormat.format(Number(val) || 0);

  const reportData = useMemo(() => {
    try {
      return operationsStorage.report({
        ...filters,
        query: searchQuery
      });
    } catch {
      return { rows: [], currencies: {}, providers: [], staff: [] };
    }
  }, [filters, searchQuery, bookings]);

  const money = (val, cur) => {
    const f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: cur === 'USD' ? 2 : 0,
      maximumFractionDigits: cur === 'USD' ? 2 : 0
    });
    return `${f.format(Number(val) || 0)} ${cur === 'USD' ? '$' : 'د.ع'}`;
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['رقم الطلب', 'تاريخ الطلب', 'العميل التجريبي', 'الخدمة', 'المصدر', 'الحالة', 'العملة', 'تكلفة المزوّد', 'السعر النهائي', 'المحصّل', 'المسترد', 'صافي المحصّل', 'الموظف', 'المزوّد'],
        ...reportData.rows.map(r => {
          const b = M.balances(r);
          return [
            r.id,
            r.date,
            r.customer,
            M.services[r.service] || r.service,
            r.source,
            M.statuses[r.status] || r.status,
            r.currency,
            r.pricing?.cost,
            r.amount,
            b.collected,
            b.refunded,
            b.netCollected,
            r.assigned,
            r.provider
          ];
        })
      ];
      const csv = operationsStorage.csv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YAR-reports-export-${M.today()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('صُدّرت تقارير المبيعات.');
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="ops-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">عمليات YAR</div>
          <h1 id="operations-title" tabIndex={-1}>التقارير</h1>
          <p>راجع المبيعات والهامش والتحصيل حسب عملة الطلب؛ أرصدة المورّدين في صفحة مستقلة.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => onNavigate('audience', null, { audienceTab: 'insights' })}
          >
            تحليلات المستخدمين
          </button>
        </div>
      </div>

      <p className="ops-notice">
        معاينة محلية فقط · كل البيانات والحركات المالية أمثلة، ولا تُرسل دفعات أو رسائل فعلية.
      </p>

      {/* Filters */}
      <section className="panel ops-card" style={{ marginBottom: 20 }}>
        <div className="ops-toolbar" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="ops-search" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 400, background: 'var(--c-f7f9f3)', border: '1px solid var(--c-e2e9da)', borderRadius: 7, padding: '7px 12px' }}>
            <i data-icon="search"><Icon name="search" /></i>
            <input
              type="search"
              value={searchQuery}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder="ابحث بالمزوّد أو العميل أو مرجع الطلب..."
              style={{ border: 0, background: 'none', outline: 0, width: '100%', font: 'inherit', fontSize: 12, color: 'var(--green)' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="quiet-button" onClick={handleExportCSV}>
              <i data-icon="download"><Icon name="download" /></i>
              تصدير التقرير CSV
            </button>
          </div>
        </div>

        <div className="ops-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: '14px 20px', background: 'var(--c-fafbf7)' }}>
          <label className="ops-field">
            <span>الخدمة</span>
            <select
              value={filters.service}
              onChange={e => setFilters({ ...filters, service: e.target.value })}
            >
              <option value="all">كل الخدمات</option>
              {Object.entries(M.services).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>العملة</span>
            <select
              value={filters.currency}
              onChange={e => setFilters({ ...filters, currency: e.target.value })}
            >
              <option value="all">كل العملات · منفصلة</option>
              <option value="IQD">IQD</option>
              <option value="USD">USD</option>
            </select>
          </label>

          <label className="ops-field">
            <span>المزوّد</span>
            <select
              value={filters.providerId}
              onChange={e => setFilters({ ...filters, providerId: e.target.value })}
            >
              <option value="all">كل المزوّدين</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>الموظف</span>
            <select
              value={filters.assignedId}
              onChange={e => setFilters({ ...filters, assignedId: e.target.value })}
            >
              <option value="all">كل الموظفين</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>من تاريخ</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            />
          </label>

          <label className="ops-field">
            <span>إلى تاريخ</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            />
          </label>
        </div>
      </section>

      {/* Currency Cards */}
      <div className="ops-currency-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 20 }}>
        {['IQD', 'USD'].filter(c => filters.currency === 'all' || filters.currency === c).map(cur => {
          const cData = reportData.currencies[cur] || {
            orders: 0, issued: 0, cancelled: 0, grossSales: 0, salesAfterDiscount: 0,
            cancelledSales: 0, netSales: 0, supplierCost: 0, discounts: 0, grossMargin: 0,
            collected: 0, refunds: 0, netCollected: 0, supplierPaid: 0, cashAfterSupplier: 0,
            outstanding: 0, providerRecoverable: 0
          };
          return (
            <section className="panel ops-currency-card" key={cur} style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 14 }}>
                {cur === 'USD' ? 'الدولار الأمريكي · USD' : 'الدينار العراقي · IQD'}
              </h3>
              <div className="ops-money-lines" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <span>الطلبات المطابقة</span>
                  <strong>{cData.orders}</strong>
                </div>
                <div>
                  <span>الطلبات الصادرة</span>
                  <strong>{cData.issued}</strong>
                </div>
                <div>
                  <span>إجمالي المبيعات</span>
                  <strong>{money(cData.grossSales, cur)}</strong>
                </div>
                <div>
                  <span>إجمالي الخصومات</span>
                  <strong>{money(cData.discounts, cur)}</strong>
                </div>
                <div>
                  <span>صافي المبيعات</span>
                  <strong>{money(cData.netSales, cur)}</strong>
                </div>
                <div>
                  <span>تكلفة المزوّدين</span>
                  <strong>{money(cData.supplierCost, cur)}</strong>
                </div>
                <div>
                  <span>الهامش الإجمالي</span>
                  <strong style={{ color: cData.grossMargin >= 0 ? 'var(--c-2d5327)' : 'var(--c-924b42)' }}>
                    {money(cData.grossMargin, cur)}
                  </strong>
                </div>
                <div>
                  <span>صافي التحصيل</span>
                  <strong>{money(cData.netCollected, cur)}</strong>
                </div>
                <div>
                  <span>المدفوع للمزوّدين</span>
                  <strong>{money(cData.supplierPaid, cur)}</strong>
                </div>
                <div>
                  <span>النقد بعد المزوّدين</span>
                  <strong>{money(cData.cashAfterSupplier, cur)}</strong>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Provider Breakdown */}
      <section className="panel ops-card" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <h2>أداء المزوّدين · التكاليف والأرصدة حسب العملة</h2>
        </div>
        <div className="table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th>المزوّد</th>
                <th>العملة</th>
                <th>عدد الطلبات</th>
                <th>المدفوع للمزوّد</th>
                <th>المتبقي للمزوّد</th>
                <th>المسترد المعلق</th>
              </tr>
            </thead>
            <tbody>
              {reportData.providers.length > 0 ? (
                reportData.providers.map(p => (
                  <tr key={p.id + p.currency}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.currency}</td>
                    <td>{p.orders}</td>
                    <td>{money(p.paid, p.currency)}</td>
                    <td>{money(p.outstanding, p.currency)}</td>
                    <td>{money(p.recoverable, p.currency)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                    لا توجد بيانات مزوّدين في الفترة المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff Breakdown */}
      <section className="panel ops-card" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <h2>متابعة الموظفين · أعداد دون جمع العملات</h2>
        </div>
        <div className="table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th>الموظف</th>
                <th>الكل</th>
                <th>بانتظار</th>
                <th>قيد المعالجة</th>
                <th>صادر</th>
                <th>ملغي</th>
              </tr>
            </thead>
            <tbody>
              {reportData.staff.length > 0 ? (
                reportData.staff.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.orders}</td>
                    <td>{s.awaiting}</td>
                    <td>{s.processing}</td>
                    <td>{s.issued}</td>
                    <td>{s.cancelled}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                    لا توجد بيانات موظفين في الفترة المحددة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cross-linking info cards */}
      <div className="reports-cross-grid">

        <section className="panel ops-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, margin: '0 0 8px 0' }}>رصيد المورّد منفصل عن إيراد الطلب</h3>
          <p className="ops-note" style={{ margin: '0 0 12px 0' }}>
            تُدار الإيداعات وخصومات الإصدار والإرجاع في «أرصدة المورّدين». تكلفة المورّد في تقرير المبيعات هي التكلفة المحفوظة بعملة البيع لحساب الهامش؛ شحن الرصيد ليس مصروف تذكرة جديدة ولا يُخصم مرة ثانية.
          </p>
          <button
            type="button"
            className="button secondary"
            onClick={() => onNavigate('supplier-credit')}
          >
            فتح أرصدة المورّدين
          </button>
        </section>
      </div>
    </div>
  );
}

export default ReportsPage;

