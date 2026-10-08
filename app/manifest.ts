import type { MetadataRoute } from 'next';
import { PRODUCT_NAME,PRODUCT_DESCRIPTION } from '@/lib/productIdentity';
export default function manifest():MetadataRoute.Manifest {
 return {name:PRODUCT_NAME,short_name:'Galactic Games',description:PRODUCT_DESCRIPTION,start_url:'/',scope:'/',display:'standalone',background_color:'#081522',theme_color:'#081522',lang:'es',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]};
}
