/**
 * Seven-segment read-out (v122): the scoreboard digits used by the pre-game rival board and the
 * in-game score. Unlit segments stay faintly visible, like a real LED panel; separators are dots.
 * Presentation only; the accessible value is the plain text in `label`.
 */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd",
  "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg", "-": "g", " ": "",
};
// Segment polygons in a 12 × 20 cell (slanted at draw time).
const SEG_PATH: Record<string, string> = {
  a: "M2.6 0.6 H9.4 L7.9 3 H4.1 Z",
  b: "M10 1.2 L10 9.2 L8.8 10 L7.6 9 L7.6 3.4 Z",
  c: "M10 10.8 L10 18.8 L7.6 16.6 L7.6 11 L8.8 10 Z",
  d: "M2.6 19.4 H9.4 L7.9 17 H4.1 Z",
  e: "M2 10.8 L2 18.8 L4.4 16.6 L4.4 11 L3.2 10 Z",
  f: "M2 1.2 L2 9.2 L3.2 10 L4.4 9 L4.4 3.4 Z",
  g: "M3 10 L4.3 8.8 H7.7 L9 10 L7.7 11.2 H4.3 Z",
};
/** Locale-independent digits with dot grouping, e.g. 270000 → "270.000" (segment panels have no other glyphs). */
export function groupDigits(n: number): string {
  const v = Math.round(n), sign = v < 0 ? "-" : "";
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const CELL_W = 12, SEP_W = 5, H = 20;

export default function SegmentDigits({ value, label, className }: { value: string; label?: string; className?: string }) {
  const chars = [...value];
  let x = 0;
  const parts = chars.map((ch, i) => {
    const at = x;
    if (ch === "." || ch === ",") {
      x += SEP_W;
      return <rect key={i} className="segOn" x={at + 1.2} y={17.4} width={2.2} height={2.2} rx={0.4} />;
    }
    x += CELL_W;
    const lit = SEGMENTS[ch] ?? "";
    return (
      <g key={i} transform={`translate(${at} 0)`}>
        {Object.entries(SEG_PATH).map(([k, d]) => <path key={k} d={d} className={lit.includes(k) ? "segOn" : "segOff"} />)}
      </g>
    );
  });
  return (
    <span className={`segDigits ${className ?? ""}`} role="img" aria-label={label ?? value}>
      <svg viewBox={`-1 0 ${x + 2} ${H}`} height="1em" width={`${((x + 2) / H).toFixed(3)}em`} aria-hidden="true" focusable="false">
        <g transform="skewX(-7) translate(1.4 0)">{parts}</g>
      </svg>
    </span>
  );
}
