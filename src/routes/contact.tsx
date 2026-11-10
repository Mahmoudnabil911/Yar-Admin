import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
export const Route=createFileRoute('/contact')({head:()=>publicHead('contact'),component:()=> <PublicSite page="contact"/>});
