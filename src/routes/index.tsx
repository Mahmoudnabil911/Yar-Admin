import {createFileRoute} from '@tanstack/react-router';
import PublicSite,{publicHead} from '@/public-site/PublicSite';
import {YarApp} from '@/components/YarApp';
export const Route=createFileRoute('/')({head:()=>publicHead('home'),validateSearch:(input:Record<string,unknown>):{page?:string}=>({...(typeof input['page']==='string'?{page:input['page']}:{})}),component:Home});
function Home(){const {page}=Route.useSearch();return page?<YarApp/>:<PublicSite/>;}
