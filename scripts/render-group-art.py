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


# ---------------------------------------------------------------- v220 · five more, chosen from the group picture

def blackhole():
    """A black hole: lensed accretion disk wrapped over and under the shadow, a photon ring, stars bent around it."""
    r = rng(71)
    img = nebula(r, (3, 3, 10), (60, 30, 90), (20, 40, 90), 0.5)
    img = stars(r, img, 1300)
    x, y = coords()
    cx, cy = 0.5, 0.52
    dx, dy = x - cx, y - cy
    d = np.sqrt(dx ** 2 + dy ** 2)
    shadow_r = 0.15
    # Flat disk seen almost edge-on: a thin, hot band across the middle.
    band_d = np.abs(dy / 0.045)
    radial_d = np.abs(dx)
    disk = np.exp(-band_d ** 2) * np.clip(1 - radial_d / 0.48, 0, 1) ** 0.8
    swirl = 0.78 + 0.22 * np.sin(dx * 28 + fractal_noise(r, 4, 4) * 3)
    doppler = np.clip(1.25 - dx * 2.2, 0.35, 1.6)  # the side coming towards us is brighter
    # Lensed image of the far side of the disk: a ring arcing over and under the shadow.
    ring_r = shadow_r * 1.35
    lensed = np.exp(-((d - ring_r) / 0.03) ** 2) * (0.35 + 0.65 * np.abs(dy) / (d + 1e-6)) * np.clip(1.2 - dx * 2.5, 0.4, 1.5)
    photon = np.exp(-((d - shadow_r * 1.04) / 0.006) ** 2)
    hot = color((255, 210, 150))
    img = img + hot * (disk * swirl * doppler)[..., None] * 2.2 + color((255, 170, 90)) * lensed[..., None] * 1.6 + color((255, 245, 225)) * photon[..., None] * 2.4
    shadow = np.clip((shadow_r - d) * 400, 0, 1)
    img = img * (1 - shadow[..., None])
    # The near disk passes in front of the shadow.
    front = disk * np.clip(1 - np.abs(dy) / 0.022, 0, 1) * (d < shadow_r)
    img = img + hot * (front * swirl * doppler)[..., None] * 1.6
    img = streak(img, cx - 0.2, cy, (255, 200, 140), 0.7, 0.25)
    img = bloom(img, 0.65, 20, 1.0)
    finish(img, r, "blackhole")


def aurora():
    """Aurora curtains over a frozen world at night, a lone outpost with its lights on the ridge."""
    r = rng(83)
    img = nebula(r, (3, 6, 14), (20, 60, 90), (40, 30, 90), 0.4)
    img = stars(r, img, 1100)
    x, y = coords()
    for k, (base, tint, amp) in enumerate(((0.32, (60, 255, 170), 1.0), (0.24, (120, 220, 255), 0.7), (0.4, (200, 90, 255), 0.55))):
        wave = base + 0.05 * np.sin(x * (4 + k * 2) + k) + 0.04 * (fractal_noise(r, 3, 3)[0:1, :] - 0.5)
        below = np.clip((y - wave) / 0.33, 0, 1)
        curtain = np.exp(-((y - wave) / 0.02) ** 2) * 1.4 + (y > wave) * (1 - below) ** 2.5 * 0.9
        rays = 0.25 + 0.75 * np.sin(x * 160 + fractal_noise(r, 3, 4) * 10) ** 4
        img = img + color(tint) * (curtain * rays * amp)[..., None] * 0.55
    # The aurora lights the haze above the horizon, so the mountains stand out against it.
    haze = np.exp(-((y - 0.66) / 0.09) ** 2)
    img = img + color((40, 140, 110)) * haze[..., None] * 0.55
    def ground(dr):
        dr.polygon(P((0, 0.7), (0.08, 0.62), (0.16, 0.68), (0.27, 0.56), (0.36, 0.66), (0.44, 0.71), (1, 0.72), (1, 1), (0, 1)), fill=255)
        dr.polygon(P((0.7, 0.72), (0.82, 0.6), (0.9, 0.66), (1, 0.58), (1, 0.75)), fill=255)
        dr.polygon(P((0, 0.84), (0.3, 0.8), (0.6, 0.83), (1, 0.79), (1, 1), (0, 1)), fill=255)
        dr.rectangle(P((0.5, 0.7), (0.66, 0.81)), fill=255)
        dr.polygon(P((0.49, 0.7), (0.58, 0.64), (0.67, 0.7)), fill=255)
        dr.rectangle(P((0.69, 0.6), (0.697, 0.81)), fill=255)
    m = mask_from(ground, 0.6)
    img = silhouette(img, m, (0, 1), (120, 255, 200), 5, body=(8, 12, 18), rim_gain=1.6)
    snow = np.clip((y - 0.78) * 4, 0, 1) * m * (0.35 + 0.3 * fractal_noise(r, 4, 8))
    img = img + color((90, 160, 170)) * snow[..., None] * 0.6
    for ox, oy in ((0.53, 0.75), (0.565, 0.75), (0.6, 0.75), (0.635, 0.75)):
        img = img + color((255, 190, 110)) * radial(ox, oy, 0.01, 1.4)[..., None] * 3.5
    img = img + color((255, 80, 70)) * radial(0.6935, 0.6, 0.007, 1.4)[..., None] * 3
    img = bloom(img, 0.7, 16, 0.8)
    finish(img, r, "aurora")


def miners():
    """A mining ship docked on a huge tumbling asteroid, floodlights cutting through drifting dust."""
    r = rng(97)
    img = nebula(r, (6, 5, 12), (120, 70, 40), (40, 60, 110), 0.45)
    img = stars(r, img, 900)
    x, y = coords()
    # Asteroid: lumpy disc, lit from the upper left, cratered.
    cx, cy = 0.46, 0.64
    ang = np.arctan2(y - cy, x - cx)
    d = np.sqrt(((x - cx) / 1.05) ** 2 + (y - cy) ** 2)
    edge = 0.36 + 0.03 * np.sin(ang * 5) + 0.02 * np.sin(ang * 11 + 1)
    rock = np.clip((edge - d) * 300, 0, 1)
    rough = fractal_noise(r, 6, 8)
    craters = np.zeros((S, S))
    for _ in range(14):
        px, py, pr = r.uniform(0.2, 0.75), r.uniform(0.4, 0.95), r.uniform(0.02, 0.05)
        dd = np.sqrt((x - px) ** 2 + (y - py) ** 2)
        craters += np.clip(1 - dd / pr, 0, 1) ** 2 * 0.6 - np.clip(1 - np.abs(dd - pr) / 0.006, 0, 1) * 0.25
    gy, gx = np.gradient(gaussian_filter(rough, 3) * 40 - craters * 6)
    relief = np.clip(0.5 - gx * 0.9 - gy * 1.1, 0, 1)
    lit = np.clip(((cx - x) * 0.9 + (cy - y) * 1.1) / 0.36 + 0.15, 0.02, 1) ** 1.4
    surface = color((150, 125, 105)) * ((0.35 + 0.8 * relief) * lit)[..., None] + color((40, 60, 90)) * 0.06
    img = img * (1 - rock[..., None]) + surface * rock[..., None]
    rim = np.clip(1 - np.abs(d - edge) * 120, 0, 1) * np.clip(((cx - x) + (cy - y)) * 4, 0, 1)
    img = img + color((255, 220, 180)) * rim[..., None] * 0.9
    # Ship on the rim, floodlights down into the dust.
    def ship(dr):
        dr.polygon(P((0.5, 0.29), (0.66, 0.27), (0.72, 0.3), (0.66, 0.33), (0.5, 0.32)), fill=255)
        dr.rectangle(P((0.53, 0.32), (0.545, 0.36)), fill=255)
        dr.rectangle(P((0.62, 0.32), (0.635, 0.36)), fill=255)
        dr.polygon(P((0.46, 0.295), (0.5, 0.29), (0.5, 0.32), (0.46, 0.315)), fill=255)
    m = mask_from(ship, 0.5)
    img = silhouette(img, m, (-1, -0.5), (255, 220, 170), 4, body=(14, 16, 22))
    dust = fractal_noise(r, 5, 5)
    for bx in (0.56, 0.64):
        px, py = x - bx, y - 0.335
        cone = np.clip(1 - np.abs(px) / (0.004 + np.clip(py, 0, 1) * 0.35), 0, 1) * (py > 0) * np.exp(-py * 3)
        img = img + color((255, 235, 190)) * (cone * (0.5 + 0.8 * dust))[..., None] * 0.7
        img = img + color((255, 250, 230)) * radial(bx, 0.34, 0.01, 1.5)[..., None] * 3
    img = img + color((90, 220, 255)) * radial(0.475, 0.305, 0.012, 1.6)[..., None] * 2.5
    img = bloom(img, 0.68, 16, 0.85)
    finish(img, r, "miners")


def supernova():
    """A star tearing itself apart: shock rings racing outwards, filaments, a nearby world caught in the light."""
    r = rng(109)
    img = nebula(r, (6, 3, 12), (150, 40, 60), (40, 80, 170), 0.6)
    img = stars(r, img, 900)
    x, y = coords()
    cx, cy = 0.6, 0.4
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    ang = np.arctan2(y - cy, x - cx)
    filaments = np.clip(np.sin(ang * 23 + fractal_noise(r, 5, 6) * 9), 0, 1) ** 6
    shell = np.exp(-((d - 0.3) / 0.05) ** 2) * (0.5 + 0.8 * fractal_noise(r, 5, 8))
    inner = np.exp(-((d - 0.17) / 0.025) ** 2)
    rays = filaments * np.exp(-d / 0.32) * (d > 0.02)
    img = img + color((255, 120, 80)) * shell[..., None] * 1.2 + color((140, 220, 255)) * inner[..., None] * 1.4 + color((255, 230, 190)) * rays[..., None] * 1.4
    img = img + color((255, 255, 245)) * radial(cx, cy, 0.06, 1.3)[..., None] * 5
    img = streak(img, cx, cy, (255, 220, 190), 1.0, 1.0)
    # A planet in the foreground, its day side blazing toward the blast.
    px, py, pr = 0.22, 0.86, 0.33
    dd = np.sqrt((x - px) ** 2 + (y - py) ** 2)
    disc = np.clip((pr - dd) * 300, 0, 1)
    shade = np.clip(((x - px) * (cx - px) + (y - py) * (cy - py)) / (pr * 0.62) + 0.2, 0, 1) ** 1.5
    surf = color((40, 50, 90)) * (0.5 + 0.5 * fractal_noise(r, 5, 6)[..., None])
    img = img * (1 - disc[..., None]) + (surf * 0.25 + color((255, 170, 120)) * shade[..., None] * 0.8 * fractal_noise(r, 4, 10)[..., None]) * disc[..., None]
    img = img + color((255, 190, 140)) * (np.clip(1 - np.abs(dd - pr) * 70, 0, 1) ** 2 * shade)[..., None] * 1.6
    img = bloom(img, 0.65, 22, 1.0)
    finish(img, r, "supernova")


def derelict():
    """A colossal ring station, abandoned, silhouetted against a swollen red giant; a scout ship's lights approaching."""
    r = rng(127)
    img = nebula(r, (8, 3, 6), (160, 40, 30), (90, 30, 60), 0.6)
    img = stars(r, img, 600)
    x, y = coords()
    # Red giant: huge, low, with granulation and a soft limb.
    cx, cy, R = 0.5, 0.95, 0.62
    d = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    disc = np.clip((R - d) * 120, 0, 1)
    gran = fractal_noise(r, 6, 16)
    limb = np.clip(1 - d / R, 0, 1) ** 0.45
    star = (color((255, 110, 40)) * (0.6 + 0.6 * gran[..., None]) + color((255, 200, 120)) * (gran[..., None] ** 3)) * limb[..., None]
    img = img * (1 - disc[..., None]) + star * disc[..., None] * 1.3
    img = img + color((255, 90, 40)) * (np.exp(-(d - R) / 0.08) * (d > R))[..., None] * 0.9
    # The ring station: thick torus seen tilted, with spokes and a hub; broken segment.
    def station(dr):
        bbox = [0.18 * S, 0.3 * S, 0.82 * S, 0.62 * S]
        dr.ellipse(bbox, outline=255, width=int(0.035 * S))
        dr.ellipse([0.46 * S, 0.43 * S, 0.54 * S, 0.49 * S], fill=255)
        for a in range(0, 360, 60):
            ex = 0.5 + 0.32 * math.cos(math.radians(a))
            ey = 0.46 + 0.16 * math.sin(math.radians(a))
            dr.line([0.5 * S, 0.46 * S, ex * S, ey * S], fill=255, width=int(0.008 * S))
        dr.rectangle([0.495 * S, 0.2 * S, 0.505 * S, 0.43 * S], fill=255)
    m = mask_from(station, 0.6)
    gap = np.clip(1 - (np.abs(x - 0.75) < 0.05) * (y < 0.42) * (y > 0.3), 0, 1)  # a broken section
    m = m * gap
    img = silhouette(img, m, (0, 1), (255, 140, 70), 6, body=(10, 6, 8), rim_gain=2.4)
    for k in range(5):
        img = img + color((120, 220, 255)) * radial(0.24 + k * 0.11, 0.33 + (k % 2) * 0.27, 0.004, 1.5)[..., None] * 2 * (k != 4)
    img = img + color((150, 240, 255)) * radial(0.3, 0.2, 0.01, 1.4)[..., None] * 3
    img = streak(img, 0.3, 0.2, (150, 230, 255), 0.4, 0.4)
    img = bloom(img, 0.68, 18, 0.9)
    finish(img, r, "derelict")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for scene in (crew, eclipse, stargate, launch, moonbase, comets, blackhole, aurora, miners, supernova, derelict):
        scene()
