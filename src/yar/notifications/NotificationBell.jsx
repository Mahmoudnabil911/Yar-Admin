import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Bell, X, CheckCheck, ArrowUpRight, KeyRound, Plane, ShieldCheck, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAccounts, useWords } from '../accounts/AccountUI';
import { usePrefs } from '../i18n/prefs';
import * as R from '../accounts/repository';
import { inboxApi } from '../services/api/inboxApi';

export default function NotificationBell({ onNavigate, onOpenBooking }) {
  useAccounts();
  const t = useWords();
  const { lang } = usePrefs();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('all');
  const [serverNotifications, setServerNotifications] = useState([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const ref = useRef(null);

  // Load persistent notifications from backend (API 124)
  const loadServerNotifications = useCallback(async () => {
    setLoadingServer(true);
    try {
      const res = await inboxApi.getNotifications();
      const raw = Array.isArray(res?.items) ? res.items : [];
      const normalized = raw.map((item) => {
        const titleAr =
          typeof item.title === 'object' && item.title
            ? item.title.ar || item.title[0] || ''
            : String(item.title || '');
        const titleEn =
          typeof item.title === 'object' && item.title
            ? item.title.en || item.title[1] || titleAr
            : titleAr;
        const msgAr =
          typeof item.message === 'object' && item.message
            ? item.message.ar || item.message[0] || item.body || ''
            : String(item.message || item.body || '');
        const msgEn =
          typeof item.message === 'object' && item.message
            ? item.message.en || item.message[1] || msgAr
            : msgAr;

        const isRead = Boolean(item.read || item.is_read || item.read_at || item.readAt);

        return {
          id: item.id,
          title: [titleAr || 'إشعار', titleEn || 'Notification'],
          message: [msgAr, msgEn],
          type: item.type || 'operations',
          readAt: isRead ? (item.read_at || item.readAt || new Date().toISOString()) : null,
          createdAt: item.created_at || item.createdAt || item.at || new Date().toISOString(),
          target: item.target || (item.booking_id ? { page: 'bookings', bookingId: item.booking_id } : null),
          isRemote: true,
        };
      });
      setServerNotifications(normalized);
    } catch (err) {
      // Graceful fallback if guest/unauthenticated or network hiccup
      console.warn('[Notifications] Failed to load server notifications:', err);
    } finally {
      setLoadingServer(false);
    }
  }, []);

  useEffect(() => {
    loadServerNotifications();
  }, [loadServerNotifications]);

  useEffect(() => {
    if (open) {
      loadServerNotifications();
    }
  }, [open, loadServerNotifications]);

  useEffect(() => {
    if (!open) return;
    const f = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', f);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', f);
  }, [open]);

  // Pure server notifications only — no mock or local storage data
  const allItems = useMemo(() => {
    return [...serverNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [serverNotifications]);

  const unread = allItems.filter((n) => !n.readAt).length;
  const visible = allItems.filter(
    (n) => tab === 'all' || (tab === 'unread' ? !n.readAt : n.type === 'requests')
  );

  function go(n) {
    const user = R.currentAccount();
    if (!user) return;
    if (n.target?.fx) {
      window.dispatchEvent(new CustomEvent('yar:open-fx'));
      setOpen(false);
      return;
    }
    if (n.target?.page === 'staff' && user.role !== 'admin') return;
    if (n.target?.inquiryId && ['admin', 'booking_employee'].includes(user.role)) {
      onNavigate?.('inbox', null, { inquiryId: n.target.inquiryId });
    } else if (n.target?.bookingId) {
      onNavigate?.('bookings');
      onOpenBooking?.(n.target.bookingId);
    } else if (n.target?.page === 'staff' && user.role === 'admin') {
      onNavigate?.('staff', null, { requestId: n.target.requestId || '', userId: n.target.userId || '' });
    }
    setOpen(false);
  }

  // Mark single notification as read on server (API 125)
  async function handleMarkRead(notification) {
    setServerNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    try {
      await inboxApi.markNotificationRead(notification.id);
    } catch (err) {
      console.error('Failed to mark notification read on server:', err);
    }
  }

  // Mark all visible notifications as read on server (API 125)
  async function handleMarkAllRead(notificationsToMark) {
    const unreadList = notificationsToMark.filter((n) => !n.readAt);
    if (unreadList.length === 0) return;

    setServerNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
    await Promise.allSettled(unreadList.map((n) => inboxApi.markNotificationRead(n.id)));
  }

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="notification-button"
        aria-label={t('الإشعارات', 'Notifications')}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell />
        {unread > 0 && <b className="notification-count">{unread}</b>}
      </Button>

      {open && (
        <>
          <div className="notification-backdrop" onClick={() => setOpen(false)} />
          <section
            className="notification-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('الإشعارات', 'Notifications')}
            data-no-translate
          >
            <header>
              <h2>
                {t('الإشعارات', 'Notifications')} <small>{unread}</small>
              </h2>
              <Button ref={ref} size="icon" variant="ghost" aria-label={t('إغلاق', 'Close')} onClick={() => setOpen(false)}>
                <X />
              </Button>
            </header>

            <div className="notification-toolbar">
              <Button variant="ghost" size="sm" onClick={() => handleMarkAllRead(visible)}>
                <CheckCheck />
                {t('تعليم الكل كمقروء', 'Mark All as Read')}
              </Button>
            </div>

            <div className="account-tabs">
              {[
                ['all', t('الكل', 'All')],
                ['unread', t('غير المقروءة', 'Unread')],
                ['requests', t('الطلبات', 'Requests')],
              ].map(([k, label]) => (
                <Button variant={tab === k ? 'default' : 'ghost'} size="sm" key={k} onClick={() => setTab(k)}>
                  {label}
                </Button>
              ))}
            </div>

            <div className="notification-list">
              {visible.length === 0 && (
                <div className="notification-empty">
                  <Bell />
                  <p>{loadingServer ? t('جاري التحميل…', 'Loading…') : t('لا توجد إشعارات', 'No notifications')}</p>
                </div>
              )}

              {visible.map((n) => (
                <article key={n.id} className={`notification-item ${n.readAt ? '' : 'unread'}`}>
                  <div className="notification-type">
                    {n.type === 'requests' ? (
                      <KeyRound />
                    ) : n.type === 'security' ? (
                      <ShieldCheck />
                    ) : n.type === 'fx' ? (
                      <Banknote />
                    ) : (
                      <Plane />
                    )}
                  </div>
                  <div>
                    <strong>{Array.isArray(n.title) ? n.title[lang === 'ar' ? 0 : 1] : String(n.title || '')}</strong>
                    <p>{Array.isArray(n.message) ? n.message[lang === 'ar' ? 0 : 1] : String(n.message || '')}</p>
                    <time title={n.createdAt}>
                      {(() => {
                        try {
                          return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                            timeZone: 'Asia/Baghdad',
                          }).format(new Date(n.createdAt));
                        } catch {
                          return String(n.createdAt || '');
                        }
                      })()}
                    </time>
                    <small>
                      {n.type === 'requests'
                        ? t('طلبات كلمة المرور', 'Password Requests')
                        : n.type === 'users'
                        ? t('إدارة المستخدمين', 'User Management')
                        : n.type === 'security'
                        ? t('الحساب والأمان', 'Account & Security')
                        : n.type === 'fx'
                        ? t('سعر الصرف', 'Exchange Rate')
                        : t('العمليات', 'Operations')}
                    </small>
                    <div className="account-actions">
                      {n.target && (
                        <Button size="sm" variant="link" onClick={() => go(n)}>
                          {t('فتح', 'Open')}
                          <ArrowUpRight />
                        </Button>
                      )}
                      {!n.readAt && (
                        <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n)}>
                          {t('تعليم كمقروء', 'Mark as Read')}
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
