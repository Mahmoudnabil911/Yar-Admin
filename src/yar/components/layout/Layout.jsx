import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import DatePickerBridge from '../ui/DatePickerBridge';
import SelectBridge from '../ui/SelectBridge';
import { FxRateBanner } from '../../features/fx/ExchangeRate';

export function Layout({
  currentPage,
  onNavigate,
  searchQuery,
  onSearchChange,
  awaitingCount = 0,
  awaitingBookings = [],
  onOpenBooking,
  isMobileMenuOpen,
  onToggleMobileMenu,
  onCloseMobileMenu,
  onSignOut,
  onOpenDataTransfer,
  onOpenProfile,
  children
}) {
  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;
    const onKey = e => { if (e.key === 'Escape') onCloseMobileMenu(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [isMobileMenuOpen, onCloseMobileMenu]);

  return (
    <>
      <DatePickerBridge />
      <SelectBridge />
      <a className="skip" href="#main">انتقل إلى المحتوى</a>
      {isMobileMenuOpen && <div className="sidebar-backdrop" onClick={onCloseMobileMenu} aria-hidden="true" />}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        awaitingCount={awaitingCount}
        isOpen={isMobileMenuOpen}
        onClose={onCloseMobileMenu}
        onSignOut={onSignOut}
      />
      <div className="shell">
        <Topbar
          currentPage={currentPage}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onToggleMobileMenu={onToggleMobileMenu}
          awaitingBookings={awaitingBookings}
          onOpenBooking={onOpenBooking}
          onSignOut={onSignOut}
          onOpenDataTransfer={onOpenDataTransfer}
          onOpenProfile={onOpenProfile}
          onNavigate={onNavigate}
        />
        <main id="main">{['overview', 'bookings', 'supplier-credit'].includes(currentPage) && <FxRateBanner />}{children}</main>
      </div>
    </>
  );
}

export default Layout;
