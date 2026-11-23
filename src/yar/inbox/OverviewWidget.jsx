import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, ArrowUpRight } from 'lucide-react';
import { useWords } from '../accounts/AccountUI';
import { inboxApi } from '../services/api/inboxApi';
import { INQUIRY_STATUSES } from './service';
import './inbox.css';

export default function OverviewWidget({ onNavigate }) {
  const t = useWords();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let active = true;
    inboxApi.getInquiries()
      .then((res) => {
        if (!active) return;
        const items = res?.items || [];
        const summary = Object.fromEntries(
          INQUIRY_STATUSES.map((s) => [s, items.filter((r) => r.status === s).length])
        );
        setCounts(summary);
      })
      .catch(() => {
        if (active) setCounts(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="inquiry-overview" data-no-translate>
      <div>
        <h2>
          <Mail size={18} /> {t('رسائل العملاء', 'Customer Inquiries')}
        </h2>
        {counts ? (
          <p>
            {t('جديدة', 'New')}: {counts.new || 0} · {t('قيد المتابعة', 'In Progress')}: {counts.in_progress || 0} ·{' '}
            {t('بانتظار العميل', 'Waiting')}: {counts.waiting_for_customer || 0} · {t('تم الحل', 'Resolved')}:{' '}
            {counts.resolved || 0}
          </p>
        ) : null}
      </div>
      <Button variant="outline" onClick={() => onNavigate('inbox')}>
        <Mail />
        {t('عرض رسائل العملاء', 'Open Customer Inbox')}
        <ArrowUpRight />
      </Button>
    </section>
  );
}
