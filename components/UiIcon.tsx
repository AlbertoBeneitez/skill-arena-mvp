/**
 * GALACTIC GAMES interface glyphs (v121). One drawing system for every chrome button:
 * 24-unit grid, 1.8 stroke, round caps and joins, optical centre at (12, 12).
 * Original drawings; no emoji or third-party icon set.
 */
import type { ReactNode } from "react";

export type UiIconName =
  | "sound" | "soundOff" | "gear" | "back" | "close" | "upload" | "grid" | "ghost"
  | "games" | "group" | "trophy" | "check" | "chevronDown" | "logout" | "trash";

/** Eight-tooth gear, computed once (pure math, identical on server and client). */
const GEAR_PATH = (() => {
  const cx = 12, cy = 12, outer = 9.6, root = 7.2;
  const pt = (r: number, deg: number) => {
    const a = (deg - 90) * Math.PI / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  let d = "";
  for (let i = 0; i < 8; i++) {
    const base = i * 45;
    d += `${i === 0 ? "M" : "L"}${pt(root, base - 13)} L${pt(outer, base - 8)} L${pt(outer, base + 8)} L${pt(root, base + 13)} `;
    d += `A${root} ${root} 0 0 1 ${pt(root, base + 32)} `;
  }
  return d + "Z";
})();

const PATHS: Record<UiIconName, ReactNode> = {
  sound: (<>
    <path d="M3.6 9.3h3.3L12 5.2v13.6l-5.1-4.1H3.6z" />
    <path d="M15.6 9.3a3.9 3.9 0 0 1 0 5.4" />
    <path d="M18.2 6.7a7.6 7.6 0 0 1 0 10.6" />
  </>),
  soundOff: (<>
    <path d="M3.6 9.3h3.3L12 5.2v13.6l-5.1-4.1H3.6z" />
    <path d="m16 9.6 4.8 4.8M20.8 9.6 16 14.4" />
  </>),
  gear: (<>
    <path d={GEAR_PATH} />
    <circle cx="12" cy="12" r="3.1" />
  </>),
  back: (<>
    <path d="M19.5 12H5" />
    <path d="M11 5.6 4.6 12l6.4 6.4" />
  </>),
  close: <path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" />,
  upload: (<>
    <path d="M20 13.6v4.6a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 18.2V5.8A1.8 1.8 0 0 1 5.8 4h5" />
    <path d="m4.4 17 4.4-4.4 3.4 3.4 2.1-2.1L19.6 19" />
    <path d="M17.4 10.4V3.2M14.4 6.2l3-3 3 3" />
  </>),
  grid: (<>
    <rect x="4" y="4" width="6.6" height="6.6" rx="1.8" />
    <rect x="13.4" y="4" width="6.6" height="6.6" rx="1.8" />
    <rect x="4" y="13.4" width="6.6" height="6.6" rx="1.8" />
    <rect x="13.4" y="13.4" width="6.6" height="6.6" rx="1.8" />
  </>),
  ghost: (<>
    <path d="M5.6 20.4V11a6.4 6.4 0 0 1 12.8 0v9.4l-2.15-1.55-2.1 1.55L12 18.85l-2.15 1.55-2.1-1.55z" />
    <circle cx="9.7" cy="11.2" r=".9" fill="currentColor" stroke="none" />
    <circle cx="14.3" cy="11.2" r=".9" fill="currentColor" stroke="none" />
  </>),
  games: (<>
    <path d="M7.6 7.8h8.8a4.6 4.6 0 0 1 4.5 5.6l-.75 3.3a2.4 2.4 0 0 1-4.05 1.15L13.8 15.6h-3.6l-2.3 2.25a2.4 2.4 0 0 1-4.05-1.15l-.75-3.3A4.6 4.6 0 0 1 7.6 7.8z" />
    <path d="M8.2 10.6v3.2M6.6 12.2h3.2" />
    <circle cx="15.6" cy="11.3" r=".95" fill="currentColor" stroke="none" />
    <circle cx="17.4" cy="13.2" r=".95" fill="currentColor" stroke="none" />
  </>),
  group: (<>
    <circle cx="9.2" cy="8.6" r="3.1" />
    <path d="M3.4 19.2a5.8 5.8 0 0 1 11.6 0" />
    <circle cx="16.8" cy="9.4" r="2.4" />
    <path d="M16.2 14.1a4.7 4.7 0 0 1 4.6 5.1" />
  </>),
  trophy: (<>
    <path d="M7.8 4.2h8.4v4.6a4.2 4.2 0 0 1-8.4 0z" />
    <path d="M7.8 5.6H5.2a2.6 2.6 0 0 0 2.9 3.6M16.2 5.6h2.6a2.6 2.6 0 0 1-2.9 3.6" />
    <path d="M12 13v3.4M8.6 19.8h6.8M9.8 16.4h4.4l.6 3.4H9.2z" />
  </>),
  check: <path d="m5.2 12.6 4.4 4.4 9.2-9.6" />,
  chevronDown: <path d="m6.4 9.4 5.6 5.6 5.6-5.6" />,
  logout: (<>
    <path d="M10 4.2H6a1.8 1.8 0 0 0-1.8 1.8v12a1.8 1.8 0 0 0 1.8 1.8h4" />
    <path d="M14.6 7.6 19 12l-4.4 4.4M19 12H9.4" />
  </>),
  trash: (<>
    <path d="M4.6 6.8h14.8M9.6 6.6V4.8h4.8v1.8" />
    <path d="m6.4 6.8.8 11.6a1.8 1.8 0 0 0 1.8 1.6h6a1.8 1.8 0 0 0 1.8-1.6l.8-11.6" />
    <path d="M10.2 10.6v5.6M13.8 10.6v5.6" />
  </>),
};

export default function UiIcon({ name, size = 22, className, mirrorRtl = false }: {
  name: UiIconName;
  size?: number;
  className?: string;
  /** Direction glyphs (back) flip in right-to-left languages. */
  mirrorRtl?: boolean;
}) {
  return (
    <svg
      className={`uiIcon ${mirrorRtl ? "uiIconDir" : ""} ${className ?? ""}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
