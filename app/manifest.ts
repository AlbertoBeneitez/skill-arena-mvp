import type { MetadataRoute } from 'next';
import { PRODUCT_NAME,PRODUCT_DESCRIPTION } from '@/lib/productIdentity';
export default function manifest():MetadataRoute.Manifest {
 return {name:PRODUCT_NAME,short_name:'Galactic Games',description:PRODUCT_DESCRIPTION,start_url:'/',scope:'/',display:'standalone',background_color:'#081522',theme_color:'#081522',lang:'es',orientation:'any',categories:['games','entertainment'],icons:[{src:'/icon-192.png?v=125',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icon-512.png?v=125',sizes:'512x512',type:'image/png',purpose:'any'},{src:'/icon-maskable-512.png?v=125',sizes:'512x512',type:'image/png',purpose:'maskable'}]};
}
