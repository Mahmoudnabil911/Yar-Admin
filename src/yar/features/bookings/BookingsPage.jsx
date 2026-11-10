import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { staffStorage } from '../../services/storage/staffStorage';
import { operationsModel as M } from '../../services/models';
import { useToast } from '../../components/ui/Toast';

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

  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  // Filtered rows
  const filteredRows = useMemo(() => {
    try {
      return operationsStorage.filter({
        ...filters,
        query: effectiveSearchQuery
      });
    } catch {
      return [];
    }
  }, [filters, effectiveSearchQuery, bookings]);

  // Stat calculations
  const stats = useMemo(() => {
    const total = filteredRows.length;
    const awaiting = filteredRows.filter(r => r.status === 'awaiting').length;
    const processing = filteredRows.filter(r => r.status === 'processing').length;
    const unpaid = filteredRows.filter(r =>
      !['cancelled', 'rejected'].includes(r.status) && M.paymentStatus(r) === 'unpaid'
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
      source: 'all',
      paymentStatus: 'all',
      startDate: '',
      endDate: ''
    });
    onSearchChange?.('');
    setPage(1);
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['رقم الطلب', 'تاريخ الطلب', 'العميل', 'الهاتف المقنّع', 'الخدمة', 'المصدر', 'حالة الحجز', 'حالة الدفع', 'العملة', 'تكلفة المزوّد', 'الزيادة', 'السعر الأصلي', 'الخصم', 'السعر النهائي', 'المحصّل', 'المسترد', 'صافي المحصّل', 'الموظف', 'المزوّد'],
        ...filteredRows.map(r => {
          const b = M.balances(r);
          return [
            r.id,
            r.date,
            r.customer,
            r.phone,
            M.services[r.service] || r.service,
            { app: 'تطبيق YAR', whatsapp: 'واتساب', office: 'المكتب' }[r.source] || r.source,
            M.statuses[r.status] || r.status,
            M.paymentStatus(r) === 'paid' ? 'مدفوع' : 'غير مدفوع',
            r.currency,
            r.pricing?.cost,
            r.pricing?.markupAmount,
            r.pricing?.original,
            r.pricing?.discountAmount,
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
      a.download = `YAR-demo-bookings-${M.today()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('صُدّرت طلبات المثال وفق المرشحات؛ العملة موضّحة لكل صف.');
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <div className="ops-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">عمليات YAR</div>
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
              {Object.entries(M.statuses).map(([k, v]) => (
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
            <span>المصدر</span>
            <select
              value={filters.source}
              onChange={e => { setFilters({ ...filters, source: e.target.value }); setPage(1); }}
            >
              <option value="all">كل المصادر</option>
              <option value="app">تطبيق YAR</option>
              <option value="whatsapp">واتساب</option>
              <option value="office">المكتب</option>
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
          {pageRows.length > 0 ? (
            <table className="ops-table">
              <thead>
                <tr>
                  <th>الطلب / العميل</th>
                  <th>الخدمة / المسار</th>
                  <th>التاريخ / المصدر</th>
                  <th>المبلغ</th>
                  <th>المسؤول / المزوّد</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(r => {
                  const initials = r.initials || r.customer.slice(0, 2);
                  const isPaid = M.paymentStatus(r) === 'paid';
                  const serviceLabel = M.services[r.service] || r.service;
                  const sourceLabel = { app: 'تطبيق', whatsapp: 'واتساب', office: 'المكتب' }[r.source] || r.source;

                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="customer-cell">
                          <span className="customer-initial">{initials}</span>
                          <div>
                            <strong className="customer-name">{r.customer}</strong>
                            <span className="booking-id">{r.id}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="service-route">
                          <strong>{serviceLabel}</strong>
                          <span>· {r.route}</span>
                        </div>
                        <small className="service-detail">{r.detail}</small>
                      </td>
                      <td>
                        <div>{r.date}</div>
                        <small style={{ color: 'var(--muted)' }}>{sourceLabel}</small>
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
                          {M.statuses[r.status] || r.status}
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
              <strong>لا توجد طلبات مطابقة</strong>
              <p>جرّب تغيير المرشحات أو مسح البحث.</p>
              <button
                type="button"
                className="button secondary"
                onClick={handleResetFilters}
              >
                مسح التصفية
              </button>
            </div>
          )}
        </div>

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

