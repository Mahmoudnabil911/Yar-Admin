import React,{useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Mail,ArrowUpRight} from 'lucide-react';
import {useWords} from '../accounts/AccountUI';
import {mockInboxService as inboxService} from './mockService';
import './inbox.css';
export default function OverviewWidget({onNavigate}){const t=useWords();const[counts,setCounts]=useState(null);useEffect(()=>{inboxService.summary().then(setCounts).catch(()=>setCounts(null));},[]);return <section className="inquiry-overview" data-no-translate><div><h2><Mail size={18}/> {t('رسائل العملاء','Customer Inquiries')}</h2>{counts?<p>{t('جديدة','New')}: {counts.new} · {t('قيد المتابعة','In Progress')}: {counts.in_progress} · {t('بانتظار العميل','Waiting')}: {counts.waiting_for_customer} · {t('تم الحل','Resolved')}: {counts.resolved}</p>:null}</div><Button variant="outline" onClick={()=>onNavigate('inbox')}><Mail/>{t('عرض رسائل العملاء','Open Customer Inbox')}<ArrowUpRight/></Button></section>;}