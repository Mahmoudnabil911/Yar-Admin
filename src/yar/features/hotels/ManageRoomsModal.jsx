import React, { useState, useEffect } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { NumberInput } from '../../components/ui/NumberInput';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';

export function ManageRoomsModal({
  isOpen,
  open,
  onClose,
  hotel,
  onUpdated
}) {
  const isModalOpen = open !== undefined ? Boolean(open) : Boolean(isOpen);
  const toast = useToast();

  const [rooms, setRooms] = useState([]);
  const [rates, setRates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Add Room form state
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomView, setRoomView] = useState('');
  const [roomBeds, setRoomBeds] = useState('');
  const [roomOccupancy, setRoomOccupancy] = useState('');
  const [roomUnits, setRoomUnits] = useState('');
  const [isSubmittingRoom, setIsSubmittingRoom] = useState(false);

  // Add Rate form state
  const [addingRateForRoomId, setAddingRateForRoomId] = useState(null);
  const [rateName, setRateName] = useState('');
  const [rateMealPlan, setRateMealPlan] = useState('BB');
  const [ratePriceUsd, setRatePriceUsd] = useState('');
  const [rateSupplierCostUsd, setRateSupplierCostUsd] = useState('');
  const [isSubmittingRate, setIsSubmittingRate] = useState(false);

  const loadData = async () => {
    if (!hotel?.id) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [roomsRes, ratesRes] = await Promise.all([
        catalogAdminApi.getRooms(),
        catalogAdminApi.getRoomRates(),
      ]);
      const hotelRooms = (roomsRes.items || []).filter(r => Number(r.hotel_id) === Number(hotel.id));
      setRooms(hotelRooms);
      setRates(ratesRes.items || []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل تحميل بيانات الغرف والأسعار.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isModalOpen && hotel?.id) {
      loadData();
      setIsAddingRoom(false);
      setAddingRateForRoomId(null);
    }
  }, [isModalOpen, hotel?.id]);

  if (!isModalOpen || !hotel) return null;

  const handleCreateRoom = async e => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setIsSubmittingRoom(true);
    setErrorMsg('');

    try {
      const newRoom = await catalogAdminApi.createRoom({
        hotel_id: hotel.id,
        name: roomName.trim(),
        view_type: roomView,
        beds: roomBeds,
        occupancy: Number(roomOccupancy) || 2,
        units_total: Number(roomUnits) || 10,
        active: true,
      });

      toast(`تمت إضافة الغرفة «${newRoom.name}» بنجاح.`);
      setRoomName('');
      setIsAddingRoom(false);
      await loadData();
      onUpdated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل إضافة الغرفة على الخادم.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleCreateRate = async (e, roomId) => {
    e.preventDefault();
    if (!rateName.trim() || Number(ratePriceUsd) <= 0) return;
    setIsSubmittingRate(true);
    setErrorMsg('');

    try {
      const newRate = await catalogAdminApi.createRoomRate({
        room_id: roomId,
        name: rateName.trim(),
        meal_plan: rateMealPlan,
        price_usd: Number(ratePriceUsd),
        supplier_cost_usd: Number(rateSupplierCostUsd) || 0,
        active: true,
      });

      toast(`تمت إضافة سعر «${newRate.name}» بنجاح.`);
      setRateName('');
      setAddingRateForRoomId(null);
      await loadData();
      onUpdated?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'فشل إضافة سعر الغرفة على الخادم.');
    } finally {
      setIsSubmittingRate(false);
    }
  };

  const handleToggleRoomActive = async room => {
    try {
      const nextActive = !room.active;
      await catalogAdminApi.updateRoom(room.id, { active: nextActive });
      toast(nextActive ? `تم تفعيل ${room.name}.` : `تم تعطيل ${room.name}.`);
      await loadData();
      onUpdated?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تغيير حالة الغرفة.');
    }
  };

  const handleToggleRateActive = async rate => {
    try {
      const nextActive = !rate.active;
      await catalogAdminApi.updateRoomRate(rate.id, { active: nextActive });
      toast(nextActive ? `تم تفعيل خطة السعر.` : `تم تعطيل خطة السعر.`);
      await loadData();
      onUpdated?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'تعذر تغيير حالة السعر.');
    }
  };

  const mealPlanLabels = {
    RO: 'إقامة فقط (بدون وجبات)',
    BB: 'شامل الإفطار (BB)',
    HB: 'نصف إقامة (إفطار وعشاء)',
    FB: 'إقامة كاملة (3 وجبات)',
    AI: 'شامل كلياً (All Inclusive)',
  };

  return (
    <Drawer
      open={isModalOpen}
      onClose={onClose}
      eyebrow="إدارة الغرف والأسعار"
      title={`غرف وأسعار: ${hotel.name}`}
    >
      <div className="ops-create-modal" style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="ops-note" style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            الغرف والأسعار المسجلة في خادم Odoo الخاصة بفندق <strong>{hotel.name}</strong>.
          </p>
          {!isAddingRoom && (
            <button
              type="button"
              className="button primary"
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setIsAddingRoom(true)}
            >
              + إضافة غرفة جديدة
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--c-ef4444)', borderRadius: 8, color: 'var(--c-ef4444)', fontSize: 13 }}>
            <strong>خطأ: </strong> {errorMsg}
          </div>
        )}

        {/* Add Room Box */}
        {isAddingRoom && (
          <div style={{ background: 'var(--panel-alt, rgba(0,0,0,0.03))', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14 }}>إضافة غرفة جديدة إلى {hotel.name}</h4>
            <form onSubmit={handleCreateRoom} className="ops-form-grid">
              <label className="ops-field wide">
                <span>اسم الغرفة *</span>
                <input
                  type="text"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  placeholder="مثال: غرفة ديلوكس مزدوجة مع إطلالة"
                  required
                />
              </label>

              <label className="ops-field">
                <span>نوع الإطلالة</span>
                <input
                  type="text"
                  value={roomView}
                  onChange={e => setRoomView(e.target.value)}
                  placeholder="إطلالة بحر، إطلالة مدينة..."
                />
              </label>

              <label className="ops-field">
                <span>نوع الأسرّة</span>
                <input
                  type="text"
                  value={roomBeds}
                  onChange={e => setRoomBeds(e.target.value)}
                  placeholder="سرير كينج، سريران منفصلان..."
                />
              </label>

              <label className="ops-field">
                <span>السعة (بالغين)</span>
                <NumberInput
                  allowDecimals={false}
                  min={1}
                  max={10}
                  value={roomOccupancy}
                  onChange={e => setRoomOccupancy(e.target.value)}
                  placeholder="مثال: 2"
                />
              </label>

              <label className="ops-field">
                <span>إجمالي الغرف المتاحة</span>
                <NumberInput
                  allowDecimals={false}
                  min={1}
                  max={500}
                  value={roomUnits}
                  onChange={e => setRoomUnits(e.target.value)}
                  placeholder="مثال: 10"
                />
              </label>

              <div className="ops-form-actions wide" style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsAddingRoom(false)}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={isSubmittingRoom}
                >
                  {isSubmittingRoom ? 'جاري الإضافة...' : 'حفظ الغرفة على السيرفر'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--muted)' }}>
            جاري تحميل الغرف والأسعار...
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--panel-alt, rgba(0,0,0,0.02))', borderRadius: 10, border: '1px dashed var(--border)' }}>
            <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
              لا توجد غرف مسجلة لهذا الفندق في قاعدة البيانات حتى الآن.
            </p>
            {!isAddingRoom && (
              <button
                type="button"
                className="button primary"
                onClick={() => setIsAddingRoom(true)}
              >
                + أضف أول غرفة الآن
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rooms.map(room => {
              const roomRates = rates.filter(r => Number(r.room_id) === Number(room.id));
              const isAddingRate = addingRateForRoomId === room.id;

              return (
                <div
                  key={room.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 16,
                    background: room.active === false ? 'rgba(0,0,0,0.02)' : 'var(--panel)',
                    opacity: room.active === false ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 15 }}>{room.name}</strong>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'var(--panel-alt, rgba(0,0,0,0.06))', color: 'var(--muted)' }}>
                          معرّف #{room.id}
                        </span>
                        {room.active === false && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(239, 68, 68, 0.1)', color: 'var(--c-ef4444)' }}>
                            معطلة
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                        {room.view_type && <span>{room.view_type} · </span>}
                        {room.beds && <span>{room.beds} · </span>}
                        <span>سعة: {room.occupancy || 2} أفراد · </span>
                        <span>إجمالي الوحدات: {room.units_total || 10}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => handleToggleRoomActive(room)}
                      >
                        {room.active === false ? 'تفعيل' : 'تعطيل'}
                      </button>
                      <button
                        type="button"
                        className="button primary"
                        style={{ fontSize: 11, padding: '4px 8px' }}
                        onClick={() => {
                          setAddingRateForRoomId(isAddingRate ? null : room.id);
                          setRateName(`خطة سعر ${room.name}`);
                        }}
                      >
                        {isAddingRate ? 'إلغاء' : '+ إضافة سعر'}
                      </button>
                    </div>
                  </div>

                  {/* Add Rate Form for this room */}
                  {isAddingRate && (
                    <div style={{ background: 'var(--panel-alt, rgba(0,0,0,0.04))', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                      <h5 style={{ margin: '0 0 10px', fontSize: 13 }}>إضافة خطة سعر للغرفة</h5>
                      <form onSubmit={e => handleCreateRate(e, room.id)} className="ops-form-grid">
                        <label className="ops-field wide">
                          <span>اسم خطة السعر *</span>
                          <input
                            type="text"
                            value={rateName}
                            onChange={e => setRateName(e.target.value)}
                            placeholder="مثال: سعر شامل الإفطار لشخصين"
                            required
                          />
                        </label>

                        <label className="ops-field">
                          <span>نظام الوجبات</span>
                          <select
                            value={rateMealPlan}
                            onChange={e => setRateMealPlan(e.target.value)}
                          >
                            <option value="BB">شامل الإفطار (BB)</option>
                            <option value="RO">إقامة فقط (RO)</option>
                            <option value="HB">نصف إقامة (HB)</option>
                            <option value="FB">إقامة كاملة (FB)</option>
                            <option value="AI">شامل كلياً (AI)</option>
                          </select>
                        </label>

                        <label className="ops-field">
                          <span>سعر البيع للعميل ($ دولار) *</span>
                          <NumberInput
                            min={1}
                            value={ratePriceUsd}
                            onChange={e => setRatePriceUsd(e.target.value)}
                            placeholder="مثال: 100"
                            required
                          />
                        </label>

                        <label className="ops-field">
                          <span>تكلفة المورّد ($ دولار)</span>
                          <NumberInput
                            min={0}
                            value={rateSupplierCostUsd}
                            onChange={e => setRateSupplierCostUsd(e.target.value)}
                            placeholder="مثال: 70"
                          />
                        </label>

                        <div className="ops-form-actions wide" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                          <button
                            type="button"
                            className="button secondary"
                            onClick={() => setAddingRateForRoomId(null)}
                          >
                            إلغاء
                          </button>
                          <button
                            type="submit"
                            className="button primary"
                            disabled={isSubmittingRate}
                          >
                            {isSubmittingRate ? 'جاري الحفظ...' : 'حفظ السعر'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Room Rates List */}
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                      خطط الأسعار والتوافر ({roomRates.length}):
                    </span>
                    {roomRates.length === 0 ? (
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                        لا توجد خطط أسعار مسجلة لهذه الغرفة بعد.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {roomRates.map(rate => (
                          <div
                            key={rate.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'var(--panel-alt, rgba(0,0,0,0.02))',
                              borderRadius: 6,
                              fontSize: 12,
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div>
                              <strong>{rate.name}</strong> ·{' '}
                              <span style={{ color: 'var(--muted)' }}>
                                {mealPlanLabels[rate.meal_plan] || rate.meal_plan || 'إقامة فقط'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ fontWeight: 700, color: 'var(--c-10b981)' }}>
                                {rate.price_usd} $
                              </span>
                              {rate.supplier_cost_usd > 0 && (
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                                  (التكلفة: {rate.supplier_cost_usd} $)
                                </span>
                              )}
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: rate.active === false ? 'var(--c-10b981)' : 'var(--c-ef4444)',
                                  cursor: 'pointer',
                                  fontSize: 11,
                                  textDecoration: 'underline',
                                }}
                                onClick={() => handleToggleRateActive(rate)}
                              >
                                {rate.active === false ? 'تفعيل' : 'تعطيل'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="button secondary" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </Drawer>
  );
}

export default ManageRoomsModal;

