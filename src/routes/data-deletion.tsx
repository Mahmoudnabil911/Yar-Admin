import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/data-deletion')({head:()=>publicHead('data-deletion'),component:()=> <PublicSite page="data-deletion"/>});
