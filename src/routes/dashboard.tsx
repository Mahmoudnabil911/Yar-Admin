import {createFileRoute} from '@tanstack/react-router';
import {YarApp} from '@/components/YarApp';
export const Route=createFileRoute('/dashboard')({head:()=>({meta:[{title:'YAR | Operations Dashboard'},{name:'description',content:'YAR staff travel operations dashboard.'},{property:'og:title',content:'YAR | Operations Dashboard'},{property:'og:description',content:'YAR staff travel operations dashboard.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),component:YarApp});
