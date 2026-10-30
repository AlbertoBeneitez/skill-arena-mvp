"use client";
/**
 * The GALACTIC GAMES stage (v121): one hand-built vector world shared by every screen, so the
 * welcome, the avatar setup and the catalogue read as one continuous camera move.
 *
 * World: 390 × 1700 units. A ringed gas giant lit from the upper left (pre-rendered, physically lit), a nebula,
 * a seeded starfield and an orbit carrying three tiny game "moons" (an eight ball, a chip and a
 * dart). Each screen only changes the camera height (`variant`), and the camera move is a single
 * composited transform, so nothing repaints while the player scrolls.
 */
import { useId } from "react";
import { preload } from "react-dom";

export type OrbitalVariant = "welcome" | "avatar" | "catalog";

const W = 390, H = 1700;
const PX = 282, PY = 300, PR = 128; // planet centre and radius
const TILT = -17;                    // ring plane, degrees

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


/** Point on the local (unrotated) orbit ellipse, then rotated into world space. */
function orbitPoint(rx: number, ry: number, deg: number) {
  const t = (deg * Math.PI) / 180, a = (TILT * Math.PI) / 180;
  const x = rx * Math.cos(t), y = ry * Math.sin(t);
  return { x: PX + x * Math.cos(a) - y * Math.sin(a), y: PY + x * Math.sin(a) + y * Math.cos(a), tangent: TILT + (Math.atan2(ry * Math.cos(t), -rx * Math.sin(t)) * 180) / Math.PI };
}
const ORBIT = { rx: 336, ry: 118 };
const MOON_BALL = orbitPoint(ORBIT.rx, ORBIT.ry, 116);
const MOON_CHIP = orbitPoint(ORBIT.rx, ORBIT.ry, 96);
const MOON_DART = orbitPoint(ORBIT.rx, ORBIT.ry, 138);

export default function OrbitalScene({ variant }: { variant: OrbitalVariant }) {
  const id = useId().replace(/:/g, "");
  preload("/art/saturn-hero.webp?v=123", { as: "image", fetchPriority: "high" });
  preload("/art/stage-nebula.webp?v=123", { as: "image" });
  const u = (name: string) => `url(#${id}${name})`;
  return (
    <div className={`orbitalScene orbital-${variant}`} aria-hidden="true">
      <svg className="orbitalWorld" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice" focusable="false">
        <defs>
          <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b1630" />
            <stop offset=".45" stopColor="#081128" />
            <stop offset="1" stopColor="#050a1a" />
          </linearGradient>
          <radialGradient id={`${id}sun`}><stop offset="0" stopColor="#fffaf0" /><stop offset=".08" stopColor="#ffe9bf" stopOpacity=".9" /><stop offset=".3" stopColor="#e9c27a" stopOpacity=".22" /><stop offset="1" stopColor="#e9c27a" stopOpacity="0" /></radialGradient>
          <radialGradient id={`${id}ball`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#5b6680" /><stop offset=".5" stopColor="#151b2a" /><stop offset="1" stopColor="#03050b" /></radialGradient>
          <radialGradient id={`${id}chip`} cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#ffe7b0" /><stop offset=".6" stopColor="#e9c27a" /><stop offset="1" stopColor="#9b7136" /></radialGradient>
          <radialGradient id={`${id}moonGlow`}><stop offset="0" stopColor="#7fe3ee" stopOpacity=".45" /><stop offset="1" stopColor="#7fe3ee" stopOpacity="0" /></radialGradient>
        </defs>

        {/* Sky: a pre-rendered nebula (scripts/render-saturn-hero.py), with the sun's core on top */}
        <rect width={W} height={H} fill={u("sky")} />
        <image href="/art/stage-nebula.webp?v=123" x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
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

        {/* Outer orbit (behind everything planetary) */}
        <g transform={`translate(${PX} ${PY}) rotate(${TILT})`}>
          <ellipse rx={ORBIT.rx + 170} ry={ORBIT.ry + 70} fill="none" stroke="#8c7bff" strokeOpacity=".16" strokeWidth=".8" />
          <ellipse rx={ORBIT.rx} ry={ORBIT.ry} fill="none" stroke="#7fe3ee" strokeOpacity=".3" strokeWidth=".9" strokeDasharray="1.5 6" strokeLinecap="round" />
        </g>

        {/* Planet and rings: a physically lit render (scripts/render-saturn-hero.py) covering x −20…400, y 150…452 */}
        <image href="/art/saturn-hero.webp?v=123" x="-20" y="150" width="420" height="302" preserveAspectRatio="none" />

        {/* Game moons riding the orbit */}
        <g className="orbitalMoons">
          <g transform={`translate(${MOON_BALL.x.toFixed(1)} ${MOON_BALL.y.toFixed(1)})`}>
            <circle r="18" fill={u("moonGlow")} />
            <circle r="8.5" fill={u("ball")} stroke="#9fb4d4" strokeOpacity=".35" strokeWidth=".6" />
            <circle cx="-1.6" cy="-1.8" r="3.6" fill="#f4f7fb" />
            <text x="-1.6" y="-0.4" textAnchor="middle" fontSize="4.4" fontWeight="800" fill="#0b0f1a" fontFamily="system-ui, sans-serif">8</text>
          </g>
          <g transform={`translate(${MOON_CHIP.x.toFixed(1)} ${MOON_CHIP.y.toFixed(1)}) rotate(-12)`}>
            <circle r="16" fill={u("moonGlow")} opacity=".8" />
            <ellipse rx="8.6" ry="7.4" fill={u("chip")} stroke="#fff1cf" strokeOpacity=".6" strokeWidth=".6" />
            <ellipse rx="5.2" ry="4.4" fill="none" stroke="#fffaf0" strokeWidth="1.4" strokeDasharray="2 1.6" />
            <ellipse rx="2.6" ry="2.2" fill="#b98a46" />
          </g>
          <g transform={`translate(${MOON_DART.x.toFixed(1)} ${MOON_DART.y.toFixed(1)}) rotate(${(MOON_DART.tangent + 180).toFixed(1)})`}>
            <circle r="15" fill={u("moonGlow")} opacity=".7" />
            <path d="M-11 0 H7" stroke="#dfe9f6" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M7 -1.6 L12 0 L7 1.6Z" fill="#f4f7fb" />
            <path d="M-11 0 L-15 -4.2 L-8.5 -0.6Z M-11 0 L-15 4.2 L-8.5 0.6Z" fill="#7fe3ee" />
            <rect x="-2" y="-1.3" width="5" height="2.6" rx="1" fill="#e9c27a" />
          </g>
        </g>
      </svg>
      <div className="orbitalVeil" />
    </div>
  );
}
