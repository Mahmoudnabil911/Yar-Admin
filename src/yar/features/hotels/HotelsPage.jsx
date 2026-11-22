import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapPin, ChevronDown, X } from 'lucide-react';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';
import { isAuthenticated } from '../../services/api/authApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';
import CatalogListView from '../catalog/CatalogListView';
import HotelEditor from './HotelEditor';
import CreateHotelModal from './CreateHotelModal';
import ManageRoomsModal from './ManageRoomsModal';
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

  const selectedLabel = cityFilter === 'all' ? `كل المدن (${cities.length})` : cityFilter;

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
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
          <MapPin size={15} style={{ color: cityFilter !== 'all' ? 'var(--c-557142)' : 'var(--c-ba9450)' }} />
          <span>{selectedLabel}</span>
        </span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            color: 'var(--c-5c6952)',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            insetInlineStart: 0,
            minWidth: 150,
            background: 'var(--c-ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            zIndex: 50,
            padding: '4px 0',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onSelect('all');
              setIsOpen(false);
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'start',
              background: cityFilter === 'all' ? 'var(--c-f0f4ea)' : 'transparent',
              fontWeight: cityFilter === 'all' ? 600 : 400,
              fontSize: 12,
              color: 'var(--c-36542a)',
              border: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>كل المدن</span>
            <small style={{ color: 'var(--muted)' }}>({cities.length})</small>
          </button>

          {cities.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onSelect(c);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                textAlign: 'start',
                background: cityFilter === c ? 'var(--c-f0f4ea)' : 'transparent',
                fontWeight: cityFilter === c ? 600 : 400,
                fontSize: 12,
                color: 'var(--c-36542a)',
                border: 0,
                cursor: 'pointer',
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

export function HotelsPage({
  editId: propEditId,
  onEdit: propOnEdit,
  onBack: propOnBack,
  searchQuery = '',
  onSearchChange,
  onNavigate,
}) {
  const [localEditId, setLocalEditId] = useState(null);
  const editId = propEditId !== undefined ? propEditId : localEditId;
  const onEdit = propOnEdit || setLocalEditId;
  const onBack = propOnBack || (() => setLocalEditId(null));

  const toast = useToast();
  const hasAuth = isAuthenticated();

  // Live state
  const [hotels, setHotels] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [roomRates, setRoomRates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [hotelToEdit, setHotelToEdit] = useState(null);
  const [hotelForRooms, setHotelForRooms] = useState(null);

  // Fetch live hotels, rooms, and room-rates from Odoo APIs (069, 072, 075)
  const fetchLiveHotels = useCallback(async (force = false) => {
    if (!isAuthenticated()) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [hotelsRes, roomsRes, ratesRes] = await Promise.all([
        catalogAdminApi.getHotels(force),
        catalogAdminApi.getRooms(undefined, force),
        catalogAdminApi.getRoomRates(undefined, force),
      ]);

      setHotels(hotelsRes.items || []);
      setRooms(roomsRes.items || []);
      setRoomRates(ratesRes.items || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تحميل بيانات الفنادق من الخادم.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAuth) {
      fetchLiveHotels();
    }
  }, [hasAuth, fetchLiveHotels]);

  // If not authenticated, fallback to legacy catalog view
  if (!hasAuth) {
    if (editId) {
      return <HotelEditor key={editId} recordId={editId} onBack={onBack} />;
    }
    return (
      <CatalogListView
        catalogKey="hotels"
        onNavigate={onNavigate}
        onEdit={onEdit}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
    );
  }

  // Filter and search calculations
  const cities = useMemo(() => {
    const set = new Set();
    hotels.forEach((h) => {
      if (h.city) set.add(h.city);
    });
    return Array.from(set);
  }, [hotels]);

  const filteredHotels = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    return hotels.filter((h) => {
      if (statusFilter === 'published' && !h.published) return false;
      if (statusFilter === 'draft' && h.published) return false;
      if (statusFilter === 'active' && !h.active) return false;
      if (statusFilter === 'inactive' && h.active) return false;
      if (cityFilter !== 'all' && h.city !== cityFilter) return false;

      if (q) {
        const nameMatch = (h.name || '').toLowerCase().includes(q);
        const cityMatch = (h.city || '').toLowerCase().includes(q);
        const idMatch = String(h.id).includes(q);
        if (!nameMatch && !cityMatch && !idMatch) return false;
      }
      return true;
    });
  }, [hotels, searchQuery, statusFilter, cityFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHotels.length / pageSize));
  const currentPageSafe = Math.min(page, totalPages);
  const startIdx = (currentPageSafe - 1) * pageSize;
  const pageRows = filteredHotels.slice(startIdx, startIdx + pageSize);

  // Counts
  const counts = useMemo(
    () => ({
      all: hotels.length,
      published: hotels.filter((h) => h.published).length,
      draft: hotels.filter((h) => !h.published).length,
      totalRooms: rooms.length,
      totalRates: roomRates.length,
    }),
    [hotels, rooms, roomRates],
  );

  const handleTogglePublish = async (hotel) => {
    try {
      const nextPublished = !hotel.published;
      await catalogAdminApi.updateHotel(hotel.id, { published: nextPublished });
      toast(nextPublished ? `تم نشر ${hotel.name}.` : `تم تحويل ${hotel.name} إلى مسودة.`);
      await fetchLiveHotels();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تحديث حالة النشر.');
    }
  };

  const handleToggleActive = async (hotel) => {
    try {
      const nextActive = !hotel.active;
      await catalogAdminApi.updateHotel(hotel.id, { active: nextActive });
      toast(nextActive ? `تم تفعيل ${hotel.name}.` : `تم تعطيل ${hotel.name}.`);
      await fetchLiveHotels();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تحديث حالة النشاط.');
    }
  };

  return (
    <div id="catalog-view">
      {/* Heading */}
      <div className="page-heading catalog-heading">
        <div>
          <div className="eyebrow">إدارة الخدمات </div>
          <h1 id="catalog-title" tabIndex={-1}>
            إدارة الفنادق
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="button secondary"
            onClick={() => fetchLiveHotels(true)}
            disabled={isLoading}
            title="تحديث البيانات من السيرفر"
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
              setHotelToEdit(null);
              setIsCreateModalOpen(true);
            }}
          >
            <i>
              <Icon name="plus" />
            </i>
            إضافة فندق جديد
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="catalog-summary">
        {[
          ['all', 'إجمالي الفنادق', counts.all],
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
            border: '1px solid var(--border)',
            fontSize: 13,
          }}
        >
          <div>
            <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>
              الغرف المسجلة
            </span>
            <strong style={{ fontSize: 16 }}>{counts.totalRooms}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>
              خطط الأسعار
            </span>
            <strong style={{ fontSize: 16, color: 'var(--c-10b981)' }}>{counts.totalRates}</strong>
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <section className="panel catalog-list-panel">
        <div
          className="catalog-toolbar"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 320,
              maxWidth: 680,
            }}
          >
            {/* Search Input */}
            <label
              className="catalog-search"
              style={{ flex: 1, minHeight: 38, height: 38, padding: '0 12px', borderRadius: 7 }}
            >
              <i>
                <Icon name="search" />
              </i>
              <input
                type="search"
                placeholder="ابحث باسم الفندق، المدينة، أو المعرّف..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange?.(e.target.value);
                  setPage(1);
                }}
              />
            </label>

            {/* City Filter Dropdown */}
            {cities.length > 0 && (
              <CityFilterDropdown
                cities={cities}
                cityFilter={cityFilter}
                onSelect={(city) => {
                  setCityFilter(city);
                  setPage(1);
                }}
              />
            )}

            {/* Clear Filters Button */}
            {(cityFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                className="button secondary"
                style={{
                  height: 38,
                  padding: '0 10px',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
                onClick={() => {
                  setCityFilter('all');
                  setStatusFilter('all');
                  onSearchChange?.('');
                  setPage(1);
                }}
                title="إلغاء التصفية والبحث"
              >
                <X size={13} />
                مسح التصفية
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div
            className="form-error"
            style={{
              margin: '12px 16px',
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--c-ef4444)',
              borderRadius: 8,
              color: 'var(--c-ef4444)',
              fontSize: 13,
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Hotels Table */}
        <div className="table-scroll">
          {isLoading && hotels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--muted)' }}>
              جاري تحميل الفنادق من السيرفر...
            </div>
          ) : pageRows.length > 0 ? (
            <table className="catalog-table">
              <thead>
                <tr>
                  <th scope="col">الفندق</th>
                  <th scope="col">المدينة</th>
                  <th scope="col">التصنيف</th>
                  <th scope="col">الغرف والخيارات</th>
                  <th scope="col">أنظمة الوجبات</th>
                  <th scope="col">تبدأ من</th>
                  <th scope="col">الدخول / الخروج</th>
                  <th scope="col">الحالة</th>
                  <th scope="col">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((hotel) => {
                  const hotelRooms = rooms.filter((r) => Number(r.hotel_id) === Number(hotel.id));
                  const roomIds = new Set(hotelRooms.map((r) => r.id));
                  const hotelRates = roomRates.filter((rate) => roomIds.has(Number(rate.room_id)));

                  const mealPlans = Array.from(
                    new Set(hotelRates.map((r) => r.meal_plan).filter(Boolean)),
                  );
                  const prices = hotelRates
                    .map((r) => Number(r.price_usd))
                    .filter((p) => !isNaN(p) && p > 0);
                  const minPrice = prices.length > 0 ? Math.min(...prices) : null;

                  return (
                    <tr key={hotel.id}>
                      {/* Name & ID */}
                      <td>
                        <div className="catalog-name">
                          <span className="catalog-avatar">
                            <i>
                              <Icon name="hotel" />
                            </i>
                          </span>
                          <div>
                            <strong>{hotel.name}</strong>
                            <small>معرّف #{hotel.id}</small>
                          </div>
                        </div>
                      </td>

                      {/* City */}
                      <td>
                        {hotel.city || '—'} {hotel.country ? `(${hotel.country})` : ''}
                      </td>

                      {/* Stars */}
                      <td>
                        <span className="star-rating" aria-label={`${hotel.stars || 5} نجوم`}>
                          {'★'.repeat(Math.max(1, Math.min(5, Number(hotel.stars) || 5)))}
                        </span>
                      </td>

                      {/* Rooms Count */}
                      <td>
                        <span className="count-chip" style={{ fontWeight: 600 }}>
                          {hotelRooms.length} غرف
                        </span>
                      </td>

                      {/* Meal plans */}
                      <td>
                        {mealPlans.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {mealPlans.map((m) => (
                              <span
                                key={m}
                                className="meal-code"
                                style={{
                                  padding: '2px 6px',
                                  background: 'var(--panel-alt, rgba(0,0,0,0.06))',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>

                      {/* Min Price */}
                      <td>
                        {minPrice !== null ? (
                          <strong style={{ color: 'var(--c-10b981)' }}>{minPrice} $</strong>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>

                      {/* Check-in / Check-out */}
                      <td>
                        <small style={{ color: 'var(--muted)' }}>
                          {hotel.check_in_time || '14:00'} / {hotel.check_out_time || '12:00'}
                        </small>
                      </td>

                      {/* Status */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span
                            className={`catalog-status ${hotel.published ? 'published' : 'draft'}`}
                          >
                            <span></span>
                            {hotel.published ? 'منشور' : 'مسودة'}
                          </span>
                          {hotel.active === false && (
                            <span style={{ fontSize: 10, color: 'var(--c-ef4444)' }}>(معطل)</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="catalog-row-actions" style={{ display: 'flex', gap: 6 }}>
                          {/* Manage Rooms button */}
                          <button
                            type="button"
                            className="button secondary"
                            style={{ fontSize: 11, padding: '4px 8px' }}
                            onClick={() => setHotelForRooms(hotel)}
                            title="إدارة الغرف والأسعار والتوافر لهذا الفندق"
                          >
                            <i>
                              <Icon name="layers" />
                            </i>
                            الغرف والأسعار ({hotelRooms.length})
                          </button>

                          {/* Edit Hotel button */}
                          <button
                            type="button"
                            className="catalog-edit"
                            onClick={() => {
                              setHotelToEdit(hotel);
                              setIsCreateModalOpen(true);
                            }}
                            title="تعديل بيانات الفندق"
                          >
                            تعديل
                          </button>

                          {/* Toggle publish button */}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <i>
                <Icon name="hotel" />
              </i>
              <strong>لا توجد فنادق مطابقة</strong>
              <p>لم يتم العثور على فنادق مسجلة تطابق معايير البحث أو التصفية.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setStatusFilter('all');
                  setCityFilter('all');
                  onSearchChange?.('');
                  setPage(1);
                }}
              >
                مسح البحث والتصفية
              </button>
            </div>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="table-footer">
          <span aria-live="polite">
            {filteredHotels.length > 0
              ? `عرض ${startIdx + 1}–${Math.min(startIdx + pageSize, filteredHotels.length)} من ${filteredHotels.length} فندقاً`
              : 'لا توجد نتائج'}
          </span>
          <div className="pagination">
            <button
              type="button"
              aria-label="السجلات السابقة"
              disabled={currentPageSafe === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i>
                <Icon name="back" />
              </i>
            </button>
            <span>
              {currentPageSafe} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="السجلات التالية"
              disabled={currentPageSafe === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <i>
                <Icon name="chevronLeft" />
              </i>
            </button>
          </div>
        </div>
      </section>

      {/* Create / Edit Hotel Drawer */}
      <CreateHotelModal
        open={isCreateModalOpen}
        hotelToEdit={hotelToEdit}
        onClose={() => {
          setIsCreateModalOpen(false);
          setHotelToEdit(null);
        }}
        onSaved={async (newOrUpdated) => {
          // Reset filters so the newly created hotel is immediately visible
          setStatusFilter('all');
          setCityFilter('all');
          onSearchChange?.('');
          setPage(1);

          // Optimistically update local state immediately
          if (newOrUpdated && newOrUpdated.id) {
            setHotels((prev) => {
              const existingIdx = prev.findIndex((h) => h.id === newOrUpdated.id);
              if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = { ...next[existingIdx], ...newOrUpdated };
                return next;
              }
              return [newOrUpdated, ...prev];
            });
          }

          await fetchLiveHotels();
        }}
      />

      {/* Manage Rooms & Rates Drawer */}
      <ManageRoomsModal
        open={Boolean(hotelForRooms)}
        hotel={hotelForRooms}
        onClose={() => setHotelForRooms(null)}
        onUpdated={async () => {
          await fetchLiveHotels();
        }}
      />
    </div>
  );
}

export default HotelsPage;
