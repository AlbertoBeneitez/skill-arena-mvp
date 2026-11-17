"use client";
/**
 * v179 · Replaces the phone-only gate. Phones and tablets get the app directly (mobile platform). A computer gets the
 * same app inside a phone-sized frame on this origin, marked as the desktop platform, so it looks and behaves the same
 * but competes only against computers (lib/platform.ts). Inside that frame the app renders normally.
 * v213: nothing is written beside the frame (owner request).
 */
import MaintenanceGate from "./MaintenanceGate";
import { useEffect, useState, type ReactNode } from "react";
import { PLATFORM_PARAM, isFramed, isPhoneLikeDevice } from "@/lib/platform";
import { installMouseDragScroll } from "./mouseDragScroll";

export default function PlatformShell({ children }: { children: ReactNode }) {
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  // v182: inside the desktop frame the mouse drags horizontal strips, like a swipe on a phone.
  useEffect(() => (isFramed() ? installMouseDragScroll() : undefined), []);
  useEffect(() => {
    if (isFramed()) return;
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    if (isPhoneLikeDevice(navigator, coarse)) return;
    const url = new URL(window.location.href);
    url.searchParams.set(PLATFORM_PARAM, "desktop");
    setFrameSrc(url.pathname + url.search + url.hash);
  }, []);
  if (!frameSrc) return <>{children}<MaintenanceGate /></>;
  return (
    <main className="deskStage">
      <iframe className="deskFrame" src={frameSrc} title="GALACTIC GAMES" allow="fullscreen; autoplay; clipboard-write; web-share" />
    </main>
  );
}
