import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Search, RefreshCw, X, Phone, Copy, ChevronLeft, ChevronRight, CheckCheck, MessageSquare } from 'lucide-react';
import { useWords } from '../accounts/AccountUI';
import { usePrefs } from '../i18n/prefs';
import { currentAccount, assignmentUsers } from '../accounts/repository';
import { assertCan } from '../auth/access';
import { inboxApi } from '../services/api/inboxApi';
import { filterInquiries, INQUIRY_STATUSES, INQUIRY_CATEGORIES, eligibleAssignee } from './service';
import './inbox.css';

export const statusWords = {
  new: ['جديد', 'New'],
  in_progress: ['قيد المتابعة', 'In Progress'],
  waiting_for_customer: ['بانتظار العميل', 'Waiting for Customer'],
  resolved: ['تم الحل', 'Resolved'],
  closed: ['مغلق', 'Closed'],
};

export const categoryWords = {
  general: ['استفسار عام', 'General Inquiry'],
  bookings: ['الحجوزات والطلبات', 'Bookings & Reservations'],
  flights: ['الطيران', 'Flights'],
  hotels: ['الفنادق والخدمات', 'Hotels & Services'],
  refund: ['الإلغاء والاسترداد', 'Cancellation & Refund Inquiry'],
  technical: ['مشكلة تقنية', 'Technical Support'],
  account: ['الحسابات', 'Account Assistance'],
  other: ['أخرى', 'Other'],
};

export default function InboxPage({ onNavigate, externalQuery = '' }) {
  const t = useWords();
  const { lang } = usePrefs();
  const user = currentAccount();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(new URLSearchParams(location.search).get('inquiryId'));
  const [filters, setFilters] = useState({
    query: externalQuery,
    status: 'all',
    category: 'all',
    assignee: 'all',
    read: 'all',
    from: '',
    until: '',
    sort: 'newest',
  });
  const [page, setPage] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const unavailable = t('تعذر معالجة الطلب حالياً. يرجى المحاولة مرة أخرى.', 'Unable to process request. Please try again.');
  const text = (r, key) => (lang === 'en' ? (r[key + 'En'] || r[key] || '') : (r[key] || ''));

  async function load(isActive = () => true) {
    setLoading(true);
    setError('');
    try {
      assertCan('inquiry.view');
      const res = await inboxApi.getInquiries();
      if (!isActive()) return;
      const rawItems = res?.items || [];
      const next = rawItems.map((r) => {
        const cName = r.customer_name || r.name || r.customer || (r.id ? `عميل #${r.id}` : 'عميل');
        return {
          id: r.id,
          reference: r.reference || `INQ-${String(r.id || '').padStart(4, '0')}`,
          fullName: cName,
          fullNameEn: cName,
          subject: r.subject || t('استفسار بدون عنوان', 'Untitled Inquiry'),
          subjectEn: r.subject || 'Untitled Inquiry',
          message: r.message || r.body || '',
          messageEn: r.message || r.body || '',
          category: r.category || 'general',
          status: r.status || 'new',
          email: r.customer_email || r.email || '',
          phoneE164: r.customer_phone || r.phone || '',
          readBy: Array.isArray(r.read_by) ? r.read_by : (Array.isArray(r.readBy) ? r.readBy : []),
          assignedTo: r.assigned_to || r.assignedTo || null,
          createdAt: r.created_at || r.createdAt || r.at || new Date().toISOString(),
          updatedAt: r.updated_at || r.updatedAt || r.created_at || r.at || new Date().toISOString(),
          notes: Array.isArray(r.notes)
            ? r.notes
            : (Array.isArray(r.replies)
                ? r.replies.map(reply => ({
                    id: reply.id || reply.message_id || Math.random(),
                    author: reply.author || reply.author_name || (reply.internal ? t('ملاحظة داخلية', 'Internal note') : t('رد', 'Reply')),
                    content: reply.content || reply.body || '',
                    at: reply.at || reply.created_at || new Date().toISOString(),
                  }))
                : []),
          activity: Array.isArray(r.activity) ? r.activity : [],
          bookingReference: r.booking_id ? String(r.booking_id) : (r.booking_reference || null),
        };
      });

      if (!isActive()) return;
      setRows(next);
      setSelected((curr) => (next.some(item => String(item.id) === String(curr)) ? curr : (next[0]?.id || null)));
    } catch (err) {
      if (!isActive()) return;
      console.error('Failed to load inquiries:', err);
      setError(err?.ar || err?.message || unavailable);
    } finally {
      if (isActive()) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    load(() => active);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setFilters((v) => ({ ...v, query: externalQuery }));
  }, [externalQuery]);

  const users = assignmentUsers().filter((u) => eligibleAssignee(assignmentUsers(), u.id));
  const list = filterInquiries(rows, { ...filters, userId: user?.id });
  const detail = rows.find((r) => String(r.id) === String(selected));
  const pages = Math.max(1, Math.ceil(list.length / 15));

  const date = (v) => {
    try {
      return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Baghdad',
      }).format(new Date(v));
    } catch {
      return String(v || '');
    }
  };

  function filter(k, v) {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  }

  async function action(permission, fn) {
    setBusy(true);
    setError('');
    try {
      assertCan(permission);
      await fn();
      await load();
    } catch (err) {
      console.error('Inquiry action failed:', err);
      setError(err?.ar || err?.message || unavailable);
    } finally {
      setBusy(false);
    }
  }

  function open(r) {
    setSelected(r.id);
    if (!r.readBy?.includes(user?.id)) {
      setRows((prev) =>
        prev.map((row) =>
          row.id === r.id ? { ...row, readBy: [...(row.readBy || []), user?.id].filter(Boolean) } : row
        )
      );
    }
  }

  return (
    <section className="inbox-page" data-no-translate>
      <header className="inbox-heading">
        <div>
          <span className="eyebrow">YAR / {t('خدمة العملاء', 'Customer Service')}</span>
          <h1>
            <Mail />
            {t('رسائل العملاء', 'Customer Inbox')}
          </h1>
        </div>
        <Button variant="outline" size="icon" aria-label={t('تحديث', 'Refresh')} onClick={load} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
        </Button>
      </header>

      {error && (
        <p role="status" className="inbox-notice" style={{ color: 'var(--c-ef4444, #ef4444)' }}>
          {error}
        </p>
      )}

      <div className="inbox-demo-label">
        <Mail size={15} />
        <span>{t('• بيانات حية ومباشرة من الخادم (API 120 / 122 / 123)', '• Live server data (API 120 / 122 / 123)')}</span>
      </div>

      <div className={`inbox-workspace ${detail ? 'has-detail' : ''}`}>
        <nav className="inbox-folders" aria-label={t('مجلدات الرسائل', 'Inquiry Folders')}>
          {['all', ...INQUIRY_STATUSES].map((s) => (
            <Button
              key={s}
              variant={filters.status === s ? 'default' : 'ghost'}
              onClick={() => filter('status', s)}
            >
              <Mail size={16} />
              {s === 'all' ? t('جميع الرسائل', 'All Inquiries') : t(...statusWords[s])}
              <span>{rows.filter((r) => s === 'all' || r.status === s).length}</span>
            </Button>
          ))}
        </nav>

        <div className="inbox-center">
          <div className="inbox-filters">
            <label className="inbox-search">
              <Search />
              <input
                type="search"
                aria-label={t('بحث الرسائل', 'Search Inquiries')}
                placeholder={t('ابحث بالعميل أو الهاتف أو المرجع', 'Search customer, phone or reference')}
                value={filters.query}
                onChange={(e) => filter('query', e.target.value)}
              />
            </label>

            <select
              aria-label={t('نوع الاستفسار', 'Inquiry Type')}
              value={filters.category}
              onChange={(e) => filter('category', e.target.value)}
            >
              <option value="all">{t('كل الأنواع', 'All Categories')}</option>
              {INQUIRY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(...categoryWords[c])}
                </option>
              ))}
            </select>

            <select
              aria-label={t('المسؤول', 'Assignee')}
              value={filters.assignee}
              onChange={(e) => filter('assignee', e.target.value)}
            >
              <option value="all">{t('كل الموظفين', 'All Staff')}</option>
              <option value="unassigned">{t('غير مسندة', 'Unassigned')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <select
              aria-label={t('القراءة', 'Read State')}
              value={filters.read}
              onChange={(e) => filter('read', e.target.value)}
            >
              {[
                ['all', 'الكل', 'All'],
                ['read', 'مقروءة', 'Read'],
                ['unread', 'غير مقروءة', 'Unread'],
              ].map(([k, a, b]) => (
                <option key={k} value={k}>
                  {t(a, b)}
                </option>
              ))}
            </select>

            <select
              aria-label={t('الترتيب', 'Sort')}
              value={filters.sort}
              onChange={(e) => filter('sort', e.target.value)}
            >
              {[
                ['newest', 'الأحدث أولًا', 'Newest First'],
                ['oldest', 'الأقدم أولًا', 'Oldest First'],
                ['updated', 'آخر تحديث', 'Recently Updated'],
              ].map(([k, a, b]) => (
                <option key={k} value={k}>
                  {t(a, b)}
                </option>
              ))}
            </select>

            <label>
              {t('من', 'From')}
              <input type="date" value={filters.from} onChange={(e) => filter('from', e.target.value)} />
            </label>
            <label>
              {t('إلى', 'Until')}
              <input type="date" value={filters.until} onChange={(e) => filter('until', e.target.value)} />
            </label>
          </div>

          <div className="inbox-list">
            {loading ? (
              <p role="status" style={{ padding: 24, textAlign: 'center' }}>
                {t('جاري تحميل الرسائل من الخادم…', 'Loading inquiries from server…')}
              </p>
            ) : list.length === 0 ? (
              <div className="inbox-empty">
                <Mail size={42} />
                <h2>{t('لا توجد رسائل متاحة', 'No Inquiries Available')}</h2>
                <p>
                  {filters.query || filters.status !== 'all' || filters.category !== 'all'
                    ? t('لا توجد نتائج مطابقة لمعايير البحث.', 'No matching inquiries for current filters.')
                    : t('لم يتم استقبال أي رسائل دعم أو استفسارات من العملاء حتى الآن.', 'No customer support inquiries received yet.')}
                </p>
              </div>
            ) : (
              list.slice((page - 1) * 15, page * 15).map((r) => (
                <Button
                  key={r.id}
                  variant="ghost"
                  className={`inquiry-row ${r.readBy?.includes(user?.id) ? '' : 'unread'} ${
                    String(selected) === String(r.id) ? 'selected' : ''
                  }`}
                  onClick={() => open(r)}
                >
                  <div className="inquiry-row-heading">
                    <span className="inquiry-avatar">{text(r, 'fullName').slice(0, 1) || 'ع'}</span>
                    <strong>{text(r, 'fullName')}</strong>
                    <span className={`inquiry-status status-${r.status}`}>
                      {statusWords[r.status] ? t(...statusWords[r.status]) : r.status}
                    </span>
                  </div>
                  <span className="inquiry-subject">{text(r, 'subject')}</span>
                  <small>{text(r, 'message')}</small>
                  <div className="inquiry-row-meta">
                    <span>{r.reference}</span>
                    <time>{date(r.createdAt)}</time>
                  </div>
                </Button>
              ))
            )}
          </div>

          <footer className="inbox-pagination">
            <span>
              {list.length} · {page}/{pages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('السابق', 'Previous')}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={t('التالي', 'Next')}
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </Button>
          </footer>
        </div>

        {detail ? (
          <aside className="inbox-detail">
            <header>
              <h2>{text(detail, 'subject')}</h2>
              <Button variant="ghost" size="icon" aria-label={t('إغلاق', 'Close')} onClick={() => setSelected(null)}>
                <X />
              </Button>
            </header>

            <strong>{text(detail, 'fullName')}</strong>
            {detail.phoneE164 && (
              <a href={`tel:${detail.phoneE164}`}>
                <Phone size={16} />
                <bdi>{detail.phoneE164}</bdi>
              </a>
            )}
            {detail.email && <p>{detail.email}</p>}
            <p>
              {detail.reference} · {date(detail.createdAt)}
            </p>
            <p>{categoryWords[detail.category] ? t(...categoryWords[detail.category]) : detail.category}</p>
            <p className="inquiry-message">{text(detail, 'message')}</p>

            <div className="inbox-detail-actions">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const hasRead = detail.readBy?.includes(user?.id);
                  setRows((prev) =>
                    prev.map((row) =>
                      row.id === detail.id
                        ? {
                            ...row,
                            readBy: hasRead
                              ? (row.readBy || []).filter((id) => id !== user?.id)
                              : [...(row.readBy || []), user?.id].filter(Boolean),
                          }
                        : row
                    )
                  );
                }}
              >
                <CheckCheck />
                {t('تغيير حالة القراءة', 'Toggle Read State')}
              </Button>

              {detail.phoneE164 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(detail.phoneE164);
                    } catch {
                      setError(t('تعذر النسخ.', 'Copy failed.'));
                    }
                  }}
                >
                  <Copy />
                  {t('نسخ الهاتف', 'Copy Phone')}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigator.clipboard.writeText(detail.reference).catch(() => setError(t('تعذر النسخ.', 'Copy failed.')))
                }
              >
                <Copy />
                {t('نسخ المرجع', 'Copy Reference')}
              </Button>

              {detail.bookingReference && (
                <Button
                  variant="link"
                  onClick={() => onNavigate('bookings', null, { bookingId: detail.bookingReference })}
                >
                  {t('فتح الحجز', 'Open Booking')}
                </Button>
              )}
            </div>

            {/* API 123: Update inquiry status */}
            <label>
              {t('الحالة', 'Status')}
              <select
                disabled={busy}
                value={detail.status}
                onChange={(e) =>
                  action('inquiry.status', async () => {
                    await inboxApi.updateInquiryStatus(detail.id, e.target.value);
                  })
                }
              >
                {INQUIRY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(...statusWords[s])}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t('المسؤول', 'Assignee')}
              <select
                disabled={busy}
                value={detail.assignedTo || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setRows((prev) =>
                    prev.map((row) => (row.id === detail.id ? { ...row, assignedTo: val } : row))
                  );
                }}
              >
                <option value="">{t('غير مسندة', 'Unassigned')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>

            {/* API 122: Internal Notes & Replies */}
            <h3>{t('ملاحظات داخلية وردود الدعم (API 122)', 'Internal Notes & Replies (API 122)')}</h3>
            {Array.isArray(detail.notes) && detail.notes.length > 0 ? (
              detail.notes.map((n) => (
                <article key={n.id || Math.random()}>
                  <strong>{n.author}</strong>
                  <time>{date(n.at)}</time>
                  <p>{n.content}</p>
                </article>
              ))
            ) : (
              <p style={{ color: 'var(--public-muted)', fontSize: 12 }}>
                {t('لا توجد ملاحظات داخلية مضافة لهذه الرسالة بعد.', 'No internal notes added to this inquiry yet.')}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!note.trim()) return;
                action('inquiry.note', async () => {
                  await inboxApi.replyToInquiry(detail.id, {
                    body: note.trim(),
                    internal: true,
                  });
                  setNote('');
                });
              }}
            >
              <textarea
                aria-label={t('ملاحظة داخلية', 'Internal Note')}
                maxLength={4000}
                required
                placeholder={t('اكتب ملاحظة داخلية أو رد دعم لحفظه على الخادم...', 'Write internal note or reply to save to server...')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
              />
              <Button disabled={busy || !note.trim()} type="submit">
                <MessageSquare />
                {busy ? t('جاري الإرسال...', 'Sending...') : t('إضافة ملاحظة على الخادم', 'Add Note to Server')}
              </Button>
            </form>

            {detail.activity && detail.activity.length > 0 && (
              <>
                <h3>{t('سجل المتابعة', 'Activity History')}</h3>
                <ol>
                  {detail.activity.map((a) => (
                    <li key={a.id}>
                      {a.actor} · {a.action} · {date(a.at)}
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        ) : (
          <aside className="inbox-detail inbox-detail-empty">
            <Mail />
            <p>{t('تفاصيل الاستفسار', 'Inquiry Details')}</p>
          </aside>
        )}
      </div>
    </section>
  );
}
