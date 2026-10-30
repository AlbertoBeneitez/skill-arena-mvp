import { useId } from "react";

/**
 * Seven-segment read-out (v122, redrawn in v124): the scoreboard digits used by the pre-game rival board and the
 * in-game HUD. Hexagonal segments with real gaps between them; unlit segments stay faintly visible like a real LED
 * panel; lit ones get a hot white core and a two-step bloom (SVG filter, so it scales with the text).
 * Presentation only; the accessible value is the plain text in `label`.
 */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
  "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "",
};
// Cell: 14 × 24 user units. Segment thickness T, gap G between neighbouring segment tips.
const L = 2.2, R = 11.8, TOP = 1.6, MID = 12, BOT = 22.4, T = 2.5, G = 0.55;
const hSeg = (x0: number, x1: number, y: number) => {
  const a = x0 + G, b = x1 - G, h = T / 2;
  return `M${a} ${y}L${a + h} ${y - h}H${b - h}L${b} ${y}L${b - h} ${y + h}H${a + h}Z`;
};
const vSeg = (x: number, y0: number, y1: number) => {
  const a = y0 + G, b = y1 - G, h = T / 2;
  return `M${x} ${a}L${x + h} ${a + h}V${b - h}L${x} ${b}L${x - h} ${b - h}V${a + h}Z`;
};
const SEG_PATH: Record<string, string> = {
  a: hSeg(L, R, TOP), g: hSeg(L, R, MID), d: hSeg(L, R, BOT),
  f: vSeg(L, TOP, MID), b: vSeg(R, TOP, MID), e: vSeg(L, MID, BOT), c: vSeg(R, MID, BOT),
};
/** Locale-independent digits with dot grouping, e.g. 270000 → "270.000" (segment panels have no other glyphs). */
export function groupDigits(n: number): string {
  const v = Math.round(n), sign = v < 0 ? "-" : "";
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const CELL_W = 14, SEP_W = 4.8, H = 24;

/** The bloom filter, exported so a grid of many read-outs (Mine Grid cells) can define it once and share it. */
export function SegmentGlowFilter({ id }: { id: string }) {
  return (
    <filter id={id} x="-20%" y="-30%" width="140%" height="160%" colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="wide" />
      <feColorMatrix in="wide" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .55 0" result="wideSoft" />
      <feGaussianBlur in="SourceGraphic" stdDeviation=".55" result="tight" />
      <feMorphology in="SourceAlpha" operator="erode" radius=".55" result="coreMask" />
      <feFlood floodColor="#ffffff" floodOpacity=".62" />
      <feComposite in2="coreMask" operator="in" result="core" />
      <feGaussianBlur in="core" stdDeviation=".3" result="coreSoft" />
      <feMerge><feMergeNode in="wideSoft" /><feMergeNode in="tight" /><feMergeNode in="SourceGraphic" /><feMergeNode in="coreSoft" /></feMerge>
    </filter>
  );
}

export default function SegmentDigits({ value, label, className, filterId, ghost = true }: {
  value: string; label?: string; className?: string;
  /** Use a filter already defined on the page (see SegmentGlowFilter) instead of embedding one. */
  filterId?: string;
  /** Draw the unlit segments (a real LED panel shows them faintly). */
  ghost?: boolean;
}) {
  const ownId = `seg${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`, fid = filterId ?? ownId;
  const off: string[] = [], on: string[] = [], dotsOn: number[] = [], colons: number[] = [];
  let x = 0;
  for (const ch of value) {
    if (ch === "." || ch === ",") { dotsOn.push(x); x += SEP_W; continue; }
    if (ch === ":") { colons.push(x); x += SEP_W; continue; }
    const lit = SEGMENTS[ch] ?? "";
    for (const [k, d] of Object.entries(SEG_PATH)) (lit.includes(k) ? on : off).push(`translate(${x} 0)|${d}`);
    x += CELL_W;
  }
  const path = (entry: string, i: number, cls: string) => {
    const [tr, d] = entry.split("|");
    return <path key={i} className={cls} transform={tr} d={d} />;
  };
  return (
    <span className={`segDigits ${className ?? ""}`} role="img" aria-label={label ?? value}>
      <svg viewBox={`-2 -1 ${x + 4} ${H + 2}`} height="1em" width={`${((x + 4) / (H + 2)).toFixed(3)}em`} aria-hidden="true" focusable="false">
        {!filterId && <defs><SegmentGlowFilter id={ownId} /></defs>}
        <g transform="skewX(-8) translate(2 0)">
          {ghost && <g className="segOffLayer">{off.map((e, i) => path(e, i, "segOff"))}</g>}
          <g className="segLitLayer" filter={`url(#${fid})`}>
            {on.map((e, i) => path(e, i, "segOn"))}
            {dotsOn.map((dx, i) => <circle key={`d${i}`} className="segOn" cx={dx + 1.9} cy={BOT} r={1.35} />)}
            {colons.flatMap((dx, i) => [7, 17].map((cy) => <circle key={`c${i}-${cy}`} className="segOn" cx={dx + 2.2} cy={cy} r={1.4} />))}
          </g>
        </g>
      </svg>
    </span>
  );
}
