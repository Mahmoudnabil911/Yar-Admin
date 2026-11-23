import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { bookingsApi } from '../../services/api/bookingsApi';

const statusLabels = { ...M.statuses, confirmed: 'مؤكد' };
const amount = value => new Intl.NumberFormat('en-US').format(Number(value) || 0);

export function ReportsPage({ searchQuery = '', onSearchChange }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ service: 'all', status: 'all', paymentStatus: 'all', startDate: '', endDate: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bookingsApi.listBookings({ limit: 100 }, true);
      setRows((result.items || []).map(bookingsApi.mapRecordToRow));
      setError('');
    } catch (err) {
      setError(err?.ar || err?.message || 'تعذر تحميل التقارير.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener('yar:bookings-updated', load);
    return () => window.removeEventListener('yar:bookings-updated', load);
  }, [load]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return rows.filter(row => {
      const paid = row.due_iqd != null ? Number(row.due_iqd) <= 0 : Number(row.total_iqd) > 0 && Number(row.collected_iqd || 0) >= Number(row.total_iqd);
      return (filters.service === 'all' || row.service === filters.service)
        && (filters.status === 'all' || row.status === filters.status)
        && (filters.paymentStatus === 'all' || (filters.paymentStatus === 'paid') === paid)
        && (!filters.startDate || (row.date || '') >= filters.startDate)
        && (!filters.endDate || (row.date || '') <= filters.endDate)
        && (!query || `${row.id} ${row.reference || ''} ${row.customer || ''} ${row.phone || ''}`.toLocaleLowerCase().includes(query));
    });
  }, [rows, filters, searchQuery]);

  const totals = useMemo(() => filtered.reduce((acc, row) => ({
    count: acc.count + 1,
    issued: acc.issued + (row.status === 'issued' ? 1 : 0),
    total: acc.total + Number(row.total_iqd || 0),
    collected: acc.collected + Number(row.collected_iqd || 0),
    refunded: acc.refunded + Number(row.refunded_iqd || 0),
    due: acc.due + Number(row.due_iqd || 0),
  }), { count: 0, issued: 0, total: 0, collected: 0, refunded: 0, due: 0 }), [filtered]);

  const exportCsv = () => {
    const data = [['رقم الحجز', 'تاريخ الإنشاء', 'العميل', 'الخدمة', 'الحالة', 'العملة', 'الإجمالي IQD', 'المحصّل IQD', 'المسترد IQD', 'المتبقي IQD', 'معرّف الموظف', 'معرّف المورّد'],
      ...filtered.map(row => [row.id, row.date, row.customer, row.service_type, statusLabels[row.status] || row.status, 'IQD', row.total_iqd, row.collected_iqd, row.refunded_iqd, row.due_iqd, row.assignedId, row.supplier_id])];
    const csv = data.map(line => line.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
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
        <div><div className="eyebrow">عمليات YAR</div><h1 id="operations-title" tabIndex={-1}>التقارير</h1><p>ملخص الحجوزات والمبالغ حسب بيانات الخادم والفلاتر المحددة.</p></div>
        <div className="heading-actions"><button type="button" className="quiet-button" onClick={load} disabled={loading}><i data-icon="refresh"><Icon name="refresh" /></i>تحديث</button><button type="button" className="button secondary" onClick={exportCsv}><i data-icon="download"><Icon name="download" /></i>تصدير CSV</button></div>
      </div>
      {error && <div className="ops-form-error" role="alert">{error} <button type="button" className="quiet-button" onClick={load}>إعادة المحاولة</button></div>}
      <div className="ops-stats">
        {[[`الحجوزات المطابقة`, totals.count], ['الصادرة', totals.issued], ['إجمالي السعر IQD', amount(totals.total)], ['المحصّل IQD', amount(totals.collected)], ['المسترد IQD', amount(totals.refunded)], ['المتبقي IQD', amount(totals.due)]].map(([label, value]) => <div className="ops-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <section className="panel ops-card">
        <div className="ops-toolbar" style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <label className="ops-search"><i data-icon="search"><Icon name="search" /></i><input type="search" value={searchQuery} onChange={event => onSearchChange?.(event.target.value)} placeholder="ابحث بالعميل أو مرجع الحجز..." /></label>
          <span className="ops-note">الـAPI الحالي يعيد حتى 100 حجز، والفلاتر تطبق على السجلات المستلمة.</span>
        </div>
        <div className="ops-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: 16 }}>
          <label className="ops-field"><span>الخدمة</span><select value={filters.service} onChange={e => setFilters({ ...filters, service: e.target.value })}><option value="all">كل الخدمات</option>{Object.entries(M.services).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="ops-field"><span>الحالة</span><select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}><option value="all">كل الحالات</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="ops-field"><span>الدفع</span><select value={filters.paymentStatus} onChange={e => setFilters({ ...filters, paymentStatus: e.target.value })}><option value="all">الكل</option><option value="paid">مدفوع</option><option value="unpaid">غير مدفوع</option></select></label>
          <label className="ops-field"><span>من تاريخ الإنشاء</span><input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} /></label>
          <label className="ops-field"><span>إلى تاريخ الإنشاء</span><input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} /></label>
        </div>
        <div className="table-scroll">
          <table className="ops-table"><thead><tr><th>الحجز / العميل</th><th>الخدمة</th><th>تاريخ الإنشاء</th><th>الإجمالي / المتبقي</th><th>الحالة</th><th>الموظف / المورّد</th></tr></thead>
            <tbody>{loading && rows.length === 0 ? <tr><td colSpan={6}>جاري تحميل التقرير...</td></tr> : filtered.map(row => <tr key={row.rawId}>
              <td><strong>{row.customer || '—'}</strong><br /><small>{row.id}</small></td>
              <td>{M.services[row.service] || row.service_type} · {row.service_id ?? '—'}</td>
              <td>{row.date || '—'}</td>
              <td>{amount(row.total_iqd)} / {amount(row.due_iqd)} IQD</td>
              <td><span className={`status ${row.status}`}>{statusLabels[row.status] || row.status}</span></td>
              <td>#{row.assignedId || '—'} / #{row.supplier_id || '—'}</td>
            </tr>)}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>لا توجد سجلات مطابقة.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default ReportsPage;
