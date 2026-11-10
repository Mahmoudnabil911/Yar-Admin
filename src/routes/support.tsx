import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/support')({head:()=>publicHead('support'),component:()=> <PublicSite page="support"/>});
