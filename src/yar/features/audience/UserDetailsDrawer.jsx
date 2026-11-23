import React from 'react';
import Drawer from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';

const roles = { admin: 'مدير', booking_employee: 'موظف حجوزات', customer: 'عميل' };

export default function UserDetailsDrawer({ user, onClose, onToggleActive }) {
  if (!user) return null;
  return (
    <Drawer
      isOpen={Boolean(user)}
      onClose={onClose}
      title="تفاصيل المستخدم"
      badgeText="بيانات الحساب من الخادم"
    >
      <div className="aud-profile">
        <span className="aud-profile-avatar">
          <Icon name="users" />
        </span>
        <h3>{user.name || user.customer_name || user.display_name || '—'}</h3>
        <span className={`aud-status ${user.active ? 'active' : 'suspended'}`}>
          {user.active ? 'نشط' : 'غير نشط'}
        </span>
      </div>
      <section className="drawer-section aud-profile-details">
        <div className="detail-line">
          <span>معرّف المستخدم</span>
          <strong>
            <bdi>{user.id}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>رقم الهاتف</span>
          <strong>
            <bdi>{user.phone || '—'}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>الدور</span>
          <strong>{roles[user.role] || user.role || '—'}</strong>
        </div>
        <div className="detail-line">
          <span>حالة التحقق</span>
          <strong>
            {user.verified === true ? 'موثّق' : user.verified === false ? 'غير موثّق' : '—'}
          </strong>
        </div>
        <div className="detail-line">
          <span>عدد الحجوزات</span>
          <strong>{user.bookingCount ?? '—'}</strong>
        </div>
      </section>
      <p className="aud-detail-note">تفاصيل الحساب المتاحة مقتصرة على الحقول التي يعيدها الخادم.</p>
      <div className="aud-status-action">
        <p>تغيير الحالة يُحفظ في الخادم ويؤدي إلى إبطال جلسات المستخدم وفق API 094.</p>
        <button
          className={`button ${user.active ? 'secondary' : 'primary'}`}
          type="button"
          onClick={onToggleActive}
        >
          <Icon name={user.active ? 'clock' : 'check'} />
          {user.active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
        </button>
      </div>
    </Drawer>
  );
}
