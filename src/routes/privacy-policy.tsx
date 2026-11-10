import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/privacy-policy')({head:()=>publicHead('privacy-policy'),component:()=> <PublicSite page="privacy-policy"/>});
