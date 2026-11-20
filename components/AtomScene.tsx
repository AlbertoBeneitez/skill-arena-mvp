"use client";
/**
 * The start screen's background (owner, v220–v221): a retro atom you can play with. Drawn on a low-resolution canvas
 * scaled up without smoothing (big pixels, like an old arcade screen), with scan lines on top (CSS).
 *
 * - The electron circles the nucleus slowly (6 s on the first orbit, up to 16 s on the fifth).
 * - Tap the right half of the background (not a button): the electron absorbs light and jumps one orbit up. The light
 *   around it is drawn into the electron and that zone goes dark, then slowly returns to the tone of the rest.
 * - Tap the left half: it falls one orbit and gives off a flash, a thin ring that grows until it leaves the screen
 *   and a photon (a small light wave) that flies out in a straight line.
 * - Each jump has its own colour of the visible spectrum, like a real atom: the closer to the nucleus, the more
 *   energetic the jump and the bluer the light (1↔2 violet, 2↔3 blue, 3↔4 green, 4↔5 red). Each orbit is tinted
 *   with the colour of the jump that reaches it.
 * - Left alone for about 8 s, an excited electron falls one orbit by itself (with its flash).
 * - Light safety (WCAG 2.3.1): at most one jump every 0.7 s (under three a second); the flash core is small
 *   (≤ 48 px), the ring is a thin line and the dark zones fade in and out slowly; no full-screen flashing. With
 *   reduced motion the scene stays still and taps only move the electron.
 * Presentation only: no game state, nothing stored. Paused while the page is hidden.
 */
import { useEffect, useRef } from "react";

const PIX = 3; // CSS pixels per canvas pixel
const ORBITS = 5;
/** Orbit size as a share of the outer one; the gaps narrow outwards and the last orbit stays well inside the screen. */
const ORBIT_SHARE = [0.26, 0.51, 0.71, 0.87, 1];
const PERIOD_S = (n: number) => 6 + 2.5 * (n - 1);
const TILT = -0.32; // radians
const SQUASH = 0.5; // ellipse height / width: the orbits are seen at an angle
const MIN_JUMP_GAP = 700; // ms: also keeps flashes under three a second
const JUMP_MS = 480;
const IDLE_FALL_MS = 8000;
/** Colour of the jump between orbit n and n + 1 (index n − 1): violet, blue, green, red. */
const JUMP_RGB: [number, number, number][] = [[156, 108, 255], [64, 132, 255], [52, 226, 110], [255, 66, 58]];
const rgba = ([r, g, b]: [number, number, number], a: number) => `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;

type Rgb = [number, number, number];
/** Light being drawn into the electron on a jump up. */
type Pull = { t0: number; rgb: Rgb; motes: { a: number; d: number; s: number }[] };
/** A dark zone left where light was absorbed. */
type Shade = { x: number; y: number; t0: number };
/** A jump down: flash core, ring leaving the screen, photon flying out, sparks. */
type Emission = { x: number; y: number; t0: number; rgb: Rgb; dir: number; reach: number; sparks: { a: number; v: number }[] };

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
      cx = w / 2; cy = h * 0.25;
      unit = Math.min(w * 0.83, h * 0.5) / 2; // outer orbit's half-width
      // Presentation only (Math.random is fine): a pixel starfield.
      stars = Array.from({ length: Math.round((w * h) / 260) }, () => ({ x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h), b: 0.25 + Math.random() * 0.6, p: Math.random() * 6.28 }));
    };
    resize();
    const onResize = () => { resize(); if (reduce) draw(performance.now()); };
    window.addEventListener("resize", onResize);

    const radius = (n: number) => unit * ORBIT_SHARE[n - 1];
    const point = (r: number, a: number) => {
      const ex = Math.cos(a) * r, ey = Math.sin(a) * r * SQUASH;
      return { x: cx + ex * Math.cos(TILT) - ey * Math.sin(TILT), y: cy + ex * Math.sin(TILT) + ey * Math.cos(TILT) };
    };

    // Electron state.
    let level = 3, from = 3, jumpAt = -1e9, angle = Math.random() * Math.PI * 2, lastTouch = performance.now();
    let charge: { t0: number; rgb: Rgb } | null = null; // the electron glows with the light it just absorbed
    const pulls: Pull[] = [];
    const shades: Shade[] = [];
    const emissions: Emission[] = [];
    const trail: { x: number; y: number }[] = [];

    const currentRadius = (now: number) => {
      const k = Math.min(1, (now - jumpAt) / JUMP_MS);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      return radius(from) + (radius(level) - radius(from)) * e;
    };
    const jump = (to: number, now: number) => {
      if (to < 1 || to > ORBITS || to === level || now - jumpAt < MIN_JUMP_GAP) return;
      const here = point(currentRadius(now), angle);
      const rgb = JUMP_RGB[Math.min(to, level) - 1];
      from = level; level = to; jumpAt = now;
      if (reduce) { from = level; draw(now); return; }
      if (to > from) {
        // Absorption: light around the electron streams into it; the zone darkens, then recovers slowly.
        pulls.push({ t0: now, rgb, motes: Array.from({ length: 18 }, () => ({ a: Math.random() * Math.PI * 2, d: 14 + Math.random() * 18, s: 0.7 + Math.random() * 0.5 })) });
        shades.push({ x: here.x, y: here.y, t0: now });
        charge = { t0: now, rgb };
      } else {
        // Emission: the photon leaves away from the nucleus, give or take a little.
        const out = Math.atan2(here.y - cy, here.x - cx) + (Math.random() - 0.5) * 0.6;
        const reach = Math.hypot(Math.max(here.x, w - here.x), Math.max(here.y, h - here.y)) + 8;
        emissions.push({ x: here.x, y: here.y, t0: now, rgb, dir: out, reach, sparks: Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2 + Math.random() * 0.4, v: 10 + Math.random() * 8 })) });
        charge = null;
      }
    };

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("button, a, input, select, textarea, label, [role=dialog], [role=button], [role=listbox], [role=option]")) return;
      const now = performance.now();
      lastTouch = now;
      jump(event.clientX >= window.innerWidth / 2 ? level + 1 : level - 1, now);
    };
    window.addEventListener("pointerdown", onPointer);

    const dot = (x: number, y: number, size = 1) => ctx.fillRect(Math.round(x), Math.round(y), size, size);

    let last = performance.now(), raf = 0, running = true;
    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!reduce) {
        angle += (Math.PI * 2 * dt) / PERIOD_S(level);
        if (level > 1 && now - Math.max(lastTouch, jumpAt) > IDLE_FALL_MS) jump(level - 1, now);
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
      // Orbits: dotted pixel ellipses tinted with the colour of the jump that reaches them; the electron's own brighter.
      for (let n = 1; n <= ORBITS; n++) {
        const r = radius(n), steps = Math.round(r * 2.4);
        const tint: Rgb = n === 1 ? [150, 170, 235] : JUMP_RGB[n - 2];
        ctx.fillStyle = rgba(tint, n === level ? 0.7 : 0.3);
        for (let i = 0; i < steps; i += 2) {
          const p = point(r, (i / steps) * Math.PI * 2);
          dot(p.x, p.y);
        }
      }
      // Dark zones left by absorbed light: they darken within 0.3 s and return to the rest's tone over 6 s.
      for (let i = shades.length - 1; i >= 0; i--) {
        const s = shades[i], age = now - s.t0;
        if (age >= 6300) { shades.splice(i, 1); continue; }
        const strength = age < 300 ? age / 300 : (1 - (age - 300) / 6000) ** 1.4;
        const dark = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 46);
        dark.addColorStop(0, `rgba(0, 0, 3, ${(0.95 * strength).toFixed(3)})`);
        dark.addColorStop(0.55, `rgba(0, 0, 3, ${(0.7 * strength).toFixed(3)})`);
        dark.addColorStop(1, "rgba(0, 0, 3, 0)");
        ctx.fillStyle = dark;
        ctx.fillRect(s.x - 46, s.y - 46, 92, 92);
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
      // Electron and its phosphor trail.
      const r = currentRadius(now);
      const e = point(r, angle);
      trail.push(e);
      if (trail.length > 26) trail.shift();
      const glowRgb: Rgb = charge && now - charge.t0 < 2200 ? charge.rgb : [70, 240, 226];
      const chargeK = charge ? Math.max(0, 1 - (now - charge.t0) / 2200) : 0;
      if (!reduce) trail.forEach((p, i) => {
        ctx.fillStyle = rgba(chargeK > 0 ? glowRgb : [70, 240, 226], (i / trail.length) * 0.5);
        dot(p.x, p.y);
      });
      // Light being absorbed: motes of the jump's colour stream from around the electron into it (0.6 s).
      for (let i = pulls.length - 1; i >= 0; i--) {
        const p = pulls[i], k = (now - p.t0) / 600;
        if (k >= 1) { pulls.splice(i, 1); continue; }
        for (const m of p.motes) {
          const kk = Math.min(1, k * m.s * 1.3), d = m.d * (1 - kk * kk), a = m.a + kk * 1.2;
          ctx.fillStyle = rgba(p.rgb, 0.95 * (1 - kk * 0.6));
          dot(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d * 0.8);
          ctx.fillStyle = rgba(p.rgb, 0.4 * (1 - kk));
          dot(e.x + Math.cos(a) * (d + 2), e.y + Math.sin(a) * (d + 2) * 0.8);
        }
      }
      const haloR = 7 + 5 * chargeK;
      const halo = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, haloR);
      halo.addColorStop(0, chargeK > 0 ? rgba(glowRgb, 0.55 + 0.35 * chargeK) : "rgba(160, 255, 246, 0.7)");
      halo.addColorStop(1, rgba(glowRgb, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(e.x - haloR, e.y - haloR, haloR * 2, haloR * 2);
      ctx.fillStyle = "#f2fffd";
      ctx.fillRect(Math.round(e.x) - 1, Math.round(e.y) - 1, 3, 3);
      // Emissions: a small core flash (0.35 s, ≤ 16 canvas px), sparks, a thin ring that grows past the screen's edges
      // and a photon wave packet flying out in a straight line.
      for (let i = emissions.length - 1; i >= 0; i--) {
        const m = emissions[i], age = (now - m.t0) / 1000;
        const ringR = 4 + age * 150, photonD = 4 + age * 120;
        if (ringR > m.reach && photonD > m.reach + 24) { emissions.splice(i, 1); continue; }
        if (age < 0.35) {
          const k = age / 0.35, rr = 4 + 12 * k;
          const flash = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, rr);
          flash.addColorStop(0, `rgba(255, 255, 255, ${(0.85 * (1 - k)).toFixed(3)})`);
          flash.addColorStop(0.35, rgba(m.rgb, 0.8 * (1 - k)));
          flash.addColorStop(1, rgba(m.rgb, 0));
          ctx.fillStyle = flash;
          ctx.fillRect(m.x - rr, m.y - rr, rr * 2, rr * 2);
        }
        if (age < 0.9) {
          const k = age / 0.9;
          ctx.fillStyle = rgba(m.rgb, 0.9 * (1 - k));
          for (const s of m.sparks) dot(m.x + Math.cos(s.a) * s.v * k * 1.6, m.y + Math.sin(s.a) * s.v * k * 1.6);
        }
        if (ringR <= m.reach) {
          const alpha = 0.75 * (1 - ringR / m.reach) ** 0.6 + 0.12;
          ctx.strokeStyle = rgba(m.rgb, alpha);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(m.x, m.y, ringR, 0, Math.PI * 2); ctx.stroke();
          if (ringR > 10) {
            ctx.strokeStyle = rgba(m.rgb, alpha * 0.35);
            ctx.beginPath(); ctx.arc(m.x, m.y, ringR - 4, 0, Math.PI * 2); ctx.stroke();
          }
        }
        // Photon: a sine wave packet 34 px long, brightest at its head, travelling along `dir`.
        const ux = Math.cos(m.dir), uy = Math.sin(m.dir);
        for (let s = 0; s < 34; s++) {
          const along = photonD - s, wave = Math.sin(along * 0.8) * 2.6 * Math.sin((Math.PI * s) / 34);
          const env = 1 - s / 34;
          ctx.fillStyle = rgba(m.rgb, 0.35 + 0.65 * env);
          dot(m.x + ux * along - uy * wave, m.y + uy * along + ux * wave, s < 10 ? 2 : 1);
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        dot(m.x + ux * photonD - 1, m.y + uy * photonD - 1, 2);
      }
    }

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const visibility = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduce && !running) { running = true; last = performance.now(); lastTouch = last; raf = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", visibility);
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
