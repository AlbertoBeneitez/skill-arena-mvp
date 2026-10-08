/** Original orbital G; no external logo or artwork. */
export default function GalacticMark({className=''}:{className?:string}) {
 return <svg className={className} viewBox="0 0 64 64" role="img" aria-label="GALACTIC GAMES">
 <circle cx="32" cy="32" r="25" fill="#10263c"/>
 <path d="M46 21a18 18 0 1 0 4 19V31H32v7h10a11 11 0 1 1-1-12z" fill="#93ebe7"/>
 <ellipse cx="32" cy="32" rx="29" ry="11" transform="rotate(-34 32 32)" fill="none" stroke="#b9abed" strokeWidth="2"/>
 <circle cx="55" cy="18" r="3" fill="#f5db91"/>
 </svg>;
}
