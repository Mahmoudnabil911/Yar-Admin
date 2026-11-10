import { Profile } from '../accounts/AccountUI';
import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useSearchParams, useLocation } from '../lib/router';
import Layout from '../components/layout/Layout';
import { Drawer } from '../components/ui/Drawer';
import { operationsStorage } from '../services/storage/operationsStorage';
import { auth, canSeePage, ALL_PAGES } from '../auth/access';
import { useSession } from '../auth/useSession';
import LoginScreen from '../auth/LoginScreen';
import { usePrefs } from '../i18n/prefs';
import AccessDenied from '../auth/AccessDenied';

// Overview eager for instant first render; other pages are code-split.
import OverviewPage from '../features/overview/OverviewPage';
import BookingDrawer from '../features/bookings/BookingDrawer';
import CreateBookingModal from '../features/bookings/CreateBookingModal';
import PaymentDetailsModal from '../features/payments/PaymentDetailsModal';
const BookingsPage = lazy(() => import('../features/bookings/BookingsPage'));
const HotelsPage = lazy(() => import('../features/hotels/HotelsPage'));
const PackagesPage = lazy(() => import('../features/packages/PackagesPage'));
const CarsPage = lazy(() => import('../features/services/CarsPage'));
const ToursPage = lazy(() => import('../features/tours/ToursPage'));
const ProvidersPage = lazy(() => import('../features/providers/ProvidersPage'));
const ProviderOpsPage = lazy(() => import('../features/providers/ProviderOpsPage'));
const SupplierCreditPage = lazy(() => import('../features/suppliers/SupplierCreditPage'));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage'));
const PricingPage = lazy(() => import('../features/pricing/PricingPage'));
const AudiencePage = lazy(() => import('../features/audience/AudiencePage'));
const ContentPage = lazy(() => import('../features/content/ContentPage'));
const StaffPage = lazy(() => import('../accounts/UsersPage'));
const InboxPage = lazy(() => import('../inbox/InboxPage'));
const DataTransferModal = lazy(() => import('../features/data/DataTransferModal'));

// Legacy query values that no longer have their own page.
// `payments` → bookings (financial details live inside each booking);
// `gateways` (electronic payment gateways) was removed → bookings.
const LEGACY_REDIRECTS = { payments: 'bookings', gateways: 'bookings' };

export function resolvePage(pageParam, pathname) {
  const pick = v => (v && LEGACY_REDIRECTS[v]) || v;
  const fromQuery = pick(pageParam);
  if (fromQuery) return fromQuery;
  const path = pick(pathname.replace(/^\//, ''));
  return path || 'overview';
}

export default function App() {
  const session = useSession();
  const { lang } = usePrefs();
  if (!session) return <SignedOut />;
  if (session.mustChangePassword) return <><Profile mandatory /><button className="button secondary" onClick={() => auth.signOut()}>تسجيل الخروج</button></>;
  // Remount on language change so locale-formatted dates/numbers refresh everywhere.
  return <Dashboard key={`${session.staffId}-${lang}`} session={session} />;
}

function SignedOut() { useEffect(() => { window.location.replace('/login'); }, []); return null; }

function Dashboard({ session }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const [opsTick, setOpsTick] = useState(0);
  useEffect(() => operationsStorage.subscribe(() => setOpsTick(t => t + 1)), []);

  const requestedPage = resolvePage(searchParams.get('page'), location.pathname);
  const knownPage = ALL_PAGES.includes(requestedPage) || requestedPage === 'profile';
  const currentPage = knownPage ? requestedPage : 'overview';
  const allowed = currentPage === 'profile' || canSeePage(currentPage, session.role);
  const currentEdit = searchParams.get('edit') || null;

  // Normalize legacy `?page=payments|gateways` to the canonical URL.
  useEffect(() => {
    const raw = searchParams.get('page');
    if (raw && LEGACY_REDIRECTS[raw]) {
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('page', LEGACY_REDIRECTS[raw]); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleNavigate = useCallback((targetPage, editParam = null, extra = null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (targetPage === 'overview') next.delete('page'); else next.set('page', targetPage);
      if (editParam) next.set('edit', editParam); else next.delete('edit');
      next.delete('bookingId');
      next.delete('inquiryId');
      if (extra) for (const [k, v] of Object.entries(extra)) next.set(k, v);
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [setSearchParams]);

  const handleCatalogEdit = useCallback(editId => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); if (editId) n.set('edit', editId); else n.delete('edit'); return n; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [setSearchParams]);

  const handleCatalogBack = useCallback(() => {
    setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('edit'); return n; });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [setSearchParams]);

  const [globalQuery, setGlobalQuery] = useState('');
  const [activeBookingId, setActiveBookingId] = useState(null);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [createBookingOpen, setCreateBookingOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Deep link: ?page=bookings&bookingId=...
  useEffect(() => {
    const bId = searchParams.get('bookingId');
    if (bId && currentPage === 'bookings' && canSeePage('bookings', session.role)) setActiveBookingId(bId);
  }, [searchParams, currentPage, session.role]);

  const handleOpenBooking = useCallback(id => {
    if (!canSeePage('bookings', auth.get()?.role)) return;
    setFinanceOpen(false);
    setActiveBookingId(id);
  }, []);
  const handleCloseBooking = useCallback(() => {
    setActiveBookingId(null);
    setFinanceOpen(false);
    if (searchParams.get('bookingId')) {
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('bookingId'); return n; }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const navFromDrawer = useCallback((page, edit, extra) => {
    setActiveBookingId(null);
    setFinanceOpen(false);
    handleNavigate(page, edit, extra);
  }, [handleNavigate]);

  const bookings = useMemo(() => operationsStorage.getBookings(), [opsTick]);
  const awaitingBookings = useMemo(() => bookings.filter(b => b.status === 'awaiting'), [bookings]);
  const activeBooking = activeBookingId ? bookings.find(b => b.id === activeBookingId) : null;

  const closeMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  const renderCurrentPage = () => {
    if (!allowed) return <AccessDenied onHome={() => handleNavigate('overview')} />;
    const catalogProps = {
      editId: currentEdit, onEdit: handleCatalogEdit, onBack: handleCatalogBack,
      searchQuery: globalQuery, onSearchChange: setGlobalQuery, onNavigate: handleNavigate,
    };
    switch (currentPage) {
      case 'profile': return <Profile />;
      case 'inbox': return <InboxPage onNavigate={handleNavigate} externalQuery={globalQuery} />;
      case 'bookings':
        return <BookingsPage onOpenBooking={handleOpenBooking} onCreateBooking={() => setCreateBookingOpen(true)} externalQuery={globalQuery} />;
      case 'hotels': return <HotelsPage {...catalogProps} />;
      case 'packages': return <PackagesPage {...catalogProps} />;
      case 'cars': return <CarsPage {...catalogProps} />;
      case 'tours': return <ToursPage {...catalogProps} />;
      case 'providers': return <ProvidersPage {...catalogProps} />;
      case 'provider-ops': return <ProviderOpsPage externalQuery={globalQuery} />;
      case 'supplier-credit': return <SupplierCreditPage onOpenBooking={id => { handleNavigate('bookings'); handleOpenBooking(id); }} />;
      case 'reports': return <ReportsPage onOpenBooking={handleOpenBooking} onNavigate={handleNavigate} />;
      case 'pricing': return <PricingPage />;
      case 'audience': return <AudiencePage onOpenBooking={handleOpenBooking} />;
      case 'content': return <ContentPage />;
      case 'staff': return <StaffPage onOpenBooking={handleOpenBooking} />;
      default:
        return <OverviewPage onOpenBooking={handleOpenBooking} onCreateBooking={() => setCreateBookingOpen(true)} onNavigate={handleNavigate} searchQuery={globalQuery} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      searchQuery={globalQuery}
      onSearchChange={setGlobalQuery}
      awaitingCount={awaitingBookings.length}
      awaitingBookings={awaitingBookings}
      isMobileMenuOpen={isMobileMenuOpen}
      onToggleMobileMenu={() => setIsMobileMenuOpen(v => !v)}
      onCloseMobileMenu={closeMenu}
      onOpenBooking={handleOpenBooking}
      onSignOut={() => auth.signOut()}
      onOpenDataTransfer={() => setDataOpen(true)}
      onOpenProfile={() => handleNavigate('profile')}
    >
      <Suspense fallback={<div className="page-loading" role="status">جاري التحميل...</div>}>
        {renderCurrentPage()}
      </Suspense>

      {/* Booking detail drawer: switches between details and payment/finance views */}
      <Drawer
        isOpen={Boolean(activeBooking)}
        onClose={handleCloseBooking}
        eyebrow={financeOpen ? 'تفاصيل الدفع' : 'تفاصيل الحجز'}
        title={activeBooking ? activeBooking.id : ''}
      >
        {activeBooking && (financeOpen ? (
          <PaymentDetailsModal
            key={`fin-${activeBooking.id}`}
            bookingId={activeBooking.id}
            onBackToBooking={() => setFinanceOpen(false)}
            onNavigate={navFromDrawer}
          />
        ) : (
          <BookingDrawer
            key={`bk-${activeBooking.id}`}
            bookingId={activeBooking.id}
            onOpenFinance={() => setFinanceOpen(true)}
            onNavigate={navFromDrawer}
          />
        ))}
      </Drawer>

      <CreateBookingModal
        isOpen={createBookingOpen}
        onClose={() => setCreateBookingOpen(false)}
        onSuccess={newBooking => { setCreateBookingOpen(false); handleOpenBooking(newBooking.id); }}
      />

      {dataOpen && (
        <Suspense fallback={null}>
          <DataTransferModal isOpen={dataOpen} onClose={() => setDataOpen(false)} />
        </Suspense>
      )}
    </Layout>
  );
}
