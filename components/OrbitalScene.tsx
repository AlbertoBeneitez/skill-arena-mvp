"use client";
/**
 * The GALACTIC GAMES stage (v121): one hand-built vector world shared by every screen, so the
 * welcome, the avatar setup and the catalogue read as one continuous camera move.
 *
 * World: 390 × 1700 units. v134: a close-up of a ringed gas giant filling the top of the welcome screen, lit from
 * behind on the left so only its crescent and atmosphere glow against the black (pre-rendered, physically lit), a
 * smoky sky and a seeded starfield. Each screen only changes the camera height (`variant`), and the camera move is a
 * single composited transform, so nothing repaints while the player scrolls.
 */
import { useId } from "react";
import { preload } from "react-dom";

export type OrbitalVariant = "welcome" | "avatar" | "catalog";

const W = 390, H = 1700;
const PX = 410, PY = 150, PR = 300; // planet centre and radius (scripts/render-saturn-hero.py)

/** mulberry32: tiny seeded PRNG so the sky is identical on server and client. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; o: number; c: string };
const STARS: Star[] = (() => {
  const rand = rng(121);
  const out: Star[] = [];
  while (out.length < 300) {
    const x = rand() * W, y = rand() * H;
    const k = rand(), hue = rand();
    if (Math.hypot(x - PX, y - PY) < PR + 6) continue;
    out.push({
      x: +x.toFixed(1), y: +y.toFixed(1),
      r: +(0.35 + k * k * k * 1.15).toFixed(2),
      o: +(0.3 + rand() * 0.6).toFixed(2),
      c: hue < 0.8 ? "#e8f0fb" : hue < 0.92 ? "#bff1f6" : "#f4dcaa",
    });
  }
  return out;
})();
/** A few bright stars get a four-point diffraction flare. */
const FLARES = [
  { x: 54, y: 92, s: 1.25 }, { x: 352, y: 612, s: 0.8 }, { x: 36, y: 668, s: 0.9 },
  { x: 196, y: 38, s: 0.6 }, { x: 318, y: 968, s: 0.75 }, { x: 88, y: 1120, s: 0.65 },
  { x: 140, y: 470, s: 0.55 },
];

export default function OrbitalScene({ variant }: { variant: OrbitalVariant }) {
  const id = useId().replace(/:/g, "");
  preload("/art/saturn-hero.webp?v=134", { as: "image", fetchPriority: "high" });
  preload("/art/stage-nebula.webp?v=132", { as: "image" });
  const u = (name: string) => `url(#${id}${name})`;
  return (
    <div className={`orbitalScene orbital-${variant}`} aria-hidden="true">
      <svg className="orbitalWorld" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice" focusable="false">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#131315" />
            <stop offset=".45" stopColor="#0f0f11" />
            <stop offset="1" stopColor="#09090b" />
          </linearGradient>
          <radialGradient id={`${id}sun`}><stop offset="0" stopColor="#fffaf0" /><stop offset=".08" stopColor="#ffe9bf" stopOpacity=".9" /><stop offset=".3" stopColor="#e9c27a" stopOpacity=".22" /><stop offset="1" stopColor="#e9c27a" stopOpacity="0" /></radialGradient>
        </defs>

        {/* Sky: a pre-rendered nebula (scripts/render-saturn-hero.py), with the sun's core on top */}
        <rect width={W} height={H} fill={u("sky")} />
        <image href="/art/stage-nebula.webp?v=132" x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
        <circle cx="26" cy="44" r="38" fill={u("sun")} />

        <g className="orbitalStars">
          {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.o} />)}
          {FLARES.map((f, i) => (
            <g key={`f${i}`} transform={`translate(${f.x} ${f.y}) scale(${f.s})`}>
              <path d="M0 -9 L1.1 -1.1 L9 0 L1.1 1.1 L0 9 L-1.1 1.1 L-9 0 L-1.1 -1.1Z" fill="#eaf8ff" opacity=".85" />
              <circle r="1.7" fill="#fff" />
            </g>
          ))}
        </g>

        {/* Planet and rings: a physically lit render (scripts/render-saturn-hero.py) covering x −20…400, y 0…520 */}
        <image href="/art/saturn-hero.webp?v=134" x="-20" y="0" width="420" height="520" preserveAspectRatio="none" />

      </svg>
      <div className="orbitalVeil" />
    </div>
  );
}
