import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';
import { bookingsApi } from '../../services/api/bookingsApi';

export function BookingsPage({
  onOpenBooking,
  onOpenCreate,
  onCreateBooking,
  searchQuery = '',
  externalQuery,
  onSearchChange
}) {
  const toast = useToast();
  const handleCreate = onOpenCreate || onCreateBooking;
  const effectiveSearchQuery = searchQuery || externalQuery || '';

  const [backendItems, setBackendItems] = useState(null);
  const [loadError, setLoadError] = useState('');
  const providers = useMemo(() => [...new Map((backendItems || []).filter(r => r.supplier_id != null).map(r => [String(r.supplier_id), { id: r.supplier_id, name: r.provider || `#${r.supplier_id}` }])).values()], [backendItems]);
  const staffList = useMemo(() => [...new Map((backendItems || []).filter(r => r.assignedId != null && r.assignedId !== '').map(r => [String(r.assignedId), { id: r.assignedId, name: r.assigned || `#${r.assignedId}` }])).values()], [backendItems]);

  const [filters, setFilters] = useState({
    service: 'all',
    currency: 'all',
    status: 'all',
    providerId: 'all',
    assignedId: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: ''
  });

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [isSyncing, setIsSyncing] = useState(true);
  const transientFailuresRef = useRef(0);
  const retryTimerRef = useRef(null);

  const loadBackendBookings = useCallback(async (force = false) => {
    setIsSyncing(true);
    try {
      const res = await bookingsApi.listBookings({ limit: 100 }, force);
      if (res && Array.isArray(res.items)) {
        transientFailuresRef.current = 0;
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
        const mapped = res.items.map(bookingsApi.mapRecordToRow);
        setBackendItems(mapped);
        window.dispatchEvent(new CustomEvent('yar:bookings-loaded', { detail: mapped }));
        setLoadError('');
        return true;
      } else {
        setBackendItems([]);
        setLoadError('استجابة الحجوزات غير مكتملة.');
        return false;
      }
    } catch (err) {
      console.warn('Backend bookings fetch:', err);
      setLoadError(err?.ar || err?.message || 'تعذر تحميل الحجوزات.');
      setBackendItems(prev => prev || []);
      const transient = err?.status === 502 || err?.status === 504 || err instanceof TypeError;
      if (transient && transientFailuresRef.current < 2) {
        transientFailuresRef.current += 1;
        const delay = transientFailuresRef.current * 1500;
        retryTimerRef.current = setTimeout(() => loadBackendBookings(true), delay);
      }
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSync = async () => {
    transientFailuresRef.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    try {
      const ok = await loadBackendBookings(true);
      toast(ok ? 'تمت مزامنة الحجوزات مع الخادم.' : 'تعذرت المزامنة مع الخادم.');
    } catch {
      toast('تعذرت المزامنة مع الخادم.');
    }
  };

  useEffect(() => {
    loadBackendBookings();

    const handleUpdate = event => {
      transientFailuresRef.current = 0;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      const created = event?.detail;
      if (created?.id != null) {
        const createdRow = bookingsApi.mapRecordToRow(created);
        setBackendItems(current => {
          const rows = current || [];
          return [createdRow, ...rows.filter(row => row.rawId !== createdRow.rawId && row.id !== createdRow.id)];
        });
      }
      loadBackendBookings();
    };
    window.addEventListener('yar:bookings-updated', handleUpdate);

    return () => {
      window.removeEventListener('yar:bookings-updated', handleUpdate);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [loadBackendBookings]);

  const activeBookings = useMemo(() => {
    if (backendItems !== null) return backendItems;
    return [];
  }, [backendItems]);

  const numFormat = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const num = val => numFormat.format(Number(val) || 0);
  const statusLabels = { ...M.statuses, confirmed: 'مؤكد' };

  // Filtered rows
  const filteredRows = useMemo(() => {
    try {
      const query = effectiveSearchQuery.trim().toLocaleLowerCase();
      return activeBookings.filter(r => {
        const paid = r.due_iqd != null
          ? Number(r.due_iqd) <= 0
          : Number(r.total_iqd) > 0 && Number(r.collected_iqd || 0) >= Number(r.total_iqd);
        const date = r.date || '';
        return (filters.service === 'all' || r.service === filters.service)
          && (filters.currency === 'all' || r.currency === filters.currency)
          && (filters.status === 'all' || r.status === filters.status)
          && (filters.providerId === 'all' || String(r.supplier_id || '') === filters.providerId)
          && (filters.assignedId === 'all' || String(r.assignedId || '') === filters.assignedId)
          && (filters.paymentStatus === 'all' || (filters.paymentStatus === 'paid') === paid)
          && (!filters.startDate || date >= filters.startDate)
          && (!filters.endDate || date <= filters.endDate)
          && (!query || `${r.id} ${r.customer || ''} ${r.customer_phone || ''} ${r.reference || ''}`.toLocaleLowerCase().includes(query));
      });
    } catch {
      return [];
    }
  }, [filters, effectiveSearchQuery, activeBookings]);

  // Stat calculations
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const awaiting = filteredRows.filter(r => r.status === 'awaiting').length;
    const processing = filteredRows.filter(r => r.status === 'processing').length;
    const unpaid = filteredRows.filter(r =>
      !['cancelled', 'rejected'].includes(r.status) && (r.due_iqd != null ? Number(r.due_iqd) > 0 : Number(r.collected_iqd || 0) < Number(r.total_iqd || 0))
    ).length;
    return { total, awaiting, processing, unpaid };
  }, [filteredRows]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPageSafe = Math.min(page, totalPages);
  const startIdx = (currentPageSafe - 1) * pageSize;
  const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

  const handleResetFilters = () => {
    setFilters({
      service: 'all',
      currency: 'all',
      status: 'all',
      providerId: 'all',
      assignedId: 'all',
      paymentStatus: 'all',
      startDate: '',
      endDate: ''
    });
    onSearchChange?.('');
    setPage(1);
  };

  const handleExportCSV = () => {
    try {
      const rows = [['رقم الطلب', 'تاريخ الإنشاء', 'العميل', 'الخدمة', 'الحالة', 'العملة', 'الإجمالي IQD', 'المحصّل IQD', 'المسترد IQD', 'المتبقي IQD', 'الموظف', 'المزوّد'],
        ...filteredRows.map(r => [r.id, r.date, r.customer, M.services[r.service] || r.service, statusLabels[r.status] || r.status, r.currency, r.total_iqd, r.collected_iqd, r.refunded_iqd, r.due_iqd, r.assigned, r.provider])];
      const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YAR-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('تم تصدير الحجوزات المحملة وفق المرشحات.');
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="ops-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">عمليات الحجوزات والطلبات</div>
          <h1 id="operations-title" tabIndex={-1}>الحجوزات والطلبات</h1>
          <p>تابع الطلب من الاستفسار حتى التأكيد، مع تفاصيل الخدمة والمسؤول وسجل المتابعة.</p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button primary"
            data-ops-add
            onClick={handleCreate}
          >
            <i data-icon="plus"><Icon name="plus" /></i>
            إدخال طلب يدوي
          </button>
        </div>
      </div>



      <div className="ops-stats">
        <div className="ops-stat">
          <span>الطلبات المطابقة</span>
          <strong>{stats.total}</strong>
        </div>
        <div className="ops-stat">
          <span>بانتظار المتابعة</span>
          <strong>{stats.awaiting}</strong>
        </div>
        <div className="ops-stat">
          <span>قيد المعالجة</span>
          <strong>{stats.processing}</strong>
        </div>
        <div className="ops-stat">
          <span>غير مدفوع</span>
          <strong>{stats.unpaid}</strong>
        </div>
      </div>

      <section className="panel ops-card">
        {loadError && <div className="ops-form-error wide" role="alert" style={{ margin: 16 }}>{loadError} <button type="button" className="quiet-button" onClick={() => loadBackendBookings(true)}>إعادة المحاولة</button></div>}
        <div className="ops-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="ops-search" style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260, maxWidth: 440, background: 'var(--c-f7f9f3)', border: '1px solid var(--c-e2e9da)', borderRadius: 7, padding: '7px 12px' }}>
            <i data-icon="search"><Icon name="search" /></i>
            <input
              type="search"
              value={effectiveSearchQuery}
              onChange={e => { onSearchChange?.(e.target.value); setPage(1); }}
              placeholder="ابحث عن حجز أو اسم عميل أو مرجع..."
              style={{ border: 0, background: 'none', outline: 0, width: '100%', font: 'inherit', fontSize: 12, color: 'var(--green)' }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="quiet-button"
              onClick={handleSync}
              disabled={isSyncing}
              title="مزامنة مع خادم Odoo"
            >
              <i data-icon="refresh"><Icon name="refresh" /></i>
              {isSyncing ? 'جاري المزامنة...' : 'تحديث'}
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={handleExportCSV}
            >
              <i data-icon="download"><Icon name="download" /></i>
              تصدير CSV
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={handleResetFilters}
            >
              إعادة ضبط
            </button>
          </div>
        </div>

        {/* Filters Grid */}
        <div className="ops-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, padding: '16px 20px', background: 'var(--c-fafbf7)', borderBottom: '1px solid var(--border)' }}>
          <label className="ops-field">
            <span>الخدمة</span>
            <select
              value={filters.service}
              onChange={e => { setFilters({ ...filters, service: e.target.value }); setPage(1); }}
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
              onChange={e => { setFilters({ ...filters, currency: e.target.value }); setPage(1); }}
            >
              <option value="all">كل العملات</option>
              <option value="IQD">دينار عراقي · IQD</option>
              <option value="USD">دولار أمريكي · USD</option>
            </select>
          </label>

          <label className="ops-field">
            <span>الحالة</span>
            <select
              value={filters.status}
              onChange={e => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}
            >
              <option value="all">كل الحالات</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          <label className="ops-field">
            <span>حالة الدفع</span>
            <select
              value={filters.paymentStatus}
              onChange={e => { setFilters({ ...filters, paymentStatus: e.target.value }); setPage(1); }}
            >
              <option value="all">الكل</option>
              <option value="paid">مدفوع</option>
              <option value="unpaid">غير مدفوع</option>
            </select>
          </label>

          <label className="ops-field">
            <span>المزوّد</span>
            <select
              value={filters.providerId}
              onChange={e => { setFilters({ ...filters, providerId: e.target.value }); setPage(1); }}
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
              onChange={e => { setFilters({ ...filters, assignedId: e.target.value }); setPage(1); }}
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
              onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setPage(1); }}
            />
          </label>

          <label className="ops-field">
            <span>إلى تاريخ</span>
            <input
              type="date"
              value={filters.endDate}
              onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setPage(1); }}
            />
          </label>
        </div>

        {/* Table */}
        <div className="table-scroll">
          {isSyncing && backendItems === null ? (
            <div className="empty-state" role="status" style={{ padding: 40, textAlign: 'center' }}>جاري تحميل الحجوزات...</div>
          ) : pageRows.length > 0 ? (
            <table className="ops-table">
              <thead>
                <tr>
                  <th>الطلب / العميل</th>
                  <th>الخدمة / المسار</th>
                  <th>تاريخ الإنشاء</th>
                  <th>المبلغ</th>
                  <th>المسؤول / المزوّد</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const initials = r.initials || r.customer?.slice(0, 2);
                  const isPaid = r.due_iqd != null ? Number(r.due_iqd) <= 0 : Number(r.total_iqd) > 0 && Number(r.collected_iqd || 0) >= Number(r.total_iqd);
                  const serviceLabel = M.services[r.service] || r.service;

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="customer-cell">
                          {initials && <span className="customer-initial">{initials}</span>}
                          <div>
                            {r.customer && <strong className="customer-name">{r.customer}</strong>}
                            <span className="booking-id">{r.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="service-route">
                          <strong>{serviceLabel}</strong>
                        </div>
                        <small className="service-detail">{r.detail}</small>
                      </td>
                      <td>
                        <div>{r.date}</div>
                      </td>
                      <td>
                        <div className="row-amount">
                          <bdi>{num(r.amount)}</bdi>
                          <small>{r.currency === 'USD' ? '$' : 'د.ع'}</small>
                        </div>
                        <small className={`payment-status ${isPaid ? 'paid' : 'pending'}`}>
                          {isPaid ? 'مدفوع' : 'غير مدفوع'}
                        </small>
                      </td>
                      <td>
                        <div>{r.assigned || 'غير مسند'}</div>
                        <small style={{ color: 'var(--muted)' }}>{r.provider}</small>
                      </td>
                      <td>
                        <span className={`status ${r.status}`}>
                          {statusLabels[r.status] || r.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="catalog-edit"
                          onClick={() => onOpenBooking(r.id)}
                        >
                          <i><Icon name="layers" /></i>
                          تفاصيل
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <i data-icon="search"><Icon name="search" /></i>
              <strong>{activeBookings.length === 0 ? 'لا توجد حجوزات مسجلة على الخادم بعد' : 'لا توجد طلبات مطابقة'}</strong>
              <p>
                {activeBookings.length === 0
                  ? 'قاعدة بيانات السيرفر الحالية لا تحتوي على حجوزات. يمكنك إنشاء حجز حقيقي الآن بالضغط على زر «إدخال طلب يدوي».'
                  : 'جرّب تغيير المرشحات أو مسح البحث.'}
              </p>
              {activeBookings.length === 0 ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={handleCreate}
                  style={{ marginTop: 12 }}
                >
                  <i data-icon="plus"><Icon name="plus" /></i>
                  إدخال طلب يدوي
                </button>
              ) : (
                <button
                  type="button"
                  className="button secondary"
                  onClick={handleResetFilters}
                >
                  مسح التصفية
                </button>
              )}
            </div>
          )}
        </div>
        {activeBookings.length === 100 && <p className="ops-note" style={{ paddingInline: 20 }}>يعيد الخادم حتى 100 حجز في الطلب الواحد؛ الفلاتر الحالية تعمل على السجلات التي أرجعها الـAPI.</p>}

        {/* Footer */}
        <div className="table-footer">
          <span aria-live="polite">
            {filteredRows.length > 0
              ? `عرض ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredRows.length)} من ${filteredRows.length} طلبًا`
              : 'لا توجد نتائج'}
          </span>
          <div className="pagination">
            <button
              type="button"
              aria-label="الصفحة السابقة"
              disabled={currentPageSafe === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <i data-icon="back"><Icon name="back" /></i>
            </button>
            <span>{currentPageSafe}</span>
            <button
              type="button"
              aria-label="الصفحة التالية"
              disabled={currentPageSafe === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <i data-icon="chevronLeft"><Icon name="chevronLeft" /></i>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default BookingsPage;

