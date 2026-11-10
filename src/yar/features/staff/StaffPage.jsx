import { LEGACY_REVIEW_ROLES } from '../../auth/access';
import React, { useState, useEffect, useMemo } from 'react';
import { staffStorage } from '../../services/storage/staffStorage';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { staffModel as M } from '../../services/models';
import { Icon } from '../../components/ui/Icon';
import Drawer from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import StaffModal from './StaffModal';

const actions = {
  create: 'إضافة موظف',
  edit: 'تعديل البيانات والصلاحيات',
  activate: 'إعادة التفعيل',
  deactivate: 'إيقاف الموظف',
};

const bookingStatuses = {
  awaiting: 'بانتظار التأكيد',
  processing: 'قيد المعالجة',
  issued: 'مؤكد',
  cancelled: 'ملغي',
};

const services = { flight: 'طيران', hotel: 'فندق', package: 'باقة', transfer: 'نقل', tour: 'جولة' };

const normalized = value =>
  String(value ?? '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');

function time(value) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Baghdad',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

export default function StaffPage({ onOpenBooking }) {
  const { showToast } = useToast();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return staffStorage.subscribe(() => setTick(t => t + 1));
  }, []);

  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');

  // Drawers state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStaff, setDetailStaff] = useState(null);

  const staffList = staffStorage.getStaff();
  const logs = staffStorage.getLogs();
  const bookings = operationsStorage.getBookings();

  const getAssignedBookings = person => {
    return bookings.filter(
      row =>
        row.assignedId === person.id ||
        row.assigneeId === person.id ||
        (!row.assignedId && !row.assigneeId && normalized(row.assigned) === normalized(person.name))
    );
  };

  const filteredStaff = useMemo(() => {
    const q = normalized(query);
    return staffList.filter(person => {
      const matchesRole = role === 'all' || person.role === role;
      const matchesStatus = status === 'all' || person.status === status;
      const matchesQuery =
        !q || normalized(`${person.name} ${M.roles[person.role]} ${person.id}`).includes(q);
      return matchesRole && matchesStatus && matchesQuery;
    });
  }, [staffList, role, status, query, tick]);

  const handleOpenAdd = () => {
    setEditingStaff(null);
    setModalOpen(true);
  };

  const handleOpenEdit = person => {
    if (person.id === M.ownerId) {
      showToast('حساب المالك محمي؛ يمكن مراجعة تفاصيله.', 'warning');
      return;
    }
    setEditingStaff(person);
    setModalOpen(true);
  };

  const handleOpenDetail = person => {
    setDetailStaff(person);
    setDetailOpen(true);
  };

  const handleSaveStaff = staffData => {
    try {
      staffStorage.upsert(staffData);
      setModalOpen(false);
      showToast('حُفظ الموظف وصلاحياته في المعاينة المحلية.');
    } catch (err) {
      throw err;
    }
  };

  const handleToggleStatus = person => {
    if (person.id === M.ownerId) {
      showToast('لا يمكن إيقاف المالك.', 'warning');
      return;
    }
    const nextStatus = person.status === 'active' ? 'inactive' : 'active';
    try {
      staffStorage.setStatus(person.id, nextStatus);
      showToast(
        nextStatus === 'active'
          ? 'أُعيد تفعيل الموظف محليًا.'
          : 'أُوقف الموظف محليًا. راجع طلباته المسندة لإعادة توزيعها.'
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="stf-page">
      <div className="page-heading stf-heading">
        <div>
          <div className="eyebrow">تنظيم الفريق</div>
          <h1 id="staff-title" tabIndex="-1">
            الموظفون والصلاحيات
          </h1>
          <p>نظّم الأدوار والصلاحيات وراجع الطلبات المسندة وسجل تغييرات الفريق.</p>
        </div>
        <button type="button" className="button primary" onClick={handleOpenAdd}>
          <Icon name="plus" />
          إضافة موظف
        </button>
      </div>

      <p className="stf-local">
        <span />
        محاكاة محلية · لا يوجد تسجيل دخول فعلي للموظفين
      </p>

      {staffStorage.notice && (
        <div className="stf-notice" role="status">
          {staffStorage.notice}
        </div>
      )}

      {/* Stats */}
      <div className="stf-stats">
        <div>
          <span>الفريق</span>
          <strong>{staffList.length}</strong>
        </div>
        <div>
          <span>موظفون نشطون</span>
          <strong>{staffList.filter(p => p.status === 'active').length}</strong>
        </div>
        <div>
          <span>مديرو نظام نشطون</span>
          <strong>{staffList.filter(p => p.role === 'admin' && p.status === 'active').length}</strong>
        </div>
        <div>
          <span>إجراءات محلية مسجلة</span>
          <strong>{logs.length}</strong>
        </div>
      </div>

      <section className="panel stf-panel">
        <div className="stf-toolbar">
          <label className="stf-search">
            <Icon name="search" />
            <input
              type="search"
              aria-label="البحث في الموظفين"
              placeholder="ابحث باسم الموظف أو الدور…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>

          <label className="stf-filter">
            الدور
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="all">كل الأدوار</option>
              {Object.entries(M.roles).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="stf-filter">
            الحالة
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">الكل</option>
              <option value="active">نشط</option>
              <option value="inactive">موقوف</option>
            </select>
          </label>
        </div>

        <div className="stf-table-wrap">
          {filteredStaff.length ? (
            <table className="stf-table">
              <thead>
                <tr>
                  <th>الموظف</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>الصلاحيات</th>
                  <th>الطلبات المسندة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(person => {
                  const assigned = getAssignedBookings(person);
                  const followUpCount = assigned.filter(r => ['awaiting', 'processing'].includes(r.status)).length;
                  const isOwner = person.id === M.ownerId;

                  return (
                    <tr key={person.id}>
                      <td>
                        <div className="stf-person">
                          <span>{person.name.charAt(0)}</span>
                          <div>
                            <strong>{person.name}</strong>
                            <small>
                              {person.id}
                              {isOwner ? ' · حساب محمي' : ''}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>{M.roles[person.role]}{LEGACY_REVIEW_ROLES.includes(person.role) && <span className="stf-status inactive" style={{ marginInlineStart: 6 }}>يحتاج مراجعة</span>}</td>
                      <td>
                        <span className={`stf-status ${person.status}`}>
                          {person.status === 'active' ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td>
                        <span className="stf-permission-count">{person.permissions.length} صلاحيات</span>
                      </td>
                      <td>
                        <strong>{assigned.length}</strong>
                        <small className="stf-sub">{followUpCount} للمتابعة</small>
                      </td>
                      <td>
                        <div className="stf-actions">
                          <button type="button" onClick={() => handleOpenDetail(person)}>
                            التفاصيل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(person)}
                            disabled={isOwner}
                            title={isOwner ? 'حساب المالك محمي' : ''}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(person)}
                            disabled={isOwner}
                            title={isOwner ? 'لا يمكن إيقاف المالك' : ''}
                          >
                            {person.status === 'active' ? 'إيقاف' : 'تفعيل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="stf-empty">
              <Icon name="users" />
              <strong>لا يوجد موظفون مطابقون</strong>
              <p>غيّر البحث أو مرشحات الدور والحالة.</p>
            </div>
          )}
        </div>

        <footer className="stf-table-footer">
          {filteredStaff.length} من {staffList.length} موظفين
        </footer>
      </section>

      <p className="stf-note">
        الإسناد الحالي يُقرأ من سجل الحجوزات الموحد. إيقاف الموظف يحفظ طلباته للمراجعة ولا يعيد توزيعها تلقائيًا.
      </p>

      {/* Add / Edit Modal */}
      <StaffModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        staffMember={editingStaff}
        onSave={handleSaveStaff}
      />

      {/* Detail Drawer */}
      <Drawer
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailStaff?.name || 'تفاصيل الموظف'}
        badgeText="الموظفون والصلاحيات"
      >
        {detailStaff && (
          <div className="stf-detail">
            <div className="stf-profile">
              <span>{detailStaff.name.charAt(0)}</span>
              <div>
                <h3>{detailStaff.name}</h3>
                <p>
                  {M.roles[detailStaff.role]} · {detailStaff.status === 'active' ? 'نشط' : 'موقوف'}
                </p>
              </div>
            </div>

            <section className="stf-section">
              <h3>صلاحيات المعاينة</h3>
              <div className="stf-pills">
                {detailStaff.permissions.map(k => (
                  <span key={k}>{M.permissions[k]}</span>
                ))}
              </div>
            </section>

            {(() => {
              const assigned = getAssignedBookings(detailStaff);
              const personLogs = logs.filter(l => l.staffId === detailStaff.id).slice().reverse();

              return (
                <>
                  <section className="stf-section">
                    <h3>الطلبات المسندة · {assigned.length}</h3>
                    {assigned.length ? (
                      <div className="stf-detail-table">
                        <table>
                          <thead>
                            <tr>
                              <th>الطلب</th>
                              <th>الخدمة</th>
                              <th>الحالة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assigned.map(row => (
                              <tr key={row.id}>
                                <td>
                                  <bdi>{row.id}</bdi>
                                  <small className="stf-sub">{row.route || row.serviceInfo || ''}</small>
                                </td>
                                <td>{services[row.service] || row.service}</td>
                                <td>{bookingStatuses[row.status] || row.status || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="stf-note">لا توجد طلبات مسندة إلى هذا الموظف.</p>
                    )}
                  </section>

                  <section className="stf-section">
                    <h3>سجل الإجراءات المحلية</h3>
                    {personLogs.length ? (
                      <ol className="stf-timeline">
                        {personLogs.map((log, idx) => (
                          <li key={idx}>
                            <strong>{actions[log.action] || log.action}</strong>
                            <p>{log.detail}</p>
                            <small>
                              <bdi>{time(log.at)}</bdi> · توقيت بغداد
                            </small>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="stf-note">لا توجد تعديلات محلية مسجلة لهذا الموظف بعد.</p>
                    )}
                  </section>
                </>
              );
            })()}

            <p className="stf-note">
              الأدوار والصلاحيات محفوظة في هذا المتصفح للمعاينة؛ لا تنفّذ تسجيل دخول أو صلاحيات خادم.
            </p>
          </div>
        )}
      </Drawer>
    </div>
  );
}

