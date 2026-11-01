"""GALACTIC GAMES app icon (v125, developed in v131), rendered procedurally with numpy — the icon the phone shows on the home screen and
on the launch (splash) screen.

The original mark (app/icon.svg: a cyan G inside a lilac orbit with a gold moon) developed into a lit scene: a banded
ion-blue gas giant lit from the upper left with an atmospheric rim, a G carved into it that glows from inside with a
bevelled metal lip, a ringed orbit that passes behind the planet at the top and in front of it at the bottom, a gold
moon on the ring, and a deep-space backdrop with a faint nebula and stars. v131: the G is raised in front of everything
(bevelled ion metal, a dark keyline and a cast shadow, so it reads at 48 px), the planet is a deep night blue and the
ring takes the warm sand of the welcome planet.

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
    # v134: black, like the app (no navy or violet nebula); a faint warm glow where the sun hides behind the planet.
    img[:] = np.array([0.020, 0.020, 0.024])
    img += np.exp(-(((u + 0.62) / 0.45) ** 2 + ((v + 0.38) / 0.45) ** 2))[..., None] * np.array([0.16, 0.12, 0.07])
    stars = rng.random((N, N))
    sm = (stars > 0.99945) * rng.random((N, N)) ** 2
    sb = ndimage.gaussian_filter(sm, 1.3) * 14
    img += np.clip(sb, 0, 1)[..., None] * np.array([0.9, 0.95, 1.0])

    # --- planet (v134): the sand giant of the welcome screen, lit from behind on the left: a bright crescent and a
    # dark night side that the rings light faintly, so the G in front of it reads at any size
    PX, PY, PR = 0.0, 0.02, 0.66
    dx, dy = (u - PX) / PR, (v - PY) / PR
    rr = dx * dx + dy * dy
    inside = rr < 1
    nz = np.sqrt(np.clip(1 - rr, 0, 1))
    L = np.array([-0.62, -0.30, -0.72]); L /= np.linalg.norm(L)
    lam = np.clip(dx * L[0] + dy * L[1] + nz * L[2], 0, 1)
    tilt = math.radians(-20)
    by = -dx * math.sin(tilt) + dy * math.cos(tilt)
    turb = ndimage.gaussian_filter(rng.random((N, N)), 14) - 0.5
    band = 0.5 + 0.5 * np.sin(by * 11 + turb * 6 + np.sin(by * 4) * 1.5)
    deep = np.array([0.30, 0.20, 0.12]); mid = np.array([0.62, 0.48, 0.30]); light = np.array([0.92, 0.82, 0.62])
    pc = deep + (mid - deep) * band[..., None]
    pc = pc + (light - pc) * np.clip((band - 0.82) * 3.0, 0, 1)[..., None]
    pc = pc * ((0.07 + 1.6 * lam ** 0.9) * (0.55 + 0.45 * nz))[..., None]
    rim = np.exp(-((1 - np.sqrt(np.clip(rr, 0, 1))) / 0.04) ** 2) * np.clip(dx * L[0] + dy * L[1] + 0.2, 0, 1)
    pc += rim[..., None] * np.array([1.0, 0.86, 0.64]) * 0.9
    halo = np.exp(-np.clip(np.sqrt(rr) - 1, 0, None) / 0.035) * (rr >= 1) * np.clip(dx * L[0] + dy * L[1] + 0.2, 0, 1)
    img += halo[..., None] * np.array([1.0, 0.85, 0.62]) * 0.6

    # --- ring in the tilted plane: warm sand ringlets with a division, like the welcome planet
    ca, sa = math.cos(tilt), math.sin(tilt)
    ru = ((u - PX) * ca + (v - PY) * sa)
    rv = (-(u - PX) * sa + (v - PY) * ca)
    A, B = 1.16, 0.29
    er = np.sqrt((ru / A) ** 2 + (rv / B) ** 2)
    lines = 0.55 + 0.45 * np.sin(er * 95) * np.sin(er * 37 + 1)
    gap = np.exp(-((er - 0.84) / 0.012) ** 2)
    rd = np.clip(lines - gap * 0.95, 0, 1) * np.clip((1 - er) / 0.03, 0, 1) * np.clip((er - 0.70) / 0.03, 0, 1)
    ringcol = np.array([0.95, 0.83, 0.60]) * (0.6 + 0.4 * lines)[..., None] * (0.75 + 0.35 * np.clip(-ru, 0, 1))[..., None]
    front = rv > 0
    shadow_band = inside & ~front & (np.abs(er - 0.85) < 0.2)
    pc = pc * np.where(shadow_band, 0.8, 1.0)[..., None]
    alpha_r = (rd * 0.92)[..., None]
    far = alpha_r * (~front)[..., None]
    img = img * (1 - far) + ringcol * far
    edge = np.clip((1 - np.sqrt(rr)) * PR * N * scale / 2 / 1.5, 0, 1)[..., None]
    img = img * (1 - edge) + pc * edge
    nearA = alpha_r * front[..., None]
    img = img * (1 - nearA) + ringcol * nearA

    # --- the G: a raised, bevelled ion-metal letter in front of everything, with a dark keyline and a cast shadow
    gx, gy = (u - PX) / (PR * 0.80), (v - PY) / (PR * 0.80)
    gr = np.sqrt(gx * gx + gy * gy)
    ang = np.degrees(np.arctan2(gy, gx))                    # 0° = right, +90° = down
    ring_g = (gr < 0.90) & (gr > 0.48) & ~((ang > -46) & (ang < 4))
    bar = (gx > 0.06) & (gx < 0.90) & (gy > -0.05) & (gy < 0.18) & (gr < 0.90)
    stem = (gx > 0.55) & (gx < 0.90) & (gy > -0.05) & (gy < 0.52) & (gr < 0.90)
    hard = ring_g | bar | stem
    px = N * scale / 2 / 1024                               # pixels per 1/1024 of the tile
    inner = ndimage.distance_transform_edt(hard)
    outer = ndimage.distance_transform_edt(~hard)
    gmask = np.clip(inner - outer + 0.5, 0, 1)              # anti-aliased coverage
    shadow = ndimage.gaussian_filter(ndimage.shift(hard.astype(float), (16 * px, 10 * px), order=1), 9 * px)
    img *= (1 - 0.6 * shadow * (1 - gmask))[..., None]
    keyline = np.clip(11 * px - outer, 0, 1) * (1 - gmask)
    img = img * (1 - 0.88 * keyline[..., None]) + np.array([0.01, 0.03, 0.08]) * 0.88 * keyline[..., None]
    # Bevel: a rounded height field from the distance to the edge, lit from the upper left, plus a chrome sky/ground.
    hgt = np.clip(inner / (26 * px), 0, 1)
    hgt = ndimage.gaussian_filter(np.sin(hgt * np.pi / 2), 2 * px)
    hy, hx = np.gradient(hgt * 26 * px)
    nn = np.stack([-hx, -hy, np.ones_like(hx)], -1); nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    diff = np.clip(nn @ L, 0, 1)
    spec = np.clip(nn @ ((L + np.array([0, 0, 1])) / np.linalg.norm(L + np.array([0, 0, 1]))), 0, 1) ** 40
    t = np.clip((v - (PY - 0.42)) / 0.84, 0, 1)[..., None]   # top → bottom of the letter
    metal = np.array([1.25, 1.75, 1.80]) * (1 - t) + np.array([0.10, 0.85, 1.10]) * t   # pre tone-curve values
    metal = metal * (1 - np.clip((t - 0.48) * 9, 0, 1) * 0.18)           # chrome horizon line
    gcol = metal * (0.55 + 0.6 * diff)[..., None] + spec[..., None] * 0.9
    img = img * (1 - gmask[..., None]) + gcol * gmask[..., None]
    img += ndimage.gaussian_filter(gmask, 22 * px)[..., None] * np.array([0.05, 0.35, 0.45]) * 0.5 * (1 - gmask[..., None])

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
