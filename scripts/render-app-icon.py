"""GALACTIC GAMES app icon (v125), rendered procedurally with numpy — the icon the phone shows on the home screen and
on the launch (splash) screen.

The original mark (app/icon.svg: a cyan G inside a lilac orbit with a gold moon) developed into a lit scene: a banded
ion-blue gas giant lit from the upper left with an atmospheric rim, a G carved into it that glows from inside with a
bevelled metal lip, a ringed orbit that passes behind the planet at the top and in front of it at the bottom, a gold
moon on the ring, and a deep-space backdrop with a faint nebula and stars.

Outputs (public/): icon-512.png and icon-192.png (rounded tile), icon-maskable-512.png (full bleed, the art inside the
80 % safe circle), apple-touch-icon.png (180, full bleed: iOS rounds it). Usage: python3 scripts/render-app-icon.py
"""
import math, os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
N = 1024


def render(scale: float) -> np.ndarray:
    """RGB float image N×N; `scale` shrinks the art around the centre (1 = full tile)."""
    ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)
    u = (xs + 0.5 - N / 2) / (N / 2) / scale          # −1…1 across the art box
    v = (ys + 0.5 - N / 2) / (N / 2) / scale
    rng = np.random.default_rng(125)

    # --- backdrop: deep navy, a soft nebula and stars
    r0 = np.sqrt(u * u + v * v)
    img = np.zeros((N, N, 3))
    img[:] = np.array([0.020, 0.040, 0.100])
    img += np.clip(1 - r0 / 1.5, 0, 1)[..., None] ** 2 * np.array([0.04, 0.09, 0.17])
    neb1 = np.exp(-(((u + 0.55) / 0.55) ** 2 + ((v + 0.45) / 0.35) ** 2))
    neb2 = np.exp(-(((u - 0.6) / 0.5) ** 2 + ((v - 0.62) / 0.3) ** 2))
    img += neb1[..., None] * np.array([0.20, 0.10, 0.32]) * 0.55 + neb2[..., None] * np.array([0.05, 0.22, 0.26]) * 0.5
    stars = rng.random((N, N))
    sm = (stars > 0.99945) * rng.random((N, N)) ** 2
    sb = ndimage.gaussian_filter(sm, 1.3) * 14
    img += np.clip(sb, 0, 1)[..., None] * np.array([0.9, 0.95, 1.0])

    # --- planet
    PX, PY, PR = 0.0, 0.04, 0.56
    dx, dy = (u - PX) / PR, (v - PY) / PR
    rr = dx * dx + dy * dy
    inside = rr < 1
    nz = np.sqrt(np.clip(1 - rr, 0, 1))
    L = np.array([-0.58, -0.62, 0.53]); L /= np.linalg.norm(L)
    lam = np.clip(dx * L[0] + dy * L[1] + nz * L[2], 0, 1)
    # Bands follow the ring plane (tilted), with turbulence.
    tilt = math.radians(-20)
    by = -dx * math.sin(tilt) + dy * math.cos(tilt)
    turb = ndimage.gaussian_filter(rng.random((N, N)), 14) - 0.5
    band = 0.5 + 0.5 * np.sin(by * 13 + turb * 9 + np.sin(by * 4) * 1.5)
    deep = np.array([0.05, 0.20, 0.42]); mid = np.array([0.18, 0.56, 0.78]); light = np.array([0.62, 0.92, 0.94])
    pc = deep + (mid - deep) * band[..., None]
    pc = pc + (light - pc) * np.clip((band - 0.78) * 3.5, 0, 1)[..., None]
    shade = 0.10 + 1.05 * lam ** 0.9
    limb = 0.55 + 0.45 * nz
    pc = pc * (shade * limb)[..., None]
    rim = np.exp(-((1 - np.sqrt(np.clip(rr, 0, 1))) / 0.05) ** 2) * (0.35 + 0.65 * np.clip(dx * L[0] + dy * L[1] + 0.4, 0, 1))
    pc += rim[..., None] * np.array([0.45, 0.95, 1.0]) * 0.55
    # Specular glint on the lit side.
    hx, hy = dx + 0.32, dy + 0.36
    pc += (np.exp(-(hx * hx + hy * hy) / 0.06) * 0.22)[..., None]

    # --- the G, carved into the planet
    gx, gy = (u - PX) / (PR * 0.78), (v - PY) / (PR * 0.78)
    gr = np.sqrt(gx * gx + gy * gy)
    ang = np.degrees(np.arctan2(gy, gx))                    # 0° = right, +90° = down
    ring_g = (gr < 0.86) & (gr > 0.50) & ~((ang > -48) & (ang < 6))
    bar = (gx > 0.02) & (gx < 0.86) & (gy > -0.04) & (gy < 0.17) & (gr < 0.86)
    stem = (gx > 0.56) & (gx < 0.86) & (gy > -0.04) & (gy < 0.5) & (gr < 0.86)
    gmask = (ring_g | bar | stem).astype(float)
    gmask = ndimage.gaussian_filter(gmask, 1.2)
    # Bevel from the height field: light from the upper left on the lip, glow in the groove.
    height = ndimage.gaussian_filter(gmask, 7)
    gyy, gxx = np.gradient(height)
    bevel = np.clip(-(gxx * L[0] + gyy * L[1]) * 60, -1, 1)
    groove = np.array([0.16, 0.78, 0.98]) * (0.75 + 0.6 * np.clip(1 - gr, 0, 1))[..., None]
    core = ndimage.gaussian_filter((gmask > 0.5).astype(float), 3)
    groove = groove + (np.array([0.9, 1.0, 1.0]) - groove) * np.clip((core - 0.8) * 4, 0, 1)[..., None] * 0.7
    gsh = ndimage.shift(gmask, (10, 8), order=1)              # carved shadow on the planet
    pc = pc * (1 - 0.55 * np.clip(gsh - gmask, 0, 1))[..., None]
    lip = np.clip(np.abs(bevel), 0, 1) * (gmask > 0.05) * (gmask < 0.95)
    pc = pc * (1 - gmask[..., None]) + groove * gmask[..., None]
    pc += (np.clip(bevel, 0, 1) * lip)[..., None] * np.array([0.9, 0.95, 1.0]) * 0.9
    pc -= (np.clip(-bevel, 0, 1) * lip)[..., None] * 0.35
    glow = ndimage.gaussian_filter(gmask, 18)
    pc += glow[..., None] * np.array([0.1, 0.6, 0.85]) * 0.45

    # --- ring (orbit) in the tilted plane: ringlets + a gap, lit, translucent
    ca, sa = math.cos(tilt), math.sin(tilt)
    ru = ((u - PX) * ca + (v - PY) * sa)
    rv = (-(u - PX) * sa + (v - PY) * ca)
    A, B = 0.98, 0.24
    er = np.sqrt((ru / A) ** 2 + (rv / B) ** 2)
    ringband = (er > 0.70) & (er < 1.0)
    lines = 0.55 + 0.45 * np.sin(er * 95) * np.sin(er * 37 + 1)
    gap = np.exp(-((er - 0.84) / 0.012) ** 2)
    rd = np.clip(lines - gap * 0.9, 0, 1) * ringband * np.clip((1 - er) / 0.03, 0, 1) * np.clip((er - 0.70) / 0.03, 0, 1)
    ringcol = np.array([0.80, 0.74, 1.0]) * (0.55 + 0.45 * lines)[..., None]
    ringcol += np.array([1.0, 0.86, 0.55]) * (0.25 * np.clip(-ru, 0, 1))[..., None]       # warm on the lit side
    front = rv > 0                                                                        # near half (lower)
    # Planet shadow on the far ring, ring shadow on the planet.
    on_planet_shadow = inside & (np.abs(((u - PX - 0.05) * ca + (v - PY - 0.06) * sa) / A) ** 2 + (((-(u - PX - 0.05) * sa + (v - PY - 0.06) * ca)) / B) ** 2 < 1.0) & ~front
    pc = pc * np.where(on_planet_shadow, 0.82, 1.0)[..., None]
    alpha_r = (rd * 0.92)[..., None]
    # Layering: background → far ring → planet → near ring.
    far = alpha_r * (~front)[..., None]
    img = img * (1 - far) + ringcol * far
    img = np.where(inside[..., None], pc, img)
    # Soft anti-aliased planet edge.
    edge = np.clip((1 - np.sqrt(rr)) * PR * N * scale / 2 / 1.5, 0, 1)
    img = img * edge[..., None] + (img * (1 - edge[..., None]))
    nearA = alpha_r * front[..., None]
    img = img * (1 - nearA) + ringcol * nearA

    # --- gold moon on the near ring (front right) with its glow
    ma = math.radians(28)
    mx = PX + (A * 0.85 * math.cos(ma)) * ca - (B * 0.85 * math.sin(ma)) * sa
    my = PY + (A * 0.85 * math.cos(ma)) * sa + (B * 0.85 * math.sin(ma)) * ca
    MR = 0.085
    mdx, mdy = (u - mx) / MR, (v - my) / MR
    mrr = mdx * mdx + mdy * mdy
    mz = np.sqrt(np.clip(1 - mrr, 0, 1))
    mlam = np.clip(mdx * L[0] + mdy * L[1] + mz * L[2], 0, 1)
    mcol = np.array([1.0, 0.80, 0.40]) * (0.25 + 1.5 * mlam)[..., None] + np.exp(-((mdx + 0.35) ** 2 + (mdy + 0.4) ** 2) / 0.05)[..., None] * 0.35
    mglow = np.exp(-mrr / 6) * 0.35
    img += mglow[..., None] * np.array([1.0, 0.8, 0.45])
    img = np.where((mrr < 1)[..., None], mcol, img)
    # A lens sparkle on the brightest star (upper right).
    sx, sy = 0.66, -0.7
    d = np.sqrt((u - sx) ** 2 + (v - sy) ** 2)
    spark = np.exp(-d / 0.02) * 0.9 + (np.exp(-np.abs(u - sx) / 0.006) * np.exp(-np.abs(v - sy) / 0.13) + np.exp(-np.abs(v - sy) / 0.006) * np.exp(-np.abs(u - sx) / 0.13)) * 0.6
    img += spark[..., None] * np.array([0.9, 0.97, 1.0])
    # Gentle vignette and tone map.
    img *= (1 - 0.25 * np.clip(r0 / 1.4, 0, 1) ** 2)[..., None]
    img = 1 - np.exp(-img * 1.35)
    return np.clip(img, 0, 1)


def to_image(rgb: np.ndarray, rounded: bool) -> Image.Image:
    im = Image.fromarray((rgb * 255).astype(np.uint8), "RGB").convert("RGBA")
    if rounded:
        ys, xs = np.mgrid[0:N, 0:N].astype(np.float64)
        r = N * 15 / 64
        cx = np.clip(xs, r, N - r); cy = np.clip(ys, r, N - r)
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        a = np.clip(r - d + 0.5, 0, 1)
        im.putalpha(Image.fromarray((a * 255).astype(np.uint8)))
    return im


full = render(0.96)
safe = render(0.80)
tile = to_image(full, True)
tile.resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, "icon-512.png"), optimize=True)
tile.resize((192, 192), Image.LANCZOS).save(os.path.join(ROOT, "icon-192.png"), optimize=True)
to_image(safe, False).resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, "icon-maskable-512.png"), optimize=True)
to_image(render(0.9), False).resize((180, 180), Image.LANCZOS).save(os.path.join(ROOT, "apple-touch-icon.png"), optimize=True)
print("icons written")
