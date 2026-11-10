import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/about')({head:()=>publicHead('about'),component:()=> <PublicSite page="about"/>});
