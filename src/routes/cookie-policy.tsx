import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/cookie-policy')({head:()=>publicHead('cookie-policy'),component:()=> <PublicSite page="cookie-policy"/>});
