import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { suppliersApi } from '../../services/api/suppliersApi';
import { AddSupplierModal } from '../suppliers/AddSupplierModal';
import { can } from '../../auth/access';

const serviceLabels = {
  flight: 'طيران',
  hotel: 'فنادق',
  car: 'نقل وسيارات',
  tour: 'جولات سياحية',
  package: 'باقات سفر',
};

export function ProvidersPage({ onNavigate, searchQuery = '', onSearchChange }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersApi.listAdminSuppliers();
      setSuppliers(res.items || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      // Fallback to getSuppliers (API 065) if admin list fails
      try {
        const fallback = await suppliersApi.getSuppliers();
        setSuppliers(fallback.items || []);
      } catch (err2) {
        setError(err.message || 'تعذر تحميل قائمة المزوّدين من الخادم.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return suppliers.filter(s => {
      if (serviceFilter !== 'all' && s.service_type !== serviceFilter) return false;
      if (statusFilter === 'active' && s.active === false) return false;
      if (statusFilter === 'inactive' && s.active !== false) return false;
      if (q) {
        const text = [s.name, s.code, s.email, s.phone, s.service_type, s.notes].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [suppliers, serviceFilter, statusFilter, searchQuery]);

  const canEdit = can('supplier.topup');

  return (
    <div id="catalog-view" className="ops-page">
      <div className="page-heading catalog-heading">
        <div>
          <div className="eyebrow">إدارة الخدمات</div>
          <h1 id="catalog-title" tabIndex={-1}>إدارة مزوّدي الخدمات</h1>
          <p>عرض وإدارة مزوّدي الطيران والفنادق والنقل والباقات والجولات في النظام (API 067 / 068).</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="button secondary"
            onClick={loadSuppliers}
            title="تحديث القائمة من الخادم"
            disabled={loading}
          >
            <i data-icon="refresh"><Icon name="refresh" /></i>
            تحديث
          </button>
          {canEdit && (
            <button
              type="button"
              className="button primary"
              data-catalog-add
              onClick={() => setShowAddModal(true)}
            >
              <i data-icon="plus"><Icon name="plus" /></i>
              إضافة مزوّد خدمة
            </button>
          )}
        </div>
      </div>

      {/* Live Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="ops-badge live" style={{ background: 'var(--c-eaf4e6, #eaf4e6)', color: 'var(--c-2b5a26, #2b5a26)', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
          • بيانات مباشرة من الخادم (API 067 / 068)
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          تُحفظ وتُدار بيانات المورّدين مباشرة على قاعدة بيانات الخادم.
        </span>
      </div>

      {error && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="button secondary" style={{ minHeight: 28, fontSize: 12, padding: '2px 8px' }} onClick={loadSuppliers}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Filters */}
      <section className="panel ops-card" style={{ marginBottom: 25 }}>
        <div className="credit-filters" style={{ display: 'flex', gap: 14, padding: '16px 20px', background: 'var(--c-fafbf7)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <label className="ops-field" style={{ minWidth: 180 }}>
            <span>نوع الخدمة</span>
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
              <option value="all">كل الخدمات</option>
              <option value="flight">طيران</option>
              <option value="hotel">فنادق</option>
              <option value="car">نقل وسيارات</option>
              <option value="tour">جولات سياحية</option>
              <option value="package">باقات سفر</option>
            </select>
          </label>

          <label className="ops-field" style={{ minWidth: 160 }}>
            <span>الحالة</span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">كل الحالات</option>
              <option value="active">مفعّل</option>
              <option value="inactive">معطّل</option>
            </select>
          </label>
        </div>

        <div className="ops-table-wrap table-scroll">
          {loading ? (
            <div className="aud-loading" style={{ padding: 40, textAlign: 'center' }}>
              <div className="aud-spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--muted)' }}>جاري تحميل قائمة المزوّدين من الخادم...</p>
            </div>
          ) : (
            <table className="ops-table catalog-table">
              <thead>
                <tr>
                  <th>المزوّد</th>
                  <th>الكود</th>
                  <th>نوع الخدمة</th>
                  <th>بيانات الاتصال</th>
                  <th>طريقة الإدارة</th>
                  <th>بيئة التشغيل</th>
                  <th>الحالة</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map(s => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        {s.notes && (
                          <small style={{ color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                            {s.notes}
                          </small>
                        )}
                      </td>
                      <td>
                        <code>{s.code || `SUP_${s.id}`}</code>
                      </td>
                      <td>
                        <span className="ops-badge" style={{ fontSize: 11 }}>
                          {serviceLabels[s.service_type] || s.service_type || 'طيران'}
                        </span>
                      </td>
                      <td>
                        {s.email && <div style={{ fontSize: 12 }}>{s.email}</div>}
                        {s.phone && <div style={{ fontSize: 12, color: 'var(--muted)' }}><bdi>{s.phone}</bdi></div>}
                        {!s.email && !s.phone && <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                      <td>
                        <div style={{ fontSize: 12 }}>
                          {s.integration === 'api' ? 'واجهة API' : 'يدوي (Manual)'}
                        </div>
                        {s.channel && (
                          <small style={{ color: 'var(--muted)' }}>قناة: {s.channel}</small>
                        )}
                      </td>
                      <td>
                        <span className={`ops-badge ${s.environment === 'production' ? 'success' : 'neutral'}`} style={{ fontSize: 11 }}>
                          {s.environment === 'production' ? 'إنتاج' : 'تجريبي'}
                        </span>
                      </td>
                      <td>
                        <span className={`ops-status ${s.active !== false ? 'paid' : 'cancelled'}`}>
                          {s.active !== false ? 'نشط' : 'معطّل'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ minHeight: 30, padding: '3px 8px', fontSize: 12 }}
                            onClick={() => onNavigate?.('supplier-credit')}
                            title="الانتقال إلى أرصدة وحركات المورّد"
                          >
                            الأرصدة
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 35, color: 'var(--muted)' }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>لا يوجد مزوّدو خدمة مسجلون مطابقون للبحث.</p>
                      <small>No suppliers found matching current criteria.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <Drawer
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          eyebrow="إدارة المورّدين (API 068)"
          title="إضافة مزوّد خدمة جديد"
        >
          <AddSupplierModal
            onClose={() => setShowAddModal(false)}
            onCreated={() => {
              loadSuppliers();
            }}
          />
        </Drawer>
      )}
    </div>
  );
}

export default ProvidersPage;
