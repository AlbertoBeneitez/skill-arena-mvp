#!/usr/bin/env python3
"""
v218 · Default group pictures, rendered like film stills (owner, 18-nov: "mucho más peliculero").

Original artwork made here from code (no third-party images): a nebula sky built from fractal noise, a backlit
subject drawn as a silhouette with a rim of light, volumetric glow (bloom), an anamorphic lens streak, chromatic
fringe, vignette and film grain. Each picture is shown in a circle (64 px in the group header), so every scene keeps
one strong subject in the middle and the light behind it.

  python3 scripts/render-group-art.py   →   public/groups/<name>.webp (512 × 512)
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy.ndimage import gaussian_filter, zoom

S = 1024  # working size; saved at 512
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "groups")


def rng(seed):
    return np.random.default_rng(seed)


def fractal_noise(r, octaves=6, base=4):
    """Smooth fractal noise in [0, 1] (sum of upsampled random grids)."""
    acc = np.zeros((S, S))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        n = base * 2 ** o
        grid = r.random((n + 1, n + 1))
        up = zoom(grid, S / n, order=3)[:S, :S]
        acc += up * amp
        total += amp
        amp *= 0.55
    acc /= total
    return (acc - acc.min()) / (acc.max() - acc.min() + 1e-9)


def coords():
    y, x = np.mgrid[0:S, 0:S].astype(float)
    return x / S, y / S


def radial(cx, cy, radius, power=2.0):
    x, y = coords()
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / radius
    return np.clip(1 - d, 0, 1) ** power


def color(c):
    return np.array(c, dtype=float).reshape(1, 1, 3) / 255.0


def nebula(r, c1, c2, c3, strength=1.0, warp=0.0):
    """Two-colour nebula clouds over a deep base colour."""
    n1, n2 = fractal_noise(r), fractal_noise(r, base=3)
    clouds = np.clip((n1 - 0.42) * 2.2, 0, 1) ** 1.6
    wisps = np.clip((n2 - 0.5) * 2.6, 0, 1) ** 2
    img = color(c1) * (0.6 + 0.4 * n2[..., None])
    img = img + color(c2) * clouds[..., None] * 0.9 * strength + color(c3) * wisps[..., None] * 0.7 * strength
    return img


def stars(r, img, count=900, big=18):
    layer = np.zeros((S, S))
    xs, ys = r.integers(0, S, count), r.integers(0, S, count)
    layer[ys, xs] = r.random(count) ** 3 * 1.6
    small = gaussian_filter(layer, 0.8) * 6
    lx, ly = r.integers(0, S, big), r.integers(0, S, big)
    bright = np.zeros((S, S))
    bright[ly, lx] = 1
    glow = gaussian_filter(bright, 3) * 60 + gaussian_filter(bright, 1) * 12
    tint = np.stack([small + glow, small + glow * 0.95, small * 1.05 + glow * 1.1], -1)
    return img + np.clip(tint, 0, 3) * 0.9


def mask_from(draw_fn, blur=0.0):
    m = Image.new("L", (S, S), 0)
    draw_fn(ImageDraw.Draw(m))
    if blur:
        m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(m, dtype=float) / 255.0


def shift(a, dy, dx):
    """Shift an image without wrapping round (empty edges)."""
    out = np.zeros_like(a)
    h, w = a.shape[:2]
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = a[ys, xs]
    return out


def silhouette(img, mask, light_dir, rim_color, rim_width=10, body=(6, 8, 14), rim_gain=2.2):
    """Darken the subject and light its edge facing the light (rim light)."""
    dx, dy = light_dir
    shifted = shift(mask, int(-dy * rim_width), int(-dx * rim_width))
    # The frame edge is not an edge of the subject.
    shifted[-rim_width - 2:, :] = np.maximum(shifted[-rim_width - 2:, :], mask[-rim_width - 2:, :])
    shifted[:, :rim_width + 2] = np.maximum(shifted[:, :rim_width + 2], mask[:, :rim_width + 2])
    shifted[:, -rim_width - 2:] = np.maximum(shifted[:, -rim_width - 2:], mask[:, -rim_width - 2:])
    rim = np.clip(mask - shifted, 0, 1)
    rim = gaussian_filter(rim, 1.2)
    inner = gaussian_filter(mask, 6) * mask
    img = img * (1 - mask[..., None]) + color(body) * mask[..., None] * (0.6 + 0.4 * inner[..., None])
    return img + color(rim_color) * rim[..., None] * rim_gain


def bloom(img, threshold=0.75, radius=18, gain=0.8):
    bright = np.clip(img - threshold, 0, None)
    b = np.stack([gaussian_filter(bright[..., i], radius) for i in range(3)], -1)
    b2 = np.stack([gaussian_filter(bright[..., i], radius * 3) for i in range(3)], -1)
    return img + b * gain + b2 * gain * 0.6


def streak(img, cx, cy, tint, length=0.9, gain=1.0):
    """Anamorphic lens streak through a light source."""
    x, y = coords()
    band = np.exp(-((y - cy) ** 2) / (2 * 0.0035 ** 2)) * np.clip(1 - np.abs(x - cx) / length, 0, 1) ** 2
    core = radial(cx, cy, 0.05, 2) * 2.5
    return img + color(tint) * (band * gain + core)[..., None]


def finish(img, r, name, vignette=0.55, grain=0.035):
    x, y = coords()
    d = np.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2)
    img = img * (1 - vignette * np.clip(d * 1.4, 0, 1) ** 2)[..., None]
    # Filmic tone curve, gentle teal-orange split.
    img = img / (1 + img * 0.55)
    img = np.clip(img * 1.25, 0, 1) ** 0.92
    lum = img.mean(-1, keepdims=True)
    img = img + (color((255, 160, 90)) - 0.5) * 0.05 * lum + (color((40, 120, 160)) - 0.5) * 0.05 * (1 - lum)
    # Chromatic fringe towards the edges.
    shift = 3
    img[..., 0] = np.roll(img[..., 0], shift, 1) * 0.5 + img[..., 0] * 0.5
    img[..., 2] = np.roll(img[..., 2], -shift, 1) * 0.5 + img[..., 2] * 0.5
    img[:, :shift] = img[:, shift:2 * shift]
    img[:, -shift:] = img[:, -2 * shift:-shift]
    img = img + (r.random((S, S, 1)) - 0.5) * grain
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((512, 512), Image.LANCZOS)
    out.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    print(name, os.path.getsize(os.path.join(OUT, f"{name}.webp")) // 1024, "KB")


def P(*pts):
    return [(px * S, py * S) for px, py in pts]


# ---------------------------------------------------------------- scenes

def crew():
    """Three astronauts on a ridge, backlit by a giant ringed planet rising."""
    r = rng(11)
    img = nebula(r, (6, 8, 22), (120, 40, 140), (30, 110, 170), 0.8)
    img = stars(r, img)
    # The planet: a huge disc low behind the ridge, lit from the top-left, with a ring.
    x, y = coords()
    cx, cy, R = 0.5, 0.86, 0.52
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    disc = np.clip((R - d) * 220, 0, 1)
    bands = 0.5 + 0.5 * np.sin((y - cy) * 60 + fractal_noise(r, 5, 4) * 7 + np.sin(x * 9) * 0.6)
    lit = np.clip(((cx - x) * 0.4 + (cy - y) * 1.2) / R + 0.2, 0, 1)
    planet = (color((250, 170, 90)) * bands[..., None] + color((150, 60, 40)) * (1 - bands[..., None])) * (lit ** 1.4)[..., None]
    img = img * (1 - disc[..., None]) + planet * disc[..., None]
    atmo = np.clip(1 - np.abs(d - R) * 45, 0, 1) ** 2 * (y < cy + 0.1)
    img = img + color((255, 190, 120)) * atmo[..., None] * 1.6
    ring = np.exp(-((((x - cx) / 1.0) ** 2 + ((y - cy + 0.05) / 0.16) ** 2) ** 0.5 - 0.66) ** 2 / 0.00025) * (y < cy - 0.02)
    img = img + color((255, 220, 170)) * ring[..., None] * 0.9
    # Ridge and three astronauts, lit from behind (the planet's limb).
    def draw(dr):
        dr.polygon(P((0, 0.78), (0.18, 0.74), (0.34, 0.77), (0.5, 0.73), (0.7, 0.76), (0.86, 0.72), (1, 0.75), (1, 1), (0, 1)), fill=255)
        for ox, sc in ((0.33, 0.86), (0.5, 1.0), (0.67, 0.9)):
            base = 0.735
            h = 0.25 * sc
            dr.ellipse(P((ox - 0.042 * sc, base - h), (ox + 0.042 * sc, base - h + 0.08 * sc)), fill=255)  # helmet
            dr.rounded_rectangle(P((ox - 0.062 * sc, base - h + 0.07 * sc), (ox + 0.03 * sc, base - h + 0.15 * sc)), radius=int(0.012 * S * sc), fill=255)  # backpack
            dr.rounded_rectangle(P((ox - 0.048 * sc, base - h + 0.068 * sc), (ox + 0.048 * sc, base - 0.085 * sc)), radius=int(0.022 * S * sc), fill=255)  # torso
            dr.polygon(P((ox - 0.044 * sc, base - 0.09 * sc), (ox - 0.006 * sc, base - 0.09 * sc), (ox - 0.012 * sc, base), (ox - 0.046 * sc, base)), fill=255)  # legs
            dr.polygon(P((ox + 0.006 * sc, base - 0.09 * sc), (ox + 0.044 * sc, base - 0.09 * sc), (ox + 0.05 * sc, base), (ox + 0.014 * sc, base)), fill=255)
            dr.polygon(P((ox + 0.044 * sc, base - h + 0.085 * sc), (ox + 0.066 * sc, base - h + 0.09 * sc), (ox + 0.07 * sc, base - h + 0.17 * sc), (ox + 0.052 * sc, base - h + 0.17 * sc)), fill=255)  # arm
            dr.polygon(P((ox - 0.044 * sc, base - h + 0.085 * sc), (ox - 0.066 * sc, base - h + 0.09 * sc), (ox - 0.07 * sc, base - h + 0.17 * sc), (ox - 0.052 * sc, base - h + 0.17 * sc)), fill=255)
        # The middle one plants a flag.
        dr.rectangle(P((0.565, 0.43), (0.57, 0.735)), fill=255)
        dr.polygon(P((0.57, 0.43), (0.66, 0.445), (0.57, 0.48)), fill=255)
    m = mask_from(draw, 0.6)
    img = silhouette(img, m, (0, 1), (255, 200, 140), rim_width=7)
    # Visor glints.
    for ox, sc in ((0.33, 0.86), (0.5, 1.0), (0.67, 0.9)):
        img = img + color((140, 230, 255)) * radial(ox + 0.016 * sc, 0.735 - 0.25 * sc + 0.04 * sc, 0.014, 2)[..., None] * 2.5
    img = streak(img, 0.5, 0.36, (255, 190, 130), 0.7, 0.5)
    img = bloom(img, 0.7, 14, 0.7)
    finish(img, r, "crew")


def eclipse():
    """A black planet eclipsing its star: blazing corona, diamond ring, orbits of a small system."""
    r = rng(23)
    img = nebula(r, (4, 4, 14), (40, 60, 160), (150, 40, 110), 0.7)
    img = stars(r, img, 1100)
    x, y = coords()
    cx, cy, R = 0.5, 0.5, 0.2
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    ang = np.arctan2(y - cy, x - cx)
    rays = 0.6 + 0.4 * np.abs(np.sin(ang * 9 + fractal_noise(r, 4, 6) * 6))
    corona = np.exp(-(d - R) / 0.06) * (d > R) * rays
    img = img + color((255, 230, 190)) * corona[..., None] * 1.6 + color((120, 180, 255)) * (np.exp(-(d - R) / 0.2) * (d > R))[..., None] * 0.6
    disc = np.clip((R - d) * 400, 0, 1)
    img = img * (1 - disc[..., None]) + color((2, 2, 6)) * disc[..., None]
    # Diamond ring at the top-right of the limb.
    dx, dy = cx + R * math.cos(-0.8), cy + R * math.sin(-0.8)
    img = img + color((255, 250, 235)) * radial(dx, dy, 0.03, 1.5)[..., None] * 4
    img = streak(img, dx, dy, (255, 235, 200), 0.85, 1.2)
    # Orbits and two small worlds catching the light.
    orbit = np.zeros((S, S))
    for k, (a, b) in enumerate(((0.36, 0.12), (0.46, 0.17))):
        e = ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2
        orbit += np.exp(-((np.sqrt(e) - 1) ** 2) / 0.00006) * (0.5 + 0.5 * (y > cy))
    img = img + color((150, 200, 255)) * orbit[..., None] * 0.5
    for px, py, pr, c in ((0.5 + 0.36 * math.cos(2.6), 0.5 + 0.12 * math.sin(2.6), 0.028, (90, 160, 255)), (0.5 + 0.46 * math.cos(0.5), 0.5 + 0.17 * math.sin(0.5), 0.02, (255, 140, 90))):
        dd = np.sqrt((x - px) ** 2 + (y - py) ** 2)
        body = np.clip((pr - dd) * 600, 0, 1)
        shade = np.clip(((cx - x) * (px - cx) * -1 + (cy - y) * (py - cy) * -1) * 60 + 0.4, 0.05, 1)
        img = img * (1 - body[..., None]) + color(c) * (body * shade)[..., None]
    img = bloom(img, 0.7, 20, 0.9)
    finish(img, r, "eclipse")


def stargate():
    """A colossal ring gate, its energy vortex opening, a lone ship crossing the light."""
    r = rng(37)
    img = nebula(r, (4, 6, 18), (20, 120, 160), (90, 50, 170), 0.9)
    img = stars(r, img, 800)
    x, y = coords()
    cx, cy = 0.5, 0.5
    # Perspective ring: an ellipse.
    e = np.sqrt(((x - cx) / 0.4) ** 2 + ((y - cy) / 0.34) ** 2)
    ang = np.arctan2((y - cy) / 0.34, (x - cx) / 0.4)
    inside = np.clip((1 - e) * 30, 0, 1)
    swirl = fractal_noise(r, 5, 5)
    vortex = (0.5 + 0.5 * np.sin(ang * 3 + e * 14 + swirl * 6)) * np.clip(1 - e, 0, 1) ** 0.6
    core = radial(cx, cy, 0.18, 1.8)
    img = img * (1 - inside[..., None] * 0.7) + (color((60, 220, 255)) * vortex[..., None] * 0.9 + color((230, 250, 255)) * core[..., None] * 1.8) * inside[..., None]
    ring = np.clip(1 - np.abs(e - 1.04) * 22, 0, 1)
    segments = (np.sin(ang * 18) > -0.2).astype(float)
    metal = color((70, 80, 100)) * (0.4 + 0.6 * np.clip(-(y - cy) * 3 + 0.5, 0, 1))[..., None]
    img = img * (1 - ring[..., None]) + metal * ring[..., None]
    chevrons = ring * (1 - segments) * 0
    lights = np.clip(1 - np.abs(e - 1.04) * 60, 0, 1) * (np.abs(np.sin(ang * 9)) > 0.97)
    img = img + color((120, 240, 255)) * lights[..., None] * 3 + chevrons[..., None]
    # Inner rim glow.
    img = img + color((90, 230, 255)) * (np.exp(-((e - 0.98) ** 2) / 0.0006))[..., None] * 1.4
    # A small ship silhouette crossing, with its engine trail.
    def ship(dr):
        dr.polygon(P((0.6, 0.6), (0.7, 0.575), (0.6, 0.55), (0.62, 0.575)), fill=255)
    m = mask_from(ship, 0.5)
    img = silhouette(img, m, (-1, 0), (200, 245, 255), 4, rim_gain=2.6)
    trail = np.exp(-((y - (0.575 + (0.6 - x) * 0.0)) ** 2) / 0.00003) * np.clip((0.6 - x) / 0.25, 0, 1) * (x < 0.6) * np.clip(1 - (0.6 - x) / 0.25, 0, 1)
    img = img + color((255, 170, 90)) * trail[..., None] * 1.6
    img = streak(img, cx, cy, (160, 240, 255), 0.95, 0.6)
    img = bloom(img, 0.65, 16, 0.9)
    finish(img, r, "stargate")


def launch():
    """Three rockets lifting off at dusk, fire and smoke columns, searchlights crossing the sky."""
    r = rng(41)
    img = nebula(r, (10, 8, 26), (200, 70, 60), (80, 40, 150), 0.6)
    x, y = coords()
    sky = np.clip(y, 0, 1) ** 2
    img = img * (1 - sky[..., None] * 0.6) + color((255, 120, 60)) * sky[..., None] * 0.55
    img = stars(r, img, 500)
    # Searchlights.
    for bx, angle in ((0.18, -0.35), (0.84, 0.3)):
        dxl, dyl = math.sin(angle), -math.cos(angle)
        px, py = x - bx, y - 0.95
        along = px * dxl + py * dyl
        across = np.abs(px * dyl - py * dxl)
        beam = np.clip(1 - across / (0.01 + along * 0.08), 0, 1) * (along > 0) * np.exp(-along * 1.5)
        img = img + color((200, 220, 255)) * beam[..., None] * 0.35
    # Smoke columns and fire under each rocket.
    smoke_noise = fractal_noise(r, 5, 6)
    for ox, top in ((0.32, 0.36), (0.5, 0.22), (0.68, 0.4)):
        width = 0.025 + np.clip(y - (top + 0.2), 0, 1) * 0.55
        col = np.clip(1 - np.abs(x - ox) / width, 0, 1) * (y > top + 0.2) * (0.6 + 0.6 * smoke_noise)
        lit = np.exp(-(y - (top + 0.22)) * 4)
        img = img * (1 - col[..., None] * 0.7) + (color((90, 80, 100)) + color((255, 150, 70)) * lit[..., None]) * col[..., None] * 0.7
        flame = radial(ox, top + 0.215, 0.05, 1.6) + radial(ox, top + 0.25, 0.08, 2.5) * 0.6
        img = img + color((255, 190, 90)) * flame[..., None] * 2.2
    def rockets(dr):
        for ox, top in ((0.32, 0.36), (0.5, 0.22), (0.68, 0.4)):
            w, h = 0.022, 0.17
            dr.polygon(P((ox, top), (ox + w, top + 0.05), (ox + w, top + h), (ox - w, top + h), (ox - w, top + 0.05)), fill=255)
            dr.polygon(P((ox - w, top + h - 0.05), (ox - w - 0.02, top + h + 0.01), (ox - w, top + h)), fill=255)
            dr.polygon(P((ox + w, top + h - 0.05), (ox + w + 0.02, top + h + 0.01), (ox + w, top + h)), fill=255)
        dr.polygon(P((0, 0.92), (0.4, 0.9), (0.6, 0.91), (1, 0.89), (1, 1), (0, 1)), fill=255)
    m = mask_from(rockets, 0.6)
    img = silhouette(img, m, (0, -1), (255, 170, 90), 6, body=(10, 10, 16))
    img = streak(img, 0.5, 0.45, (255, 180, 110), 0.8, 0.45)
    img = bloom(img, 0.7, 18, 0.85)
    finish(img, r, "launch")


def moonbase():
    """Domes on a cratered moon, Earth rising huge behind them, landing lights and a beam into the sky."""
    r = rng(53)
    img = nebula(r, (3, 5, 14), (30, 60, 140), (20, 120, 120), 0.5)
    img = stars(r, img, 1000)
    x, y = coords()
    # Earth: blue marble with clouds, lit from the right.
    cx, cy, R = 0.58, 0.42, 0.3
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    disc = np.clip((R - d) * 300, 0, 1)
    land = fractal_noise(r, 6, 4)
    clouds = np.clip((fractal_noise(r, 6, 6) - 0.55) * 3, 0, 1)
    is_land = np.clip((land - 0.55) * 25, 0, 1)[..., None]
    detail = fractal_noise(r, 6, 12)[..., None]
    ocean = color((10, 45, 120)) * (0.7 + 0.5 * detail)
    ground = color((95, 110, 60)) * (1 - detail) + color((150, 120, 80)) * detail
    surface = ocean * (1 - is_land) + ground * is_land
    surface = surface * (1 - clouds[..., None]) + color((240, 245, 255)) * clouds[..., None]
    lit = np.clip(((x - cx) * 1.0 + (cy - y) * 0.4) / R + 0.35, 0, 1) ** 1.2
    img = img * (1 - disc[..., None]) + surface * (lit * disc)[..., None]
    city = (r.random((S, S)) > 0.985) * is_land[..., 0] * disc * np.clip(0.4 - lit, 0, 1) * 2.5
    img = img + color((255, 190, 110)) * gaussian_filter(city, 1.2)[..., None] * 4
    img = img + color((110, 180, 255)) * (np.clip(1 - np.abs(d - R) * 50, 0, 1) ** 2 * lit)[..., None] * 1.4
    # Ground and domes.
    def base(dr):
        dr.polygon(P((0, 0.74), (0.2, 0.72), (0.45, 0.75), (0.7, 0.71), (1, 0.73), (1, 1), (0, 1)), fill=255)
        for ox, rad in ((0.3, 0.09), (0.5, 0.06), (0.66, 0.11)):
            dr.pieslice([(ox - rad) * S, (0.735 - rad) * S, (ox + rad) * S, (0.735 + rad) * S], 180, 360, fill=255)
        dr.rectangle(P((0.785, 0.53), (0.795, 0.74)), fill=255)  # antenna
        dr.polygon(P((0.76, 0.53), (0.82, 0.53), (0.79, 0.56)), fill=255)
    m = mask_from(base, 0.6)
    img = silhouette(img, m, (1, -0.4), (150, 200, 255), 6, body=(14, 16, 22))
    # Dome windows and landing lights.
    for ox, oy in ((0.28, 0.705), (0.32, 0.7), (0.5, 0.72), (0.63, 0.7), (0.68, 0.69), (0.71, 0.705)):
        img = img + color((255, 200, 120)) * radial(ox, oy, 0.008, 1.5)[..., None] * 3
    for k in range(9):
        lx = 0.08 + k * 0.1
        img = img + color((120, 220, 255) if k % 2 else (255, 90, 80)) * radial(lx, 0.82, 0.006, 1.5)[..., None] * 3
    # Beam from the antenna.
    beam = np.clip(1 - np.abs(x - 0.79) / (0.003 + (0.53 - y) * 0.05), 0, 1) * (y < 0.53) * np.exp(-(0.53 - y) * 2)
    img = img + color((150, 220, 255)) * beam[..., None] * 0.6
    img = bloom(img, 0.7, 14, 0.8)
    finish(img, r, "moonbase")


def comets():
    """Three comets diving past the limb of a dark world, their fiery tails crossing the frame."""
    r = rng(67)
    img = nebula(r, (6, 4, 16), (170, 40, 90), (40, 80, 170), 0.75)
    img = stars(r, img, 900)
    x, y = coords()
    # Dark world at the bottom with a thin dawn rim.
    cx, cy, R = 0.4, 1.35, 0.72
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    disc = np.clip((R - d) * 300, 0, 1)
    img = img * (1 - disc[..., None]) + color((5, 6, 12)) * disc[..., None]
    rim = np.clip(1 - np.abs(d - R) * 90, 0, 1) ** 1.5 * np.clip((x - 0.1) * 1.5, 0, 1)
    img = img + color((255, 150, 90)) * rim[..., None] * 1.8 + color((120, 170, 255)) * (np.clip(1 - np.abs(d - R - 0.01) * 40, 0, 1) ** 3)[..., None] * 0.5
    # Comets: head + long tapering tail along their direction.
    for hx, hy, ang, length, tint in ((0.72, 0.3, 2.55, 0.75, (255, 200, 120)), (0.58, 0.5, 2.45, 0.6, (140, 220, 255)), (0.82, 0.58, 2.6, 0.5, (255, 140, 160))):
        dxv, dyv = math.cos(ang), math.sin(ang)  # tail direction (away from the sun, up-left)
        px, py = x - hx, y - hy
        along = px * dxv + py * dyv
        across = px * -dyv + py * dxv
        t = np.clip(along / length, 0, 1)
        width = 0.006 + t * 0.06
        tail = np.exp(-(across ** 2) / (2 * width ** 2)) * (along > 0) * (1 - t) ** 1.5
        ion = np.exp(-(across ** 2) / (2 * (0.003 + t * 0.012) ** 2)) * (along > 0) * (1 - t)
        img = img + color(tint) * tail[..., None] * 1.1 + color((200, 240, 255)) * ion[..., None] * 0.9
        img = img + color((255, 250, 240)) * radial(hx, hy, 0.018, 1.4)[..., None] * 4
        img = streak(img, hx, hy, tint, 0.35, 0.25)
    img = bloom(img, 0.7, 18, 0.9)
    finish(img, r, "comets")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for scene in (crew, eclipse, stargate, launch, moonbase, comets):
        scene()
