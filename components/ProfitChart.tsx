"use client";
import { useId } from "react";

/** Reproducible path from 0 to the final profit for example pilots (presentation only). */
export function profitSeries(playerId: string, netMinor: string, points = 28): number[] {
  let seed = 2166136261 >>> 0;
  for (const ch of playerId) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rnd = () => {
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >>> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 4294967296;
  };
  const end = Number(netMinor) / 100 || 0;
  const scale = Math.max(Math.abs(end), 10);
  // Random walk, then pinned so that it starts at 0 and finishes exactly at the net profit.
  const walk = [0];
  for (let i = 1; i < points; i++) walk.push(walk[i - 1] + (rnd() - 0.46) * scale * 0.35);
  const drift = walk[points - 1];
  return walk.map((v, i) => v - (drift * i) / (points - 1) + (end * i) / (points - 1));
}

export default function ProfitChart({
  values,
  height = 36,
  width = 96,
  detailed = false,
  label,
}: {
  values: number[];
  height?: number;
  width?: number;
  detailed?: boolean;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  const min = Math.min(0, ...values),
    max = Math.max(0, ...values),
    span = max - min || 1,
    pad = detailed ? 18 : 3,
    x = (i: number) => pad + (i * (width - pad * 2)) / (values.length - 1),
    y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2),
    d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" "),
    up = values[values.length - 1] >= 0,
    colour = up ? "#6fe3b4" : "#ff8aa0",
    zero = y(0);
  return (
    <svg className="profitChart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={colour} stopOpacity=".4" />
          <stop offset="1" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={pad} x2={width - pad} y1={zero} y2={zero} stroke="rgba(190,220,240,.28)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={`${d} L${x(values.length - 1)} ${zero} L${x(0)} ${zero} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={colour} strokeWidth={detailed ? 2.2 : 1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={detailed ? 3.2 : 2.4} fill={colour} />
    </svg>
  );
}
