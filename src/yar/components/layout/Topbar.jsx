import NotificationBell from '../../notifications/NotificationBell';
import { ExchangeRateChip } from '../../features/fx/ExchangeRate';
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../ui/Icon';
import { useSession } from '../../auth/useSession';
import { can } from '../../auth/access';
import { usePrefs, prefs } from '../../i18n/prefs';
import { ROLE_LABELS } from './Sidebar';

const pageTitles = {
  inbox: 'رسائل العملاء',
  overview: 'الصفحة الرئيسية',
  bookings: 'الحجوزات والطلبات',
  audience: 'مستخدمو التطبيق والزوار',
  'supplier-credit': 'أرصدة المورّدين',
  reports: 'التقارير',
  hotels: 'إدارة الفنادق',
  packages: 'إدارة الباقات',
  cars: 'إدارة السيارات',
  tours: 'إدارة الجولات',
  providers: 'مزوّدو الخدمة',
  'provider-ops': 'ربط الطيران وواجهات API',
  pricing: 'الأسعار والخصومات',
  content: 'محتوى التطبيق',
  staff: 'الموظفون والصلاحيات'
};

const searchPlaceholders = {
  inbox: 'ابحث بالعميل أو الهاتف أو المرجع...',
  overview: 'ابحث عن حجز أو اسم عميل...',
  bookings: 'ابحث عن حجز أو اسم عميل أو مرجع...',
  audience: 'ابحث باسم المستخدم أو الموبايل أو المدينة...',
  'supplier-credit': 'ابحث باسم المورّد...',
  reports: 'ابحث بالمزوّد أو العميل أو مرجع الطلب...',
  hotels: 'ابحث باسم الفندق أو المدينة أو العنوان…',
  packages: 'ابحث باسم الباقة أو الوجهات…',
  cars: 'ابحث باسم السيارة أو المزوّد…',
  tours: 'ابحث باسم الجولة أو المدينة…',
  providers: 'ابحث باسم المزوّد أو القناة…',
  'provider-ops': 'ابحث باسم المزوّد أو القناة...',
  pricing: 'ابحث باسم قاعدة التسعير أو الخدمة...',
  content: 'ابحث بعنوان المحتوى أو نصه...',
  staff: 'ابحث باسم الموظف أو الدور...'
};

function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) close(); };
    const k = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [ref, open, close]);
}

export function Topbar({
  currentPage,
  searchQuery,
  onSearchChange,
  onToggleMobileMenu,
  awaitingBookings = [],
  onOpenBooking,
  onSignOut,
  onOpenDataTransfer,
  onOpenProfile,
  onNavigate,
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const session = useSession();
  const { lang, theme } = usePrefs();

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useOutside(notifRef, showNotifications, () => setShowNotifications(false));
  useOutside(profileRef, showProfile, () => setShowProfile(false));

  const title = pageTitles[currentPage] || 'الصفحة الرئيسية';
  const placeholder = searchPlaceholders[currentPage] || 'ابحث عن حجز أو اسم عميل...';

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button type="button" className="icon-button mobile-menu" aria-label="فتح القائمة" id="mobile-menu" onClick={onToggleMobileMenu}>
          <i data-icon="menu"><Icon name="menu" /></i>
        </button>
        <span className="crumb-root">مساحة العمل</span>
        <span className="crumb-slash">/</span>
        <strong>{title}</strong>
      </div>

      <div className="top-actions">
        <label className="global-search">
          <i data-icon="search"><Icon name="search" /></i>
          <input
            ref={searchInputRef}
            id="global-search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
          />
          <kbd>/</kbd>
        </label>

        

        <button
          type="button"
          className="icon-button pref-button"
          aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
          title={lang === 'ar' ? 'English' : 'العربية'}
          onClick={() => prefs.set({ lang: lang === 'ar' ? 'en' : 'ar' })}
          data-no-translate
        >
          <span className="pref-text">{lang === 'ar' ? 'EN' : 'ع'}</span>
        </button>

        <button
          type="button"
          className="icon-button pref-button"
          aria-label={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          onClick={() => prefs.set({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></g></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="currentColor"/></svg>
          )}
        </button>

        <ExchangeRateChip />
        <NotificationBell onNavigate={onNavigate} onOpenBooking={onOpenBooking} />
        <div className="top-divider"></div>
        <div className="pop-anchor" ref={profileRef}>
          <button
            type="button"
            className="top-avatar"
            aria-label="حساب المستخدم"
            aria-expanded={showProfile}
            onClick={() => setShowProfile(s => !s)}
            data-no-translate
          >
            {session?.name?.slice(0, 2) || '?'}
          </button>
          {showProfile && (
            <div className="popover top-popover profile-popover" role="menu">
              <div className="popover-title">
                <strong data-no-translate>{session?.name}</strong>
                <small>{ROLE_LABELS[session?.role]}</small>
              </div>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setShowProfile(false); onOpenProfile?.(); }}>ملفي الشخصي</button>
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setShowProfile(false); onOpenProfile?.(); }}>تغيير كلمة المرور</button>
              {can('data.transfer') && (
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setShowProfile(false); onOpenDataTransfer?.(); }}>
                  تصدير / استيراد البيانات
                </button>
              )}
              <button type="button" role="menuitem" className="menu-item" onClick={() => { setShowProfile(false); onSignOut?.(); }}>
                تسجيل الخروج
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
