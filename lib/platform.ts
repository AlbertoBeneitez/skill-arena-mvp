/**
 * v179 · Two platforms, the same app: phones (and tablets) play against phones, computers against computers. The
 * platform splits the competitive pools (public matches, groups, rankings) and is sent with every durable start.
 *
 * Detection is client-side (user agent, touch, pointer) and so can be spoofed by someone who emulates a phone on a
 * computer; the server replays every match regardless, and this only decides who plays whom. A computer shows the
 * app inside a phone-sized frame (components/PlatformShell.tsx), which tells the app it is the desktop platform.
 */
export type Platform = "mobile" | "desktop";
export const PLATFORMS: readonly Platform[] = ["mobile", "desktop"];
export const isPlatform = (v: unknown): v is Platform => v === "mobile" || v === "desktop";
export const PLATFORM_PARAM = "platform";
const KEY = "gg.platform";

/** Phones and tablets: a mobile user agent, or (iPadOS, which reports a desktop Safari) a touch screen whose primary
 * pointer is coarse. */
export function isPhoneLikeDevice(nav: Pick<Navigator, "userAgent" | "maxTouchPoints">, coarsePointer: boolean) {
  const ua = nav.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(ua)) return true;
  return (nav.maxTouchPoints ?? 0) > 0 && coarsePointer;
}

/** True inside the desktop frame (the app embedded by PlatformShell on the same origin). */
export function isFramed() {
  try { return typeof window !== "undefined" && window.self !== window.top; } catch { return true; }
}

/** The platform this app instance plays on (client only; "mobile" during server rendering). */
export function currentPlatform(): Platform {
  if (typeof window === "undefined") return "mobile";
  if (isFramed()) {
    const asked = new URLSearchParams(window.location.search).get(PLATFORM_PARAM);
    try {
      if (isPlatform(asked)) sessionStorage.setItem(KEY, asked);
      const kept = sessionStorage.getItem(KEY);
      if (isPlatform(kept)) return kept;
    } catch { /* storage may be blocked: fall back to the request */ }
    return isPlatform(asked) ? asked : "desktop";
  }
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return isPhoneLikeDevice(navigator, coarse) ? "mobile" : "desktop";
}

/** Group codes carry their platform (v179): 8 characters, the first M (mobile) or D (desktop). Older 7-character codes
 * have none and are accepted anywhere. */
export const platformLetter = (p: Platform) => (p === "desktop" ? "D" : "M");
export function codePlatform(code: string): Platform | null {
  const c = code.trim().toUpperCase();
  if (c.length !== 8) return null;
  return c[0] === "D" ? "desktop" : c[0] === "M" ? "mobile" : null;
}

/** Navigates the whole window (not the desktop frame): sign-in pages refuse to be framed. */
export function assignTop(url: string) {
  try { (window.top ?? window).location.assign(url); } catch { window.location.assign(url); }
}
