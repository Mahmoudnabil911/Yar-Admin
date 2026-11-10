import { uiLocale } from '../../i18n/prefs';
import React, { useState, useMemo, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsStorage } from '../../services/storage/operationsStorage';
import { catalogStorage } from '../../services/storage/catalogStorage';
import { supplierCreditModel as C, operationsModel as M } from '../../services/models';
import { TopUpModal } from './TopUpModal';
import { can } from '../../auth/access';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';

const labels = { deposit: 'شحن رصيد', issue: 'خصم إصدار', return: 'إرجاع إلى الرصيد' };

export function SupplierCreditPage({ onNavigate, onOpenBooking, searchQuery = '', onSearchChange }) {
  const toast = useToast();

  const [providers, setProviders] = useState(() => catalogStorage.getRecords('providers'));
  const [ledger, setLedger] = useState(() => operationsStorage.getCreditLedger());
  const [bookings, setBookings] = useState(() => operationsStorage.getBookings());

  const [providerFilter, setProviderFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  // Modals & Drawers
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpTarget, setTopUpTarget] = useState({ providerId: '', currency: 'USD' });

  const [accountDrawer, setAccountDrawer] = useState({ open: false, providerId: '', currency: 'USD' });

  useEffect(() => {
    const unsubOps = operationsStorage.subscribe(() => {
      setLedger(operationsStorage.getCreditLedger());
      setBookings(operationsStorage.getBookings());
    });
    const unsubCat = catalogStorage.subscribe(() => {
      setProviders(catalogStorage.getRecords('providers'));
    });
    return () => {
      unsubOps();
      unsubCat();
    };
  }, []);

  const money = (v, c) => {
    const f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: c === 'USD' ? 2 : 0,
      maximumFractionDigits: c === 'USD' ? 2 : 0
    });
    return `${f.format(Number(v) || 0)} ${c === 'USD' ? '$' : 'د.ع'}`;
  };

  // Accounts list
  const accounts = useMemo(() => {
    if (!C) return [];
    const all = C.accounts(ledger, providers);
    const q = searchQuery.trim().toLowerCase();
    return all.filter(a => {
      if (providerFilter !== 'all' && a.providerId !== providerFilter) return false;
      if (currencyFilter !== 'all' && a.currency !== currencyFilter) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.providerId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledger, providers, providerFilter, currencyFilter, searchQuery]);

  // Full Statement entries
  const statementRows = useMemo(() => {
    if (!C) return [];
    const q = searchQuery.trim().toLowerCase();
    const all = C.statement(ledger, bookings);
    return all.filter(e => {
      if (providerFilter !== 'all' && e.providerId !== providerFilter) return false;
      if (currencyFilter !== 'all' && e.currency !== currencyFilter) return false;
      if (q) {
        const text = [e.providerName, e.pnr, e.route, e.reference, e.bookingId, e.note].join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [ledger, bookings, providerFilter, currencyFilter, searchQuery]);

  const handleOpenAccount = (pId, cur) => {
    setAccountDrawer({ open: true, providerId: pId, currency: cur });
  };

  const handleOpenTopUp = (pId = '', cur = 'USD') => {
    setTopUpTarget({ providerId: pId, currency: cur });
    setShowTopUp(true);
  };

  const handleAddDemoStatement = pId => {
    try {
      operationsStorage.addSupplierStatementDemo(pId);
      toast('أُضيفت تذاكر وتعزيز وإرجاع تجريبية دون تغيير الحركات السابقة.');
    } catch (e) {
      toast(e.message);
    }
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['الحركة', 'التاريخ', 'المورّد', 'العملة', 'مدين - خصم', 'دائن - تعزيز', 'الرصيد المتبقي', 'PNR', 'الروت', 'تاريخ السفر', 'الناقل', 'المرجع', 'الطلب', 'الملاحظة'],
        ...statementRows.map(e => [
          labels[e.type] || e.type,
          e.at,
          e.providerName,
          e.currency,
          e.debit || '',
          e.credit || '',
          e.after,
          e.pnr || '',
          e.route || '',
          e.travelDate || '',
          e.carrier || '',
          e.reference || '',
          e.bookingId || '',
          e.note || ''
        ])
      ];
      const csv = operationsStorage.csv(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YAR-supplier-credit-${M.today()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('صُدّر كشف حركات أرصدة المورّدين.');
    } catch (e) {
      toast(e.message);
    }
  };

  // Account drawer statement
  const drawerAccount = useMemo(() => {
    if (!accountDrawer.open || !C) return null;
    const p = providers.find(p => p.id === accountDrawer.providerId);
    const balanceVal = C.balance(ledger, accountDrawer.providerId, accountDrawer.currency);
    const rows = C.statement(ledger, bookings).filter(e =>
      e.providerId === accountDrawer.providerId && e.currency === accountDrawer.currency
    );
    return {
      name: p?.name || 'المورّد',
      provider: p,
      balance: balanceVal,
      rows
    };
  }, [accountDrawer, ledger, bookings, providers]);

  const canTopUp = can('supplier.topup');
  const canDemo = can('supplier.demo');

  return (
    <div className="ops-page credit-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">حسابات المورّدين</div>
          <h1 id="credit-title" tabIndex={-1}>أرصدة المورّدين</h1>
          <p>اشحن رصيد المورّد مسبقًا، وتابع خصم تكلفة الخدمة عند كل إصدار.</p>
        </div>
        {canTopUp ? (
        <button
            type="button"
            className="button primary"
            data-credit-add
            onClick={() => handleOpenTopUp()}
          >
            <i data-icon="plus"><Icon name="plus" /></i>
            شحن رصيد
          </button>
        ) : (
          <span className="perm-chip" role="note">عرض فقط · شحن الرصيد وتعديله متاحان لمدير النظام.</span>
        )}
      </div>

      <p className="ops-notice">
        أرصدة المورّدين منفصلة عن تحصيل الزبائن، ولا تُجمع العملات.
      </p>

      {/* Currency Balances Grid */}
      <div className="ops-currency-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20, marginBottom: 20 }}>
        {['USD', 'IQD'].filter(c => currencyFilter === 'all' || currencyFilter === c).map(cur => {
          const curAccounts = accounts.filter(a => a.currency === cur);
          const totalBalance = curAccounts.reduce((sum, a) => sum + a.balance, 0);
          const totalDeposits = curAccounts.reduce((sum, a) => sum + a.deposits, 0);
          const totalIssued = curAccounts.reduce((sum, a) => sum + a.issued, 0);
          const totalReturned = curAccounts.reduce((sum, a) => sum + a.returned, 0);

          return (
            <section className="panel ops-currency-card" key={cur} style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>
                {cur === 'USD' ? 'الدولار الأمريكي · USD' : 'الدينار العراقي · IQD'}
              </h3>
              <div className="credit-balance" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>الرصيد المتاح لدى المورّدين</span>
                <strong style={{ fontSize: 26, color: 'var(--green)' }}><bdi>{money(totalBalance, cur)}</bdi></strong>
              </div>
              <div className="ops-money-lines">
                <div>
                  <span>إجمالي الشحن</span>
                  <strong><bdi>{money(totalDeposits, cur)}</bdi></strong>
                </div>
                <div>
                  <span>خصومات الإصدار</span>
                  <strong><bdi>{money(totalIssued, cur)}</bdi></strong>
                </div>
                <div>
                  <span>الإرجاع إلى الرصيد</span>
                  <strong><bdi>{money(totalReturned, cur)}</bdi></strong>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Accounts List Panel */}
      <section className="panel ops-card" style={{ marginBottom: 25 }}>
        <div className="credit-filters" style={{ display: 'flex', gap: 14, padding: '16px 20px', background: 'var(--c-fafbf7)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <label className="ops-field" style={{ minWidth: 200 }}>
            <span>المورّد</span>
            <select
              value={providerFilter}
              onChange={e => setProviderFilter(e.target.value)}
            >
              <option value="all">كل المورّدين</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="ops-field" style={{ minWidth: 160 }}>
            <span>العملة</span>
            <select
              value={currencyFilter}
              onChange={e => setCurrencyFilter(e.target.value)}
            >
              <option value="all">كل العملات · منفصلة</option>
              <option value="USD">USD</option>
              <option value="IQD">IQD</option>
            </select>
          </label>
        </div>

        <div className="ops-table-wrap table-scroll">
          <table className="ops-table credit-accounts">
            <thead>
              <tr>
                <th>المورّد</th>
                <th>الرصيد المتاح</th>
                <th>شحن الرصيد</th>
                <th>خصومات الإصدار</th>
                <th>الإرجاع</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length > 0 ? (
                accounts.map(a => (
                  <tr key={a.providerId + a.currency}>
                    <td>
                      <strong>{a.name}</strong>
                      <small style={{ color: 'var(--muted)', display: 'block' }}>{a.currency}</small>
                    </td>
                    <td>
                      <strong><bdi>{money(a.balance, a.currency)}</bdi></strong>
                      {a.low && <span className="ops-status review" style={{ marginInlineStart: 8 }}>رصيد منخفض</span>}
                    </td>
                    <td><bdi>{money(a.deposits, a.currency)}</bdi></td>
                    <td><bdi>{money(a.issued, a.currency)}</bdi></td>
                    <td><bdi>{money(a.returned, a.currency)}</bdi></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => handleOpenAccount(a.providerId, a.currency)}
                        >
                          كشف الحساب
                        </button>
                        {canTopUp && (
                        <button
                          type="button"
                          className="button primary"
                          style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                          onClick={() => handleOpenTopUp(a.providerId, a.currency)}
                        >
                          شحن
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 25, color: 'var(--muted)' }}>
                    لا توجد حسابات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="ops-note" style={{ padding: '12px 20px', margin: 0, borderTop: '1px solid var(--border)' }}>
          تنبيه الرصيد: الرصيد المنخفض أقل من 100$ أو 100,000 د.ع. السجلات السابقة لا تُخصم بأثر رجعي؛ أي خصم جديد يرتبط بطلب واحد ومرجع إصدار.
        </p>
      </section>

      {/* Movement Ledger Statement Panel */}
      <section className="panel ops-card">
        <div className="ops-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>سجل الحركات</h3>
            <p className="ops-note" style={{ margin: '4px 0 0 0' }}>
              الرصيد بعد كل حركة محسوب على كامل حساب المورّد بعملته، حتى عند التصفية.
            </p>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={handleExportCSV}
          >
            <i data-icon="download"><Icon name="download" /></i>
            تصدير الكشف CSV
          </button>
        </div>

        <div className="credit-statement">
          <div className="table-scroll">
            <table className="ops-table credit-ledger">
              <thead>
                <tr>
                  <th>الحركة / التاريخ</th>
                  <th>المورّد / تفاصيل التذكرة</th>
                  <th>مدين · خصم</th>
                  <th>دائن · تعزيز</th>
                  <th>الرصيد المتبقي</th>
                  <th>المرجع / الطلب</th>
                </tr>
              </thead>
              <tbody>
                {statementRows.length > 0 ? (
                  statementRows.map(e => (
                    <tr key={e.id}>
                      <td>
                        <span className={`ops-status ${e.type === 'issue' ? 'processing' : e.type === 'return' ? 'partialRefund' : 'paid'}`}>
                          {labels[e.type] || e.type}
                        </span>
                        <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                          {new Date(e.at).toLocaleString(uiLocale(), { timeZone: 'Asia/Baghdad' })}
                        </small>
                      </td>
                      <td>
                        <strong>{e.providerName}</strong>
                        {e.bookingId && (
                          <div className="credit-ticket" style={{ fontSize: 11, color: 'var(--c-4d6945)', marginTop: 3 }}>
                            <span>PNR: <bdi>{e.pnr || 'غير مسجّل'}</bdi></span>
                            <span style={{ margin: '0 6px' }}>·</span>
                            <span>الروت: {e.route || 'غير مسجّل'}</span>
                            {e.travelDate && <span> · تاريخ السفر: {e.travelDate}</span>}
                            {e.carrier && <span> · الناقل: {e.carrier}</span>}
                          </div>
                        )}
                        <small style={{ color: 'var(--muted)', display: 'block' }}>{e.staffName || 'فريق العمل'}</small>
                      </td>
                      <td className="credit-debit">
                        <bdi style={{ color: e.debit ? 'var(--c-924b42)' : 'inherit' }}>
                          {e.debit ? money(e.debit, e.currency) : '—'}
                        </bdi>
                      </td>
                      <td className="credit-credit">
                        <bdi style={{ color: e.credit ? 'var(--c-2b5a26)' : 'inherit' }}>
                          {e.credit ? money(e.credit, e.currency) : '—'}
                        </bdi>
                      </td>
                      <td>
                        <strong><bdi>{money(e.after, e.currency)}</bdi></strong>
                      </td>
                      <td>
                        <bdi>{e.reference}</bdi>
                        {e.bookingId && (
                          <button
                            type="button"
                            className="text-action"
                            style={{ display: 'block', fontSize: 11, padding: 0, marginTop: 3 }}
                            onClick={() => onOpenBooking(e.bookingId)}
                          >
                            {e.bookingId}
                          </button>
                        )}
                        <small style={{ color: 'var(--muted)', display: 'block' }}>{e.note}</small>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 25, color: 'var(--muted)' }}>
                      لا توجد حركات مطابقة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Top up modal */}
      {showTopUp && (
        <Drawer
          open={showTopUp}
          onClose={() => setShowTopUp(false)}
          eyebrow="حساب المورّد · رصيد مسبق الدفع"
          title="شحن رصيد المورّد"
        >
          <TopUpModal
            initialProviderId={topUpTarget.providerId}
            initialCurrency={topUpTarget.currency}
            onClose={() => setShowTopUp(false)}
            onDone={(pId, cur) => handleOpenAccount(pId, cur)}
          />
        </Drawer>
      )}

      {/* Account Statement Drawer */}
      {accountDrawer.open && drawerAccount && (
        <Drawer
          open={accountDrawer.open}
          onClose={() => setAccountDrawer({ open: false, providerId: '', currency: 'USD' })}
          eyebrow="رصيد مسبق الدفع"
          title={`${drawerAccount.name} · ${accountDrawer.currency}`}
        >
          <div className="credit-balance" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>الرصيد المتاح لدى المورّد</span>
            <strong style={{ fontSize: 26, color: 'var(--green)' }}>
              <bdi>{money(drawerAccount.balance, accountDrawer.currency)}</bdi>
            </strong>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
              تُخصم تكلفة الخدمة عند الإصدار / التأكيد فقط.
            </p>
          </div>

          <div className="ops-form-actions" style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            {canTopUp && (
            <button
              type="button"
              className="button primary"
              onClick={() => handleOpenTopUp(accountDrawer.providerId, accountDrawer.currency)}
            >
              شحن الرصيد
            </button>
            )}

          </div>

          <section className="ops-section">
            <h3>كشف حركات الحساب</h3>
            <div className="table-scroll">
              <table className="ops-table credit-ledger">
                <thead>
                  <tr>
                    <th>الحركة / التاريخ</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>الرصيد</th>
                    <th>المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerAccount.rows.map(e => (
                    <tr key={e.id}>
                      <td>
                        <span className={`ops-status ${e.type === 'issue' ? 'processing' : e.type === 'return' ? 'partialRefund' : 'paid'}`}>
                          {labels[e.type] || e.type}
                        </span>
                        <small style={{ color: 'var(--muted)', display: 'block' }}>
                          {new Date(e.at).toLocaleString(uiLocale(), { timeZone: 'Asia/Baghdad' })}
                        </small>
                      </td>
                      <td>{e.debit ? money(e.debit, e.currency) : '—'}</td>
                      <td>{e.credit ? money(e.credit, e.currency) : '—'}</td>
                      <td><strong>{money(e.after, e.currency)}</strong></td>
                      <td>
                        <bdi>{e.reference}</bdi>
                        {e.bookingId && (
                          <button
                            type="button"
                            className="text-action"
                            style={{ fontSize: 11, padding: 0 }}
                            onClick={() => {
                              setAccountDrawer({ open: false, providerId: '', currency: 'USD' });
                              onOpenBooking(e.bookingId);
                            }}
                          >
                            {e.bookingId}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Drawer>
      )}
    </div>
  );
}

export default SupplierCreditPage;

