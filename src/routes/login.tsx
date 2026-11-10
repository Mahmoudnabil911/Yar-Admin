import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/login')({head:()=>publicHead('login'),component:()=> <PublicSite page="login"/>});
