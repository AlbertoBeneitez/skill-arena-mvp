"""Catalogue covers v3 (original art): full-bleed 16:11 close-ups that fill the card (640×440 SVG source).

The SVGs are only a source: scripts/rasterize-covers.cjs renders them to 800×550 WebP for the app (blur filters are
too expensive for phones to paint live). Usage:
    python3 scripts/generate-covers.py && node scripts/rasterize-covers.cjs
"""
import math, random, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "covers")
W, H = 640, 440


def f(v):
    return f"{v:.1f}"


def defs_common():
    return """
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="bigglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="dof" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="dof2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="9"/></filter>
<filter id="bokeh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity=".6"/></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .055 0"/></filter>
<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6fbff"/><stop offset=".45" stop-color="#9fb0c4"/><stop offset=".55" stop-color="#5d6c80"/><stop offset="1" stop-color="#cfdbe8"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffb81f"/><stop offset="1" stop-color="#b86a00"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="48%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
"""


def svg(body, bg="#05070f", extra_defs="", glare=True):
    g = '<rect width="640" height="440" fill="url(#vig)"/>'
    if glare:
        g += '<rect width="640" height="440" filter="url(#grain)" opacity="1"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<defs>{defs_common()}{extra_defs}</defs>
<rect width="640" height="440" fill="{bg}"/>
{body}
{g}
</svg>'''


def bokeh(seed, cols, n=14, ymax=440, rmin=12, rmax=46, op=(0.08, 0.25)):
    r = random.Random(seed)
    return "".join(
        f'<circle cx="{f(r.uniform(-20, 660))}" cy="{f(r.uniform(-20, ymax))}" r="{f(r.uniform(rmin, rmax))}" fill="{r.choice(cols)}" opacity="{r.uniform(*op):.2f}" filter="url(#bokeh)"/>'
        for _ in range(n))


def stars(seed, n=80, ymax=440):
    r = random.Random(seed)
    return "".join(f'<circle cx="{f(r.uniform(0, 640))}" cy="{f(r.uniform(0, ymax))}" r="{r.choice([.5, .7, .9, 1.2])}" fill="#eaf2ff" opacity="{r.uniform(.2, .9):.2f}"/>' for _ in range(n))


def sphere(cx, cy, r, color, idn, hi="#ffffff", shade="#000", shadow=True, gloss=.6):
    sh = f'<ellipse cx="{f(cx + r * .15)}" cy="{f(cy + r * .95)}" rx="{f(r * .95)}" ry="{f(r * .25)}" fill="#000" opacity=".45" filter="url(#soft)"/>' if shadow else ""
    return (f'<defs><radialGradient id="{idn}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="{hi}"/><stop offset=".22" stop-color="{color}"/><stop offset=".85" stop-color="{shade}"/><stop offset="1" stop-color="{shade}"/></radialGradient></defs>'
            f'{sh}<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="url(#{idn})"/>'
            f'<ellipse cx="{f(cx - r * .3)}" cy="{f(cy - r * .4)}" rx="{f(r * .32)}" ry="{f(r * .18)}" fill="#fff" opacity="{gloss}" transform="rotate(-28 {f(cx - r * .3)} {f(cy - r * .4)})"/>'
            f'<path d="M{f(cx - r * .8)},{f(cy + r * .35)} A{f(r)},{f(r)} 0 0 0 {f(cx + r * .8)},{f(cy + r * .35)}" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="{f(r * .08)}"/>')


def sparkle(x, y, s, col="#ffffff", op=1):
    return (f'<g opacity="{op}" filter="url(#glow)"><path d="M{x},{y - s} Q{x + s * .13},{y - s * .13} {x + s},{y} Q{x + s * .13},{y + s * .13} {x},{y + s} '
            f'Q{x - s * .13},{y + s * .13} {x - s},{y} Q{x - s * .13},{y - s * .13} {x},{y - s}Z" fill="{col}"/></g>')


def trail(pts, col, w0=12, op=.6):
    n = len(pts)
    return "".join(f'<line x1="{f(pts[i - 1][0])}" y1="{f(pts[i - 1][1])}" x2="{f(pts[i][0])}" y2="{f(pts[i][1])}" stroke="{col}" stroke-width="{f(w0 * i / n)}" stroke-linecap="round" opacity="{.05 + op * i / n:.2f}"/>' for i in range(1, n))


def shape(kind, x, y, s):
    if kind == "circle": return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(s)}"/>'
    if kind == "square": return f'<rect x="{f(x - s * .88)}" y="{f(y - s * .88)}" width="{f(s * 1.76)}" height="{f(s * 1.76)}"/>'
    n = {"tri": 3, "hex": 6}.get(kind)
    if n:
        return '<polygon points="' + " ".join(f"{f(x + s * math.cos(-math.pi / 2 + 2 * math.pi * k / n))},{f(y + s * math.sin(-math.pi / 2 + 2 * math.pi * k / n))}" for k in range(n)) + '"/>'
    return '<polygon points="' + " ".join(f"{f(x + s * (1.1 if k % 2 == 0 else .45) * math.cos(-math.pi / 2 + k * math.pi / 5))},{f(y + s * (1.1 if k % 2 == 0 else .45) * math.sin(-math.pi / 2 + k * math.pi / 5))}" for k in range(10)) + '"/>'


covers = {}
ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}


# ---------- Roulette: low, close view of a huge wheel, ball in a pocket, chips out of focus ----------
def roulette():
    cx, cy, rx, ry = 320, 330, 470, 190
    k = ry / rx
    d = ('<radialGradient id="room" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#3b1830"/><stop offset=".6" stop-color="#140a1c"/><stop offset="1" stop-color="#05030a"/></radialGradient>'
         '<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e09a4a"/><stop offset=".4" stop-color="#8a4a18"/><stop offset="1" stop-color="#2e1606"/></linearGradient>'
         '<radialGradient id="cone" cx="48%" cy="30%" r="70%"><stop offset="0" stop-color="#ffe9b0"/><stop offset=".45" stop-color="#b08938"/><stop offset="1" stop-color="#3b2a10"/></radialGradient>'
         '<radialGradient id="spot" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff2d6" stop-opacity=".35"/><stop offset="1" stop-color="#fff2d6" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#room)"/>', bokeh(11, ["#ffcf7a", "#ff6a8a", "#ffffff", "#ffa040"], 18, 200, 10, 34)]
    p.append(f'<ellipse cx="{cx}" cy="{cy + 40}" rx="{rx + 30}" ry="{ry + 30}" fill="#000" opacity=".7" filter="url(#soft)"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy + 22}" rx="{rx}" ry="{ry}" fill="#2b1406"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#wood)"/>')
    p.append(f'<path d="M{cx - rx + 20},{cy - 20} A{rx - 20},{ry - 20} 0 0 1 {cx + rx - 20},{cy - 20}" fill="none" stroke="#ffe6b8" stroke-width="3" opacity=".6"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx - 30}" ry="{f(ry - 14)}" fill="#1a0d05"/>')
    for i in range(10):
        a = i * math.pi / 5 + .15
        x, y = cx + (rx - 56) * math.cos(a), cy + (rx - 56) * math.sin(a) * k
        p.append(f'<polygon points="{f(x)},{f(y - 7)} {f(x + 12)},{f(y)} {f(x)},{f(y + 7)} {f(x - 12)},{f(y)}" fill="url(#chrome)"/>')
    R1, R2, R3 = rx - 92, rx - 150, rx - 190
    for i, num in enumerate(ORDER):
        a0, a1 = 2 * math.pi * i / 37 + 1.2, 2 * math.pi * (i + 1) / 37 + 1.2
        col = "#18a35a" if num == 0 else ("#c8202f" if num in RED else "#14161d")
        pts = " ".join(f"{f(cx + rr * math.cos(a))},{f(cy + rr * math.sin(a) * k)}" for a, rr in [(a0, R1), (a1, R1), (a1, R2), (a0, R2)])
        p.append(f'<polygon points="{pts}" fill="{col}" stroke="#e8c97e" stroke-width="1.2"/>')
        am = (a0 + a1) / 2
        tx, ty = cx + (R1 + R2) / 2 * math.cos(am), cy + (R1 + R2) / 2 * math.sin(am) * k
        if math.sin(am) < .95:
            sz = 11 + 7 * max(0, math.sin(am))
            p.append(f'<text x="{f(tx)}" y="{f(ty + sz * .35)}" font-family="Georgia, serif" font-size="{f(sz)}" font-weight="700" fill="#fff" text-anchor="middle" transform="rotate({f(math.degrees(am) + 90)} {f(tx)} {f(ty)}) scale(1 1)">{num}</text>')
        pk = " ".join(f"{f(cx + rr * math.cos(a))},{f(cy + rr * math.sin(a) * k)}" for a, rr in [(a0, R2), (a1, R2), (a1, R3), (a0, R3)])
        p.append(f'<polygon points="{pk}" fill="#24150a" stroke="#f6dfa0" stroke-width="2"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{R3}" ry="{f(R3 * k)}" fill="url(#cone)"/>')
    for i in range(8):
        a = i * math.pi / 4 + .3
        p.append(f'<line x1="{cx}" y1="{cy}" x2="{f(cx + (R3 - 6) * math.cos(a))}" y2="{f(cy + (R3 - 6) * math.sin(a) * k)}" stroke="#fff3cf" stroke-opacity=".28" stroke-width="5"/>')
    p.append(f'<rect x="{cx - 12}" y="{cy - 90}" width="24" height="90" rx="10" fill="url(#chrome)" filter="url(#shadow)"/>')
    for a in [.35, .35 + math.pi / 2, .35 + math.pi, .35 + 3 * math.pi / 2]:
        ex, ey = cx + 90 * math.cos(a), cy - 58 + 36 * math.sin(a)
        p.append(f'<line x1="{cx}" y1="{cy - 58}" x2="{f(ex)}" y2="{f(ey)}" stroke="url(#chrome)" stroke-width="10" stroke-linecap="round"/><circle cx="{f(ex)}" cy="{f(ey)}" r="9" fill="url(#chrome)"/>')
    p.append(f'<circle cx="{cx}" cy="{cy - 94}" r="17" fill="url(#chrome)"/>')
    # ball settled in a pocket at the front-left, with the bounce trail
    a = 2 * math.pi * 6.5 / 37 + 1.2
    bx, by = cx + (R2 + R3) / 2 * math.cos(a), cy + (R2 + R3) / 2 * math.sin(a) * k - 8
    arc = [(bx + 160 - t * 16, by - 60 + (t - 6) ** 2 * 1.6) for t in range(11)]
    p.append(trail(arc, "#ffffff", 14, .5))
    p.append(sphere(bx, by, 14, "#f1f6fb", "rb"))
    p.append(f'<circle cx="{f(bx)}" cy="{f(by)}" r="26" fill="#fff" opacity=".2" filter="url(#glow)"/>')
    p.append('<rect width="640" height="440" fill="url(#spot)"/>')
    # chips out of focus in the foreground corners

    def chip_stack(x, y, col, n, rr):
        out = []
        for q in range(n):
            yy = y - q * rr * .28
            out.append(f'<ellipse cx="{x}" cy="{f(yy + rr * .12)}" rx="{rr}" ry="{f(rr * .36)}" fill="#000" opacity=".35"/><ellipse cx="{x}" cy="{f(yy)}" rx="{rr}" ry="{f(rr * .36)}" fill="{col}"/>'
                       f'<ellipse cx="{x}" cy="{f(yy)}" rx="{rr}" ry="{f(rr * .36)}" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="{f(rr * .09)}" stroke-dasharray="{f(rr * .25)} {f(rr * .35)}"/>')
        return "".join(out)
    p.append(f'<g filter="url(#dof)">{chip_stack(70, 420, "#e12d3f", 6, 74)}</g>')
    p.append(f'<g filter="url(#dof)">{chip_stack(585, 430, "#7b3fd0", 5, 80)}</g>')
    p.append(sparkle(bx + 10, by - 14, 12, "#fff8e0"))
    return svg("".join(p), extra_defs=d)
covers["galactic-roulette"] = roulette()


# ---------- Slot: three huge reels fill the frame ----------
def slot():
    d = ('<linearGradient id="reel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d4458"/><stop offset=".2" stop-color="#e6eaf4"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".8" stop-color="#e6eaf4"/><stop offset="1" stop-color="#3d4458"/></linearGradient>'
         '<linearGradient id="seven" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6dc"/><stop offset=".45" stop-color="#ff2d48"/><stop offset="1" stop-color="#7a0618"/></linearGradient>'
         '<linearGradient id="frame" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6a4708"/><stop offset=".5" stop-color="#ffe08a"/><stop offset="1" stop-color="#6a4708"/></linearGradient>'
         '<linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#08040f" stop-opacity=".85"/><stop offset=".3" stop-color="#08040f" stop-opacity="0"/><stop offset=".7" stop-color="#08040f" stop-opacity="0"/><stop offset="1" stop-color="#08040f" stop-opacity=".85"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="#1a0b2e"/>']
    xs = [6, 218, 430]
    for i, x in enumerate(xs):
        p.append(f'<rect x="{x}" y="-10" width="204" height="460" fill="url(#reel)"/>')
        # symbols: cherry above, 7 centre, BAR below
        p.append(f'<g opacity=".9"><circle cx="{x + 82}" cy="62" r="30" fill="#e3153a"/><circle cx="{x + 128}" cy="70" r="30" fill="#b80e2c"/><circle cx="{x + 72}" cy="52" r="8" fill="#fff" opacity=".6"/>'
                 f'<path d="M{x + 82},34 Q{x + 104},-10 {x + 132},4 M{x + 128},42 Q{x + 124},10 {x + 132},4" stroke="#3f8a4a" stroke-width="6" fill="none"/></g>')
        p.append(f'<text x="{x + 102}" y="300" font-family="Impact, Arial Black, sans-serif" font-size="240" text-anchor="middle" fill="url(#seven)" stroke="#2a0710" stroke-width="9" paint-order="stroke">7</text>')
        p.append(f'<rect x="{x + 42}" y="368" width="120" height="50" rx="9" fill="#1a1440"/><text x="{x + 102}" y="405" font-family="Arial Black, sans-serif" font-size="34" font-weight="900" fill="#ecebff" text-anchor="middle">BAR</text>')
        p.append(f'<rect x="{x}" y="-10" width="204" height="460" fill="url(#shade)"/>')
        p.append(f'<rect x="{x + 10}" y="-10" width="18" height="460" fill="#fff" opacity=".22"/>')
    for x in (0, 212, 424, 636):
        p.append(f'<rect x="{x - 6}" y="-10" width="16" height="460" fill="url(#frame)"/>')
    # payline + win glow
    p.append('<rect x="0" y="206" width="640" height="6" fill="#fff3b0" filter="url(#bigglow)"/>')
    p.append('<polygon points="0,196 22,209 0,222" fill="#fff3b0"/><polygon points="640,196 618,209 640,222" fill="#fff3b0"/>')
    # bulbs along top and bottom
    for i in range(22):
        x = 14 + i * 29.5
        p.append(f'<circle cx="{f(x)}" cy="10" r="5" fill="{"#fff3b0" if i % 2 else "#ff4fa3"}" filter="url(#glow)"/><circle cx="{f(x)}" cy="430" r="5" fill="{"#ff4fa3" if i % 2 else "#fff3b0"}" filter="url(#glow)"/>')
    # coins flying at the camera
    r = random.Random(5)
    for q in range(16):
        x, y, s = r.uniform(-20, 660), r.uniform(120, 460), r.uniform(.6, 1.8)
        blur = 'filter="url(#dof)"' if s > 1.3 else ""
        p.append(f'<g {blur} transform="rotate({r.randint(-50, 50)} {f(x)} {f(y)})"><ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(14 * s)}" ry="{f(22 * s)}" fill="url(#gold)" stroke="#8a5200" stroke-width="2"/><ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(8 * s)}" ry="{f(14 * s)}" fill="none" stroke="#fff3b0" stroke-opacity=".8" stroke-width="1.5"/></g>')
    p.append(sparkle(120, 150, 16, "#fff3b0") + sparkle(520, 260, 12, "#fff3b0") + sparkle(330, 120, 10))
    return svg("".join(p), extra_defs=d)
covers["galactic-slot"] = slot()


# ---------- Darts: the board fills the frame, darts in close-up ----------
def darts():
    cx, cy, R = 330, 230, 300
    d = ('<radialGradient id="spotd" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>'
         '<linearGradient id="fl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff6ff"/><stop offset="1" stop-color="#2f5bff"/></linearGradient>'
         '<linearGradient id="fl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff4a2a"/></linearGradient>'
         '<linearGradient id="barrel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5468"/><stop offset=".4" stop-color="#f0f4fa"/><stop offset="1" stop-color="#2a3040"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="#120d0a"/>']
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 40}" fill="#0c0c10"/>')
    order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

    def ring(r0, r1, cA, cB):
        out = []
        for i in range(20):
            a0 = math.radians(-99 + i * 18); a1 = a0 + math.radians(18)
            pts = [(cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)), (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1)), (cx + r0 * math.cos(a0), cy + r0 * math.sin(a0))]
            out.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{cA if i % 2 == 0 else cB}"/>')
        return "".join(out)
    p.append(ring(R * .66, R, "#17171c", "#ede3c8"))
    p.append(ring(R * .9, R, "#c81d30", "#13914c"))
    p.append(ring(R * .14, R * .66, "#17171c", "#ede3c8"))
    p.append(ring(R * .56, R * .66, "#c81d30", "#13914c"))
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R * .14}" fill="#13914c"/><circle cx="{cx}" cy="{cy}" r="{R * .065}" fill="#c81d30"/>')
    for i in range(20):
        a = math.radians(-99 + i * 18)
        p.append(f'<line x1="{f(cx + R * .14 * math.cos(a))}" y1="{f(cy + R * .14 * math.sin(a))}" x2="{f(cx + R * math.cos(a))}" y2="{f(cy + R * math.sin(a))}" stroke="#d6dde6" stroke-width="1.6"/>')
    for rr in (R * .065, R * .14, R * .56, R * .66, R * .9, R):
        p.append(f'<circle cx="{cx}" cy="{cy}" r="{f(rr)}" fill="none" stroke="#d6dde6" stroke-width="1.6"/>')
    for i, n in enumerate(order):
        a = math.radians(-90 + i * 18)
        p.append(f'<text x="{f(cx + (R + 22) * math.cos(a))}" y="{f(cy + (R + 22) * math.sin(a) + 8)}" font-family="Arial Black, sans-serif" font-size="24" fill="#f2f4f8" text-anchor="middle">{n}</text>')
    # sisal texture
    r = random.Random(3)
    for _ in range(500):
        a, rr = r.uniform(0, 2 * math.pi), r.uniform(0, R)
        p.append(f'<circle cx="{f(cx + rr * math.cos(a))}" cy="{f(cy + rr * math.sin(a))}" r=".9" fill="#000" opacity=".18"/>')
    p.append('<rect width="640" height="440" fill="url(#spotd)"/>')

    def dart(tx, ty, ang, fl, s, blur=False):
        c, sn = math.cos(ang), math.sin(ang)
        P = lambda dd, w=0: (tx + c * dd - sn * w, ty + sn * dd + c * w)
        tip, b0, b1, sh0, sh1, f0 = P(0), P(30 * s), P(110 * s), P(110 * s), P(190 * s), P(170 * s)
        fa, fb, fc = P(260 * s, 52 * s), P(260 * s, -52 * s), P(225 * s)
        g = f'<g filter="url({"#dof" if blur else "#shadow"})">'
        g += f'<line x1="{f(tip[0])}" y1="{f(tip[1])}" x2="{f(b0[0])}" y2="{f(b0[1])}" stroke="#c9d2dc" stroke-width="{f(4 * s)}" stroke-linecap="round"/>'
        g += f'<line x1="{f(b0[0])}" y1="{f(b0[1])}" x2="{f(b1[0])}" y2="{f(b1[1])}" stroke="url(#barrel)" stroke-width="{f(16 * s)}" stroke-linecap="round"/>'
        for q in range(5):
            m = P((40 + q * 15) * s)
            g += f'<circle cx="{f(m[0])}" cy="{f(m[1])}" r="{f(7.5 * s)}" fill="none" stroke="#1c2230" stroke-opacity=".5" stroke-width="{f(1.5 * s)}"/>'
        g += f'<line x1="{f(sh0[0])}" y1="{f(sh0[1])}" x2="{f(sh1[0])}" y2="{f(sh1[1])}" stroke="#1d2433" stroke-width="{f(8 * s)}" stroke-linecap="round"/>'
        g += f'<polygon points="{f(f0[0])},{f(f0[1])} {f(fa[0])},{f(fa[1])} {f(fc[0])},{f(fc[1])}" fill="url(#{fl})"/><polygon points="{f(f0[0])},{f(f0[1])} {f(fb[0])},{f(fb[1])} {f(fc[0])},{f(fc[1])}" fill="url(#{fl})" opacity=".75"/></g>'
        return f'<circle cx="{f(tx)}" cy="{f(ty)}" r="{f(5 * s)}" fill="#000" opacity=".7"/>' + g
    p.append(dart(cx + 4, cy - 2, math.radians(-36), "fl1", 1.0))
    t20 = (cx - 6, cy - R * .61)
    p.append(dart(t20[0], t20[1], math.radians(-64), "fl2", .85))
    p.append(dart(cx - R * .5, cy + R * .35, math.radians(-150), "fl1", .9))
    p.append(f'<circle cx="{cx + 4}" cy="{cy - 2}" r="30" fill="#9ff6ff" opacity=".25" filter="url(#bigglow)"/>')
    p.append(sparkle(cx + 4, cy - 2, 16, "#effcff"))
    return svg("".join(p), extra_defs=d)
covers["darts"] = darts()


# ---------- Billiards: low angle on the felt, cue ball huge in the foreground ----------
def billiards():
    """Low, cinematic angle across the felt at the moment of the break: the rack explodes under a pendant lamp,
    smoke in the light cone, warm bokeh in the dark room, the cue out of focus in the foreground."""
    d = ('<radialGradient id="broom" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#1c3a3a"/><stop offset=".55" stop-color="#0a1418"/><stop offset="1" stop-color="#030607"/></radialGradient>'
         '<linearGradient id="bfelt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b5a44"/><stop offset=".55" stop-color="#11865f"/><stop offset="1" stop-color="#064a35"/></linearGradient>'
         '<radialGradient id="bpool" cx="50%" cy="48%" r="55%"><stop offset="0" stop-color="#fff4c8" stop-opacity=".42"/><stop offset=".6" stop-color="#fff4c8" stop-opacity=".08"/><stop offset="1" stop-color="#fff4c8" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="bcone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4" stop-opacity=".30"/><stop offset="1" stop-color="#fff2c4" stop-opacity="0"/></linearGradient>'
         '<linearGradient id="brail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c07a3c"/><stop offset=".5" stop-color="#6b3612"/><stop offset="1" stop-color="#2a1205"/></linearGradient>'
         '<linearGradient id="bshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b6b52"/><stop offset="1" stop-color="#0c3d2e"/></linearGradient>'
         '<linearGradient id="bcue" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1a0c04"/><stop offset=".5" stop-color="#d9ae6a"/><stop offset=".93" stop-color="#f6e4bd"/><stop offset="1" stop-color="#2a8fff"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#broom)"/>', bokeh(41, ["#ffcf7a", "#ffa040", "#ffffff", "#7fe3ee"], 16, 150, 8, 30, (.10, .35))]
    # Perspective table: far rail at y=150, near edge below the frame.
    FY, NY, FW, NW = 156, 520, 250, 560
    def P(u, v):  # u -1..1 across, v 0 (far) .. 1 (near)
        y = FY + (NY - FY) * v
        w = FW + (NW - FW) * v
        return 320 + u * w, y, w / NW
    # Rail and felt.
    p.append(f'<polygon points="{320 - FW - 26},{FY - 24} {320 + FW + 26},{FY - 24} {320 + NW + 60},{NY} {320 - NW - 60},{NY}" fill="url(#brail)"/>')
    p.append(f'<polygon points="{320 - FW},{FY} {320 + FW},{FY} {320 + NW},{NY} {320 - NW},{NY}" fill="url(#bfelt)"/>')
    p.append(f'<polygon points="{320 - FW},{FY} {320 + FW},{FY} {320 + FW + 6},{FY + 12} {320 - FW - 6},{FY + 12}" fill="url(#bshade)"/>')
    for i in range(7):
        x = 320 - FW + 40 + i * (2 * FW - 80) / 6
        p.append(f'<polygon points="{f(x)},{FY - 15} {f(x + 6)},{FY - 11} {f(x)},{FY - 7} {f(x - 6)},{FY - 11}" fill="#f4e3b8"/>')
    for x in (320 - FW + 4, 320, 320 + FW - 4):
        p.append(f'<ellipse cx="{f(x)}" cy="{FY + 1}" rx="17" ry="7" fill="#020403"/>')
    for i in range(36):
        y = FY + 16 + i * 8
        p.append(f'<line x1="0" y1="{y}" x2="640" y2="{y + 1}" stroke="#fff" stroke-opacity=".018"/>')
    p.append('<rect width="640" height="440" fill="url(#bpool)"/>')
    # Lamp and its smoky light cone.
    p.append('<polygon points="250,40 390,40 600,440 40,440" fill="url(#bcone)"/>')
    for q in range(6):
        rr = random.Random(90 + q)
        p.append(f'<ellipse cx="{f(rr.uniform(170, 470))}" cy="{f(rr.uniform(70, 230))}" rx="{f(rr.uniform(60, 130))}" ry="{f(rr.uniform(14, 30))}" fill="#e8f2f0" opacity=".06" filter="url(#soft)"/>')
    p.append('<rect x="316" y="0" width="8" height="22" fill="#1a1a1a"/><path d="M250,48 Q320,4 390,48 Z" fill="#0f3d2f"/><path d="M250,48 Q320,4 390,48" fill="none" stroke="#e3b660" stroke-width="3"/>')
    p.append('<ellipse cx="320" cy="48" rx="70" ry="9" fill="#fff6d6"/><ellipse cx="320" cy="50" rx="110" ry="22" fill="#fff6d6" opacity=".25" filter="url(#soft)"/>')
    # The break: the cue ball has just hit the apex; the rack bursts open.
    cols = ["#ffd23f", "#2f6bff", "#e12d3f", "#7b3cff", "#ff7a1f", "#159a52", "#8a1c2a", "#111111", "#ffd23f", "#2f6bff", "#e12d3f", "#7b3cff", "#ff7a1f", "#159a52", "#8a1c2a"]
    ax, av = 0.0, .42
    rr = random.Random(7)
    balls = []
    k = 0
    for row in range(5):
        for i in range(row + 1):
            u0, v0 = ax + (i - row / 2) * .075, av - .03 - row * .052
            du, dv = u0 - ax, v0 - av
            spread = .35 + rr.uniform(0, .45)
            balls.append((v0 + dv * spread * .5, u0, v0, u0 + du * spread * 1.6, k)); k += 1
    for v1, u0, v0, u1, idx in sorted(balls):
        x0, y0, s0 = P(u0, v0); x1, y1, s1 = P(u1, max(.02, v1))
        r = 36 * s1
        if abs(u1 - u0) + abs(v1 - v0) > .04:
            p.append(trail([(x0 + (x1 - x0) * t / 5, y0 + (y1 - y0) * t / 5) for t in range(6)], "#ffffff", max(3, r * .6), .14))
        p.append(f'<ellipse cx="{f(x1 + r * .2)}" cy="{f(y1 + r * .85)}" rx="{f(r * .9)}" ry="{f(r * .28)}" fill="#000" opacity=".45"/>')
        p.append(sphere(x1, y1, r, cols[idx % 15], f"bb{idx}", shade="#050505", shadow=False))
        if idx >= 8:
            p.append(f'<ellipse cx="{f(x1)}" cy="{f(y1)}" rx="{f(r * .97)}" ry="{f(r * .45)}" fill="#f6f2e6" opacity=".85"/>')
        p.append(f'<circle cx="{f(x1 - r * .1)}" cy="{f(y1 - r * .05)}" r="{f(r * .38)}" fill="#fbf8ef"/><text x="{f(x1 - r * .1)}" y="{f(y1 + r * .12)}" font-family="Arial Black, sans-serif" font-size="{f(r * .46)}" text-anchor="middle" fill="#111">{idx + 1}</text>')
    # Cue ball at the impact point with its trail from the camera, flash and chalk dust.
    ix, iy, isc = P(ax, av + .06)
    cr = 36 * isc
    p.append(trail([(ix + (300 - ix) * t / 8 * 0, iy + (470 - iy) * (8 - t) / 8) for t in range(9)], "#ffffff", cr * 1.4, .22))
    p.append(f'<circle cx="{f(ix)}" cy="{f(iy - 6)}" r="54" fill="#ffffff" opacity=".35" filter="url(#bigglow)"/>')
    for q in range(16):
        a = q * 2 * math.pi / 16 + .2
        p.append(f'<line x1="{f(ix + math.cos(a) * 30)}" y1="{f(iy - 6 + math.sin(a) * 14)}" x2="{f(ix + math.cos(a) * 66)}" y2="{f(iy - 6 + math.sin(a) * 30)}" stroke="#fff6d6" stroke-width="2.2" opacity=".75" filter="url(#glow)"/>')
    p.append(f'<ellipse cx="{f(ix + cr * .2)}" cy="{f(iy + cr * .85)}" rx="{f(cr * .9)}" ry="{f(cr * .28)}" fill="#000" opacity=".45"/>')
    p.append(sphere(ix, iy, cr, "#f6f3ea", "bcb", shade="#7f7b70", shadow=False, gloss=.8))
    for q in range(30):
        g = random.Random(300 + q)
        p.append(f'<circle cx="{f(ix + g.gauss(0, 30))}" cy="{f(iy - 10 + g.gauss(0, 12))}" r="{f(g.uniform(1, 3))}" fill="#9fd0ff" opacity="{g.uniform(.3, .8):.2f}"/>')
    # Foreground: two balls very close to the camera, out of focus, and the cue following through.
    p.append(f'<g filter="url(#dof2)">{sphere(70, 430, 92, "#e12d3f", "bf1", shade="#2a0508", shadow=False)}{sphere(590, 452, 80, "#ffd23f", "bf2", shade="#3a2a00", shadow=False)}</g>')
    p.append(f'<g filter="url(#dof)"><line x1="330" y1="620" x2="{f(ix)}" y2="{f(iy + 70)}" stroke="url(#bcue)" stroke-width="30" stroke-linecap="round"/></g>')
    p.append(sparkle(ix + 34, iy - 30, 13, "#fff6d6") + sparkle(ix - cr * .4, iy - cr * .5, 9, "#ffffff"))
    return svg("".join(p), extra_defs=d)
covers["billiards"] = billiards()


# ---------- Tower Drop: tall stack of containers, elevator module above ----------
def container(x, y, w, h, face, shade, label, idn):
    out = [f'<defs><linearGradient id="{idn}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{face}"/><stop offset=".65" stop-color="{face}"/><stop offset="1" stop-color="{shade}"/></linearGradient></defs>',
           f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" fill="url(#{idn})" stroke="#000" stroke-opacity=".4" stroke-width="2"/>']
    for n in range(int(x + 16), int(x + w - 10), 16):
        out.append(f'<rect x="{n}" y="{f(y + 12)}" width="5" height="{f(h - 26)}" fill="#000" opacity=".18"/><rect x="{n + 5}" y="{f(y + 12)}" width="2" height="{f(h - 26)}" fill="#fff" opacity=".16"/>')
    out.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="8" fill="#fff" opacity=".28"/>')
    for cxx in (x, x + w - 14):
        out.append(f'<rect x="{f(cxx)}" y="{f(y)}" width="14" height="14" fill="#262b36"/><rect x="{f(cxx)}" y="{f(y + h - 14)}" width="14" height="14" fill="#262b36"/>')
    out.append(f'<rect x="{f(x)}" y="{f(y + h - 18)}" width="{f(w)}" height="8" fill="#15181f"/>')
    for n in range(int(x), int(x + w - 18), 18):
        out.append(f'<polygon points="{n},{f(y + h - 10)} {n + 9},{f(y + h - 18)} {n + 18},{f(y + h - 18)} {n + 9},{f(y + h - 10)}" fill="#ffd23f"/>')
    out.append(f'<rect x="{f(x + w / 2 - 36)}" y="{f(y + 16)}" width="72" height="22" fill="#08101e" opacity=".85"/><text x="{f(x + w / 2)}" y="{f(y + 33)}" font-family="Menlo, monospace" font-size="16" font-weight="700" fill="#e9f4ff" text-anchor="middle">{label}</text>')
    out.append(f'<circle cx="{f(x + w - 26)}" cy="{f(y + 26)}" r="5" fill="#5cffb0" filter="url(#glow)"/>')
    return "".join(out)


def tower():
    d = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0f2a"/><stop offset="1" stop-color="#2a1640"/></linearGradient>'
         '<radialGradient id="planet" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#ff9a5a"/><stop offset=".4" stop-color="#7a3a5a"/><stop offset="1" stop-color="#1a1030"/></radialGradient>'
         '<linearGradient id="teth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6c80"/><stop offset=".5" stop-color="#e6f4ff"/><stop offset="1" stop-color="#5d6c80"/></linearGradient>'
         '<linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b6fd8"/><stop offset="1" stop-color="#14265a"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#sky)"/>', stars(16, 90, 300)]
    p.append('<ellipse cx="320" cy="560" rx="560" ry="200" fill="url(#planet)"/>')
    p.append('<ellipse cx="320" cy="560" rx="560" ry="200" fill="none" stroke="#ffc08a" stroke-opacity=".5" stroke-width="3" filter="url(#glow)"/>')
    # station towers either side, out of focus
    g = []
    for (x, w, h) in [(-10, 70, 330), (70, 40, 220), (540, 60, 360), (600, 60, 260)]:
        g.append(f'<rect x="{x}" y="{440 - h}" width="{w}" height="{h}" fill="#0b1430" stroke="#2fd9c8" stroke-opacity=".35"/>')
        for q in range(10, h - 10, 22):
            g.append(f'<rect x="{x + 8}" y="{440 - h + q}" width="{w - 16}" height="4" fill="#ffb86a" opacity=".5"/>')
    p.append(f'<g filter="url(#dof)">{"".join(g)}</g>')
    stackc = [("#e8742c", "#a9480f"), ("#1f8fa6", "#125e70"), ("#d2343f", "#8c1c26"), ("#e9b730", "#a6780e"), ("#3e5fbf", "#243d88"), ("#6a7ad8", "#3a46a0")]
    y = 450
    for i, (fc, sc) in enumerate(stackc):
        w = 340 - i * 10; h = 66; y -= h
        p.append(container(320 - w / 2 + (i % 2) * 10 - 5, y, w, h, fc, sc, f"GX-{i + 1:02d}", f"ct{i}"))
    # elevator module + hanging container (top right)
    mx, my = 420, 40
    p.append(f'<rect x="{mx - 7}" y="-10" width="14" height="{my}" fill="url(#teth)"/>')
    for side in (-1, 1):
        x0 = mx + side * 46 - (90 if side < 0 else 0)
        p.append(f'<rect x="{x0}" y="{my - 14}" width="90" height="28" fill="url(#sol)" stroke="#9fc4ff"/>')
    p.append(f'<rect x="{mx - 44}" y="{my - 26}" width="88" height="56" rx="18" fill="url(#chrome)" filter="url(#shadow)"/><rect x="{mx - 26}" y="{my - 12}" width="52" height="16" rx="5" fill="#c4eff8"/>')
    hx, hy = 470, 92
    p.append(f'<line x1="{mx}" y1="{my + 30}" x2="{hx}" y2="{hy - 10}" stroke="#d2effb" stroke-width="4"/>')
    p.append(f'<g transform="rotate(-7 {hx} {hy})">{container(hx - 110, hy, 220, 60, "#d9dee6", "#9aa2ae", "GX-07", "ctop")}</g>')
    p.append(f'<line x1="{hx - 6}" y1="{hy + 64}" x2="{hx - 20}" y2="{hy + 120}" stroke="#ffd23f" stroke-width="3" stroke-dasharray="4 6" opacity=".7"/>')
    p.append(sparkle(560, 70, 12, "#ffe9b0"))
    return svg("".join(p), extra_defs=d)
covers["tower-drop"] = tower()


# ---------- Orb Burst: the bubble ceiling fills the frame, a burst in the middle ----------
def orb():
    p = ['<rect width="640" height="440" fill="#0a0b24"/>', bokeh(17, ["#ff6f91", "#4fa8ff", "#ffd23f"], 10, 440, 20, 60)]
    cols = ["#4fa8ff", "#ff6f91", "#ffd23f", "#5cffb0", "#b98cff", "#ff9a3c"]
    r = random.Random(7)
    R = 34
    hole = {(2, 5), (2, 6), (3, 5), (3, 6), (3, 4), (1, 6)}
    for row in range(5):
        n = 11 if row % 2 == 0 else 10
        for i in range(-1, n + 1):
            if (row, i) in hole: continue
            if row == 4 and r.random() < .4: continue
            x = 20 + i * 2 * R + (R if row % 2 else 0)
            y = 20 + row * R * 1.73
            p.append(sphere(x, y, R - 1.5, r.choice(cols), f"o{row}_{i}", shadow=False, gloss=.7))
    bx, by = 400, 160
    p.append(f'<circle cx="{bx}" cy="{by}" r="80" fill="none" stroke="#ffd23f" stroke-width="5" opacity=".7" filter="url(#glow)"/>')
    p.append(f'<circle cx="{bx}" cy="{by}" r="44" fill="#fff6c8" opacity=".7" filter="url(#bigglow)"/>')
    for q in range(18):
        a = q * 2 * math.pi / 18; dd = r.uniform(60, 130)
        x, y = bx + math.cos(a) * dd, by + math.sin(a) * dd
        p.append(f'<polygon points="{f(x)},{f(y - 9)} {f(x + 7)},{f(y)} {f(x)},{f(y + 9)} {f(x - 7)},{f(y)}" fill="{r.choice(cols)}" transform="rotate({q * 25} {f(x)} {f(y)})" filter="url(#glow)"/>')
    for (x, y, c) in [(240, 300, "#b98cff"), (520, 310, "#5cffb0"), (460, 360, "#4fa8ff")]:
        p.append(f'<line x1="{x}" y1="{y - 70}" x2="{x}" y2="{y - 30}" stroke="{c}" stroke-width="6" opacity=".35"/>')
        p.append(sphere(x, y, 26, c, f"dr{x}", shadow=False))
    for q in range(12):
        p.append(f'<circle cx="{f(320 + q * 6)}" cy="{f(420 - q * 20)}" r="4" fill="#e9fbff" opacity="{.95 - q * .07:.2f}"/>')
    p.append('<ellipse cx="320" cy="452" rx="130" ry="36" fill="#0d1a33" stroke="#7fe3ee" stroke-width="5" filter="url(#glow)"/>')
    p.append(sphere(320, 420, 36, "#ff6f91", "shot", shadow=False))
    p.append(sparkle(bx, by, 22, "#fff8e0"))
    return svg("".join(p))
covers["orb-burst"] = orb()


# ---------- Shot Gallery: the tarp with open windows, targets revealed ----------
def gallery():
    """Night fairground booth: marquee bulbs, striped awning, a spotlit white tarp whose front sheet is lifting over the big
    coloured figures, a hit with sparks, the red reticle and a toy rifle with muzzle flash out of focus in the foreground."""
    d = ('<radialGradient id="gnight" cx="50%" cy="30%" r="90%"><stop offset="0" stop-color="#2a1640"/><stop offset=".6" stop-color="#0d0a1c"/><stop offset="1" stop-color="#040309"/></radialGradient>'
         '<linearGradient id="gtarp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7f6f1"/><stop offset=".75" stop-color="#e6e5de"/><stop offset="1" stop-color="#c8c7bf"/></linearGradient>'
         '<radialGradient id="gspot" cx="50%" cy="30%" r="60%"><stop offset="0" stop-color="#fffbe8" stop-opacity=".55"/><stop offset="1" stop-color="#fffbe8" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="gfront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9e8e1"/></linearGradient>'
         '<linearGradient id="grod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#a9a8a1"/></linearGradient>'
         '<linearGradient id="gcast" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#28281f" stop-opacity=".35"/><stop offset="1" stop-color="#28281f" stop-opacity="0"/></linearGradient>'
         '<linearGradient id="gwood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8462e"/><stop offset=".35" stop-color="#7c2416"/><stop offset="1" stop-color="#2a0a05"/></linearGradient>'
         '<linearGradient id="gpost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a1410"/><stop offset=".5" stop-color="#c2382a"/><stop offset="1" stop-color="#5a1410"/></linearGradient>'
         '<linearGradient id="gbarrel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa6b2"/><stop offset=".5" stop-color="#2b3138"/><stop offset="1" stop-color="#0d1014"/></linearGradient>'
         '<linearGradient id="gstock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98a4a"/><stop offset="1" stop-color="#5a3010"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#gnight)"/>', bokeh(52, ["#ffcf7a", "#ff6a8a", "#7fe3ee", "#ffffff"], 18, 440, 10, 36, (.12, .32))]
    # Booth: back tarp framed by two red posts.
    L, R, T, B = 74, 566, 96, 372
    p.append(f'<rect x="{L}" y="{T}" width="{R - L}" height="{B - T}" fill="url(#gtarp)"/>')
    for x in range(L, R, 40):
        p.append(f'<rect x="{x}" y="{T}" width="20" height="{B - T}" fill="#77766c" opacity=".05"/>')
    p.append(f'<rect x="{L}" y="{T}" width="{R - L}" height="{B - T}" fill="url(#gspot)"/>')
    figs = [("#ff4fa0", "tri", 170, 222), ("#3d8bff", "circle", 320, 214), ("#ffcc1f", "star", 470, 222), ("#8fd43a", "square", 196, 318), ("#ff8a1f", "hex", 444, 318)]
    for c, kind, x, y in figs:
        p.append(f'<g fill="#28281f" opacity=".2">{shape(kind, x + 7, y + 9, 46)}</g>')
        p.append(f'<g fill="{c}" stroke="#141414" stroke-opacity=".25" stroke-width="3">{shape(kind, x, y, 46)}</g>')
        p.append(f'<g fill="#ffffff" opacity=".2">{shape(kind, x - 9, y - 10, 16)}</g>')
    # Hit on the orange hexagon: hole, cracks, sparks.
    hx, hy = 452, 310
    for q in range(8):
        a = q * .8
        p.append(f'<line x1="{hx}" y1="{hy}" x2="{f(hx + math.cos(a) * 20)}" y2="{f(hy + math.sin(a) * 20)}" stroke="#0a0a0a" stroke-width="1.6"/>')
    p.append(f'<circle cx="{hx}" cy="{hy}" r="7" fill="#c9ced3"/><circle cx="{hx}" cy="{hy}" r="4.5" fill="#050505"/>')
    for q in range(12):
        a = -math.pi * .95 + q * .2
        p.append(f'<line x1="{f(hx + math.cos(a) * 26)}" y1="{f(hy + math.sin(a) * 26)}" x2="{f(hx + math.cos(a) * 46)}" y2="{f(hy + math.sin(a) * 46)}" stroke="#ffb13a" stroke-width="3" filter="url(#glow)"/>')
    # Front sheet lifting: cast shadow, folds, weighted hem rod.
    hem = 150
    p.append(f'<rect x="{L}" y="{hem}" width="{R - L}" height="30" fill="url(#gcast)"/>')
    p.append(f'<rect x="{L}" y="{T}" width="{R - L}" height="{hem - T}" fill="url(#gfront)"/>')
    for x in range(L, R, 28):
        k = math.sin(x * .1) * .5 + .5
        p.append(f'<rect x="{x}" y="{T}" width="14" height="{hem - T}" fill="#6f6d64" opacity="{.05 + .08 * k:.3f}"/>')
    p.append(f'<rect x="{L - 6}" y="{hem - 8}" width="{R - L + 12}" height="15" rx="7" fill="url(#grod)"/>')
    # Reticle on the blue circle.
    tx, ty = 320, 214
    p.append(f'<g stroke="#ff2d3c" stroke-width="5" fill="none" filter="url(#glow)"><circle cx="{tx}" cy="{ty}" r="58"/><line x1="{tx}" y1="{ty - 84}" x2="{tx}" y2="{ty - 40}"/><line x1="{tx}" y1="{ty + 40}" x2="{tx}" y2="{ty + 84}"/><line x1="{tx - 84}" y1="{ty}" x2="{tx - 40}" y2="{ty}"/><line x1="{tx + 40}" y1="{ty}" x2="{tx + 84}" y2="{ty}"/></g><circle cx="{tx}" cy="{ty}" r="4" fill="#ff2d3c"/>')
    # Posts with marquee bulbs and the striped awning.
    for x0 in (L - 40, R):
        p.append(f'<rect x="{x0}" y="{T - 30}" width="40" height="{440 - T + 30}" fill="url(#gpost)"/>')
        for q in range(9):
            y = T - 6 + q * 38
            p.append(f'<circle cx="{x0 + 20}" cy="{y}" r="11" fill="#ffd27a" opacity=".35" filter="url(#glow)"/><circle cx="{x0 + 20}" cy="{y}" r="6" fill="#fff4cc"/>')
    for i in range(9):
        x = L - 40 + i * (R - L + 80) / 9
        w = (R - L + 80) / 9
        p.append(f'<path d="M{f(x)},40 L{f(x + w)},40 L{f(x + w)},70 Q{f(x + w / 2)},92 {f(x)},70 Z" fill="{"#e8362b" if i % 2 == 0 else "#fbf3e4"}"/>')
    p.append(f'<rect x="{L - 44}" y="30" width="{R - L + 88}" height="12" rx="4" fill="#7a1c14"/>')
    for q in range(16):
        x = L - 30 + q * (R - L + 60) / 15
        p.append(f'<circle cx="{f(x)}" cy="36" r="8" fill="#ffd27a" opacity=".4" filter="url(#glow)"/><circle cx="{f(x)}" cy="36" r="3.6" fill="#fff4cc"/>')
    # Counter in front.
    p.append(f'<rect x="-10" y="{B}" width="660" height="{440 - B}" fill="url(#gwood)"/><rect x="-10" y="{B}" width="660" height="6" fill="#e8a36a" opacity=".6"/>')
    # Fairground rifle from the bottom right (a little out of focus), with muzzle flash.
    p.append('<g filter="url(#dof)" transform="translate(540 412) rotate(30) scale(1.35)">'
             '<rect x="-236" y="-8" width="200" height="16" rx="6" fill="url(#gbarrel)"/>'
             '<rect x="-232" y="-17" width="10" height="10" rx="2" fill="#2b3138"/>'
             '<rect x="-120" y="5" width="96" height="14" rx="6" fill="url(#gstock)"/>'
             '<rect x="-48" y="-16" width="90" height="34" rx="8" fill="#22282f"/><rect x="-40" y="-22" width="26" height="8" rx="3" fill="#3a434d"/>'
             '<path d="M30,-14 L190,-30 L200,40 L30,22 Z" fill="url(#gstock)"/>'
             '<path d="M-6,18 Q8,44 26,20" fill="none" stroke="#2b3138" stroke-width="6"/></g>')
    mx, my = 540 - 236 * 1.35 * math.cos(math.radians(30)), 412 - 236 * 1.35 * math.sin(math.radians(30))
    p.append(f'<circle cx="{f(mx)}" cy="{f(my)}" r="34" fill="#ffe7a0" opacity=".55" filter="url(#bigglow)"/>')
    p.append(f'<polygon points="{f(mx)},{f(my)} {f(mx - 40)},{f(my - 30)} {f(mx - 16)},{f(my - 8)} {f(mx - 46)},{f(my - 2)} {f(mx - 14)},{f(my + 6)} {f(mx - 28)},{f(my + 30)}" fill="#fff6d6" filter="url(#glow)"/>')
    p.append(sparkle(150, 160, 12, "#fff4cc") + sparkle(500, 180, 10, "#ffffff"))
    return svg("".join(p), extra_defs=d)
covers["shot-gallery"] = gallery()
covers["reaction-test"] = covers["shot-gallery"]


# ---------- Solitaire: big fanned cards on the felt ----------
def card(x, y, rank, suit, red, rot, s=1.0, blur=False):
    col = "#cf1b30" if red else "#121826"
    w, h = 150 * s, 212 * s
    fl = ' filter="url(#dof)"' if blur else ' filter="url(#shadow)"'
    return (f'<g transform="rotate({rot} {f(x + w / 2)} {f(y + h)})"{fl}><rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(14 * s)}" fill="#fbfaf5" stroke="#c9cfd8"/>'
            f'<rect x="{f(x + 7 * s)}" y="{f(y + 7 * s)}" width="{f(w - 14 * s)}" height="{f(h - 14 * s)}" rx="{f(10 * s)}" fill="none" stroke="#e8dec6"/>'
            f'<text x="{f(x + 16 * s)}" y="{f(y + 38 * s)}" font-family="Georgia, serif" font-size="{f(34 * s)}" font-weight="700" fill="{col}">{rank}</text>'
            f'<text x="{f(x + 18 * s)}" y="{f(y + 66 * s)}" font-family="Arial, sans-serif" font-size="{f(26 * s)}" fill="{col}">{suit}</text>'
            f'<text x="{f(x + w / 2)}" y="{f(y + 146 * s)}" font-family="Arial, sans-serif" font-size="{f(84 * s)}" fill="{col}" text-anchor="middle">{suit}</text></g>')


def solitaire():
    d = ('<radialGradient id="felt" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#16805f"/><stop offset=".7" stop-color="#0a4a37"/><stop offset="1" stop-color="#042419"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#felt)"/>']
    r = random.Random(2)
    for _ in range(900):
        p.append(f'<circle cx="{f(r.uniform(0, 640))}" cy="{f(r.uniform(0, 440))}" r=".8" fill="#000" opacity=".12"/>')
    # back cards out of focus
    p.append(card(-40, -60, "A", "♣", False, -18, 1.0, True) + card(520, -40, "A", "♦", True, 16, 1.0, True))
    fan = [("K", "♠", False), ("Q", "♥", True), ("J", "♣", False), ("10", "♦", True), ("9", "♠", False), ("A", "♥", True)]
    for i, (rk, s, red) in enumerate(fan):
        p.append(card(70 + i * 70, 120 + abs(i - 2.5) * 12, rk, s, red, -30 + i * 12, 1.15))
    p.append(sparkle(560, 120, 14, "#ffe9b0") + sparkle(110, 330, 10, "#ffffff"))
    return svg("".join(p), extra_defs=d)
covers["solitaire-sprint"] = solitaire()


# ---------- Mine Grid: perspective field to the edges, a mine exploding ----------
def mine():
    d = ('<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa0e6"/><stop offset="1" stop-color="#2f4a86"/></linearGradient>'
         '<linearGradient id="open" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17264a"/><stop offset="1" stop-color="#0c1630"/></linearGradient>'
         '<radialGradient id="boom" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".3" stop-color="#ffb04a" stop-opacity=".9"/><stop offset=".7" stop-color="#ff3b5c" stop-opacity=".4"/><stop offset="1" stop-color="#ff3b5c" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="#070d22"/>']
    nums = {(4, 3): 1, (5, 3): 2, (4, 4): 1, (5, 4): 3, (6, 4): 2, (5, 5): 1, (4, 5): 1, (6, 3): 1, (6, 5): 1, (3, 4): 1, (7, 4): 2}
    colors = {1: "#7fe3ee", 2: "#5cffb0", 3: "#ff8a4c"}

    def P(i, j):
        t = j / 7
        y = -10 + 470 * (t ** 1.25)
        half = 230 + 330 * t
        return 320 - half + 2 * half * i / 11, y
    for j in range(7):
        for i in range(11):
            a, b, c, dd = P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)
            pad = 3
            pts = f"{f(a[0] + pad)},{f(a[1] + pad)} {f(b[0] - pad)},{f(b[1] + pad)} {f(c[0] - pad)},{f(c[1] - pad)} {f(dd[0] + pad)},{f(dd[1] - pad)}"
            opened = (i, j) in nums or (4 <= i <= 6 and 3 <= j <= 5)
            blur = ' filter="url(#dof)"' if j <= 1 else ""
            p.append(f'<polygon points="{pts}" fill="{"url(#open)" if opened else "url(#tile)"}" stroke="{"#23365e" if opened else "#b2ccf6"}" stroke-width="1.5"{blur}/>')
            if (i, j) in nums:
                cxx = (a[0] + b[0] + c[0] + dd[0]) / 4; cyy = (a[1] + b[1] + c[1] + dd[1]) / 4
                p.append(f'<text x="{f(cxx)}" y="{f(cyy + 12)}" font-family="Arial Black, sans-serif" font-size="{26 + j * 6}" fill="{colors[nums[(i, j)]]}" text-anchor="middle" filter="url(#glow)">{nums[(i, j)]}</text>')
    for (fi, fj) in [(7.5, 2.5), (2.5, 5.5)]:
        fx, fy = P(fi, fj); s = .9 + fj * .25
        p.append(f'<line x1="{f(fx)}" y1="{f(fy + 12 * s)}" x2="{f(fx)}" y2="{f(fy - 40 * s)}" stroke="#e9f4ff" stroke-width="{f(4 * s)}"/><polygon points="{f(fx)},{f(fy - 40 * s)} {f(fx + 34 * s)},{f(fy - 28 * s)} {f(fx)},{f(fy - 16 * s)}" fill="#ff3b5c"/>')
    mx, my = P(8.5, 5.6)
    p.append(f'<circle cx="{f(mx)}" cy="{f(my)}" r="150" fill="url(#boom)"/>')
    rr = random.Random(2)
    for q in range(22):
        a = q * math.pi / 11 + rr.uniform(-.1, .1); d0, d1 = 50, 50 + rr.uniform(40, 110)
        p.append(f'<line x1="{f(mx + math.cos(a) * d0)}" y1="{f(my + math.sin(a) * d0 * .8)}" x2="{f(mx + math.cos(a) * d1)}" y2="{f(my + math.sin(a) * d1 * .8)}" stroke="#ffd36a" stroke-width="4" stroke-linecap="round" filter="url(#glow)"/>')
    for q in range(8):
        a = q * math.pi / 4
        p.append(f'<line x1="{f(mx)}" y1="{f(my)}" x2="{f(mx + 40 * math.cos(a))}" y2="{f(my + 40 * math.sin(a))}" stroke="#2a2f3a" stroke-width="7" stroke-linecap="round"/>')
    p.append(sphere(mx, my, 28, "#3a3f4c", "mine", hi="#9aa3b5", shadow=False))
    p.append(f'<circle cx="{f(mx + 7)}" cy="{f(my - 7)}" r="5" fill="#ff3b5c" filter="url(#glow)"/>')
    return svg("".join(p), extra_defs=d)
covers["mine-grid"] = mine()


# ---------- Stack Shift: the well fills the frame, a line clearing ----------
def stackshift():
    p = ['<rect width="640" height="440" fill="#070b1c"/>']
    for x in range(0, 640, 32):
        p.append(f'<line x1="{x}" y1="0" x2="{x}" y2="440" stroke="#7fe3ee" stroke-opacity=".05"/>')
    cs = 46
    x0 = 320 - 6 * cs
    p.append(f'<rect x="{x0 - 10}" y="-20" width="{12 * cs + 20}" height="480" fill="#0a1328" stroke="#7fe3ee" stroke-width="4" filter="url(#glow)"/>')

    def cell(i, j, col, glow=False):
        x = x0 + i * cs; y = 440 - (j + 1) * cs
        g = ' filter="url(#glow)"' if glow else ""
        return (f'<g{g}><rect x="{x + 2}" y="{y + 2}" width="{cs - 4}" height="{cs - 4}" rx="7" fill="{col}"/><rect x="{x + 6}" y="{y + 5}" width="{cs - 12}" height="9" rx="4" fill="#fff" opacity=".42"/>'
                f'<rect x="{x + 6}" y="{y + cs - 14}" width="{cs - 12}" height="7" rx="3" fill="#000" opacity=".22"/></g>')
    cols = ["#4fa8ff", "#a47bff", "#ff6f91", "#ffd23f", "#5cffb0", "#ff9a3c", "#2fd9c8"]
    heights = [3, 4, 2, 5, 3, 4, 1, 3, 4, 2, 3, 4]
    for i, h in enumerate(heights):
        for j in range(h):
            if j == 1: continue
            p.append(cell(i, j, cols[(i * 3 + j) % 7]))
    yline = 440 - 2 * cs
    p.append(f'<rect x="{x0}" y="{yline}" width="{12 * cs}" height="{cs}" fill="#ffffff" opacity=".9" filter="url(#bigglow)"/>')
    r = random.Random(8)
    for q in range(26):
        x = r.uniform(x0, x0 + 12 * cs); y = yline + r.uniform(-30, 10) - r.uniform(0, 140)
        p.append(f'<rect x="{f(x)}" y="{f(y)}" width="10" height="10" rx="2" fill="{r.choice(cols)}" transform="rotate({r.randint(0, 90)} {f(x)} {f(y)})" opacity=".9"/>')
    for (i, j) in [(5, 7), (6, 7), (7, 7), (6, 8)]:
        p.append(f'<rect x="{x0 + i * cs + 10}" y="{440 - (j + 1) * cs - 60}" width="{cs - 20}" height="60" fill="#b98cff" opacity=".2"/>')
        p.append(cell(i, j, "#b98cff", True))
    for (i, j) in [(5, 4), (6, 4), (7, 4), (6, 5)]:
        p.append(f'<rect x="{x0 + i * cs + 2}" y="{440 - (j + 1) * cs + 2}" width="{cs - 4}" height="{cs - 4}" rx="7" fill="none" stroke="#b98cff" stroke-width="2" stroke-dasharray="6 4" opacity=".7"/>')
    p.append(sparkle(x0 + 12 * cs - 20, yline + 20, 16) + sparkle(160, 120, 10, "#e0d0ff"))
    return svg("".join(p))
covers["stack-shift"] = stackshift()


# ---------- Stack: isometric tower fills the frame ----------
def iso(cx, cy, w, dd, h, top, left, right):
    t = [(cx, cy - dd), (cx + w, cy), (cx, cy + dd), (cx - w, cy)]
    lf = [(cx - w, cy), (cx, cy + dd), (cx, cy + dd + h), (cx - w, cy + h)]
    rt = [(cx, cy + dd), (cx + w, cy), (cx + w, cy + h), (cx, cy + dd + h)]
    F = lambda pts: " ".join(f"{f(x)},{f(y)}" for x, y in pts)
    return (f'<polygon points="{F(lf)}" fill="{left}"/><polygon points="{F(rt)}" fill="{right}"/><polygon points="{F(t)}" fill="{top}"/>'
            f'<polyline points="{F([t[3], t[0], t[1]])}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>')


def stack():
    """The full tower sits lower in the frame (v118): the falling gold block and the landing ring clear the card's badge."""
    d = '<radialGradient id="sbg" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#2a3a7a"/><stop offset="1" stop-color="#060a1e"/></radialGradient>'
    p = ['<rect width="640" height="440" fill="url(#sbg)"/>', stars(31, 70, 260), bokeh(15, ["#7fe3ee", "#b996ff", "#ff9ad8"], 12, 440, 20, 55)]
    cols = [("#7fe3ee", "#2d8ea0", "#1d6475"), ("#8fb4ff", "#3c5fbf", "#2a428a"), ("#b996ff", "#6b46c6", "#4b2f92"), ("#ff9ad8", "#c2468f", "#8a2c63"), ("#7fffc4", "#2aa877", "#1c7a55")]
    g = ['<g transform="translate(0 128)">']
    for i in range(9):
        c = cols[i % len(cols)]
        g.append(iso(320 + (i % 2) * 6 - 3, 470 - i * 46, 230 - i * 6, 116 - i * 3, 38, *c))
    g.append('<ellipse cx="320" cy="84" rx="200" ry="98" fill="none" stroke="#fff3b0" stroke-width="5" opacity=".75" filter="url(#glow)"/>')
    g.append(iso(420, 30, 150, 76, 34, "#ffe066", "#c99a1c", "#8f6b10"))
    for q in range(1, 5):
        g.append(f'<rect x="{410 + q * 3}" y="{-60 - q * 14}" width="{4 + q}" height="{28 - q * 3}" rx="2" fill="#ffe066" opacity="{.6 - q * .12:.2f}"/>')
    g.append('</g>')
    p += g
    p.append(f'<g transform="rotate(26 570 250)">{iso(570, 250, 46, 24, 30, "#ffe066", "#c99a1c", "#8f6b10")}</g>')
    p.append(sparkle(150, 200, 14, "#fff3b0") + sparkle(540, 140, 10))
    return svg("".join(p), extra_defs=d)
covers["precision-stack"] = stack()
covers["stack-3d"] = covers["precision-stack"]


# ---------- Pinball: the playfield in close-up, bumpers lit, ball flying off a flipper ----------
def pinball():
    d = ('<linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a6c"/><stop offset="1" stop-color="#081638"/></linearGradient>'
         '<linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fe8ff" stop-opacity=".25"/><stop offset=".5" stop-color="#9fe8ff" stop-opacity=".75"/><stop offset="1" stop-color="#9fe8ff" stop-opacity=".25"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#pf)"/>']
    for (x, y, r, c) in [(140, 120, 200, "rgba(170,60,220,.35)"), (520, 300, 220, "rgba(30,170,220,.28)")]:
        p.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" filter="url(#soft)"/>')
    p.append(stars(22, 70))
    # habitrails sweeping across
    for path in ["M-20,300 C80,60 260,10 400,30 S640,120 660,60", "M660,330 C560,120 420,80 300,90"]:
        p.append(f'<path d="{path}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="34" transform="translate(6 10)"/><path d="{path}" fill="none" stroke="url(#ramp)" stroke-width="30"/>')
        p.append(f'<path d="{path}" fill="none" stroke="#e9f2fb" stroke-width="3" transform="translate(0 -13)"/><path d="{path}" fill="none" stroke="#e9f2fb" stroke-width="3" transform="translate(0 13)"/>')
    # bumpers big
    for (x, y, r, c, lit) in [(190, 210, 62, "#e12d3f", False), (400, 170, 58, "#ffb81f", True), (330, 330, 66, "#2f8fff", False)]:
        p.append(f'<circle cx="{x + 6}" cy="{y + 12}" r="{r + 10}" fill="#000" opacity=".45" filter="url(#soft)"/><circle cx="{x}" cy="{y}" r="{r + 10}" fill="#141a2c"/>')
        if lit:
            p.append(f'<circle cx="{x}" cy="{y}" r="{r + 40}" fill="{c}" opacity=".35" filter="url(#bigglow)"/>')
        p.append(sphere(x, y, r, c, f"bp{x}", shadow=False))
        p.append(f'<circle cx="{x}" cy="{y}" r="{r * .58}" fill="#f2f6fb"/>')
        p.append(f'<g fill="{c}">{shape("star", x, y, r * .38)}</g>')
        for n in range(14):
            a = n / 14 * 2 * math.pi
            p.append(f'<circle cx="{f(x + math.cos(a) * (r + 5))}" cy="{f(y + math.sin(a) * (r + 5))}" r="3" fill="{c if lit else "#fff"}" opacity="{1 if lit else .3}"/>')
    p.append('<circle cx="400" cy="170" r="94" fill="none" stroke="#fff3b0" stroke-width="5" opacity=".7" filter="url(#glow)"/>')
    # flipper at the bottom right, ball shooting up off it
    p.append('<g filter="url(#shadow)"><path d="M640,410 L470,372 Q456,370 458,384 L630,440 Z" fill="#fbfbff" stroke="#e12d3f" stroke-width="6"/></g>')
    pts = [(520 - t * 14, 360 - t * 22) for t in range(9)]
    p.append(trail(pts, "#bdf6ff", 30, .6))
    p.append(sphere(pts[-1][0], pts[-1][1], 26, "#dfe7f1", "pbb"))
    # score display strip at the top
    p.append('<rect x="200" y="12" width="240" height="44" rx="8" fill="#120700" stroke="#ff8a1f" stroke-width="3"/><text x="320" y="46" font-family="Menlo, monospace" font-size="30" font-weight="900" fill="#ffb03a" text-anchor="middle" filter="url(#glow)">2.450.000</text>')
    for i in range(7):
        p.append(f'<circle cx="{60 + i * 34}" cy="410" r="8" fill="{"#5cffb0" if i % 2 else "#24463a"}" filter="url(#glow)"/>')
    p.append(sparkle(400, 170, 22, "#fff3b0"))
    return svg("".join(p), extra_defs=d)
covers["pinball"] = pinball()


# ---------- Bowling: low view at the pin deck, the ball smashing in ----------
def pin(x, y, s, idn, rot=0):
    return (f'<defs><linearGradient id="{idn}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aeb8c6"/><stop offset=".42" stop-color="#ffffff"/><stop offset="1" stop-color="#8f9aab"/></linearGradient></defs>'
            f'<ellipse cx="{f(x)}" cy="{f(y + 2)}" rx="{f(10 * s)}" ry="{f(3 * s)}" fill="#000" opacity=".4"/>'
            f'<g transform="rotate({rot} {f(x)} {f(y)})"><path d="M{f(x)},{f(y - 46 * s)} C{f(x + 6 * s)},{f(y - 46 * s)} {f(x + 7 * s)},{f(y - 38 * s)} {f(x + 5 * s)},{f(y - 32 * s)} C{f(x + 4 * s)},{f(y - 28 * s)} {f(x + 11 * s)},{f(y - 16 * s)} {f(x + 10 * s)},{f(y - 6 * s)} C{f(x + 9 * s)},{f(y)} {f(x - 9 * s)},{f(y)} {f(x - 10 * s)},{f(y - 6 * s)} C{f(x - 11 * s)},{f(y - 16 * s)} {f(x - 4 * s)},{f(y - 28 * s)} {f(x - 5 * s)},{f(y - 32 * s)} C{f(x - 7 * s)},{f(y - 38 * s)} {f(x - 6 * s)},{f(y - 46 * s)} {f(x)},{f(y - 46 * s)}Z" fill="url(#{idn})"/>'
            f'<rect x="{f(x - 5 * s)}" y="{f(y - 33 * s)}" width="{f(10 * s)}" height="{f(2.5 * s)}" fill="#e12d3f"/><rect x="{f(x - 5.5 * s)}" y="{f(y - 29 * s)}" width="{f(11 * s)}" height="{f(2.5 * s)}" fill="#e12d3f"/></g>')


def bowling():
    d = ('<linearGradient id="lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a30"/><stop offset="1" stop-color="#f0c48a"/></linearGradient>'
         '<radialGradient id="hit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff6c8"/><stop offset=".4" stop-color="#ffb04a" stop-opacity=".6"/><stop offset="1" stop-color="#ff3d9a" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="#090b1c"/>', bokeh(24, ["#ff3d9a", "#7a5cff", "#7fe3ee"], 14, 160, 14, 40)]
    p.append('<polygon points="80,150 560,150 760,440 -120,440" fill="url(#lane)"/>')
    for q in range(1, 24):
        x0 = 80 + 480 * q / 24; x1 = -120 + 880 * q / 24
        p.append(f'<line x1="{f(x0)}" y1="150" x2="{f(x1)}" y2="440" stroke="#5a3519" stroke-opacity=".3"/>')
    p.append('<polygon points="80,150 560,150 600,210 40,210" fill="#fff" opacity=".1"/>')
    p.append('<rect x="0" y="120" width="640" height="34" fill="#0b1226"/><rect x="0" y="148" width="640" height="5" fill="#ff3d9a" filter="url(#glow)"/>')
    p.append('<circle cx="330" cy="200" r="170" fill="url(#hit)"/>')
    rows = [[(320, 250)], [(280, 236), (360, 236)], [(240, 222), (320, 222), (400, 222)], [(200, 208), (280, 208), (360, 208), (440, 208)]]
    flying = {(320, 250): (-30, -40, -50), (280, 236): (-110, -90, -80), (360, 236): (90, -100, 70), (320, 222): (10, -150, 20), (240, 222): (-150, -40, -110), (400, 222): (160, -60, 120)}
    k = 0
    for row in reversed(rows):
        for (x, y) in row:
            if (x, y) in flying:
                dx, dy, rot = flying[(x, y)]
                p.append(trail([(x, y - 40), (x + dx * .6, y + dy * .6 - 40)], "#ffffff", 10, .4))
                p.append(pin(x + dx, y + dy, 2.0, f"pf{k}", rot))
            else:
                p.append(pin(x, y, 1.9, f"ps{k}"))
            k += 1
    rr = random.Random(41)
    for _ in range(50):
        a = rr.uniform(0, 2 * math.pi); dd = rr.uniform(40, 300)
        x, y = 330 + math.cos(a) * dd, 200 + math.sin(a) * dd * .6
        p.append(f'<rect x="{f(x)}" y="{f(y)}" width="9" height="4" fill="{rr.choice(["#ff3d9a", "#7fe3ee", "#ffd23f", "#b98cff"])}" transform="rotate({rr.randint(0, 180)} {f(x)} {f(y)})"/>')
    for i in range(7):
        p.append(f'<circle cx="{350 - i * 10}" cy="{350 + i * 18}" r="{90 - i * 7}" fill="#7a5cff" opacity="{.16 - i * .02:.2f}"/>')
    p.append(sphere(350, 330, 92, "#5b3cff", "ball", hi="#d6c8ff", shade="#140a44", gloss=.7))
    p.append('<path d="M272,318 Q350,280 432,330" fill="none" stroke="#ff7ad8" stroke-width="7" opacity=".45"/>')
    for (dx, dy) in [(-18, -30), (14, -38), (-4, -8)]:
        p.append(f'<circle cx="{350 + dx}" cy="{330 + dy}" r="10" fill="#0e0830"/>')
    p.append(sparkle(330, 206, 26, "#fff8e0"))
    return svg("".join(p), extra_defs=d)
covers["bowling"] = bowling()


# ---------- Galoku: the five-box board fills the frame ----------
def galoku():
    U = 44; K = U / math.sqrt(2); OX = 320; OY = 4
    boxes = [(0, 0), (0, 3), (0, 6), (3, 0), (6, 0)]
    tones = ["#f3c55a", "#7fe3ee", "#5fb8ff", "#ff7ab8", "#c58cff"]
    P = lambda c, r: (OX + (c - r) * K, OY + (c + r) * K)
    poly = lambda c, r, w, h: " ".join(f"{f(x)},{f(y)}" for x, y in [P(c, r), P(c + w, r), P(c + w, r + h), P(c, r + h)])
    rr = random.Random(6)
    p = ['<rect width="640" height="440" fill="#070c22"/>', bokeh(23, tones, 12, 440, 20, 60)]
    for _ in range(14):
        p.append(f'<text x="{f(rr.uniform(0, 640))}" y="{f(rr.uniform(40, 440))}" font-family="Arial Black, sans-serif" font-size="{rr.randint(30, 80)}" fill="{rr.choice(tones)}" opacity=".14" filter="url(#dof)">{rr.randint(1, 9)}</text>')
    p.append('<g filter="url(#shadow)">' + "".join(f'<polygon points="{poly(c0, r0, 3, 3)}" fill="#13264a"/>' for (r0, c0) in boxes) + '</g>')
    p.append(f'<polygon points="{poly(0, 1, 9, 1)}" fill="#7fe3ee" fill-opacity=".1"/><polygon points="{poly(1, 0, 1, 9)}" fill="#7fe3ee" fill-opacity=".1"/>')
    p.append(f'<polygon points="{poly(1, 1, 1, 1)}" fill="#f3c55a" fill-opacity=".5" filter="url(#glow)"/>')
    for (r0, c0) in boxes:
        for r in range(3):
            for c in range(3):
                p.append(f'<polygon points="{poly(c0 + c, r0 + r, 1, 1)}" fill="none" stroke="#a7bfe0" stroke-opacity=".35" stroke-width="1.5"/>')
    for i, (r0, c0) in enumerate(boxes):
        p.append(f'<polygon points="{poly(c0, r0, 3, 3)}" fill="none" stroke="{tones[i]}" stroke-width="5" stroke-linejoin="round" filter="url(#glow)"/>')
    digits = {(0, 0): 5, (2, 2): 8, (0, 4): 7, (1, 7): 2, (4, 1): 9, (7, 2): 4, (2, 5): 6, (5, 0): 1, (8, 1): 6, (1, 3): 1, (0, 8): 9, (6, 2): 3, (2, 0): 4, (3, 1): 2, (1, 5): 4, (2, 7): 3, (7, 0): 8}
    for (r, c), dg in digits.items():
        x, y = P(c + .5, r + .5)
        p.append(f'<text x="{f(x)}" y="{f(y + 10)}" font-family="Arial, sans-serif" font-size="28" font-weight="800" text-anchor="middle" fill="{"#7fe3ee" if (r * 3 + c) % 4 == 0 else "#eef4ff"}">{dg}</text>')
    x, y = P(1.5, 1.5)
    p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="30" fill="none" stroke="#fff3b0" stroke-width="3.5" filter="url(#glow)"/><text x="{f(x)}" y="{f(y + 13)}" font-family="Arial Black, sans-serif" font-size="38" text-anchor="middle" fill="#fff3b0" filter="url(#glow)">3</text>')
    p.append(sparkle(x + 34, y - 30, 14, "#fff3b0"))
    return svg("".join(p))
covers["corner-sudoku"] = galoku()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, body in covers.items():
        open(os.path.join(OUT, f"{name}.svg"), "w").write(body)
    print("wrote", len(covers), "covers to", OUT)
