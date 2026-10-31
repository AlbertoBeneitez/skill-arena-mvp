"""Bowling V3 art (v125), rendered procedurally with numpy — everything original.

Outputs
  public/art/bowling-lane.webp  512 × 2048: the lane seen from above, covering x ∈ [-235, LANE + 235] mm (gutters
                                included) and y ∈ [0, PIT] mm, far end (pit) on the top row. components/games/Bowling.tsx
                                samples one row per screen line, so the boards, grain, arrows and dots are in perspective.
  public/art/bowling-pit.webp   1024 × 560 RGBA: the wall behind the pins (pit opening with curtain, the masking unit
                                with a ringed planet and neon tubes, side dividers), covering x ∈ [-1500, LANE + 1500] mm and
                                0–2200 mm of height, drawn standing on the floor at y = PIT + 300 mm.
Geometry comes from lib/verified/bowlingCore.v3.ts (lane 1054 mm, head pin 32 004 mm, pit 33 416 mm).
Usage: python3 scripts/render-bowling-art.py
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
LANE, HEAD, PIT, OIL = 1054.0, 32004.0, 33416.0, 19200.0
SPACING = 305.0
rng = np.random.default_rng(125)


def noise1(n, scale, seed):
    r = np.random.default_rng(seed).random(int(n / scale) + 3)
    x = np.arange(n) / scale
    i = x.astype(int); f = x - i; f = f * f * (3 - 2 * f)
    return r[i] * (1 - f) + r[i + 1] * f


# ---------------------------------------------------------------- lane
W, H = 512, 2048
XMIN, XMAX = -235.0, LANE + 235.0
xs = XMIN + (np.arange(W) + 0.5) / W * (XMAX - XMIN)            # mm per column
ys = PIT * (1 - (np.arange(H) + 0.5) / H)                        # mm per row (top = pit)
X, Y = np.meshgrid(xs, ys)
img = np.zeros((H, W, 3))

lane = (X >= 0) & (X <= LANE)
board = np.clip((X / LANE * 39).astype(int), 0, 38)
bfrac = X / LANE * 39 - board
# Maple on the heads and the pin deck, pine in between (like a real lane), each board a slightly different tone.
maple = (Y < 8600) | (Y > HEAD - 900)
tone = np.random.default_rng(7).normal(0, 0.035, 39)[board]
base_maple = np.array([0.93, 0.76, 0.52]); base_pine = np.array([0.84, 0.60, 0.37])
col = np.where(maple[..., None], base_maple, base_pine) * (1 + tone[..., None])
# Grain: streaks stretched along the board, a different pattern per board.
grain = np.zeros((H, W))
for b in range(39):
    m = board == b
    g = noise1(H, 9 + b % 5, 100 + b)[:, None] * 0.6 + noise1(H, 2.2, 300 + b)[:, None] * 0.4
    wave = np.sin((bfrac * 6.0 + g * 5.0 + b) * math.pi)
    grain = np.where(m, wave, grain)
col *= (1 + 0.045 * grain[..., None])
# Board seams and staggered butt joints in the pine section.
seam = np.minimum(bfrac, 1 - bfrac) < 0.055
col = np.where(seam[..., None], col * 0.72, col)
joints = np.random.default_rng(9).uniform(9000, HEAD - 1400, (39, 3))
for b in range(39):
    for jy in joints[b]:
        m = (board == b) & (np.abs(Y - jy) < 9)
        col[m] *= 0.75
# Oil: a slightly glossier, cooler front; dry back end warmer.
oil = np.clip((OIL - Y) / 2500, 0, 1)
col = col * (1 - 0.05 * oil[..., None]) + np.array([0.95, 0.95, 1.0]) * 0.05 * oil[..., None]
# Long soft reflections of the ceiling lights.
for lx in (0.25, 0.5, 0.75):
    d = np.abs(X - LANE * lx) / 60
    col += 0.06 * np.exp(-d * d)[..., None]
img = np.where(lane[..., None], col, img)

# Gutters: concave chrome with a bright centre and dark lips.
for g0, g1 in ((-235.0, 0.0), (LANE, LANE + 235.0)):
    m = (X >= g0) & (X < g1)
    u = (X - g0) / (g1 - g0)
    shade = 0.16 + 0.42 * np.exp(-((u - 0.5) / 0.18) ** 2) + 0.12 * np.exp(-((u - 0.2) / 0.05) ** 2)
    shade *= 1 + 0.06 * np.sin(Y / 700)
    gc = np.stack([shade * 0.62, shade * 0.72, shade * 0.95], -1)
    lip = (np.abs(u) < 0.04) | (np.abs(u - 1) < 0.04)
    gc[lip] = [0.08, 0.09, 0.14]
    img = np.where(m[..., None], gc, img)

pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
d = ImageDraw.Draw(pil)
px = lambda x: (x - XMIN) / (XMAX - XMIN) * W
py = lambda y: (1 - y / PIT) * H
# Arrows (7), dots and range finders at the same fractions of the lane as on a regulation lane.
for k in range(7):
    x = LANE / 2 + (k - 3) * 135
    y = 8050 + abs(k - 3) * 525
    tri = [(px(x), py(y)), (px(x - 26), py(y - 660)), (px(x + 26), py(y - 660))]
    d.polygon(tri, fill=(46, 24, 14))
    d.line(tri + [tri[0]], fill=(110, 230, 240), width=1)
for k in (-4, -3, -2, -1, 1, 2, 3, 4):
    for y in (2450, 900):
        x = LANE / 2 + k * (118 if y > 1000 else 105)
        r = 1.6
        d.ellipse([px(x) - r, py(y) - r * 2.2, px(x) + r, py(y) + r * 2.2], fill=(52, 28, 16))
for x in (LANE * 10 / 39, LANE * 29 / 39):
    d.rectangle([px(x) - 1.2, py(15400), px(x) + 1.2, py(14100)], fill=(70, 38, 20))
# Pin spots on the deck.
for c, r in [[0, 0], [-1, 1], [1, 1], [-2, 2], [0, 2], [2, 2], [-3, 3], [-1, 3], [1, 3], [3, 3]]:
    x = LANE / 2 + c * SPACING / 2
    y = HEAD + r * SPACING * 0.866
    d.ellipse([px(x) - 9, py(y) - 2.2, px(x) + 9, py(y) + 2.2], fill=(150, 104, 64))
    d.ellipse([px(x) - 5, py(y) - 1.2, px(x) + 5, py(y) + 1.2], fill=(118, 78, 46))
# Foul line: a neon red strip on the last rows.
d.rectangle([px(0), H - 5, px(LANE), H - 1], fill=(255, 70, 100))
lane_img = pil.filter(ImageFilter.GaussianBlur(0.35))
lane_img.save(os.path.join(ROOT, "public/art/bowling-lane.webp"), quality=86, method=6)

# ---------------------------------------------------------------- pit wall / masking unit
PW, PH = 1024, 560
XM0, XM1, HM = -1500.0, LANE + 1500.0, 2200.0
sx = PW / (XM1 - XM0); sy = PH / HM
gy, gx = np.mgrid[0:PH, 0:PW].astype(np.float64)
WX = XM0 + (gx + 0.5) / sx
WZ = HM - (gy + 0.5) / sy                                # height above the floor (mm)
rgba = np.zeros((PH, PW, 4))
# Wall: deep navy with soft vertical panel lines.
wall = np.stack([0.03 + 0 * WX, 0.05 + 0 * WX, 0.11 + 0 * WX], -1)
wall *= (1 + 0.25 * (np.cos(WX / 380 * math.pi) > 0.96)[..., None])
rgba[..., :3] = wall; rgba[..., 3] = 1.0
# Pit opening (x in the lane + gutters, height < 520 mm): black with curtain folds.
po = (WX > -260) & (WX < LANE + 260) & (WZ < 520)
fold = 0.04 + 0.035 * (0.5 + 0.5 * np.sin(WX / 40)) * np.clip(WZ / 520, 0, 1)
rgba[po, :3] = np.stack([fold * 0.9, fold * 0.7, fold * 1.4], -1)[po]
# Masking unit: a rounded panel over the lane with a planet scene inside.
mx0, mx1, mz0, mz1 = -380.0, LANE + 380.0, 700.0, 2050.0
cxm, czm = (mx0 + mx1) / 2, (mz0 + mz1) / 2
inside = (WX > mx0) & (WX < mx1) & (WZ > mz0) & (WZ < mz1)
u = (WX - mx0) / (mx1 - mx0); v = (WZ - mz0) / (mz1 - mz0)
sky = np.stack([0.05 + 0.10 * v, 0.03 + 0.05 * v, 0.16 + 0.22 * v], -1)
stars = np.random.default_rng(5).random((PH, PW)) > 0.9965
sky[stars] = [0.9, 0.92, 1.0]
# Planet with bands and a terminator.
pcx, pcz, pr = cxm + 420, mz0 + 640, 430.0
ddx, ddz = (WX - pcx) / pr, (WZ - pcz) / pr
rr = ddx * ddx + ddz * ddz
pl = rr < 1
nz = np.sqrt(np.clip(1 - rr, 0, 1))
lam = np.clip(-0.55 * ddx + 0.45 * ddz + 0.7 * nz, 0, 1)
band = 0.5 + 0.5 * np.sin(ddz * 11 + np.sin(ddx * 3) * 0.6)
pcol = np.stack([0.95 * band + 0.55 * (1 - band), 0.62 * band + 0.38 * (1 - band), 0.42 * band + 0.55 * (1 - band)], -1)
pcol *= (0.12 + 0.95 * lam)[..., None]
sky = np.where(pl[..., None], pcol, sky)
# Ring (an ellipse band, hidden behind the planet's upper half).
ex, ez = (WX - pcx) / (pr * 2.1), (WZ - pcz) / (pr * 0.42)
er = np.sqrt(ex * ex + ez * ez)
ring = (er > 0.72) & (er < 1.0) & ~(pl & (WZ > pcz))
rc = 0.55 + 0.35 * np.sin(er * 60)
sky = np.where(ring[..., None], np.stack([rc * 0.95, rc * 0.82, rc * 0.62], -1), sky)
rgba[inside, :3] = sky[inside]
# Neon frame: pink outer tube, cyan inner tube, both glowing.
edge = np.minimum.reduce([WX - mx0, mx1 - WX, WZ - mz0, mz1 - WZ])
edge = np.where(inside, edge, -np.minimum.reduce([np.abs(WX - np.clip(WX, mx0, mx1)) + np.abs(WZ - np.clip(WZ, mz0, mz1))]) * 1.0)
glow_p = np.exp(-((edge - 0) / 28) ** 2)
glow_c = np.exp(-((edge - 60) / 14) ** 2) * inside
rgba[..., :3] += glow_p[..., None] * np.array([1.0, 0.24, 0.6]) * 0.9
rgba[..., :3] += glow_c[..., None] * np.array([0.5, 0.9, 0.95]) * 0.8
# Light strips on the dividers between lanes (left and right of the pit).
for xd in (-900.0, LANE + 900.0):
    s = np.exp(-((WX - xd) / 22) ** 2) * (WZ < 1900)
    rgba[..., :3] += s[..., None] * np.array([0.5, 0.88, 0.95]) * 0.7
rgba[..., :3] = np.clip(rgba[..., :3], 0, 1)
pit = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
# "GALACTIC" lettering on the masking unit (plain sans; vector-free, drawn with PIL's default font scaled up).
txt = Image.new("L", (640, 70), 0)
ImageDraw.Draw(txt).text((4, 2), "GALACTIC  LANES", fill=255, font_size=44)
txt = txt.crop(txt.getbbox())
tw = int((mx1 - mx0) * sx * 0.52); th = int(txt.height * tw / txt.width)
txt = txt.resize((tw, th), Image.LANCZOS)
tx0 = int((mx0 + 70 - XM0) * sx); tz = int((HM - (mz0 + 160)) * sy) - th
glow = txt.filter(ImageFilter.GaussianBlur(4))
pit.paste((255, 120, 210), (tx0, tz), glow)
pit.paste((255, 245, 250), (tx0, tz), txt)
pit.save(os.path.join(ROOT, "public/art/bowling-pit.webp"), quality=88, method=6)
print("bowling-lane.webp", lane_img.size, "bowling-pit.webp", pit.size)
