import React from 'react';
import { audienceData as D } from '../../services/models';
import { audienceStorage } from '../../services/storage/audienceStorage';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { operationsModel } from '../../services/models';
import Drawer from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';

const platforms = { all: 'كل المنصات', ios: 'iOS', android: 'Android' };
const statuses = { active: 'نشط', suspended: 'موقوف محليًا' };
const services = { flight: 'طيران', hotel: 'فنادق', package: 'باقات', transfer: 'نقل', tour: 'جولات' };
const sources = { direct: 'مباشر', campaign: 'حملة إعلانية', referral: 'إحالة' };
const requestStatuses = { pending: 'بانتظار المتابعة', confirmed: 'مؤكد · تجريبي', cancelled: 'ملغي · تجريبي' };

function maskedPhone(value) {
  const text = String(value || '');
  if (/[Xx*]/.test(text)) return text;
  const digits = text.replace(/\D/g, '');
  return digits ? `07XX XXX XX${digits.slice(-2)}` : 'غير متاح';
}

function num(val) {
  return new Intl.NumberFormat('en-US').format(Number(val) || 0);
}

export default function UserDetailsDrawer({ isOpen, onClose, userId, onOpenBooking }) {
  const { showToast } = useToast();

  if (!userId) return null;

  const detail = D.userDetail(audienceStorage.getRawDemoData(), userId);
  if (!detail) return null;

  const user = detail.user;
  const currentStatus = audienceStorage.getEffectiveStatus(user);
  const nextStatus = currentStatus === 'suspended' ? 'active' : 'suspended';

  const linked = operationsStorage.getBookings().filter(record => record.customerId === userId);

  const handleToggleStatus = () => {
    try {
      audienceStorage.setStatus(userId, nextStatus);
      showToast(
        nextStatus === 'suspended'
          ? 'أُوقف المستخدم في هذه المعاينة المحلية.'
          : 'أُعيد تفعيل المستخدم في هذه المعاينة المحلية.'
      );
    } catch {
      showToast('تعذر حفظ الحالة محليًا.', 'error');
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="تفاصيل المستخدم"
      badgeText="حساب مسجل · بيانات مثال"
    >
      <div className="aud-profile">
        <span className="aud-profile-avatar">
          <Icon name="users" />
        </span>
        <h3>{user.name}</h3>
        <span className={`aud-status ${currentStatus}`}>{statuses[currentStatus]}</span>
      </div>

      <section className="drawer-section aud-profile-details">
        <div className="detail-line">
          <span>الهاتف المقنّع</span>
          <strong>
            <bdi>{maskedPhone(user.phone)}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>المدينة</span>
          <strong>
            <bdi>{user.city || '—'}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>إنشاء الحساب</span>
          <strong>
            <bdi>{user.createdAt}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>المنصة</span>
          <strong>
            <bdi>{platforms[user.platform] || '—'}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>مصدر التسجيل</span>
          <strong>
            <bdi>{sources[user.source] || user.source || '—'}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>آخر نشاط · كل الفترات</span>
          <strong>
            <bdi>{user.lastActivity || 'لا توجد جلسات'}</bdi>
          </strong>
        </div>
        <div className="detail-line">
          <span>الطلبات · كل الفترات</span>
          <strong>
            <bdi>{num(user.requestCount)}</bdi>
          </strong>
        </div>
      </section>

      <section className="drawer-section">
        <h3>طلبات جلسات التحليل التجريبية · كل الفترات</h3>
        <div className="aud-request-list">
          {detail.requests.length ? (
            detail.requests.slice(0, 6).map((req, i) => (
              <article key={i} className="aud-request-row">
                <div>
                  <strong>
                    {services[req.service] || 'خدمة'} · <bdi>{req.requestId || 'طلب تجريبي'}</bdi>
                  </strong>
                  <small>
                    <bdi>{req.date}</bdi> · {platforms[req.platform] || ''}
                  </small>
                </div>
                <span>{requestStatuses[req.requestStatus] || 'إرسال طلب'}</span>
              </article>
            ))
          ) : (
            <p className="aud-empty-note">لم يُرسل هذا المستخدم طلبًا في بيانات المثال.</p>
          )}
        </div>
        <p className="aud-detail-note">إرسال الطلب لا يعني تأكيد حجز. حالات الطلبات هنا بيانات تجريبية.</p>
      </section>

      <section className="aud-linked-bookings">
        <h3>طلبات مركز الحجوزات المرتبطة · {linked.length}</h3>
        {linked.length ? (
          linked.map(record => (
            <button
              key={record.id}
              type="button"
              onClick={() => {
                onClose();
                if (onOpenBooking) onOpenBooking(record.id);
              }}
            >
              <div>
                <strong>{record.id}</strong>
                <small>
                  {record.route} · {operationsModel?.statuses[record.status] || record.status}
                </small>
              </div>
              <span>
                {record.currency} {num(record.amount)}
              </span>
            </button>
          ))
        ) : (
          <p>لا توجد حجوزات مرتبطة بهذا الحساب. يمكن ربط طلب يدوي بالحساب من مركز الحجوزات.</p>
        )}
      </section>

      <div className="aud-status-action">
        <p>تُحفظ الحالة في هذا المتصفح فقط. لا تتغير الجلسات أو الأرقام التاريخية.</p>
        <button
          className={`button ${nextStatus === 'suspended' ? 'secondary' : 'primary'}`}
          type="button"
          onClick={handleToggleStatus}
        >
          <Icon name={nextStatus === 'suspended' ? 'clock' : 'check'} />
          {nextStatus === 'suspended' ? 'إيقاف المستخدم محليًا' : 'إعادة تفعيل المستخدم محليًا'}
        </button>
      </div>
    </Drawer>
  );
}

