import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { bookingsApi } from '../../services/api/bookingsApi';
import { reportsApi } from '../../services/api/reportsApi';

const statusLabels = { ...M.statuses, confirmed: 'مؤكد', issued: 'مؤكد' };
const amount = value => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export function ReportsPage({ searchQuery = '', onSearchChange }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [serverReport, setServerReport] = useState(null);
  const [overviewSummary, setOverviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    service: 'all',
    status: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [bookingsRes, reportRes, overviewRes] = await Promise.allSettled([
        bookingsApi.listBookings({ limit: 100 }, true),
        reportsApi.getBookingsReport(true),
        reportsApi.getDashboardSummary(true),
      ]);

      if (bookingsRes.status === 'fulfilled' && bookingsRes.value?.items) {
        setRows(bookingsRes.value.items.map(bookingsApi.mapRecordToRow));
      } else if (bookingsRes.status === 'rejected') {
        const err = bookingsRes.reason;
        console.warn('Reports bookings list error:', err);
      }

      if (reportRes.status === 'fulfilled' && reportRes.value) {
        setServerReport(reportRes.value);
      }

      if (overviewRes.status === 'fulfilled' && overviewRes.value) {
        setOverviewSummary(overviewRes.value);
      }

      if (bookingsRes.status === 'rejected' && reportRes.status === 'rejected') {
        const err = reportRes.reason || bookingsRes.reason;
        setError(err?.ar || err?.message || 'تعذر تحميل بيانات التقارير من الخادم.');
      }
    } catch (err) {
      console.warn('Reports loading failed:', err);
      setError(err?.ar || err?.message || 'تعذر تحميل التقارير.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handleLoaded = event => {
      if (Array.isArray(event?.detail) && event.detail.length > 0) {
        setRows(event.detail);
        setLoading(false);
      }
    };
    window.addEventListener('yar:bookings-updated', load);
    window.addEventListener('yar:bookings-loaded', handleLoaded);
    return () => {
      window.removeEventListener('yar:bookings-updated', load);
      window.removeEventListener('yar:bookings-loaded', handleLoaded);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return rows.filter(row => {
      const paid =
        row.due_iqd != null
          ? Number(row.due_iqd) <= 0
          : Number(row.total_iqd) > 0 && Number(row.collected_iqd || 0) >= Number(row.total_iqd);
      return (
        (filters.service === 'all' || row.service === filters.service) &&
        (filters.status === 'all' || row.status === filters.status) &&
        (filters.paymentStatus === 'all' || (filters.paymentStatus === 'paid') === paid) &&
        (!filters.startDate || (row.date || '') >= filters.startDate) &&
        (!filters.endDate || (row.date || '') <= filters.endDate) &&
        (!query ||
          `${row.id} ${row.reference || ''} ${row.customer || ''} ${row.phone || ''}`
            .toLocaleLowerCase()
            .includes(query))
      );
    });
  }, [rows, filters, searchQuery]);

  const isFiltered =
    filters.service !== 'all' ||
    filters.status !== 'all' ||
    filters.paymentStatus !== 'all' ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate) ||
    Boolean(searchQuery.trim());

  const totals = useMemo(() => {
    const calculated = filtered.reduce(
      (acc, row) => ({
        count: acc.count + 1,
        issued: acc.issued + (row.status === 'issued' || row.status === 'confirmed' ? 1 : 0),
        total: acc.total + Number(row.total_iqd || 0),
        collected: acc.collected + Number(row.collected_iqd || 0),
        refunded: acc.refunded + Number(row.refunded_iqd || 0),
        due: acc.due + Number(row.due_iqd || 0),
      }),
      { count: 0, issued: 0, total: 0, collected: 0, refunded: 0, due: 0 }
    );

    // If no filters are active, complement with authoritative backend reports data when available
    if (!isFiltered && serverReport) {
      const confirmedOrIssued =
        (serverReport.by_state?.confirmed || 0) + (serverReport.by_state?.issued || 0);
      return {
        count: serverReport.count ?? calculated.count,
        issued: confirmedOrIssued || calculated.issued,
        total: serverReport.sales_iqd ?? calculated.total,
        collected: serverReport.collected_iqd ?? calculated.collected,
        refunded: calculated.refunded,
        due: Math.max(0, (serverReport.sales_iqd ?? calculated.total) - (serverReport.collected_iqd ?? calculated.collected)),
      };
    }

    return calculated;
  }, [filtered, isFiltered, serverReport]);

  const exportCsv = () => {
    const data = [
      [
        'رقم الحجز',
        'تاريخ الإنشاء',
        'العميل',
        'الخدمة',
        'الحالة',
        'العملة',
        'الإجمالي IQD',
        'المحصّل IQD',
        'المسترد IQD',
        'المتبقي IQD',
        'معرّف الموظف',
        'معرّف المورّد',
      ],
      ...filtered.map(row => [
        row.id,
        row.date,
        row.customer,
        M.services[row.service] || row.service_type,
        statusLabels[row.status] || row.status,
        'IQD',
        row.total_iqd,
        row.collected_iqd,
        row.refunded_iqd,
        row.due_iqd,
        row.assignedId,
        row.supplier_id,
      ]),
    ];
    const csv = data
      .map(line => line.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `YAR-booking-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('تم تصدير التقرير من بيانات الخادم.');
  };

  return (
    <div className="ops-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">عمليات YAR · API 113 & API 046</div>
          <h1 id="operations-title" tabIndex={-1}>
            التقارير
          </h1>
          <p>تحليلات الحجوزات والمبالغ المجمعة مباشرة من خادم Odoo.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="quiet-button" onClick={load} disabled={loading}>
            <i data-icon="refresh">
              <Icon name="refresh" />
            </i>
            تحديث
          </button>
          <button type="button" className="button secondary" onClick={exportCsv}>
            <i data-icon="download">
              <Icon name="download" />
            </i>
            تصدير CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="ops-form-error" role="alert">
          {error}{' '}
          <button type="button" className="quiet-button" onClick={load}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Main KPI aggregate cards */}
      <div className="ops-stats">
        {[
          [`الحجوزات المطابقة`, totals.count],
          ['الصادرة / المؤكدة', totals.issued],
          ['إجمالي السعر IQD', amount(totals.total)],
          ['المحصّل IQD', amount(totals.collected)],
          ['المسترد IQD', amount(totals.refunded)],
          ['المتبقي IQD', amount(totals.due)],
        ].map(([label, value]) => (
          <div className="ops-stat" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      {/* Backend aggregates breakdown (API 113) */}
      {serverReport && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 20,
          }}
        >
          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--c-1c3d2b)' }}>
              توزيع الخدمات المجمّع (API 113)
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(serverReport.by_service || {}).map(([srv, count]) => (
                <div
                  key={srv}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    background: count > 0 ? 'var(--c-f0f5ed)' : 'var(--c-fafbf7)',
                    color: count > 0 ? 'var(--c-234e32)' : 'var(--muted)',
                  }}
                >
                  <span>{M.services[srv] || srv}: </span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 13, margin: '0 0 12px', color: 'var(--c-1c3d2b)' }}>
              توزيع حالات الحجوزات (API 113)
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(serverReport.by_state || {}).map(([st, count]) => (
                <div
                  key={st}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    background: count > 0 ? 'var(--c-f0f5ed)' : 'var(--c-fafbf7)',
                    color: count > 0 ? 'var(--c-234e32)' : 'var(--muted)',
                  }}
                >
                  <span>{statusLabels[st] || st}: </span>
                  <strong>{count}</strong>
                </div>
              ))}
              {serverReport.supplier_cost_usd != null && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    background: 'var(--c-fafbf7)',
                    marginInlineStart: 'auto',
                  }}
                >
                  <span>تكلفة الموردين: </span>
                  <strong style={{ color: 'var(--c-8a5a48)' }}>
                    ${amount(serverReport.supplier_cost_usd)}
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtering and Data Table */}
      <section className="panel ops-card">
        <div
          className="ops-toolbar"
          style={{
            padding: 16,
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <label className="ops-search">
            <i data-icon="search">
              <Icon name="search" />
            </i>
            <input
              type="search"
              value={searchQuery}
              onChange={event => onSearchChange?.(event.target.value)}
              placeholder="ابحث بالعميل أو مرجع الحجز..."
            />
          </label>
          <span className="ops-note">
            بيانات مباشرة من الخادم · يعرض تفاصيل الحجوزات والفلاتر التفاعلية.
          </span>
        </div>

        <div
          className="ops-filters"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            padding: 16,
          }}
        >
          <label className="ops-field">
            <span>الخدمة</span>
            <select
              value={filters.service}
              onChange={e => setFilters({ ...filters, service: e.target.value })}
            >
              <option value="all">كل الخدمات</option>
              {Object.entries(M.services).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ops-field">
            <span>الحالة</span>
            <select
              value={filters.status}
              onChange={e => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="all">كل الحالات</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="ops-field">
            <span>الدفع</span>
            <select
              value={filters.paymentStatus}
              onChange={e => setFilters({ ...filters, paymentStatus: e.target.value })}
            >
              <option value="all">الكل</option>
              <option value="paid">مدفوع</option>
              <option value="unpaid">غير مدفوع</option>
            </select>
          </label>
          <label className="ops-field">
            <span>من تاريخ الإنشاء</span>
            <input
              type="date"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            />
          </label>
          <label className="ops-field">
            <span>إلى تاريخ الإنشاء</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            />
          </label>
        </div>

        <div className="table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th>الحجز / العميل</th>
                <th>الخدمة</th>
                <th>تاريخ الإنشاء</th>
                <th>الإجمالي / المتبقي</th>
                <th>الحالة</th>
                <th>الموظف / المورّد</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    جاري تحميل التقرير...
                  </td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.rawId || row.id}>
                    <td>
                      <strong>{row.customer || '—'}</strong>
                      <br />
                      <small>{row.id}</small>
                    </td>
                    <td>
                      {M.services[row.service] || row.service_type || '—'} ·{' '}
                      {row.service_id ?? '—'}
                    </td>
                    <td>{row.date || '—'}</td>
                    <td>
                      {amount(row.total_iqd)} / {amount(row.due_iqd)} IQD
                    </td>
                    <td>
                      <span className={`status ${row.status}`}>
                        {statusLabels[row.status] || row.status}
                      </span>
                    </td>
                    <td>
                      #{row.assignedId || '—'} / #{row.supplier_id || '—'}
                    </td>
                  </tr>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                    لا توجد سجلات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ReportsPage;
