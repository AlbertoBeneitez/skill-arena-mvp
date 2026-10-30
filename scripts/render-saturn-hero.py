"""Hero planet for the GALACTIC GAMES stage (v123): a physically lit ringed gas giant, rendered procedurally with numpy.

Output: public/art/saturn-hero.webp (RGBA). It covers world units x ∈ [X0, X1], y ∈ [Y0, Y1] of the 390-wide stage
(components/OrbitalScene.tsx draws it at exactly that rectangle). Everything is original: banded atmosphere with fBm
turbulence and a storm, Lambert light with limb darkening and an atmospheric rim, the rings' shadow on the clouds, the
planet's shadow on the rings, and ~40 ringlets with a Cassini-like division.  Usage: python3 scripts/render-saturn-hero.py
"""
import math, os, sys
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "art", "saturn-hero.webp")
PX, PY, PR = 282.0, 300.0, 128.0          # planet centre and radius (world units, as in OrbitalScene)
TILT = math.radians(-17.0)                 # ring major axis on screen
SQUASH = 0.235                             # ring minor/major ratio
X0, X1, Y0, Y1 = -20.0, 400.0, 150.0, 452.0
S = 3.0                                    # pixels per world unit
W, H = int((X1 - X0) * S), int((Y1 - Y0) * S)

rng = np.random.default_rng(123)

# Frame: e1 along the ring's major axis, e2 the in-plane axis seen squashed, N the ring/pole normal (towards the viewer a bit).
u = np.array([math.cos(TILT), math.sin(TILT), 0.0])
w = np.array([-math.sin(TILT), math.cos(TILT), 0.0])
z = np.array([0.0, 0.0, 1.0])
c = math.sqrt(1 - SQUASH ** 2)
e1 = u
e2 = SQUASH * w + c * z
N = -c * w + SQUASH * z
L = np.array([-0.62, -0.55, 0.56]); L /= np.linalg.norm(L)     # key light: upper left, a little in front

ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
X = X0 + (xs + 0.5) / S
Y = Y0 + (ys + 0.5) / S
dx, dy = (X - PX) / PR, (Y - PY) / PR
rr = dx * dx + dy * dy
inside = rr < 1.0


def value_noise(shape_xy, scale, seed, periodic_x=None):
    """Smooth value noise sampled at arbitrary float coords (array x, y)."""
    def sample(x, y):
        gx = int(math.ceil(scale[0])) + 2
        gy = int(math.ceil(scale[1])) + 2
        r = np.random.default_rng(seed).random((gy + 1, gx + 1))
        if periodic_x:
            r[:, -1] = r[:, 0]
        xf, yf = x * scale[0], y * scale[1]
        x0 = np.floor(xf).astype(int); y0 = np.floor(yf).astype(int)
        tx, ty = xf - x0, yf - y0
        x0 %= gx; y0 %= gy
        x1 = (x0 + 1) % gx; y1 = (y0 + 1) % gy
        sx = tx * tx * (3 - 2 * tx); sy = ty * ty * (3 - 2 * ty)
        a = r[y0, x0] * (1 - sx) + r[y0, x1] * sx
        b = r[y1, x0] * (1 - sx) + r[y1, x1] * sx
        return a * (1 - sy) + b * sy
    return sample


def fbm(x, y, base, octaves, seed):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        f = base * (2 ** o)
        total = total + amp * value_noise(None, (f, f * 0.5), seed + o)(x, y)
        norm += amp
        amp *= 0.5
    return total / norm

rgb = np.zeros((H, W, 3))
alpha = np.zeros((H, W))

# ---------------- planet ----------------
nz = np.sqrt(np.clip(1 - rr, 0, 1))
n = np.stack([dx, dy, nz], axis=-1)
lat = np.arcsin(np.clip(n @ N, -1, 1))
lon = np.arctan2(n @ np.cross(N, e1), n @ e1)
lu, lv = (lon / (2 * np.pi)) % 1.0, (lat / np.pi + 0.5)
# Gentle swirls: longitude-stretched noise only nudges the latitude near the belts.
swirl = fbm(lu * 2.0, lv * 7.0, 3.0, 4, 7) - 0.5
lat2 = lat + 0.022 * swirl
# Latitude profile: a smoothed random sequence of zones and belts, plus two dominant equatorial belts.
LAT = np.linspace(-np.pi / 2, np.pi / 2, 900)
_bz = np.random.default_rng(5).random(LAT.size)
_kk = np.exp(-np.linspace(-3, 3, 31) ** 2); _kk /= _kk.sum()
prof = np.convolve(_bz, _kk, mode="same")
prof = (prof - prof.min()) / (prof.max() - prof.min())
prof = 0.6 * prof + 0.4 * (0.5 + 0.5 * np.cos(LAT * 6.0))
prof = (prof - prof.min()) / (prof.max() - prof.min())
prof = prof ** 1.25
prof -= 0.32 * np.exp(-((LAT - 0.30) / 0.05) ** 2) + 0.28 * np.exp(-((LAT + 0.26) / 0.05) ** 2)
b = np.clip(np.interp(lat2, LAT, prof), 0, 1)
palette = np.array([
    [0.42, 0.28, 0.18], [0.60, 0.42, 0.27], [0.76, 0.59, 0.39], [0.86, 0.72, 0.50], [0.93, 0.83, 0.63], [0.97, 0.91, 0.76],
])
idx = b * (len(palette) - 1)
i0 = np.clip(np.floor(idx).astype(int), 0, len(palette) - 2)
t = (idx - i0)[..., None]
col = palette[i0] * (1 - t) + palette[i0 + 1] * t
# Polar haze: the high latitudes go blue-grey and smooth.
polar = np.clip((np.abs(lat) - 0.95) / 0.45, 0, 1)[..., None]
col = col * (1 - polar * 0.7) + np.array([0.55, 0.62, 0.68]) * polar * 0.7
# A pale storm oval in the southern belt with a dark core.
st_lat, st_lon = -0.36, 0.55
dlon = np.angle(np.exp(1j * (lon - st_lon)))
oval = np.exp(-((dlon / 0.16) ** 2 + ((lat - st_lat) / 0.055) ** 2))
col = col * (1 - oval[..., None] * 0.55) + np.array([0.99, 0.95, 0.85]) * oval[..., None] * 0.55
core = np.exp(-((dlon / 0.06) ** 2 + ((lat - st_lat) / 0.02) ** 2))
col = col * (1 - core[..., None] * 0.35) + np.array([0.6, 0.35, 0.22]) * core[..., None] * 0.35
col *= (0.96 + 0.08 * (fbm(lu * 4, lv * 16, 4.0, 3, 21) - 0.5))[..., None]

# Light: Lambert with a soft terminator, limb darkening, and the rings' shadow.
ndl = n @ L
diffuse = np.clip(ndl, 0, 1) ** 0.85
soft = np.clip((ndl + 0.08) / 0.16, 0, 1) * 0.06           # faint scattered light just past the terminator
limb = 0.55 + 0.45 * nz ** 0.5
# Ring shadow: from the surface point towards the light, where does the ray cross the ring plane?
P = n                                                       # relative to centre, in planet radii
den = L @ N
tt = -(P @ N) / den
Hpt = P + tt[..., None] * L
rho = np.linalg.norm(Hpt, axis=-1) * PR                     # world units

# Fine ringlet structure: a random radial profile, smoothed so no detail is finer than ~1.3 world units (no moiré).
RING_R = np.arange(150, 290, 0.45)
_raw = np.random.default_rng(7).random(RING_R.size)
_k = np.exp(-np.linspace(-3, 3, 9) ** 2); _k /= _k.sum()
RING_FINE = np.convolve(_raw, _k, mode="same")
RING_FINE = (RING_FINE - RING_FINE.min()) / (RING_FINE.max() - RING_FINE.min())


def ring_density(rw):
    """Optical depth of the rings at world radius rw (≈ 166–276), with ringlets and a division."""
    d = np.zeros_like(rw)
    def band(a, bb, v, soft=1.2):
        return v * np.clip((rw - a) / soft, 0, 1) * np.clip((bb - rw) / soft, 0, 1)
    d += band(166, 184, 0.35)          # C ring, faint
    d += band(184, 199.5, 0.82)        # B ring, dense
    d += band(207, 252, 0.62)          # A ring
    d += band(236, 238.5, -0.45, 0.5)  # Encke-like gap
    d += band(258, 263, 0.18, 0.8)     # F-like ringlet
    d += band(268, 271, 0.10, 0.8)
    fine = np.interp(rw, RING_R, RING_FINE)
    return np.clip(d * (0.62 + 0.62 * fine), 0, 0.97)

ringshadow = np.where(tt > 0, ring_density(rho), 0)
light = (diffuse * (1 - 0.85 * ringshadow) + soft) * limb + 0.025
planet = col * light[..., None]
# Atmospheric rim on the lit limb (thin teal-white scattering).
rim = np.clip(1 - nz, 0, 1) ** 4 * np.clip(ndl + 0.15, 0, 1) ** 1.3
planet = planet + rim[..., None] * np.array([0.55, 0.85, 0.95]) * 0.55
rgb = np.where(inside[..., None], planet, rgb)
alpha = np.where(inside, 1.0, alpha)
# Anti-aliased edge.
edge = np.clip((1 - np.sqrt(rr)) * PR * S, 0, 1)
alpha = np.where(inside, edge, alpha)

# Atmospheric halo just outside the disc (lit side brighter).
dist = np.sqrt(rr)
halo = np.clip(1 - (dist - 1) / 0.07, 0, 1) * (dist >= 1)
hdir = np.clip((-(dx * L[0] + dy * L[1]) / np.maximum(dist, 1e-6)) * 0.7 + 0.35, 0, 1) ** 1.6
halo_a = halo ** 2.2 * 0.42 * hdir
rgb = np.where((dist >= 1)[..., None], np.array([0.5, 0.86, 0.95]), rgb)
alpha = np.where(dist >= 1, halo_a, alpha)

# ---------------- rings ----------------
# Ray along z through the pixel meets the ring plane at depth zr.
zr = -((X - PX) * N[0] + (Y - PY) * N[1]) / N[2]
Q = np.stack([X - PX, Y - PY, zr], axis=-1)
rho_r = np.linalg.norm(Q, axis=-1)
dens = ring_density(rho_r)
# Ring colour by radius: warm inner, pale outer, with fine variation.
rc = np.stack([
    0.78 + 0.12 * np.sin(rho_r * 0.11) + 0.05 * np.sin(rho_r * 1.7),
    0.66 + 0.10 * np.sin(rho_r * 0.11 + 0.4) + 0.05 * np.sin(rho_r * 1.7 + 0.3),
    0.50 + 0.08 * np.sin(rho_r * 0.11 + 0.9),
], axis=-1)
rc = np.clip(rc, 0, 1)
# Sunlit side of the rings vs the planet's shadow on them.
Qn = Q / PR
bq = Qn @ L
cq = (Qn * Qn).sum(-1) - 1
disc = bq * bq - cq
shadowed = (disc > 0) & ((-bq + np.sqrt(np.maximum(disc, 0))) > 0) & ((-bq - np.sqrt(np.maximum(disc, 0))) > -50)
# Only rays heading towards the light from behind the planet are blocked: the ring point must be on the far side.
shadowed &= (bq < 0)
ring_light = np.where(shadowed, 0.12, 1.0) * (0.55 + 0.45 * abs(L @ N))
ring_rgb = rc * ring_light[..., None]
ring_a = dens * 0.95
# Occlusion with the planet: the ring is hidden where the planet surface is closer to the viewer.
planet_z = np.where(inside, nz * PR, -1e9)
front = zr > planet_z
ring_vis = np.where(inside & ~front, 0.0, ring_a)
# Composite ring over whatever is already there.
a_out = ring_vis + alpha * (1 - ring_vis)
rgb = (ring_rgb * ring_vis[..., None] + rgb * (alpha * (1 - ring_vis))[..., None]) / np.maximum(a_out, 1e-6)[..., None]
alpha = a_out

# A small icy moon in the upper left of the frame, lit by the same sun (drawn behind everything else).
MX, MY, MR = 96.0, 214.0, 11.0
mdx, mdy = (X - MX) / MR, (Y - MY) / MR
mrr = mdx * mdx + mdy * mdy
min_ = (mrr < 1.0) & (alpha < 0.02)
mnz = np.sqrt(np.clip(1 - mrr, 0, 1))
mn = np.stack([mdx, mdy, mnz], axis=-1)
mlight = np.clip(mn @ L, 0, 1) ** 0.9 * (0.6 + 0.4 * mnz ** 0.5) + 0.02
mtex = 0.82 + 0.18 * (fbm2_m := (lambda x, y: sum(value_noise(None, (f, f), 90 + k)(x, y) * (0.5 ** k) for k, f in enumerate([3.0, 6.0, 12.0])) / 1.75))(mdx * 0.5 + 0.5, mdy * 0.5 + 0.5)
mcol = np.array([0.80, 0.80, 0.78]) * (mtex * mlight)[..., None]
medge = np.clip((1 - np.sqrt(mrr)) * MR * S, 0, 1)
rgb = np.where(min_[..., None], mcol, rgb)
alpha = np.where(min_, medge, alpha)

# Gentle filmic tone curve and grain.
rgb = 1 - np.exp(-rgb * 1.35)
rgb = rgb / (1 - math.exp(-1.35))
rgb += (rng.random(rgb.shape) - 0.5) * 0.012
img = np.dstack([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)])
im = Image.fromarray((img * 255 + 0.5).astype(np.uint8), "RGBA")
os.makedirs(os.path.dirname(OUT), exist_ok=True)
im.save(OUT, "WEBP", quality=88, method=6)
print("wrote", OUT, im.size, os.path.getsize(OUT) // 1024, "KB")


# ---------------- nebula sky for the whole 390 × 1700 stage (1 px per unit; it is soft by nature) ----------------
SW, SH = 390, 1700
yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float64)
nx_, ny_ = xx / SW, yy / SW


def fbm2(x, y, base, octaves, seed):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        f = base * (2 ** o)
        total = total + amp * value_noise(None, (f, f), seed + o)(x, y)
        norm += amp; amp *= 0.52
    return total / norm

q1 = fbm2(nx_, ny_, 2.0, 5, 31); q2 = fbm2(nx_ + 3.1, ny_ + 1.7, 2.0, 5, 41)
warped = fbm2(nx_ + 1.6 * q1, ny_ + 1.6 * q2, 1.8, 6, 51)
dust = fbm2(nx_ * 2 + q2, ny_ * 2 + q1, 3.0, 5, 61)
sky = np.zeros((SH, SW, 3))
top = np.array([0.043, 0.086, 0.188]); bot = np.array([0.020, 0.039, 0.102])
grad = (yy / SH)[..., None]
sky += top * (1 - grad) + bot * grad
# Clouds: violet body, teal edges, a warm glow near the planet; dark dust lanes cut through them.
cloud = np.clip((warped - 0.42) / 0.38, 0, 1) ** 1.6
edge = np.clip(1 - np.abs(warped - 0.55) / 0.12, 0, 1) ** 2
violet = np.array([0.55, 0.48, 1.0]); teal = np.array([0.21, 0.78, 0.84]); warm = np.array([0.91, 0.76, 0.48])
region = np.exp(-((yy - 560) / 420) ** 2) * 0.9 + np.exp(-((yy - 1250) / 380) ** 2) * 0.8 + np.exp(-((yy - 180) / 260) ** 2) * 0.45
sky += violet * (cloud * 0.30 * region)[..., None]
sky += teal * (edge * 0.10 * region)[..., None]
pd = np.sqrt((xx - PX) ** 2 + (yy - PY) ** 2)
sky += warm * (np.exp(-(pd / 300) ** 2) * 0.10)[..., None]
lanes = np.clip((dust - 0.55) / 0.2, 0, 1)
sky *= (1 - 0.55 * lanes * np.clip(cloud * 2, 0, 1))[..., None]
# Sun glow at the upper left.
sd = np.sqrt((xx - 26) ** 2 + (yy - 44) ** 2)
sky += np.array([1.0, 0.92, 0.78]) * (np.exp(-(sd / 70) ** 2) * 0.55 + np.exp(-(sd / 220) ** 2) * 0.10)[..., None]
sky += (rng.random(sky.shape) - 0.5) * 0.008
sky_img = Image.fromarray((np.clip(sky, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
SKY_OUT = os.path.join(os.path.dirname(OUT), "stage-nebula.webp")
sky_img.save(SKY_OUT, "WEBP", quality=82, method=6)
print("wrote", SKY_OUT, sky_img.size, os.path.getsize(SKY_OUT) // 1024, "KB")
