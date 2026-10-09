import { useId } from "react";
/** Original vector insignia: orbital G, illuminated facets and a satellite. */
export default function GalacticMark({
  className = "",
}: {
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 128 128"
      role="img"
      aria-label="GALACTIC GAMES"
    >
      <defs>
        <radialGradient id={`${id}-space`} cx="35%" cy="25%" r="80%">
          <stop stopColor="#294865" />
          <stop offset="1" stopColor="#071525" />
        </radialGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#edfffc" />
          <stop offset=".45" stopColor="#9bf2e1" />
          <stop offset="1" stopColor="#4e98b7" />
        </linearGradient>
        <linearGradient id={`${id}-orbit`}>
          <stop stopColor="#66739f" />
          <stop offset=".5" stopColor="#c7b7ef" />
          <stop offset="1" stopColor="#99e5e3" />
        </linearGradient>
      </defs>
      <circle
        cx="64"
        cy="64"
        r="49"
        fill={`url(#${id}-space)`}
        stroke="#48687d"
      />
      <circle
        cx="64"
        cy="64"
        r="44"
        fill="none"
        stroke="#6899a8"
        strokeOpacity=".3"
        strokeDasharray="3 8"
      />
      <ellipse
        cx="64"
        cy="64"
        rx="59"
        ry="22"
        transform="rotate(-32 64 64)"
        fill="none"
        stroke={`url(#${id}-orbit)`}
        strokeWidth="3"
      />
      <path
        d="M89 42a33 33 0 1 0 6 37V59H63v13h19a20 20 0 1 1-2-20z"
        fill={`url(#${id}-metal)`}
      />
      <path
        d="M36 83a34 34 0 0 0 44 15"
        fill="none"
        stroke="#e0fffb"
        strokeOpacity=".5"
        strokeWidth="1.5"
      />
      <path
        d="M14 91c19 2 58-11 94-42"
        fill="none"
        stroke="#b2d9ec"
        strokeWidth="2.5"
      />
      <circle
        cx="110"
        cy="37"
        r="6"
        fill="#f5d69d"
        stroke="#fff1cf"
        strokeWidth="1.5"
      />
      <path d="m26 24 2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#d9f8fa" />
      <circle cx="91" cy="109" r="2" fill="#b2c2e9" />
    </svg>
  );
}
