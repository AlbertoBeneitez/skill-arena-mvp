"use client";
/**
 * v220 · The start screen's background (owner): a retro atom you can play with. Drawn on a low-resolution canvas
 * scaled up without smoothing (big pixels, like an old arcade screen), with scan lines on top (CSS).
 *
 * - The electron circles the nucleus slowly (6 s on the first orbit, up to 16 s on the fifth).
 * - Tap the background (not a button): it absorbs the energy and jumps to a higher orbit, giving off a small burst of
 *   light. Left alone, an excited electron falls back one orbit after a few seconds and the zone where it is at that
 *   moment goes darker for a while; resting on the first orbit for long, it jumps up by itself now and then.
 * - Light safety (WCAG 2.3.1): at most one burst every 0.7 s (under three a second), each small (≤ 48 px) and short;
 *   no full-screen flashing. With reduced motion the scene stays still; taps only move the electron.
 * Presentation only: no game state, nothing stored. Paused while the page is hidden.
 */
import { useEffect, useRef } from "react";

const PIX = 3; // CSS pixels per canvas pixel
const ORBITS = 5;
const PERIOD_S = (n: number) => 6 + 2.5 * (n - 1);
const TILT = -0.32; // radians
const SQUASH = 0.5; // ellipse height / width: the orbits are seen at an angle
const MIN_BURST_GAP = 700;
const JUMP_MS = 480;

type Burst = { x: number; y: number; t0: number };
type Shade = { x: number; y: number; t0: number };

export default function AtomScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "1";

    let w = 0, h = 0, cx = 0, cy = 0, unit = 0;
    let stars: { x: number; y: number; b: number; p: number }[] = [];
    const resize = () => {
      w = Math.max(1, Math.ceil(window.innerWidth / PIX));
      h = Math.max(1, Math.ceil(window.innerHeight / PIX));
      canvas.width = w; canvas.height = h;
      cx = w / 2; cy = h * 0.31;
      unit = Math.min(w * 0.92, h * 0.62) / 2; // outer orbit's half-width
      // Presentation only (Math.random is fine): a pixel starfield.
      stars = Array.from({ length: Math.round((w * h) / 260) }, () => ({ x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h), b: 0.25 + Math.random() * 0.6, p: Math.random() * 6.28 }));
    };
    resize();
    const onResize = () => { resize(); if (reduce) draw(performance.now()); };
    window.addEventListener("resize", onResize);

    const radius = (n: number) => unit * (0.24 + 0.76 * ((n - 1) / (ORBITS - 1)) ** 0.85);
    const point = (r: number, a: number) => {
      const ex = Math.cos(a) * r, ey = Math.sin(a) * r * SQUASH;
      return { x: cx + ex * Math.cos(TILT) - ey * Math.sin(TILT), y: cy + ex * Math.sin(TILT) + ey * Math.cos(TILT) };
    };

    // Electron state.
    let level = 2, from = 2, jumpAt = -1e9, angle = Math.random() * Math.PI * 2;
    let nextFall = Infinity, idleSince = performance.now(), lastBurst = -1e9;
    const bursts: Burst[] = [];
    const shades: Shade[] = [];
    const trail: { x: number; y: number }[] = [];
    const scheduleFall = (now: number) => { nextFall = level > 1 ? now + 3500 + Math.random() * 3500 : Infinity; };

    const currentRadius = (now: number) => {
      const k = Math.min(1, (now - jumpAt) / JUMP_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      return radius(from) + (radius(level) - radius(from)) * e;
    };
    const jump = (to: number, now: number) => {
      to = Math.max(1, Math.min(ORBITS, to));
      if (to === level) return;
      const r = currentRadius(now), here = point(r, angle);
      from = level; level = to; jumpAt = now;
      if (to > from) {
        if (!reduce && now - lastBurst >= MIN_BURST_GAP) { bursts.push({ x: here.x, y: here.y, t0: now }); lastBurst = now; }
      } else if (!reduce) {
        shades.push({ x: here.x, y: here.y, t0: now });
      }
      idleSince = now;
      scheduleFall(now);
      if (reduce) { from = level; draw(now); }
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("button, a, input, select, textarea, label, [role=dialog], [role=button]")) return;
      const now = performance.now();
      if (now - jumpAt < JUMP_MS) return; // one jump at a time (also keeps bursts under three a second)
      jump(level < ORBITS ? level + 1 : level, now);
    };
    window.addEventListener("pointerdown", onPointer);

    let last = performance.now(), raf = 0, running = true;
    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!reduce) {
        angle += (Math.PI * 2 * dt) / PERIOD_S(level);
        if (now >= nextFall) jump(level - 1, now);
        if (level === 1 && now - idleSince > 7000) jump(1 + 1 + Math.floor(Math.random() * 2), now);
      }
      // Sky: deep indigo, faint glow behind the atom, slow-twinkling pixel stars.
      ctx.fillStyle = "#07061a";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 1.3);
      glow.addColorStop(0, "rgba(64, 40, 140, 0.45)");
      glow.addColorStop(1, "rgba(7, 6, 26, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        const tw = reduce ? 1 : 0.75 + 0.25 * Math.sin(now / 2400 + s.p);
        ctx.fillStyle = `rgba(214, 226, 255, ${(s.b * tw).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, 1, 1);
      }
      // Orbits: dotted pixel ellipses; the electron's own orbit a little brighter.
      for (let n = 1; n <= ORBITS; n++) {
        const r = radius(n), steps = Math.round(r * 2.4);
        ctx.fillStyle = n === level ? "rgba(70, 240, 226, 0.55)" : "rgba(120, 150, 230, 0.26)";
        for (let i = 0; i < steps; i += 2) {
          const p = point(r, (i / steps) * Math.PI * 2);
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
      }
      // Nucleus: a tight cluster of amber protons and teal neutrons, gently breathing.
      const pulse = reduce ? 1 : 1 + 0.06 * Math.sin(now / 900);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.2 * pulse);
      core.addColorStop(0, "rgba(255, 197, 61, 0.55)");
      core.addColorStop(1, "rgba(255, 197, 61, 0)");
      ctx.fillStyle = core;
      ctx.fillRect(cx - unit * 0.25, cy - unit * 0.25, unit * 0.5, unit * 0.5);
      const nr = Math.max(2, Math.round(unit * 0.035));
      [[0, 0, 0], [1, 0.9, 1], [-1, 0.6, 1], [0.4, -1, 0], [-0.7, -0.8, 1], [1.1, -0.3, 0], [-1.2, 0.3, 0]].forEach(([ox, oy, kind]) => {
        ctx.fillStyle = kind ? "#46c9d8" : "#ffc53d";
        const x = Math.round(cx + ox * nr * 1.4 * pulse), y = Math.round(cy + oy * nr * 1.4 * pulse);
        ctx.fillRect(x - nr, y - nr + 1, nr * 2, nr * 2 - 2);
        ctx.fillRect(x - nr + 1, y - nr, nr * 2 - 2, nr * 2);
      });
      // Electron and its phosphor trail (behind the nucleus when on the far side of the orbit).
      const r = currentRadius(now);
      const e = point(r, angle);
      trail.push(e);
      if (trail.length > 26) trail.shift();
      if (!reduce) trail.forEach((p, i) => {
        ctx.fillStyle = `rgba(70, 240, 226, ${((i / trail.length) * 0.5).toFixed(3)})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      });
      const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, 7);
      halo.addColorStop(0, "rgba(160, 255, 246, 0.7)");
      halo.addColorStop(1, "rgba(70, 240, 226, 0)");
      ctx.fillStyle = halo;
      ctx.fillRect(e.x - 7, e.y - 7, 14, 14);
      ctx.fillStyle = "#e9fffd";
      ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 3, 3);
      // Bursts of light on a jump up: a ring and eight pixel rays, gone in 0.7 s, at most 16 canvas px (48 CSS px).
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i], k = (now - b.t0) / 700;
        if (k >= 1) { bursts.splice(i, 1); continue; }
        const alpha = 0.85 * (1 - k) ** 1.5, ring = 3 + 13 * k;
        ctx.strokeStyle = `rgba(255, 244, 200, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, ring, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = `rgba(160, 255, 246, ${alpha.toFixed(3)})`;
        for (let a = 0; a < 8; a++) {
          const da = (a / 8) * Math.PI * 2;
          for (let s = ring * 0.4; s < ring; s += 2) ctx.fillRect(Math.round(b.x + Math.cos(da) * s), Math.round(b.y + Math.sin(da) * s), 1, 1);
        }
      }
      // A fall leaves the zone where the electron was darker for a while (4 s).
      for (let i = shades.length - 1; i >= 0; i--) {
        const s = shades[i], k = (now - s.t0) / 4000;
        if (k >= 1) { shades.splice(i, 1); continue; }
        const strength = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - k) ** 1.2;
        const dark = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 34);
        dark.addColorStop(0, `rgba(0, 0, 4, ${(0.75 * strength).toFixed(3)})`);
        dark.addColorStop(1, "rgba(0, 0, 4, 0)");
        ctx.fillStyle = dark;
        ctx.fillRect(s.x - 34, s.y - 34, 68, 68);
      }
    }

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const visibility = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", visibility);
    scheduleFall(performance.now());
    if (reduce) { running = false; draw(performance.now()); }
    else raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  return (
    <div className="atomScene" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="atomVeil" />
    </div>
  );
}
