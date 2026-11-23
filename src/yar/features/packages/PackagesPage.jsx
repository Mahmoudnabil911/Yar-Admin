import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  MapPin,
  ChevronDown,
  Calendar,
  Users,
  DollarSign,
  Package as PackageIcon,
} from 'lucide-react';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { isAuthenticated } from '../../services/api/authApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';
import CatalogListView from '../catalog/CatalogListView';
import CatalogEditor from '../catalog/CatalogEditor';
import { CreatePackageModal } from './CreatePackageModal';
import { ManagePackageOptionsModal } from './ManagePackageOptionsModal';
import '../hotels/hotel-editor.css';

function CityFilterDropdown({ cities, cityFilter, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectedLabel = cityFilter === 'all' ? `كل الوجهات (${cities.length})` : cityFilter;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          height: 38,
          background: cityFilter !== 'all' ? 'var(--c-eef4e7)' : 'var(--c-f7f9f3)',
          border: `1px solid ${cityFilter !== 'all' ? 'var(--c-557142)' : 'var(--c-e2e9da)'}`,
          borderRadius: 7,
          padding: '0 12px',
          fontSize: 12,
          fontWeight: cityFilter !== 'all' ? 600 : 500,
          color: 'var(--c-36542a)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          minWidth: 135,
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <MapPin
            size={15}
            style={{ color: cityFilter !== 'all' ? 'var(--c-557142)' : 'var(--c-ba9450)' }}
          />
          <span>{selectedLabel}</span>
        </span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'var(--c-557142)',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: '#ffffff',
            border: '1px solid var(--c-e2e9da)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            zIndex: 50,
            minWidth: 180,
            maxHeight: 250,
            overflowY: 'auto',
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onSelect('all');
              setIsOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '8px 14px',
              border: 'none',
              background: cityFilter === 'all' ? 'var(--c-eef4e7)' : 'transparent',
              fontSize: 12,
              fontWeight: cityFilter === 'all' ? 600 : 400,
              color: cityFilter === 'all' ? 'var(--c-36542a)' : 'inherit',
              cursor: 'pointer',
              textAlign: 'right',
            }}
          >
            كل الوجهات ({cities.length})
          </button>
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onSelect(c);
                setIsOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '8px 14px',
                border: 'none',
                background: cityFilter === c ? 'var(--c-eef4e7)' : 'transparent',
                fontSize: 12,
                fontWeight: cityFilter === c ? 600 : 400,
                color: cityFilter === c ? 'var(--c-36542a)' : 'inherit',
                cursor: 'pointer',
                textAlign: 'right',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PackagesPage({
  editId: propEditId,
  onEdit: propOnEdit,
  onBack: propOnBack,
  searchQuery = '',
  onSearchChange,
  onNavigate,
}) {
  const toast = useToast();
  const hasAuth = isAuthenticated();

  const [localEditId, setLocalEditId] = useState(null);
  const editId = propEditId !== undefined ? propEditId : localEditId;
  const onEdit = propOnEdit || setLocalEditId;
  const onBack = propOnBack || (() => setLocalEditId(null));

  // Live state from Odoo Backend (API 078 / 081)
  const [packages, setPackages] = useState([]);
  const [serviceOptions, setServiceOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState(null);
  const [packageForOptions, setPackageForOptions] = useState(null);

  // Fetch live packages and options from Odoo APIs (078, 081)
  const fetchLivePackages = useCallback(async (force = false) => {
    if (!isAuthenticated()) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [servicesRes, optionsRes] = await Promise.all([
        catalogAdminApi.getServices(force),
        catalogAdminApi.getServiceOptions(force),
      ]);

      const allServices = servicesRes.items || [];
      // Filter packages (either service_type === 'package' or default internal items)
      const pkgItems = allServices.filter((s) => !s.service_type || s.service_type === 'package');
      setPackages(pkgItems);
      setServiceOptions(optionsRes.items || []);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'تعذر تحميل بيانات الباقات السياحية من الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAuth) {
      fetchLivePackages();
    }
  }, [hasAuth, fetchLivePackages]);

  // Fallback to legacy catalog view if not authenticated
  if (!hasAuth) {
    if (editId) {
      return <CatalogEditor catalogKey="packages" recordId={editId} onBack={onBack} />;
    }
    return (
      <CatalogListView
        catalogKey="packages"
        onNavigate={onNavigate}
        onEdit={onEdit}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
    );
  }

  // Filter calculations
  const cities = useMemo(() => {
    const set = new Set();
    packages.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return Array.from(set).sort();
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return packages.filter((item) => {
      if (statusFilter === 'published' && !item.published) return false;
      if (statusFilter === 'draft' && item.published) return false;
      if (statusFilter === 'active' && !item.active) return false;
      if (cityFilter !== 'all' && item.city !== cityFilter) return false;

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = item.name && item.name.toLowerCase().includes(q);
        const matchCity = item.city && item.city.toLowerCase().includes(q);
        const matchDesc = item.description && item.description.toLowerCase().includes(q);
        if (!matchName && !matchCity && !matchDesc) return false;
      }

      return true;
    });
  }, [packages, statusFilter, cityFilter, searchQuery]);

  // Status counts
  const counts = useMemo(() => {
    return {
      all: packages.length,
      published: packages.filter((p) => p.published).length,
      draft: packages.filter((p) => !p.published).length,
    };
  }, [packages]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / pageSize));
  const displayedPackages = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPackages.slice(start, start + pageSize);
  }, [filteredPackages, page, pageSize]);

  // Live Status Toggles via API 080
  const handleTogglePublished = async (pkg) => {
    try {
      const nextPublished = !pkg.published;
      await catalogAdminApi.updateService(pkg.id, { published: nextPublished });
      toast(
        nextPublished ? `تم نشر باقة «${pkg.name}» للعملاء.` : `تم إلغاء نشر باقة «${pkg.name}».`,
      );
      await fetchLivePackages();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تحديث حالة النشر.');
    }
  };

  const handleToggleActive = async (pkg) => {
    try {
      const nextActive = !pkg.active;
      await catalogAdminApi.updateService(pkg.id, { active: nextActive });
      toast(nextActive ? `تم تفعيل باقة «${pkg.name}».` : `تم تعطيل باقة «${pkg.name}».`);
      await fetchLivePackages();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تحديث حالة النشاط.');
    }
  };

  return (
    <div id="catalog-view">
      {/* Heading */}
      <div className="page-heading catalog-heading">
        <div>
          <div className="eyebrow">إدارة الخدمات / الباقات السياحية</div>
          <h1
            id="catalog-title"
            tabIndex={-1}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span>إدارة الباقات السياحية</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => fetchLivePackages(true)}
            disabled={isLoading}
            title="تحديث البيانات من السيرفر (API 078)"
          >
            <i>
              <Icon name="refresh" />
            </i>
            {isLoading ? 'جاري التحميل...' : 'تحديث'}
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              setPackageToEdit(null);
              setIsCreateModalOpen(true);
            }}
          >
            <i>
              <Icon name="plus" />
            </i>
            إضافة باقة سياحية جديدة
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="catalog-summary">
        {[
          ['all', 'إجمالي الباقات', counts.all],
          ['published', 'منشور للعملاء', counts.published],
          ['draft', 'مسودات', counts.draft],
        ].map(([s, label, count]) => (
          <button
            key={s}
            type="button"
            className={statusFilter === s ? 'selected' : ''}
            aria-pressed={statusFilter === s}
            onClick={() => {
              setStatusFilter(s);
              setPage(1);
            }}
          >
            <span>{label}</span>
            <strong>{count}</strong>
          </button>
        ))}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '0 16px',
            background: 'var(--panel-alt, rgba(0,0,0,0.02))',
            borderRadius: 8,
            marginInlineStart: 'auto',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)' }}>
            تصفية حسب الوجهة:
          </span>
          <CityFilterDropdown
            cities={cities}
            cityFilter={cityFilter}
            onSelect={(c) => {
              setCityFilter(c);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Error Notice */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            margin: '16px 0',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid var(--c-ef4444)',
            borderRadius: 8,
            color: 'var(--c-ef4444)',
            fontSize: 13,
          }}
        >
          <strong>خطأ في الاتصال بالخادم: </strong> {errorMsg}
        </div>
      )}

      {/* Live Packages Grid */}
      {isLoading && packages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)', fontSize: 14 }}>
          جاري جلب الباقات السياحية من سيرفر Odoo...
        </div>
      ) : filteredPackages.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 60,
            background: 'var(--panel-alt, rgba(0,0,0,0.02))',
            borderRadius: 8,
            border: '1px dashed var(--border)',
            color: 'var(--muted)',
            fontSize: 14,
            marginTop: 20,
          }}
        >
          لا توجد باقات سياحية مطابقة للشروط أو البحث.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 20,
            marginTop: 20,
          }}
        >
          {displayedPackages.map((pkg) => {
            const pkgOptions = serviceOptions.filter(
              (o) => Number(o.service_id) === Number(pkg.id),
            );
            const durationDays = pkg.duration_minutes
              ? Math.round(pkg.duration_minutes / 1440)
              : null;

            return (
              <div
                key={pkg.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {/* Card Banner / Header */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--c-36542a), var(--c-557142))',
                    color: '#ffffff',
                    padding: '16px 18px',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PackageIcon size={20} style={{ opacity: 0.9 }} />
                      <span
                        style={{
                          fontSize: 11,
                          background: 'rgba(255,255,255,0.2)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        باقة سياحية #{pkg.id}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleTogglePublished(pkg)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 20,
                          border: 'none',
                          cursor: 'pointer',
                          background: pkg.published ? '#ffffff' : 'rgba(255,255,255,0.2)',
                          color: pkg.published ? 'var(--c-36542a)' : '#ffffff',
                        }}
                        title="انقر لتغيير حالة النشر في التطبيق"
                      >
                        {pkg.published ? '✓ منشور' : 'مسودة'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleActive(pkg)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: 20,
                          border: 'none',
                          cursor: 'pointer',
                          background: pkg.active
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(239, 68, 68, 0.8)',
                          color: pkg.active ? 'var(--c-36542a)' : '#ffffff',
                        }}
                        title="انقر لتغيير حالة النشاط للحجز"
                      >
                        {pkg.active ? 'نشط' : 'معطل'}
                      </button>
                    </div>
                  </div>

                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      marginTop: 12,
                      lineHeight: 1.4,
                      color: '#ffffff',
                    }}
                  >
                    {pkg.name}
                  </h3>
                </div>

                {/* Card Content */}
                <div
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    gap: 14,
                  }}
                >
                  {/* Meta items */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 12,
                      fontSize: 12,
                      color: 'var(--muted)',
                    }}
                  >
                    {pkg.city && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} style={{ color: 'var(--c-ba9450)' }} />
                        {pkg.city}
                      </span>
                    )}

                    {durationDays && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Calendar size={14} style={{ color: 'var(--c-557142)' }} />
                        {durationDays} أيام
                      </span>
                    )}

                    {pkg.capacity && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Users size={14} style={{ color: 'var(--c-557142)' }} />
                        سعة {pkg.capacity} أفراد
                      </span>
                    )}
                  </div>

                  {/* Description preview */}
                  {pkg.description && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>
                      {pkg.description.length > 90
                        ? `${pkg.description.slice(0, 90)}...`
                        : pkg.description}
                    </p>
                  )}

                  {/* Price Box */}
                  <div
                    style={{
                      background: 'var(--panel-alt, rgba(0,0,0,0.02))',
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>سعر الباقة الأساسي</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-36542a)' }}>
                        ${pkg.price_usd || 0}
                      </div>
                    </div>

                    {pkg.supplier_cost_usd != null && (
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>تكلفة المورّد</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
                          ${pkg.supplier_cost_usd}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service Options Bar */}
                  <div
                    style={{
                      marginTop: 'auto',
                      paddingTop: 12,
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      className="button secondary"
                      style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }}
                      onClick={() => setPackageForOptions(pkg)}
                    >
                      فئات وخيارات الباقة ({pkgOptions.length})
                    </button>

                    <button
                      type="button"
                      className="button outline"
                      style={{ fontSize: 12, padding: '4px 10px', minHeight: 30 }}
                      onClick={() => {
                        setPackageToEdit(pkg);
                        setIsCreateModalOpen(true);
                      }}
                    >
                      تعديل
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            type="button"
            className="button secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </button>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 12px',
              fontSize: 13,
            }}
          >
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            className="button secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </button>
        </div>
      )}

      {/* Modals */}
      <CreatePackageModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        packageToEdit={packageToEdit}
        onSaved={fetchLivePackages}
      />

      <ManagePackageOptionsModal
        open={Boolean(packageForOptions)}
        onClose={() => setPackageForOptions(null)}
        packageItem={packageForOptions}
        onUpdated={fetchLivePackages}
      />
    </div>
  );
}

export default PackagesPage;
