import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/terms')({head:()=>publicHead('terms'),component:()=> <PublicSite page="terms"/>});
