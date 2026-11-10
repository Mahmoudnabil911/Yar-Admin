import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/refund-policy')({head:()=>publicHead('refund-policy'),component:()=> <PublicSite page="refund-policy"/>});
