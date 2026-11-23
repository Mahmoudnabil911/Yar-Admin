import { uiLocale } from '../../i18n/prefs';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { operationsModel as M } from '../../services/models';
import { TopUpModal } from './TopUpModal';
import { AddSupplierModal } from './AddSupplierModal';
import { can } from '../../auth/access';
import { Drawer } from '../../components/ui/Drawer';
import { useToast } from '../../components/ui/Toast';
import { suppliersApi } from '../../services/api/suppliersApi';

const labels = {
  topup: 'شحن رصيد',
  deposit: 'شحن رصيد',
  credit: 'شحن رصيد',
  issue: 'خصم إصدار',
  debit: 'خصم إصدار',
  return: 'إرجاع إلى الرصيد',
  refund: 'إرجاع إلى الرصيد',
};

export function SupplierCreditPage({ onNavigate, onOpenBooking, searchQuery = '', onSearchChange }) {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveSuppliers, setLiveSuppliers] = useState([]);

  const [providerFilter, setProviderFilter] = useState('all');
  const [currencyFilter, setCurrencyFilter] = useState('all');

  // Modals & Drawers
  const [showTopUp, setShowTopUp] = useState(false);
  const [topUpTarget, setTopUpTarget] = useState({ providerId: '', currency: 'USD' });
  const [showAddSupplier, setShowAddSupplier] = useState(false);

  const [accountDrawer, setAccountDrawer] = useState({
    open: false,
    providerId: '',
    currency: 'USD',
    name: '',
    balance: 0,
  });
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState(null);
  const [drawerItems, setDrawerItems] = useState([]);
  const [drawerBalance, setDrawerBalance] = useState(0);

  // Load suppliers from API 065
  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await suppliersApi.getSuppliers();
      setLiveSuppliers(res.items || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
      setError(err.message || 'تعذر تحميل أرصدة الموردين من الخادم.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Load drawer ledger from API 066 when drawer opens
  const loadDrawerLedger = useCallback(async (pId) => {
    if (!pId) return;
    setDrawerLoading(true);
    setDrawerError(null);
    try {
      const res = await suppliersApi.getSupplierLedger(pId);
      setDrawerItems(res.items || []);
      if (res.balance_usd != null) {
        setDrawerBalance(Number(res.balance_usd));
      }
    } catch (err) {
      console.error('Failed to load supplier ledger:', err);
      setDrawerError(err.message || 'تعذر تحميل كشف حساب المورّد من الخادم.');
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountDrawer.open && accountDrawer.providerId) {
      loadDrawerLedger(accountDrawer.providerId);
    }
  }, [accountDrawer.open, accountDrawer.providerId, loadDrawerLedger]);

  const money = (v, c = 'USD') => {
    const f = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: c === 'USD' ? 2 : 0,
      maximumFractionDigits: c === 'USD' ? 2 : 0,
    });
    return `${f.format(Number(v) || 0)} ${c === 'USD' ? '$' : 'د.ع'}`;
  };

  // ONLY real suppliers from API (no mock catalog providers)
  const availableProviders = useMemo(() => {
    return liveSuppliers.map(s => ({
      id: String(s.id),
      name: s.name || `مورّد #${s.id}`,
    }));
  }, [liveSuppliers]);

  // Accounts list from live data only
  const accounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = liveSuppliers.map(s => {
      const id = String(s.id);
      const name = s.name || `مورّد #${id}`;
      const cur = s.currency || 'USD';
      const bal = Number(s.balance_usd ?? s.balance ?? 0);
      return {
        providerId: id,
        name,
        currency: cur,
        balance: bal,
        deposits: Number(s.deposits ?? 0),
        issued: Number(s.issued ?? 0),
        returned: Number(s.returned ?? 0),
        low: bal < (cur === 'USD' ? 100 : 100000),
      };
    });

    return list.filter(a => {
      if (providerFilter !== 'all' && a.providerId !== providerFilter) return false;
      if (currencyFilter !== 'all' && a.currency !== currencyFilter) return false;
      if (q && !a.name.toLowerCase().includes(q) && !a.providerId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [liveSuppliers, providerFilter, currencyFilter, searchQuery]);

  const handleOpenAccount = (pId, cur = 'USD', name = '', balance = 0) => {
    const s = liveSuppliers.find(x => String(x.id) === String(pId));
    const resolvedName = name || s?.name || `مورّد #${pId}`;
    const resolvedBal = balance || Number(s?.balance_usd ?? s?.balance ?? 0);
    setAccountDrawer({
      open: true,
      providerId: String(pId),
      currency: cur,
      name: resolvedName,
      balance: resolvedBal,
    });
    setDrawerBalance(resolvedBal);
    setDrawerItems([]);
  };

  // Process and calculate running balances for drawer ledger items (API 066)
  const processedDrawerItems = useMemo(() => {
    if (!drawerItems || drawerItems.length === 0) return [];

    // Sort chronologically (oldest to newest) to calculate running balance accurately
    const sorted = [...drawerItems].sort((a, b) => {
      const timeA = new Date(a.at || a.created_at || a.created_at_utc || 0).getTime() || (Number(a.id) || 0);
      const timeB = new Date(b.at || b.created_at || b.created_at_utc || 0).getTime() || (Number(b.id) || 0);
      return timeA - timeB;
    });

    let running = 0;
    const computed = sorted.map(item => {
      const isIssue = item.type === 'issue' || item.type === 'debit';
      const amount = Number(item.amount_usd ?? item.amount ?? 0);
      if (isIssue) {
        running -= amount;
      } else {
        running += amount;
      }
      return {
        ...item,
        calculatedAfter: item.balance_after_usd != null ? Number(item.balance_after_usd) : running,
      };
    });

    // Return newest first for display
    return computed.reverse();
  }, [drawerItems]);

  const handleOpenTopUp = (pId = '', cur = 'USD') => {
    setTopUpTarget({ providerId: String(pId), currency: cur });
    setShowTopUp(true);
  };

  const handleTopUpSuccess = (pId) => {
    loadSuppliers();
    if (accountDrawer.open && accountDrawer.providerId === pId) {
      loadDrawerLedger(pId);
    }
  };

  const handleExportCSV = () => {
    try {
      const rows = [
        ['المورّد', 'العملة', 'الرصيد المتاح', 'شحن الرصيد', 'خصومات الإصدار', 'الإرجاع', 'الحالة'],
        ...accounts.map(a => [
          a.name,
          a.currency,
          a.balance,
          a.deposits,
          a.issued,
          a.returned,
          a.low ? 'منخفض' : 'طبيعي',
        ]),
      ];
      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YAR-suppliers-credit-${M.today()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast('صُدّر كشف أرصدة المورّدين بنجاح.');
    } catch (e) {
      toast(e.message);
    }
  };

  const canTopUp = can('supplier.topup');

  return (
    <div className="ops-page credit-page">
      <div className="page-heading ops-heading">
        <div>
          <div className="eyebrow">حسابات المورّدين</div>
          <h1 id="credit-title" tabIndex={-1}>أرصدة المورّدين</h1>
          <p>اشحن رصيد المورّد مسبقًا، وتابع خصم تكلفة الخدمة عند كل إصدار.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="button secondary"
            onClick={loadSuppliers}
            title="تحديث البيانات من الخادم"
            disabled={loading}
          >
            <i data-icon="refresh"><Icon name="refresh" /></i>
            تحديث
          </button>
          {canTopUp && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowAddSupplier(true)}
            >
              <i data-icon="plus"><Icon name="plus" /></i>
              إضافة مورّد
            </button>
          )}
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
      </div>

      {/* Live Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span className="ops-badge live" style={{ background: 'var(--c-eaf4e6, #eaf4e6)', color: 'var(--c-2b5a26, #2b5a26)', padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
          • بيانات مباشرة من الخادم (API 065 / 066 / 064 / 068)
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          أرصدة المورّدين بالدولار منفصلة عن تحصيل العملاء، وتُعرض الحسابات الحقيقية فقط من الخادم.
        </span>
      </div>

      {error && (
        <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="button secondary" style={{ minHeight: 28, fontSize: 12, padding: '2px 8px' }} onClick={loadSuppliers}>
            إعادة المحاولة
          </button>
        </div>
      )}

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
              {availableProviders.map(p => (
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
          {loading ? (
            <div className="aud-loading" style={{ padding: 40, textAlign: 'center' }}>
              <div className="aud-spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--muted)' }}>جاري تحميل أرصدة الموردين من الخادم...</p>
            </div>
          ) : (
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
                            onClick={() => handleOpenAccount(a.providerId, a.currency, a.name, a.balance)}
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
                    <td colSpan={6} style={{ textAlign: 'center', padding: 35, color: 'var(--muted)' }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>لا توجد حسابات موردين مسجلة حتى الآن.</p>
                      <small>No supplier accounts found on the server.</small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <p className="ops-note" style={{ padding: '12px 20px', margin: 0, borderTop: '1px solid var(--border)' }}>
          تنبيه الرصيد: الرصيد المنخفض أقل من 100$ أو 100,000 د.ع. يُخصم رصيد المورّد تلقائيًا عند تأكيد الحجز وإصدار التذكرة.
        </p>
      </section>

      {/* Movement Ledger Statement Panel */}
      <section className="panel ops-card">
        <div className="ops-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>كشف حركة أرصدة الموردين</h3>
            <p className="ops-note" style={{ margin: '4px 0 0 0' }}>
              اضغط على «كشف الحساب» أمام أي مورّد في الجدول أعلاه لعرض وتدقيق كشف حركاته المباشرة (API 066).
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
      </section>

      {/* Add Supplier Modal (API 068) */}
      {showAddSupplier && (
        <Drawer
          open={showAddSupplier}
          onClose={() => setShowAddSupplier(false)}
          eyebrow="إدارة المورّدين (API 068)"
          title="إضافة مورّد جديد"
        >
          <AddSupplierModal
            onClose={() => setShowAddSupplier(false)}
            onCreated={() => {
              loadSuppliers();
            }}
          />
        </Drawer>
      )}

      {/* Top up modal (API 064) */}
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
            providers={availableProviders}
            onClose={() => setShowTopUp(false)}
            onDone={(pId, cur) => {
              handleTopUpSuccess(pId);
              handleOpenAccount(pId, cur);
            }}
          />
        </Drawer>
      )}

      {/* Account Statement Drawer (API 066) */}
      {accountDrawer.open && (
        <Drawer
          open={accountDrawer.open}
          onClose={() => setAccountDrawer({ open: false, providerId: '', currency: 'USD', name: '', balance: 0 })}
          eyebrow="حساب المورّد · رصيد مسبق الدفع (API 066)"
          title={`${accountDrawer.name || (liveSuppliers.find(s => String(s.id) === String(accountDrawer.providerId))?.name) || 'المورّد'} · ${accountDrawer.currency}`}
        >
          <div className="credit-balance" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)', display: 'block' }}>الرصيد المتاح لدى المورّد</span>
            <strong style={{ fontSize: 26, color: 'var(--green)' }}>
              <bdi>{money(drawerBalance || accountDrawer.balance, accountDrawer.currency)}</bdi>
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
            <button
              type="button"
              className="button secondary"
              onClick={() => loadDrawerLedger(accountDrawer.providerId)}
              disabled={drawerLoading}
            >
              تحديث الكشف
            </button>
          </div>

          <section className="ops-section">
            <h3>كشف حركات الحساب</h3>

            {drawerLoading ? (
              <div className="aud-loading" style={{ padding: 30, textAlign: 'center' }}>
                <div className="aud-spinner" style={{ margin: '0 auto 10px' }} />
                <p style={{ color: 'var(--muted)' }}>جاري تحميل كشف الحساب من الخادم...</p>
              </div>
            ) : drawerError ? (
              <div className="ops-form-error wide" role="alert" style={{ marginBottom: 16 }}>
                <p>{drawerError}</p>
                <button
                  type="button"
                  className="button secondary"
                  style={{ minHeight: 28, fontSize: 12, marginTop: 8 }}
                  onClick={() => loadDrawerLedger(accountDrawer.providerId)}
                >
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="ops-table credit-ledger">
                  <thead>
                    <tr>
                      <th>الحركة / التاريخ</th>
                      <th>خصم</th>
                      <th>شحن</th>
                      <th>الرصيد</th>
                      <th>المرجع / الطلب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processedDrawerItems.length > 0 ? (
                      processedDrawerItems.map((e, idx) => {
                        const isIssue = e.type === 'issue' || e.type === 'debit';
                        const isReturn = e.type === 'return' || e.type === 'refund';
                        const isDeposit = e.type === 'deposit' || e.type === 'credit' || e.type === 'topup' || !e.type;
                        const dateStr = e.at || e.created_at || e.created_at_utc;
                        const amountVal = Number(e.amount_usd ?? e.amount ?? 0);
                        const afterVal = e.calculatedAfter ?? (e.balance_after_usd ?? e.after ?? 0);
                        return (
                          <tr key={e.id || idx}>
                            <td>
                              <span className={`ops-status ${isIssue ? 'processing' : isReturn ? 'partialRefund' : 'paid'}`}>
                                {labels[e.type] || e.type || 'حركة رصيد'}
                              </span>
                              {dateStr && (
                                <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                                  {new Date(dateStr).toLocaleString(uiLocale(), { timeZone: 'Asia/Baghdad' })}
                                </small>
                              )}
                            </td>
                            <td>
                              <bdi style={{ color: isIssue ? 'var(--c-924b42)' : 'inherit' }}>
                                {isIssue ? money(amountVal, accountDrawer.currency) : '—'}
                              </bdi>
                            </td>
                            <td>
                              <bdi style={{ color: (isDeposit || isReturn) ? 'var(--c-2b5a26)' : 'inherit' }}>
                                {(isDeposit || isReturn) ? money(amountVal, accountDrawer.currency) : '—'}
                              </bdi>
                            </td>
                            <td>
                              <strong>{money(afterVal, accountDrawer.currency)}</strong>
                            </td>
                            <td>
                              <bdi>{e.reference || '—'}</bdi>
                              {e.booking_id && (
                                <button
                                  type="button"
                                  className="text-action"
                                  style={{ fontSize: 11, padding: 0, display: 'block', marginTop: 3 }}
                                  onClick={() => {
                                    setAccountDrawer({ open: false, providerId: '', currency: 'USD', name: '', balance: 0 });
                                    onOpenBooking?.(e.booking_id);
                                  }}
                                >
                                  طلب #{e.booking_id}
                                </button>
                              )}
                              {e.note && (
                                <small style={{ color: 'var(--muted)', display: 'block' }}>{e.note}</small>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 25, color: 'var(--muted)' }}>
                          <p style={{ fontWeight: 600, marginBottom: 4 }}>لا توجد حركات مسجلة لهذا المورّد حتى الآن.</p>
                          <small>No transactions recorded for this supplier yet.</small>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </Drawer>
      )}
    </div>
  );
}

export default SupplierCreditPage;
