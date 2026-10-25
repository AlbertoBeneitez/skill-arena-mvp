"""Catalogue covers v2 (original art, 640×400 SVG): every game in a lit scene with depth, motion and detail."""
import math, random, os, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "covers")

def f2(v):
    return f"{v:.1f}"

def stars(seed, n=70, ymax=400):
    r = random.Random(seed)
    s = []
    for _ in range(n):
        x, y = r.uniform(0, 640), r.uniform(0, ymax)
        rad = r.choice([0.5, 0.7, 0.9, 1.1, 1.5])
        s.append(f'<circle cx="{f2(x)}" cy="{f2(y)}" r="{rad}" fill="#e8f1ff" opacity="{r.uniform(.25, .9):.2f}"/>')
    return "".join(s)

def sparkle(x, y, s, col="#ffffff", op=1):
    return (f'<g opacity="{op}" filter="url(#glow)"><path d="M{x},{y - s} Q{x + s * .14},{y - s * .14} {x + s},{y} Q{x + s * .14},{y + s * .14} {x},{y + s} '
            f'Q{x - s * .14},{y + s * .14} {x - s},{y} Q{x - s * .14},{y - s * .14} {x},{y - s}Z" fill="{col}"/></g>')

def bokeh(seed, cols, n=9):
    r = random.Random(seed * 7 + 1)
    out = []
    for _ in range(n):
        x, y, rr = r.uniform(0, 640), r.uniform(10, 260), r.uniform(10, 34)
        out.append(f'<circle cx="{f2(x)}" cy="{f2(y)}" r="{f2(rr)}" fill="{r.choice(cols)}" opacity="{r.uniform(.07, .18):.2f}" filter="url(#bokeh)"/>')
    return "".join(out)

def planet(seed, accent):
    r = random.Random(seed)
    side = r.choice([-1, 1])
    x = 320 + side * r.uniform(220, 280)
    y = r.uniform(40, 90)
    R = r.uniform(70, 95)
    return (f'<defs><radialGradient id="pl" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f3e2c0"/><stop offset=".45" stop-color="#b08a5a"/><stop offset="1" stop-color="#2a1d14"/></radialGradient>'
            f'<linearGradient id="plr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{accent}" stop-opacity="0"/><stop offset=".5" stop-color="#f6e6c4" stop-opacity=".8"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></linearGradient></defs>'
            f'<g opacity=".55"><ellipse cx="{f2(x)}" cy="{f2(y)}" rx="{f2(R * 2.1)}" ry="{f2(R * .38)}" fill="none" stroke="url(#plr)" stroke-width="9" transform="rotate(-14 {f2(x)} {f2(y)})"/>'
            f'<circle cx="{f2(x)}" cy="{f2(y)}" r="{f2(R)}" fill="url(#pl)"/>'
            f'<path d="M{f2(x - R * 2.1)},{f2(y)} A{f2(R * 2.1)},{f2(R * .38)} 0 0 0 {f2(x + R * 2.1)},{f2(y)}" fill="none" stroke="url(#plr)" stroke-width="9" transform="rotate(-14 {f2(x)} {f2(y)})"/></g>')

def frame(accent, accent2, body, seed=1, floor_y=330, floor=True, rays=True, front=""):
    ray = ""
    if rays:
        ray = (f'<g opacity=".55" filter="url(#ray)"><polygon points="250,-10 300,-10 380,{floor_y} 170,{floor_y}" fill="{accent}" opacity=".18"/>'
               f'<polygon points="330,-10 370,-10 520,{floor_y} 360,{floor_y}" fill="{accent2}" opacity=".14"/>'
               f'<polygon points="200,-10 230,-10 230,{floor_y} 60,{floor_y}" fill="#ffffff" opacity=".06"/></g>')
    flo = ""
    if floor:
        lines = []
        for k in range(-9, 10):
            lines.append(f'<line x1="{320 + k * 26}" y1="{floor_y}" x2="{320 + k * 120}" y2="400" stroke="{accent}" stroke-opacity=".16"/>')
        for k in range(1, 6):
            yy = floor_y + (400 - floor_y) * (k / 6) ** 1.6
            lines.append(f'<line x1="0" y1="{f2(yy)}" x2="640" y2="{f2(yy)}" stroke="{accent}" stroke-opacity="{.06 + k * .02:.2f}"/>')
        flo = (f'<rect x="0" y="{floor_y}" width="640" height="{400 - floor_y}" fill="url(#flo)"/>' + "".join(lines) +
               f'<ellipse cx="320" cy="{floor_y + 8}" rx="270" ry="38" fill="url(#floorglow)"/>'
               f'<line x1="0" y1="{floor_y}" x2="640" y2="{floor_y}" stroke="{accent}" stroke-opacity=".35" stroke-width="1.5"/>')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400">
<defs>
<radialGradient id="bg" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="#1d2c5e"/><stop offset=".55" stop-color="#0c1533"/><stop offset="1" stop-color="#04070f"/></radialGradient>
<radialGradient id="neb1" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{accent}" stop-opacity=".55"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="neb2" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{accent2}" stop-opacity=".45"/><stop offset="1" stop-color="{accent2}" stop-opacity="0"/></radialGradient>
<radialGradient id="floorglow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{accent}" stop-opacity=".6"/><stop offset="1" stop-color="{accent}" stop-opacity="0"/></radialGradient>
<linearGradient id="flo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1530"/><stop offset="1" stop-color="#03050b"/></linearGradient>
<radialGradient id="vig" cx="50%" cy="45%" r="72%"><stop offset=".58" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
<linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6fbff"/><stop offset=".45" stop-color="#9fb0c4"/><stop offset=".55" stop-color="#5d6c80"/><stop offset="1" stop-color="#cfdbe8"/></linearGradient>
<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffb81f"/><stop offset="1" stop-color="#b86a00"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="bokeh" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="ray" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#000" flood-opacity=".6"/></filter>
</defs>
<rect width="640" height="400" fill="url(#bg)"/>
<ellipse cx="160" cy="120" rx="240" ry="160" fill="url(#neb1)"/>
<ellipse cx="510" cy="260" rx="240" ry="170" fill="url(#neb2)"/>
{stars(seed)}
{planet(seed, accent)}
{bokeh(seed, [accent, accent2, "#ffffff"])}
{ray}
{flo}
{body}
{front}
<rect width="640" height="400" fill="url(#vig)"/>
</svg>'''

def sphere(cx, cy, r, color, hi="#ffffff", idn="s", shade=None, shadow=True):
    shade = shade or "#000"
    g = f'<radialGradient id="{idn}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="{hi}"/><stop offset=".25" stop-color="{color}"/><stop offset="1" stop-color="{shade}"/></radialGradient>'
    sh = f'<ellipse cx="{f2(cx)}" cy="{f2(cy + r * 0.95)}" rx="{f2(r * 0.9)}" ry="{f2(r * 0.22)}" fill="#000" opacity=".4" filter="url(#soft)"/>' if shadow else ""
    return (f'<defs>{g}</defs>{sh}<circle cx="{f2(cx)}" cy="{f2(cy)}" r="{f2(r)}" fill="url(#{idn})"/>'
            f'<ellipse cx="{f2(cx - r * .32)}" cy="{f2(cy - r * .38)}" rx="{f2(r * .3)}" ry="{f2(r * .17)}" fill="#fff" opacity=".6" transform="rotate(-30 {f2(cx - r * .32)} {f2(cy - r * .38)})"/>')

def trail(points, col, w0=10):
    out = []
    n = len(points)
    for i in range(1, n):
        (x0, y0), (x1, y1) = points[i - 1], points[i]
        out.append(f'<line x1="{f2(x0)}" y1="{f2(y0)}" x2="{f2(x1)}" y2="{f2(y1)}" stroke="{col}" stroke-width="{f2(w0 * i / n)}" stroke-linecap="round" opacity="{.08 + .5 * i / n:.2f}"/>')
    return "".join(out)

def confetti(seed, cx, cy, n, cols, spread=220):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        a = r.uniform(0, 2 * math.pi); d = r.uniform(30, spread)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * .7
        c = r.choice(cols)
        if r.random() < .5:
            out.append(f'<rect x="{f2(x)}" y="{f2(y)}" width="7" height="3" fill="{c}" transform="rotate({r.randint(0, 180)} {f2(x)} {f2(y)})" opacity=".9"/>')
        else:
            out.append(f'<circle cx="{f2(x)}" cy="{f2(y)}" r="{r.uniform(1.2, 2.6):.1f}" fill="{c}" opacity=".9"/>')
    return "".join(out)

covers = {}
ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}

# ---------- Galactic Roulette ----------
def roulette():
    cx, cy, rx, ry = 320, 200, 214, 104
    k = ry / rx
    p = ['<defs><linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d08a3c"/><stop offset=".45" stop-color="#7a4216"/><stop offset="1" stop-color="#2e1606"/></linearGradient>'
         '<radialGradient id="cone" cx="45%" cy="35%" r="65%"><stop offset="0" stop-color="#f1d58e"/><stop offset=".5" stop-color="#9a7430"/><stop offset="1" stop-color="#3b2a10"/></radialGradient>'
         '<linearGradient id="felt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f7a4e"/><stop offset="1" stop-color="#063d27"/></linearGradient></defs>']
    # cloth in the foreground with gold lines
    p.append('<polygon points="0,300 640,300 640,400 0,400" fill="url(#felt)"/>')
    p.append('<path d="M0,318 L640,318 M0,372 L640,372" stroke="#e9c46a" stroke-width="2" opacity=".7"/>')
    for i, n in enumerate([3, 6, 9, 12, 15, 18, 21]):
        x = 40 + i * 90
        col = "#c8202f" if n in RED else "#14161d"
        p.append(f'<polygon points="{x},322 {x + 80},322 {x + 86},368 {x - 6},368" fill="{col}" opacity=".85" stroke="#e9c46a" stroke-width="1.2"/>'
                 f'<text x="{x + 40}" y="354" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#f6ecd2" text-anchor="middle">{n}</text>')
    p.append(f'<ellipse cx="{cx}" cy="{cy + 34}" rx="{rx + 14}" ry="{ry + 16}" fill="#000" opacity=".55" filter="url(#soft)"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy + 16}" rx="{rx}" ry="{ry}" fill="#2b1406"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#wood)"/>')
    p.append(f'<path d="M{cx - rx + 10},{cy - 10} A{rx - 10},{ry - 10} 0 0 1 {cx + rx - 10},{cy - 10}" fill="none" stroke="#ffe2a8" stroke-width="2" opacity=".55"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx - 16}" ry="{ry - 9}" fill="#1a0d05"/>')
    # ball track diamonds
    for i in range(8):
        a = i * math.pi / 4 + .2
        x, y = cx + (rx - 30) * math.cos(a), cy + (rx - 30) * math.sin(a) * k
        p.append(f'<polygon points="{f2(x)},{f2(y - 5)} {f2(x + 7)},{f2(y)} {f2(x)},{f2(y + 5)} {f2(x - 7)},{f2(y)}" fill="url(#chrome)"/>')
    R1, R2, R3 = rx - 46, rx - 72, rx - 90
    for i, num in enumerate(ORDER):
        a0, a1 = 2 * math.pi * i / 37 + .3, 2 * math.pi * (i + 1) / 37 + .3
        col = "#18a35a" if num == 0 else ("#c8202f" if num in RED else "#14161d")
        pts = " ".join(f"{f2(cx + rr * math.cos(a))},{f2(cy + rr * math.sin(a) * k)}" for a, rr in [(a0, R1), (a1, R1), (a1, R2), (a0, R2)])
        p.append(f'<polygon points="{pts}" fill="{col}" stroke="#e2c27a" stroke-width=".8"/>')
        am = (a0 + a1) / 2
        tx, ty = cx + (R1 + R2) / 2 * math.cos(am), cy + (R1 + R2) / 2 * math.sin(am) * k
        if math.sin(am) > -0.2:
            p.append(f'<text x="{f2(tx)}" y="{f2(ty + 3)}" font-family="system-ui" font-size="7.5" font-weight="800" fill="#fff" text-anchor="middle">{num}</text>')
        pk = " ".join(f"{f2(cx + rr * math.cos(a))},{f2(cy + rr * math.sin(a) * k)}" for a, rr in [(a0, R2), (a1, R2), (a1, R3), (a0, R3)])
        p.append(f'<polygon points="{pk}" fill="#2a1a0b" stroke="#f4dc9a" stroke-width="1.2"/>')
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{R3}" ry="{f2(R3 * k)}" fill="url(#cone)"/>')
    for i in range(8):
        a = i * math.pi / 4
        p.append(f'<line x1="{cx}" y1="{cy}" x2="{f2(cx + (R3 - 4) * math.cos(a))}" y2="{f2(cy + (R3 - 4) * math.sin(a) * k)}" stroke="#ffe8b0" stroke-opacity=".25" stroke-width="3"/>')
    # turret
    p.append(f'<rect x="{cx - 7}" y="{cy - 52}" width="14" height="52" rx="6" fill="url(#chrome)"/>')
    for a in [0.3, 0.3 + math.pi / 2, 0.3 + math.pi, 0.3 + 3 * math.pi / 2]:
        p.append(f'<line x1="{cx}" y1="{cy - 34}" x2="{f2(cx + 50 * math.cos(a))}" y2="{f2(cy - 34 + 22 * math.sin(a))}" stroke="url(#chrome)" stroke-width="6" stroke-linecap="round"/>'
                 f'<circle cx="{f2(cx + 50 * math.cos(a))}" cy="{f2(cy - 34 + 22 * math.sin(a))}" r="5" fill="url(#chrome)"/>')
    p.append(f'<circle cx="{cx}" cy="{cy - 54}" r="10" fill="url(#chrome)"/>')
    # the ball flying along the track with a bright trail, landing towards a pocket
    pts = [(cx + (rx - 26) * math.cos(a), cy + (rx - 26) * math.sin(a) * k - 10 * math.sin((a - 1.2) * 1.4)) for a in [1.0 + t * .09 for t in range(12)]]
    p.append(trail(pts, "#e8f6ff", 10))
    bx, by = pts[-1]
    p.append(sphere(bx, by - 4, 9, "#eef4fb", idn="rb"))
    p.append(f'<circle cx="{f2(bx)}" cy="{f2(by - 4)}" r="16" fill="#ffffff" opacity=".25" filter="url(#glow)"/>')
    def chip(x, y, col, n, val):
        out = []
        for q in range(n):
            yy = y - q * 7
            out.append(f'<ellipse cx="{x}" cy="{yy + 4}" rx="34" ry="12" fill="#000" opacity=".3"/><ellipse cx="{x}" cy="{yy}" rx="34" ry="12" fill="{col}"/>'
                       f'<ellipse cx="{x}" cy="{yy}" rx="34" ry="12" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3" stroke-dasharray="6 9"/>')
        top = y - (n - 1) * 7
        out.append(f'<ellipse cx="{x}" cy="{top}" rx="21" ry="7" fill="{col}" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>'
                   f'<text x="{x}" y="{top + 3.5}" font-family="system-ui" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">{val}</text>')
        return "".join(out)
    p.append(chip(78, 312, "#ff8a1f", 6, "25") + chip(132, 340, "#e12d3f", 3, "5") + chip(560, 326, "#8b45e6", 7, "25") + chip(510, 356, "#1f8fff", 2, "1"))
    front = sparkle(cx + rx - 30, cy - ry + 20, 9, "#ffe9b0") + sparkle(120, 90, 6) + sparkle(540, 120, 7, "#ffd0a0")
    return frame("#ff5a3c", "#7a3cff", "".join(p), seed=11, floor=False, front=front)
covers["galactic-roulette"] = roulette()

# ---------- Galactic Slot ----------
def slot():
    p = ['<defs><linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2c8f"/><stop offset="1" stop-color="#160a3a"/></linearGradient>'
         '<linearGradient id="reel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a6274"/><stop offset=".22" stop-color="#eef2f8"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".78" stop-color="#eef2f8"/><stop offset="1" stop-color="#5a6274"/></linearGradient>'
         '<linearGradient id="seven" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0d6"/><stop offset=".45" stop-color="#ff3b52"/><stop offset="1" stop-color="#8c0a1e"/></linearGradient>'
         '<radialGradient id="burst" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffb81f" stop-opacity="0"/></radialGradient></defs>']
    # sunburst rays behind the cabinet
    for i in range(16):
        a0 = i * math.pi / 8; a1 = a0 + math.pi / 18
        p.append(f'<polygon points="320,200 {f2(320 + 420 * math.cos(a0))},{f2(200 + 420 * math.sin(a0))} {f2(320 + 420 * math.cos(a1))},{f2(200 + 420 * math.sin(a1))}" fill="{"#ffb81f" if i % 2 else "#ff3d9a"}" opacity=".09"/>')
    p.append('<circle cx="320" cy="190" r="190" fill="url(#burst)"/>')
    p.append('<rect x="170" y="318" width="300" height="40" rx="10" fill="#1d1040" stroke="url(#gold)" stroke-width="3"/>')
    p.append('<rect x="146" y="40" width="348" height="290" rx="36" fill="url(#gold)" filter="url(#shadow)"/>')
    p.append('<rect x="154" y="48" width="332" height="274" rx="30" fill="url(#cab)"/>')
    # marquee with bulbs
    p.append('<rect x="176" y="58" width="288" height="44" rx="16" fill="#12062e" stroke="#ffcf4a" stroke-width="2"/>')
    for i in range(16):
        p.append(f'<circle cx="{186 + i * 17.9:.1f}" cy="62" r="3.5" fill="{"#fff3b0" if i % 2 else "#ff4fa3"}" filter="url(#glow)"/><circle cx="{186 + i * 17.9:.1f}" cy="98" r="3.5" fill="{"#ff4fa3" if i % 2 else "#fff3b0"}" filter="url(#glow)"/>')
    p.append('<text x="320" y="88" font-family="Impact, Arial Black, sans-serif" font-size="24" text-anchor="middle" fill="url(#gold)" stroke="#5a0a2e" stroke-width="1.5" paint-order="stroke" filter="url(#glow)">777</text>')
    # reels window
    p.append('<rect x="176" y="112" width="288" height="152" rx="16" fill="#0b0620" stroke="#c9902e" stroke-width="3"/>')
    def cherry(x, y, s):
        return (f'<path d="M{x - 6 * s},{y - 4 * s} Q{x},{y - 22 * s} {x + 6 * s},{y - 20 * s} M{x + 7 * s},{y - 2 * s} Q{x + 6 * s},{y - 16 * s} {x + 6 * s},{y - 20 * s}" stroke="#3f8a4a" stroke-width="{2 * s}" fill="none"/>'
                f'<circle cx="{x - 7 * s}" cy="{y + 3 * s}" r="{8 * s}" fill="#e3153a"/><circle cx="{x + 8 * s}" cy="{y + 5 * s}" r="{8 * s}" fill="#c8102e"/>'
                f'<circle cx="{x - 9 * s}" cy="{y}" r="{2.4 * s}" fill="#fff" opacity=".7"/>')
    for i in range(3):
        x = 188 + i * 92
        p.append(f'<rect x="{x}" y="120" width="80" height="136" rx="10" fill="url(#reel)"/>')
        # partial symbols above / below (spinning feel)
        p.append(f'<g opacity=".55">{cherry(x + 40, 128, .8)}</g>')
        p.append(f'<rect x="{x + 18}" y="236" width="44" height="18" rx="4" fill="#1a1440" opacity=".55"/><text x="{x + 40}" y="250" font-family="system-ui" font-size="12" font-weight="900" fill="#e8e9ff" text-anchor="middle" opacity=".7">BAR</text>')
        p.append(f'<text x="{x + 40}" y="218" font-family="Impact, Arial Black, sans-serif" font-size="80" text-anchor="middle" fill="url(#seven)" stroke="#2a0a12" stroke-width="4" paint-order="stroke">7</text>')
        p.append(f'<rect x="{x}" y="120" width="10" height="136" fill="#fff" opacity=".2"/>')
    p.append('<rect x="168" y="185" width="304" height="4" fill="#fff3b0" filter="url(#glow)"/>')
    p.append('<polygon points="164,178 176,187 164,196" fill="#fff3b0"/><polygon points="476,178 464,187 476,196" fill="#fff3b0"/>')
    # win panel
    p.append('<rect x="206" y="276" width="228" height="36" rx="12" fill="#0b0620" stroke="#ff4fa3" stroke-width="2"/>')
    p.append('<text x="320" y="301" font-family="system-ui, sans-serif" font-size="20" font-weight="900" text-anchor="middle" fill="url(#gold)" filter="url(#glow)">JACKPOT</text>')
    # lever
    p.append('<rect x="494" y="150" width="18" height="74" rx="7" fill="url(#chrome)"/><line x1="503" y1="152" x2="534" y2="78" stroke="url(#chrome)" stroke-width="9" stroke-linecap="round"/>')
    p.append(sphere(536, 72, 18, "#ff2d55", idn="knob"))
    # coins flying out
    r = random.Random(5)
    for q in range(22):
        x = 320 + r.uniform(-280, 280); y = r.uniform(250, 390)
        if 160 < x < 480 and y < 330: continue
        w = r.uniform(5, 18)
        p.append(f'<g transform="rotate({r.randint(-40, 40)} {f2(x)} {f2(y)})"><ellipse cx="{f2(x)}" cy="{f2(y)}" rx="{f2(w)}" ry="16" fill="url(#gold)" stroke="#8a5200" stroke-width="1.5"/>'
                 f'<ellipse cx="{f2(x)}" cy="{f2(y)}" rx="{f2(w * .55)}" ry="10" fill="none" stroke="#fff3b0" stroke-opacity=".7"/></g>')
    front = sparkle(180, 70, 9, "#fff3b0") + sparkle(470, 300, 8, "#fff3b0") + sparkle(560, 160, 6) + sparkle(90, 210, 7, "#ffd0f0")
    return frame("#ffb81f", "#ff3d9a", "".join(p), seed=12, floor_y=350, front=front)
covers["galactic-slot"] = slot()

# ---------- Darts ----------
def darts():
    cx, cy, R = 320, 196, 138
    p = ['<defs><linearGradient id="cabw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1f0e"/><stop offset=".5" stop-color="#6b3a18"/><stop offset="1" stop-color="#2a1608"/></linearGradient>'
         '<radialGradient id="spot" cx="50%" cy="40%" r="55%"><stop offset="0" stop-color="#fff6dc" stop-opacity=".35"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="flight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe3ee"/><stop offset="1" stop-color="#3a6bff"/></linearGradient>'
         '<linearGradient id="flight2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff5a3c"/></linearGradient></defs>']
    # cabinet with open doors (chalk scoreboard on the doors)
    p.append(f'<rect x="{cx - 170}" y="{cy - 172}" width="340" height="344" rx="10" fill="url(#cabw)" filter="url(#shadow)"/>')
    for side in (-1, 1):
        x0 = cx + side * 172
        pts = f"{x0},{cy - 170} {x0 + side * 112},{cy - 150} {x0 + side * 112},{cy + 150} {x0},{cy + 170}"
        p.append(f'<polygon points="{pts}" fill="#4a2810" stroke="#2a1608" stroke-width="3"/>')
        inner = f"{x0 + side * 10},{cy - 156} {x0 + side * 102},{cy - 138} {x0 + side * 102},{cy + 138} {x0 + side * 10},{cy + 156}"
        p.append(f'<polygon points="{inner}" fill="#1c2a24"/>')
        for q in range(6):
            yy = cy - 110 + q * 40
            p.append(f'<line x1="{x0 + side * 22}" y1="{yy}" x2="{x0 + side * 90}" y2="{yy + 4}" stroke="#e9efe6" stroke-opacity=".5" stroke-width="2"/>')
        for q, t in enumerate(["501", "441", "381", "301"] if side < 0 else ["501", "460", "400", "340"]):
            p.append(f'<text x="{x0 + side * 56}" y="{cy - 120 + q * 40}" font-family="Comic Sans MS, cursive" font-size="16" fill="#e9efe6" opacity=".8" text-anchor="middle">{t}</text>')
    p.append(f'<rect x="{cx - 170}" y="{cy - 172}" width="340" height="344" fill="url(#spot)"/>')
    p.append(f'<circle cx="{cx}" cy="{cy + 8}" r="{R + 16}" fill="#000" opacity=".55" filter="url(#soft)"/>')
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 22}" fill="#101014"/>')
    order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
    def ring(r0, r1, colA, colB):
        out = []
        for i in range(20):
            a0 = math.radians(-90 - 9 + i * 18); a1 = a0 + math.radians(18)
            pts = [(cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)), (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)),
                   (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1)), (cx + r0 * math.cos(a0), cy + r0 * math.sin(a0))]
            out.append(f'<polygon points="{" ".join(f"{f2(x)},{f2(y)}" for x, y in pts)}" fill="{colA if i % 2 == 0 else colB}"/>')
        return "".join(out)
    p.append(ring(R * .66, R, "#121218", "#efe6cf"))
    p.append(ring(R * .9, R, "#d21f32", "#159a52"))
    p.append(ring(R * .14, R * .66, "#121218", "#efe6cf"))
    p.append(ring(R * .56, R * .66, "#d21f32", "#159a52"))
    p.append(f'<circle cx="{cx}" cy="{cy}" r="{R * .14}" fill="#159a52"/><circle cx="{cx}" cy="{cy}" r="{R * .065}" fill="#d21f32"/>')
    # wire spider
    for i in range(20):
        a = math.radians(-99 + i * 18)
        p.append(f'<line x1="{f2(cx + R * .14 * math.cos(a))}" y1="{f2(cy + R * .14 * math.sin(a))}" x2="{f2(cx + R * math.cos(a))}" y2="{f2(cy + R * math.sin(a))}" stroke="#c9d2dc" stroke-width=".9" opacity=".7"/>')
    for rr in (R * .14, R * .56, R * .66, R * .9, R):
        p.append(f'<circle cx="{cx}" cy="{cy}" r="{f2(rr)}" fill="none" stroke="#c9d2dc" stroke-width=".9" opacity=".7"/>')
    for i, n in enumerate(order):
        a = math.radians(-90 + i * 18)
        p.append(f'<text x="{f2(cx + (R + 12) * math.cos(a))}" y="{f2(cy + (R + 12) * math.sin(a) + 4)}" font-family="system-ui" font-size="12" font-weight="800" fill="#f2f4f8" text-anchor="middle">{n}</text>')
    def stuck(tx, ty, ang, flight, s=1.0):
        c, sn = math.cos(ang), math.sin(ang)
        P = lambda d, w=0: (tx + c * d - sn * w, ty + sn * d + c * w)
        a, b = P(0), P(40 * s); c1, c2 = P(36 * s), P(86 * s); f0 = P(80 * s)
        fa, fb, fc = P(126 * s, 26 * s), P(126 * s, -26 * s), P(98 * s)
        return (f'<circle cx="{f2(tx)}" cy="{f2(ty)}" r="3.5" fill="#000" opacity=".6"/>'
                f'<g filter="url(#shadow)"><line x1="{f2(a[0])}" y1="{f2(a[1])}" x2="{f2(b[0])}" y2="{f2(b[1])}" stroke="url(#chrome)" stroke-width="{5 * s}" stroke-linecap="round"/>'
                f'<line x1="{f2(c1[0])}" y1="{f2(c1[1])}" x2="{f2(c2[0])}" y2="{f2(c2[1])}" stroke="#1d2433" stroke-width="{7 * s}" stroke-linecap="round"/>'
                f'<polygon points="{f2(f0[0])},{f2(f0[1])} {f2(fa[0])},{f2(fa[1])} {f2(fc[0])},{f2(fc[1])}" fill="url(#{flight})"/>'
                f'<polygon points="{f2(f0[0])},{f2(f0[1])} {f2(fb[0])},{f2(fb[1])} {f2(fc[0])},{f2(fc[1])}" fill="url(#{flight})" opacity=".75"/></g>')
    # treble 20 and bull already hit; a third dart flying in with a streak
    t20 = (cx + R * .61 * math.cos(math.radians(-90)), cy + R * .61 * math.sin(math.radians(-90)))
    p.append(stuck(t20[0] - 3, t20[1], math.radians(-62), "flight2", .85))
    p.append(stuck(cx + 5, cy + 3, math.radians(-38), "flight", .95))
    p.append(f'<circle cx="{cx + 5}" cy="{cy + 3}" r="14" fill="#7fe3ee" opacity=".35" filter="url(#glow)"/>')
    pts = [(560 - t * 22, 380 - t * 26 + t * t * .6) for t in range(9)]
    p.append(trail(pts, "#bdf6ff", 12))
    p.append(stuck(pts[-1][0] - 8, pts[-1][1] - 10, math.radians(-131), "flight", .8))
    front = sparkle(cx + 5, cy + 3, 10, "#e8ffff") + sparkle(470, 70, 6) + sparkle(150, 330, 6, "#ffe9b0")
    return frame("#2fd9c8", "#ff5a6a", "".join(p), seed=13, floor=False, front=front)
covers["darts"] = darts()

# ---------- Billiards ----------
def billiards():
    p = ['<defs><linearGradient id="felt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#11805f"/><stop offset="1" stop-color="#074332"/></linearGradient>'
         '<linearGradient id="rail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5228"/><stop offset="1" stop-color="#3a200c"/></linearGradient>'
         '<radialGradient id="lamp" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff4cc" stop-opacity=".55"/><stop offset="1" stop-color="#fff4cc" stop-opacity="0"/></radialGradient></defs>']
    p.append('<polygon points="150,84 490,84 612,372 28,372" fill="url(#rail)" filter="url(#shadow)"/>')
    p.append('<polygon points="176,100 464,100 572,352 68,352" fill="url(#felt)"/>')
    # lamp light pool
    p.append('<ellipse cx="320" cy="210" rx="250" ry="130" fill="url(#lamp)"/>')
    p.append('<polygon points="176,100 464,100 470,108 170,108" fill="#000" opacity=".25"/>')
    for x in (230, 320, 410):
        p.append(f'<circle cx="{x}" cy="92" r="2.5" fill="#f4e3b8"/>')
    for (x, y) in [(110, 220), (530, 220), (82, 290), (558, 290), (140, 150), (500, 150)]:
        p.append(f'<circle cx="{x}" cy="{y}" r="2.5" fill="#f4e3b8"/>')
    for (x, y, r) in [(178, 102, 11), (462, 102, 11), (66, 352, 15), (574, 352, 15), (124, 226, 12), (516, 226, 12)]:
        p.append(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * .8}" fill="#05080a"/>')
    # lamp shade at the top
    p.append('<line x1="320" y1="0" x2="320" y2="20" stroke="#222" stroke-width="3"/>')
    p.append('<path d="M250,44 Q320,10 390,44 Z" fill="#0f6b4a" stroke="#d8b46a" stroke-width="2"/><ellipse cx="320" cy="44" rx="70" ry="7" fill="#fff4cc" filter="url(#glow)"/>')
    p.append('<polygon points="250,44 390,44 520,330 120,330" fill="#fff4cc" opacity=".05"/>')
    # the break: balls scattering with motion streaks
    cols = ["#ffd23f", "#2f6bff", "#e12d3f", "#7b3cff", "#ff7a1f", "#159a52", "#8a1c2a", "#111111", "#ffd23f", "#2f6bff"]
    r = random.Random(9)
    base = [(320 + (i - row / 2) * 30, 160 + row * 22) for row in range(4) for i in range(row + 1)]
    for q, (x, y) in enumerate(base):
        dx, dy = x - 320, y - 190
        d = math.hypot(dx, dy) or 1
        push = 30 + r.uniform(0, 40)
        nx, ny = x + dx / d * push, y + dy / d * push * .7
        p.append(trail([(x, y), ((x + nx) / 2, (y + ny) / 2), (nx, ny)], cols[q], 12))
        rr = 13 + (ny - 150) / 40
        p.append(sphere(nx, ny, rr, cols[q], idn=f"bb{q}"))
        if q in (1, 4, 8):
            p.append(f'<ellipse cx="{f2(nx)}" cy="{f2(ny)}" rx="{f2(rr * .96)}" ry="{f2(rr * .4)}" fill="#fff" opacity=".8"/>')
        p.append(f'<circle cx="{f2(nx)}" cy="{f2(ny)}" r="{f2(rr * .42)}" fill="#fff" opacity=".9"/><text x="{f2(nx)}" y="{f2(ny + rr * .2)}" font-family="system-ui" font-size="{f2(rr * .55)}" font-weight="800" text-anchor="middle" fill="#111">{q + 1}</text>')
    # impact flash at the apex
    p.append(f'<circle cx="320" cy="214" r="22" fill="#fff" opacity=".35" filter="url(#glow)"/>')
    p.append(sphere(322, 252, 16, "#f4f2ea", hi="#ffffff", shade="#8d8a80", idn="cue"))
    p.append(trail([(300, 330), (308, 300), (316, 270)], "#ffffff", 14))
    # cue stick pulled back + chalk
    p.append('<line x1="300" y1="296" x2="168" y2="400" stroke="#e8c48a" stroke-width="10" stroke-linecap="round"/><line x1="226" y1="355" x2="168" y2="400" stroke="#2b1608" stroke-width="11"/>'
             '<line x1="300" y1="296" x2="290" y2="304" stroke="#2a8fff" stroke-width="10" stroke-linecap="round"/>')
    p.append('<g transform="rotate(-12 520 336)"><rect x="508" y="326" width="22" height="18" fill="#2a8fff"/><rect x="508" y="326" width="22" height="5" fill="#9ccbff"/></g>')
    front = sparkle(320, 214, 11, "#fff8e0") + sparkle(470, 140, 6) + sparkle(160, 160, 5)
    return frame("#2fd9a0", "#2f6bff", "".join(p), seed=14, floor=False, rays=False, front=front)
covers["billiards"] = billiards()

# ---------- Stack (isometric slabs) ----------
def iso_slab(cx, cy, w, d, h, top, left, right, op=1, extra=""):
    t = [(cx, cy - d), (cx + w, cy), (cx, cy + d), (cx - w, cy)]
    lf = [(cx - w, cy), (cx, cy + d), (cx, cy + d + h), (cx - w, cy + h)]
    rt = [(cx, cy + d), (cx + w, cy), (cx + w, cy + h), (cx, cy + d + h)]
    f = lambda pts: " ".join(f"{f2(x)},{f2(y)}" for x, y in pts)
    return (f'<g opacity="{op}" {extra}><polygon points="{f(lf)}" fill="{left}"/><polygon points="{f(rt)}" fill="{right}"/><polygon points="{f(t)}" fill="{top}"/>'
            f'<polyline points="{f([t[3], t[0], t[1]])}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/></g>')
def stack():
    p = []
    cols = [("#7fe3ee", "#2d8ea0", "#1d6475"), ("#8fb4ff", "#3c5fbf", "#2a428a"), ("#b996ff", "#6b46c6", "#4b2f92"), ("#ff9ad8", "#c2468f", "#8a2c63"), ("#7fffc4", "#2aa877", "#1c7a55")]
    # glowing pedestal
    p.append('<ellipse cx="320" cy="356" rx="190" ry="34" fill="#000" opacity=".55" filter="url(#soft)"/>')
    p.append(iso_slab(320, 330, 150, 76, 22, "#1a2a52", "#0f1a38", "#0a1228"))
    p.append('<ellipse cx="320" cy="330" rx="120" ry="50" fill="none" stroke="#7fe3ee" stroke-opacity=".5" stroke-width="2" filter="url(#glow)"/>')
    for i in range(7):
        c = cols[i % len(cols)]
        p.append(iso_slab(320 + (i % 2) * 4 - 2, 300 - i * 28, 118 - i * 4, 60 - i * 2, 24, *c))
    # perfect-drop flash ring on top
    p.append('<ellipse cx="320" cy="104" rx="120" ry="58" fill="none" stroke="#fff3b0" stroke-width="3" opacity=".7" filter="url(#glow)"/>')
    # sliding slab + chopped piece tumbling away
    p.append(iso_slab(360, 70, 96, 50, 24, "#ffe066", "#c99a1c", "#8f6b10"))
    for q in range(1, 5):
        p.append(f'<rect x="{470 + q * 18}" y="{64 + q * 2}" width="{46 - q * 9}" height="3" rx="1.5" fill="#ffe066" opacity="{.65 - q * .13:.2f}"/>')
    p.append(iso_slab(520, 200, 30, 16, 20, "#ffe066", "#c99a1c", "#8f6b10", extra='transform="rotate(28 520 200)"'))
    p.append(trail([(470, 120), (495, 150), (515, 185)], "#ffe066", 8))
    p.append('<line x1="320" y1="20" x2="320" y2="50" stroke="#7fe3ee" stroke-width="2" stroke-dasharray="4 5" opacity=".5"/>')
    front = sparkle(200, 100, 8, "#fff3b0") + sparkle(440, 104, 6) + sparkle(110, 260, 5)
    return frame("#7fe3ee", "#b996ff", "".join(p), seed=15, floor_y=345, front=front)
covers["precision-stack"] = stack()
covers["stack-3d"] = covers["precision-stack"]

# ---------- Tower Drop ----------
def container_svg(x, y, w, h, face, shade, label):
    out = [f'<defs><linearGradient id="c{label}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{face}"/><stop offset=".6" stop-color="{face}"/><stop offset="1" stop-color="{shade}"/></linearGradient></defs>',
           f'<rect x="{f2(x)}" y="{f2(y)}" width="{f2(w)}" height="{h}" fill="url(#c{label})" stroke="#000" stroke-opacity=".35"/>']
    for n in range(int(x + 10), int(x + w - 6), 10):
        out.append(f'<rect x="{n}" y="{f2(y + 8)}" width="3" height="{h - 18}" fill="#000" opacity=".16"/><rect x="{n + 3}" y="{f2(y + 8)}" width="1.5" height="{h - 18}" fill="#fff" opacity=".14"/>')
    out.append(f'<rect x="{f2(x)}" y="{f2(y)}" width="{f2(w)}" height="6" fill="#fff" opacity=".3"/>')
    for cx in (x, x + w - 8):
        out.append(f'<rect x="{f2(cx)}" y="{f2(y)}" width="8" height="8" fill="#2a2f3a"/><rect x="{f2(cx)}" y="{f2(y + h - 8)}" width="8" height="8" fill="#2a2f3a"/>')
    out.append(f'<rect x="{f2(x)}" y="{f2(y + h - 11)}" width="{f2(w)}" height="5" fill="#1a1d24"/>')
    for n in range(int(x), int(x + w - 10), 12):
        out.append(f'<polygon points="{n},{f2(y + h - 6)} {n + 6},{f2(y + h - 11)} {n + 12},{f2(y + h - 11)} {n + 6},{f2(y + h - 6)}" fill="#ffd23f"/>')
    out.append(f'<rect x="{f2(x + w / 2 - 22)}" y="{f2(y + 10)}" width="44" height="14" fill="#08101e" opacity=".8"/><text x="{f2(x + w / 2)}" y="{f2(y + 21)}" font-family="ui-monospace, Menlo, monospace" font-size="10" font-weight="700" fill="#e9f4ff" text-anchor="middle">{label}</text>')
    out.append(f'<circle cx="{f2(x + w - 14)}" cy="{f2(y + 16)}" r="3" fill="#5cffb0" filter="url(#glow)"/>')
    return "".join(out)
def tower():
    p = ['<defs><linearGradient id="teth" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5d6c80"/><stop offset=".5" stop-color="#e6f4ff"/><stop offset="1" stop-color="#5d6c80"/></linearGradient>'
         '<linearGradient id="sol" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b6fd8"/><stop offset="1" stop-color="#1a2f6a"/></linearGradient></defs>']
    # station skyline silhouettes
    for (x, w, h) in [(20, 40, 120), (64, 26, 80), (96, 50, 150), (520, 44, 140), (568, 30, 90), (602, 34, 170)]:
        p.append(f'<rect x="{x}" y="{360 - h}" width="{w}" height="{h}" fill="#0b1430" stroke="#2fd9c8" stroke-opacity=".25"/>')
        for q in range(3, h - 10, 18):
            p.append(f'<rect x="{x + 6}" y="{360 - h + q}" width="{w - 12}" height="3" fill="#ffb86a" opacity=".35"/>')
    p.append('<ellipse cx="320" cy="368" rx="210" ry="22" fill="#000" opacity=".55" filter="url(#soft)"/>')
    p.append('<rect x="146" y="350" width="348" height="18" fill="#3d566b"/><rect x="146" y="350" width="348" height="3" fill="#9fe7ee"/>')
    for x in range(160, 486, 26):
        p.append(f'<rect x="{x}" y="358" width="12" height="4" fill="#ffd23f" filter="url(#glow)"/>')
    stackc = [("#e8742c", "#b9551b"), ("#1f8fa6", "#156a7c"), ("#d2343f", "#9c222b"), ("#e9b730", "#b58a1c"), ("#3e5fbf", "#2c4590")]
    y = 350
    for i, (f_, s) in enumerate(stackc):
        w = 226 - i * 12; h = 40; y -= h
        p.append(container_svg(320 - w / 2 + (i % 2) * 8 - 4, y, w, h, f_, s, f"GX-{i + 1:02d}"))
    # planetary elevator: tether, climber module with solar wings, hanging container on the swing
    mx, my = 300, 54
    p.append(f'<rect x="{mx - 5}" y="-10" width="10" height="{my}" fill="url(#teth)"/>')
    for q in range(0, my, 12):
        p.append(f'<circle cx="{mx}" cy="{q}" r="1.6" fill="#7fe3ee" filter="url(#glow)"/>')
    for side in (-1, 1):
        p.append(f'<rect x="{mx + side * 34 - (60 if side < 0 else 0)}" y="{my - 12}" width="60" height="20" fill="url(#sol)" stroke="#9fc4ff" stroke-width="1"/>')
        for q in range(1, 4):
            xx = mx + side * 34 - (60 if side < 0 else 0) + q * 15
            p.append(f'<line x1="{xx}" y1="{my - 12}" x2="{xx}" y2="{my + 8}" stroke="#9fc4ff" stroke-opacity=".5"/>')
    p.append(f'<rect x="{mx - 30}" y="{my - 20}" width="60" height="40" rx="14" fill="url(#chrome)" filter="url(#shadow)"/>')
    p.append(f'<rect x="{mx - 18}" y="{my - 10}" width="36" height="12" rx="4" fill="#c4eff8"/><circle cx="{mx - 20}" cy="{my + 12}" r="3" fill="#5cffb0" filter="url(#glow)"/><circle cx="{mx + 20}" cy="{my + 12}" r="3" fill="#ff5a6a" filter="url(#glow)"/>')
    hx, hy = 402, 120
    p.append(f'<line x1="{mx}" y1="{my + 20}" x2="{hx}" y2="{hy - 18}" stroke="#d2effb" stroke-width="3"/>')
    p.append(f'<path d="M{mx + 30},{my + 34} A120,120 0 0 0 {hx + 50},{hy - 30}" fill="none" stroke="#7fe3ee" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 6"/>')
    p.append(f'<line x1="{hx - 24}" y1="{hy}" x2="{hx}" y2="{hy - 18}" stroke="#a4f9ed" stroke-width="4"/><line x1="{hx + 24}" y1="{hy}" x2="{hx}" y2="{hy - 18}" stroke="#a4f9ed" stroke-width="4"/>')
    p.append(f'<g transform="rotate(-6 {hx} {hy})">{container_svg(hx - 60, hy, 120, 38, "#d9dee6", "#a9b1bd", "GX-06")}</g>')
    p.append(f'<line x1="{hx}" y1="{hy + 44}" x2="{hx - 6}" y2="{196}" stroke="#ffd23f" stroke-width="2" stroke-dasharray="3 5" opacity=".6"/>')
    front = sparkle(470, 180, 7, "#ffe9b0") + sparkle(170, 120, 6) + sparkle(560, 60, 5)
    return frame("#ff9a3c", "#2fd9c8", "".join(p), seed=16, floor_y=362, front=front)
covers["tower-drop"] = tower()

# ---------- Orb Burst ----------
def orb():
    p = []
    cols = ["#4fa8ff", "#ff6f91", "#ffd23f", "#5cffb0", "#b98cff", "#ff9a3c"]
    r = random.Random(7)
    R = 22
    p.append('<rect x="50" y="22" width="540" height="10" rx="5" fill="url(#chrome)" opacity=".8"/>')
    hole = {(3, 6), (3, 7), (4, 5), (4, 6), (4, 7), (2, 7)}
    for row in range(5):
        n = 12 if row % 2 == 0 else 11
        for i in range(n):
            if (row, i) in hole: continue
            if row == 4 and r.random() < .35: continue
            x = 72 + i * 2 * R + (R if row % 2 else 0)
            y = 54 + row * R * 1.73
            p.append(sphere(x, y, R - 1, r.choice(cols), idn=f"o{row}_{i}", shadow=False))
    # burst: shockwave, shards and popping orbs
    bx, by = 380, 200
    p.append(f'<circle cx="{bx}" cy="{by}" r="46" fill="none" stroke="#ffd23f" stroke-width="3" opacity=".7" filter="url(#glow)"/>')
    p.append(f'<circle cx="{bx}" cy="{by}" r="26" fill="#fff3b0" opacity=".55" filter="url(#glow)"/>')
    for q in range(14):
        a = q * 2 * math.pi / 14; d = r.uniform(40, 80)
        x, y = bx + math.cos(a) * d, by + math.sin(a) * d
        p.append(f'<polygon points="{f2(x)},{f2(y - 5)} {f2(x + 4)},{f2(y)} {f2(x)},{f2(y + 5)} {f2(x - 4)},{f2(y)}" fill="{r.choice(cols)}" transform="rotate({q * 25} {f2(x)} {f2(y)})" filter="url(#glow)"/>')
    # dropped orbs falling with motion lines
    for (x, y, c) in [(250, 270, "#b98cff"), (470, 285, "#5cffb0"), (420, 320, "#4fa8ff")]:
        p.append(f'<line x1="{x}" y1="{y - 46}" x2="{x}" y2="{y - 20}" stroke="{c}" stroke-width="3" opacity=".4"/><line x1="{x - 10}" y1="{y - 40}" x2="{x - 10}" y2="{y - 24}" stroke="{c}" stroke-width="2" opacity=".3"/>')
        p.append(sphere(x, y, 16, c, idn=f"drop{x}", shadow=False))
    p.append(f'<text x="{bx + 50}" y="{by - 40}" font-family="system-ui" font-size="22" font-weight="900" fill="#fff3b0" filter="url(#glow)">+640</text>')
    # aim laser + launcher
    for q in range(10):
        p.append(f'<circle cx="{f2(320 + q * 6.5)}" cy="{f2(344 - q * 15)}" r="3" fill="#e9fbff" opacity="{.95 - q * .08:.2f}"/>')
    p.append('<ellipse cx="320" cy="364" rx="78" ry="20" fill="#0d1a33" stroke="#7fe3ee" stroke-width="3" filter="url(#glow)"/>')
    p.append('<ellipse cx="320" cy="364" rx="56" ry="13" fill="none" stroke="#7fe3ee" stroke-opacity=".5"/>')
    p.append(sphere(320, 346, 22, "#ff6f91", idn="shot"))
    p.append(sphere(408, 372, 13, "#5cffb0", idn="next"))
    p.append('<line x1="40" y1="300" x2="600" y2="300" stroke="#ff5a6a" stroke-width="1.5" stroke-dasharray="8 7" opacity=".6"/>')
    front = sparkle(bx, by, 14, "#fff8e0") + sparkle(120, 260, 6) + sparkle(560, 240, 7, "#ffd0f0")
    return frame("#ff6f91", "#4fa8ff", "".join(p), seed=17, floor=False, front=front)
covers["orb-burst"] = orb()

# ---------- Shot Gallery (killer range, static steel plates) ----------
def shape_path(kind, x, y, s):
    if kind == "circle": return f'<circle cx="{x}" cy="{y}" r="{s}"/>'
    if kind == "square": return f'<rect x="{x - s * .88}" y="{y - s * .88}" width="{s * 1.76}" height="{s * 1.76}"/>'
    n = {"tri": 3, "hex": 6}.get(kind)
    if n:
        pts = [f"{f2(x + s * math.cos(-math.pi / 2 + 2 * math.pi * k / n))},{f2(y + s * math.sin(-math.pi / 2 + 2 * math.pi * k / n))}" for k in range(n)]
        return f'<polygon points="{" ".join(pts)}"/>'
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5; rr = s * (1.1 if k % 2 == 0 else .45)
        pts.append(f"{f2(x + rr * math.cos(a))},{f2(y + rr * math.sin(a))}")
    return f'<polygon points="{" ".join(pts)}"/>'
def head(x, y, r):
    return (f'M{f2(x)},{f2(y - r * 1.05)} C{f2(x + r * 1.25)},{f2(y - r * 1.05)} {f2(x + r * 1.15)},{f2(y + r * .2)} {f2(x + r * .42)},{f2(y + r * .85)} '
            f'Q{f2(x)},{f2(y + r * 1.12)} {f2(x - r * .42)},{f2(y + r * .85)} C{f2(x - r * 1.15)},{f2(y + r * .2)} {f2(x - r * 1.25)},{f2(y - r * 1.05)} {f2(x)},{f2(y - r * 1.05)}Z')
def plate(x, y, color, kind, s=1.0, holes=0, seed=0):
    r = random.Random(seed)
    R = 30 * s
    out = [f'<rect x="{f2(x - 3 * s)}" y="{f2(y + R * .9)}" width="{f2(6 * s)}" height="{f2(44 * s)}" fill="#3b4148"/><rect x="{f2(x - 16 * s)}" y="{f2(y + R * .9 + 42 * s)}" width="{f2(32 * s)}" height="{f2(7 * s)}" fill="#24282d"/>',
           f'<path d="{head(x + 4 * s, y + 5 * s, R)}" fill="#000" opacity=".5"/>',
           f'<path d="{head(x, y, R)}" fill="url(#steel)" stroke="#15181b" stroke-width="2"/>',
           f'<path d="{head(x - 3 * s, y - 3 * s, R * .8)}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>',
           f'<g fill="{color}">{shape_path(kind, x, y - 2 * s, 14 * s)}</g>']
    for h in range(holes):
        hx, hy = x + r.uniform(-12, 12) * s, y + r.uniform(-14, 8) * s
        for q in range(5):
            a = r.uniform(0, 2 * math.pi); l = r.uniform(6, 12) * s
            out.append(f'<line x1="{f2(hx)}" y1="{f2(hy)}" x2="{f2(hx + math.cos(a) * l)}" y2="{f2(hy + math.sin(a) * l)}" stroke="#0a0a0a" stroke-width="1" opacity=".8"/>')
        out.append(f'<circle cx="{f2(hx)}" cy="{f2(hy)}" r="{f2(4.8 * s)}" fill="#c9ced3"/><circle cx="{f2(hx)}" cy="{f2(hy)}" r="{f2(3.2 * s)}" fill="#050505"/>')
    return "".join(out)
def gallery():
    p = ['<defs><linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a7b0b8"/><stop offset=".5" stop-color="#5d656d"/><stop offset="1" stop-color="#33393f"/></linearGradient>'
         '<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a30"/><stop offset="1" stop-color="#121417"/></linearGradient>'
         '<radialGradient id="pool" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff4d6" stop-opacity=".32"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient></defs>']
    # concrete range wall with block joints and light pools
    p.append('<rect x="0" y="0" width="640" height="330" fill="url(#wall)"/>')
    for row, y in enumerate(range(30, 330, 36)):
        p.append(f'<line x1="0" y1="{y}" x2="640" y2="{y}" stroke="#000" stroke-opacity=".4"/>')
        for x in range(0 if row % 2 else 40, 640, 80):
            p.append(f'<line x1="{x}" y1="{y - 36}" x2="{x}" y2="{y}" stroke="#000" stroke-opacity=".35"/>')
    r = random.Random(4)
    for _ in range(40):
        p.append(f'<circle cx="{f2(r.uniform(0, 640))}" cy="{f2(r.uniform(20, 320))}" r="{r.uniform(.8, 2.2):.1f}" fill="#000" opacity=".5"/>')
    for x in (120, 320, 520):
        p.append(f'<rect x="{x - 50}" y="0" width="100" height="5" fill="#fff6de" filter="url(#glow)"/><ellipse cx="{x}" cy="40" rx="170" ry="260" fill="url(#pool)"/>')
    # rubber berm with hazard stripes, floor
    p.append('<rect x="0" y="318" width="640" height="16" fill="#0a0b0c"/>')
    for x in range(-20, 660, 30):
        p.append(f'<polygon points="{x},318 {x + 15},318 {x + 7},326 {x - 8},326" fill="#ffcc1f"/>')
    p.append('<rect x="0" y="334" width="640" height="66" fill="#08090a"/>')
    # order slab
    p.append('<rect x="210" y="16" width="220" height="54" fill="#0b0d0f" stroke="#2b3038" stroke-width="2"/><rect x="210" y="16" width="12" height="54" fill="#ffcc1f"/>')
    p.append('<rect x="250" y="27" width="32" height="32" fill="#ff4fa0"/><text x="300" y="50" font-family="system-ui" font-size="18" font-weight="900" fill="#5a636c">+</text>')
    p.append(f'<g fill="#9aa3ab">{shape_path("tri", 334, 44, 15)}</g>')
    for q in range(3):
        p.append(f'<rect x="{368 + q * 12}" y="32" width="7" height="20" fill="{"#d9a441" if q else "#3a3f45"}"/>')
    p.append('<circle cx="414" cy="43" r="8" fill="#43ff7a" filter="url(#glow)"/>')
    # plates
    plates = [(92, 150, "#ff4fa0", "tri", 1.0, 2), (210, 210, "#3d8bff", "circle", 1.05, 0), (330, 150, "#ff4fa0", "square", 1.0, 0),
              (450, 214, "#8fd43a", "tri", 1.05, 0), (560, 150, "#ffcc1f", "hex", 1.0, 0), (330, 262, "#9a63ff", "star", .9, 0)]
    for i, (x, y, c, kd, s, h) in enumerate(plates):
        p.append(plate(x, y, c, kd, s, h, seed=i))
    # the hit: knocked plate tipping back + sparks + reticle
    hx, hy = 92, 150
    for q in range(10):
        a = -math.pi * .95 + q * .2; d = r.uniform(18, 44)
        p.append(f'<line x1="{f2(hx + math.cos(a) * d)}" y1="{f2(hy + math.sin(a) * d)}" x2="{f2(hx + math.cos(a) * (d + 9))}" y2="{f2(hy + math.sin(a) * (d + 9))}" stroke="#ffc35a" stroke-width="2" filter="url(#glow)"/>')
    p.append(f'<circle cx="{hx + 2}" cy="{hy - 6}" r="10" fill="#fff8e6" opacity=".8" filter="url(#glow)"/>')
    tx, ty = 450, 214
    p.append(f'<g stroke="#ff2d3c" stroke-width="3" fill="none" filter="url(#glow)"><circle cx="{tx}" cy="{ty}" r="30"/><line x1="{tx}" y1="{ty - 44}" x2="{tx}" y2="{ty - 22}"/><line x1="{tx}" y1="{ty + 22}" x2="{tx}" y2="{ty + 44}"/>'
             f'<line x1="{tx - 44}" y1="{ty}" x2="{tx - 22}" y2="{ty}"/><line x1="{tx + 22}" y1="{ty}" x2="{tx + 44}" y2="{ty}"/></g><circle cx="{tx}" cy="{ty}" r="2.5" fill="#ff2d3c"/>')
    # brass casings
    for (x, y, a) in [(520, 360, 30), (548, 380, -20), (490, 384, 70)]:
        p.append(f'<rect x="{x}" y="{y}" width="14" height="6" rx="2" fill="#d9a441" transform="rotate({a} {x} {y})"/>')
    return frame("#ff2d3c", "#ffcc1f", "".join(p), seed=18, floor=False, rays=False)
covers["reaction-test"] = gallery()
covers["shot-gallery"] = covers["reaction-test"]

# ---------- Solitaire Sprint ----------
def card(x, y, rank, suit, red, rot, s=1.0):
    col = "#d21f32" if red else "#141a26"
    w, h = 110 * s, 156 * s
    return (f'<g transform="rotate({rot} {f2(x + w / 2)} {f2(y + h)})" filter="url(#shadow)"><rect x="{f2(x)}" y="{f2(y)}" width="{f2(w)}" height="{f2(h)}" rx="{f2(12 * s)}" fill="#fbfaf6" stroke="#c9cfd8"/>'
            f'<rect x="{f2(x + 5 * s)}" y="{f2(y + 5 * s)}" width="{f2(w - 10 * s)}" height="{f2(h - 10 * s)}" rx="{f2(9 * s)}" fill="none" stroke="#e6dcc4"/>'
            f'<text x="{f2(x + 12 * s)}" y="{f2(y + 28 * s)}" font-family="Georgia, serif" font-size="{f2(24 * s)}" font-weight="700" fill="{col}">{rank}</text>'
            f'<text x="{f2(x + 14 * s)}" y="{f2(y + 50 * s)}" font-family="system-ui" font-size="{f2(20 * s)}" fill="{col}">{suit}</text>'
            f'<text x="{f2(x + w / 2)}" y="{f2(y + 104 * s)}" font-family="system-ui" font-size="{f2(54 * s)}" fill="{col}" text-anchor="middle">{suit}</text></g>')
def back(x, y, rot, s=1.0):
    w, h = 96 * s, 136 * s
    return (f'<g transform="rotate({rot} {f2(x + w / 2)} {f2(y + h / 2)})" filter="url(#shadow)"><rect x="{f2(x)}" y="{f2(y)}" width="{f2(w)}" height="{f2(h)}" rx="11" fill="#2a4fb8" stroke="#fff" stroke-width="3"/>'
            f'<rect x="{f2(x + 10)}" y="{f2(y + 10)}" width="{f2(w - 20)}" height="{f2(h - 20)}" rx="8" fill="none" stroke="#7fe3ee" stroke-width="2" stroke-dasharray="6 4"/>'
            f'<circle cx="{f2(x + w / 2)}" cy="{f2(y + h / 2)}" r="{f2(16 * s)}" fill="none" stroke="#ffd23f" stroke-width="2"/></g>')
def solitaire():
    p = ['<defs><linearGradient id="felt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d5a45"/><stop offset="1" stop-color="#05261d"/></linearGradient></defs>']
    p.append('<polygon points="60,250 580,250 660,400 -20,400" fill="url(#felt2)"/>')
    p.append('<polygon points="60,250 580,250 586,256 54,256" fill="#d8b46a" opacity=".7"/>')
    # foundations with aces
    for i, (s, red) in enumerate([("♠", False), ("♥", True), ("♣", False), ("♦", True)]):
        p.append(card(150 + i * 92, 268, "A", s, red, 0, .62))
    # cascade of bouncing cards (the classic win cascade) with ghost trail
    r = random.Random(3)
    for q in range(7):
        x = 470 - q * 46; y = 60 + abs(math.sin(q * .9)) * 60
        p.append(f'<g opacity="{.12 + q * .05:.2f}">{card(x, y, "K", "♥", True, -10 + q * 3, .55)}</g>')
    fan = [("K", "♠", False), ("Q", "♥", True), ("J", "♣", False), ("10", "♦", True), ("A", "♠", False)]
    for i, (rk, s, red) in enumerate(fan):
        p.append(card(130 + i * 66, 92 + abs(i - 2) * 8, rk, s, red, -24 + i * 12, .9))
    p.append(back(46, 40, -10, 1))
    p.append(back(58, 52, -4, 1))
    # timer badge
    p.append('<circle cx="560" cy="88" r="34" fill="#0b1226" stroke="#ffd23f" stroke-width="3"/><path d="M560,88 L560,62 A26,26 0 0 1 584,96 Z" fill="#ffd23f" opacity=".85"/><circle cx="560" cy="88" r="3" fill="#fff"/>')
    front = sparkle(520, 40, 7, "#ffe9b0") + sparkle(600, 150, 6) + sparkle(110, 210, 6, "#ffd0f0") + confetti(30, 320, 120, 26, ["#ffd23f", "#ff8fb8", "#7fe3ee"], 300)
    return frame("#ff8fb8", "#2f6bff", "".join(p), seed=19, floor=False, front=front)
covers["solitaire-sprint"] = solitaire()

# ---------- Mine Grid ----------
def mine():
    p = ['<defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b8fd0"/><stop offset="1" stop-color="#2f4a86"/></linearGradient>'
         '<linearGradient id="open" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16243f"/><stop offset="1" stop-color="#0e1830"/></linearGradient>'
         '<radialGradient id="boom" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset=".35" stop-color="#ff8a3c" stop-opacity=".7"/><stop offset="1" stop-color="#ff3b5c" stop-opacity="0"/></radialGradient></defs>']
    nums = {(2, 2): 1, (2, 3): 2, (3, 2): 1, (3, 3): 3, (4, 3): 2, (3, 4): 1, (2, 4): 1, (4, 2): 1, (4, 4): 1, (1, 3): 1, (5, 3): 2}
    colors = {1: "#7fe3ee", 2: "#5cffb0", 3: "#ff8a4c"}
    def P(i, j):
        t = j / 6
        y = 74 + 276 * (t ** 1.1)
        half = 160 + 140 * t
        return 320 - half + (2 * half) * i / 8, y
    for j in range(6):
        for i in range(8):
            a, b, c, d = P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)
            pad = 2.5
            pts = f"{f2(a[0] + pad)},{f2(a[1] + pad)} {f2(b[0] - pad)},{f2(b[1] + pad)} {f2(c[0] - pad)},{f2(c[1] - pad)} {f2(d[0] + pad)},{f2(d[1] - pad)}"
            opened = (i, j) in nums or (2 <= i <= 4 and 2 <= j <= 4)
            p.append(f'<polygon points="{pts}" fill="{"url(#open)" if opened else "url(#tile)"}" stroke="{"#24365c" if opened else "#a7c4f2"}" stroke-width="1"/>')
            if not opened:
                p.append(f'<polyline points="{f2(d[0] + pad)},{f2(d[1] - pad)} {f2(a[0] + pad)},{f2(a[1] + pad)} {f2(b[0] - pad)},{f2(b[1] + pad)}" fill="none" stroke="#fff" stroke-opacity=".35"/>')
            if (i, j) in nums:
                cx = (a[0] + b[0] + c[0] + d[0]) / 4; cy = (a[1] + b[1] + c[1] + d[1]) / 4
                p.append(f'<text x="{f2(cx)}" y="{f2(cy + 7)}" font-family="system-ui" font-size="{18 + j * 3}" font-weight="900" fill="{colors[nums[(i, j)]]}" text-anchor="middle" filter="url(#glow)">{nums[(i, j)]}</text>')
    # radar sweep over the grid
    p.append('<path d="M320,350 L120,120 A300,300 0 0 1 220,84 Z" fill="#7fe3ee" opacity=".07"/>')
    for (fi, fj) in [(5.5, 1.5), (1.5, 4.5)]:
        fx, fy = P(fi, fj)
        s = 1 + fj * .12
        p.append(f'<line x1="{f2(fx)}" y1="{f2(fy + 10 * s)}" x2="{f2(fx)}" y2="{f2(fy - 28 * s)}" stroke="#e9f4ff" stroke-width="3"/><polygon points="{f2(fx)},{f2(fy - 28 * s)} {f2(fx + 24 * s)},{f2(fy - 19 * s)} {f2(fx)},{f2(fy - 10 * s)}" fill="#ff3b5c"/>')
    # exploding mine
    mx, my = P(6.5, 4.5)
    p.append(f'<circle cx="{f2(mx)}" cy="{f2(my)}" r="70" fill="url(#boom)"/>')
    r = random.Random(2)
    for q in range(16):
        a = q * math.pi / 8 + r.uniform(-.1, .1); d0, d1 = 34, 34 + r.uniform(20, 50)
        p.append(f'<line x1="{f2(mx + math.cos(a) * d0)}" y1="{f2(my + math.sin(a) * d0 * .8)}" x2="{f2(mx + math.cos(a) * d1)}" y2="{f2(my + math.sin(a) * d1 * .8)}" stroke="#ffd36a" stroke-width="2.5" stroke-linecap="round" filter="url(#glow)"/>')
    for q in range(8):
        a = q * math.pi / 4
        p.append(f'<line x1="{f2(mx)}" y1="{f2(my)}" x2="{f2(mx + 24 * math.cos(a))}" y2="{f2(my + 24 * math.sin(a))}" stroke="#2a2f3a" stroke-width="4" stroke-linecap="round"/>')
    p.append(sphere(mx, my, 16, "#3a3f4c", hi="#9aa3b5", idn="mine", shadow=False))
    p.append(f'<circle cx="{f2(mx + 4)}" cy="{f2(my - 4)}" r="3" fill="#ff3b5c" filter="url(#glow)"/>')
    front = sparkle(mx - 40, my - 50, 9, "#fff3b0") + sparkle(150, 60, 6) + sparkle(520, 70, 5)
    return frame("#ff3b5c", "#4f7fff", "".join(p), seed=20, floor=False, front=front)
covers["mine-grid"] = mine()

# ---------- Stack Shift ----------
def stackshift():
    p = ['<rect x="196" y="26" width="248" height="348" rx="14" fill="#0a1328" stroke="#7fe3ee" stroke-width="3" filter="url(#shadow)"/>',
         '<rect x="196" y="26" width="248" height="348" rx="14" fill="none" stroke="#7fe3ee" stroke-width="8" opacity=".25" filter="url(#glow)"/>']
    for x in range(200, 440, 24):
        p.append(f'<line x1="{x}" y1="30" x2="{x}" y2="370" stroke="#7fe3ee" stroke-opacity=".08"/>')
    def cell(i, j, col):
        x = 204 + i * 24; y = 346 - j * 24
        return (f'<rect x="{x}" y="{y}" width="22" height="22" rx="4" fill="{col}"/><rect x="{x + 2}" y="{y + 2}" width="18" height="5" rx="2" fill="#fff" opacity=".4"/>'
                f'<rect x="{x + 2}" y="{y + 16}" width="18" height="4" rx="2" fill="#000" opacity=".2"/>')
    cols = ["#4fa8ff", "#a47bff", "#ff6f91", "#ffd23f", "#5cffb0", "#ff9a3c", "#2fd9c8"]
    heights = [3, 4, 2, 5, 3, 4, 1, 3, 4, 2]
    for i, h in enumerate(heights):
        for j in range(h):
            if j == 1: continue
            if not (i == 6 and j == 0): p.append(cell(i, j, cols[(i * 3 + j) % 7]))
    # the row being cleared: white flash + shards flying out
    p.append('<rect x="200" y="320" width="240" height="24" fill="#ffffff" opacity=".85" filter="url(#glow)"/>')
    r = random.Random(8)
    for q in range(18):
        x = r.uniform(204, 436); y = 332 + r.uniform(-6, 6)
        dx = (x - 320) * r.uniform(.6, 1.4)
        p.append(f'<rect x="{f2(x + dx)}" y="{f2(y - r.uniform(20, 80))}" width="6" height="6" rx="1" fill="{r.choice(cols)}" transform="rotate({r.randint(0, 90)} {f2(x + dx)} {f2(y)})" opacity=".9"/>')
    # falling T piece with trail and ghost
    for (i, j) in [(5, 10), (6, 10), (7, 10), (6, 11)]:
        x = 204 + i * 24; y = 346 - j * 24
        p.append(f'<rect x="{x + 4}" y="{y - 40}" width="14" height="36" fill="#b98cff" opacity=".22"/>')
        p.append(f'<g filter="url(#glow)">{cell(i, j, "#b98cff")}</g>')
    for (i, j) in [(5, 5), (6, 5), (7, 5), (6, 6)]:
        x = 204 + i * 24; y = 346 - j * 24
        p.append(f'<rect x="{x}" y="{y}" width="22" height="22" rx="4" fill="none" stroke="#b98cff" stroke-dasharray="4 3" opacity=".6"/>')
    p.append('<rect x="464" y="56" width="96" height="96" rx="12" fill="#0a1328" stroke="#7fe3ee" stroke-opacity=".5"/>')
    for (i, j) in [(0, 0), (1, 0), (1, 1), (2, 1)]:
        p.append(f'<rect x="{484 + i * 19}" y="{110 - j * 19}" width="17" height="17" rx="3" fill="#5cffb0"/>')
    p.append('<rect x="80" y="56" width="96" height="96" rx="12" fill="#0a1328" stroke="#7fe3ee" stroke-opacity=".5"/>')
    for (i, j) in [(0, 0), (1, 0), (2, 0), (3, 0)]:
        p.append(f'<rect x="{90 + i * 19}" y="96" width="17" height="17" rx="3" fill="#4fa8ff"/>')
    front = sparkle(440, 320, 9, "#ffffff") + sparkle(120, 260, 6) + sparkle(540, 220, 6, "#e0d0ff")
    return frame("#b98cff", "#2fd9c8", "".join(p), seed=21, floor=False, front=front)
covers["stack-shift"] = stackshift()

# ---------- Pinball ----------
def pinball():
    p = ['<defs><linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a6c"/><stop offset="1" stop-color="#0b1a46"/></linearGradient>'
         '<linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe3ee" stop-opacity=".2"/><stop offset=".5" stop-color="#7fe3ee" stop-opacity=".7"/><stop offset="1" stop-color="#7fe3ee" stop-opacity=".2"/></linearGradient></defs>',
         '<polygon points="206,26 434,26 566,384 74,384" fill="url(#chrome)" filter="url(#shadow)"/>',
         '<polygon points="218,38 422,38 548,380 92,380" fill="url(#pf)"/>']
    # score display
    p.append('<rect x="250" y="44" width="140" height="28" rx="6" fill="#120a2a" stroke="#ff8a1f" stroke-width="2"/>')
    p.append('<text x="320" y="65" font-family="ui-monospace, Menlo, monospace" font-size="20" font-weight="900" fill="#ff8a1f" text-anchor="middle" filter="url(#glow)">0924500</text>')
    # ramps
    p.append('<path d="M150,300 C150,150 230,90 300,96" fill="none" stroke="url(#ramp)" stroke-width="16"/>')
    p.append('<path d="M490,300 C490,150 410,90 340,96" fill="none" stroke="url(#ramp)" stroke-width="16"/>')
    p.append('<ellipse cx="320" cy="170" rx="150" ry="40" fill="none" stroke="#7a8cff" stroke-opacity=".35" stroke-width="10"/>')
    for (x, y, rr, c) in [(260, 128, 26, "#e12d3f"), (380, 138, 26, "#ffb81f"), (320, 206, 30, "#2f8fff")]:
        p.append(f'<circle cx="{x}" cy="{y + 6}" r="{rr + 6}" fill="#000" opacity=".4"/><circle cx="{x}" cy="{y}" r="{rr + 5}" fill="#1b1f2c"/><circle cx="{x}" cy="{y}" r="{rr}" fill="{c}" stroke="#fff" stroke-width="3"/>'
                 f'<polygon points="{x},{y - 12} {x + 4},{y - 3} {x + 12},{y - 3} {x + 6},{y + 3} {x + 8},{y + 12} {x},{y + 7} {x - 8},{y + 12} {x - 6},{y + 3} {x - 12},{y - 3} {x - 4},{y - 3}" fill="#fff"/>'
                 f'<circle cx="{x}" cy="{y}" r="{rr + 16}" fill="{c}" opacity=".28" filter="url(#soft)"/>')
    # lit bumper hit ring
    p.append('<circle cx="380" cy="138" r="44" fill="none" stroke="#fff3b0" stroke-width="3" opacity=".7" filter="url(#glow)"/>')
    for i, x in enumerate((268, 300, 332, 364)):
        p.append(f'<rect x="{x}" y="262" width="24" height="10" rx="2" fill="{"#ff8a1f" if i != 2 else "#3a2a10"}" filter="url(#glow)"/>')
    # lane lights and slingshots
    for i in range(5):
        p.append(f'<circle cx="{258 + i * 31}" cy="300" r="5" fill="{"#5cffb0" if i % 2 else "#2a4a3a"}" filter="url(#glow)"/>')
    p.append('<polygon points="150,250 150,316 196,330" fill="#ff3d9a" opacity=".8" stroke="#fff" stroke-width="2"/><polygon points="490,250 490,316 444,330" fill="#ff3d9a" opacity=".8" stroke="#fff" stroke-width="2"/>')
    # flippers
    p.append('<g filter="url(#shadow)"><path d="M196,334 L292,358 Q298,364 290,368 L192,350 Q184,342 196,334Z" fill="#fbfbff" stroke="#e12d3f" stroke-width="4"/>'
             '<path d="M444,334 L348,358 Q342,364 350,368 L448,350 Q456,342 444,334Z" fill="#fbfbff" stroke="#e12d3f" stroke-width="4"/></g>')
    # plunger lane
    p.append('<line x1="526" y1="360" x2="490" y2="150" stroke="#7fe3ee" stroke-opacity=".35" stroke-width="2"/><rect x="520" y="352" width="14" height="26" rx="3" fill="url(#chrome)"/>')
    # ball with a bright trail coming off the bumper
    pts = [(380 - 10 + t * 2, 190 + t * 12) for t in range(8)]
    p.append(trail(pts, "#bdf6ff", 20))
    p.append(sphere(pts[-1][0], pts[-1][1], 13, "#dfe7f1", idn="pb"))
    front = sparkle(380, 138, 12, "#fff3b0") + sparkle(150, 80, 6) + sparkle(520, 90, 7, "#ffd0f0")
    return frame("#7a5cff", "#ff3d9a", "".join(p), seed=22, floor=False, front=front)
covers["pinball"] = pinball()

# ---------- Corner Sudoku ----------
def sudoku():
    U = 44; K = U / math.sqrt(2); OX = 320; OY = 34
    boxes = [(0, 0), (0, 3), (3, 0)]
    tones = ["#f3c55a", "#7fe3ee", "#ff7ab8"]
    P = lambda c, r: (OX + (c - r) * K, OY + (c + r) * K)
    poly = lambda c, r, w, h: " ".join(f"{f2(x)},{f2(y)}" for x, y in [P(c, r), P(c + w, r), P(c + w, r + h), P(c, r + h)])
    rr = random.Random(6)
    p = []
    # floating blurred digits in the background
    for _ in range(18):
        p.append(f'<text x="{f2(rr.uniform(0, 640))}" y="{f2(rr.uniform(30, 390))}" font-family="system-ui" font-size="{rr.randint(18, 46)}" font-weight="800" fill="{rr.choice(tones)}" opacity=".16" filter="url(#blur2)">{rr.randint(1, 9)}</text>')
    p.append('<g filter="url(#shadow)">' + "".join(f'<polygon points="{poly(c0, r0, 3, 3)}" fill="#13264a"/>' for (r0, c0) in boxes) + '</g>')
    # highlighted row/column and the selected cell
    p.append(f'<polygon points="{poly(0, 1, 6, 1)}" fill="#7fe3ee" fill-opacity=".09"/>')
    p.append(f'<polygon points="{poly(1, 0, 1, 6)}" fill="#7fe3ee" fill-opacity=".09"/>')
    p.append(f'<polygon points="{poly(1, 1, 1, 1)}" fill="#f3c55a" fill-opacity=".45" filter="url(#glow)"/>')
    for (r0, c0) in boxes:
        for r in range(3):
            for c in range(3):
                p.append(f'<polygon points="{poly(c0 + c, r0 + r, 1, 1)}" fill="none" stroke="#9fb7d8" stroke-opacity=".3"/>')
    for i, (r0, c0) in enumerate(boxes):
        p.append(f'<polygon points="{poly(c0, r0, 3, 3)}" fill="none" stroke="{tones[i]}" stroke-width="4" stroke-linejoin="round" filter="url(#glow)"/>')
    digits = {(0, 0): 5, (2, 2): 8, (0, 4): 7, (4, 1): 9, (2, 5): 6, (5, 0): 1, (1, 3): 2, (2, 0): 4, (3, 1): 2, (1, 5): 4, (5, 2): 7, (0, 3): 9}
    for (r, c), d in digits.items():
        x, y = P(c + .5, r + .5)
        p.append(f'<text x="{f2(x)}" y="{f2(y + 7)}" font-family="system-ui" font-size="20" font-weight="800" text-anchor="middle" fill="{"#7fe3ee" if (r * 3 + c) % 4 == 0 else "#eef4ff"}">{d}</text>')
    # the digit being placed, popping in with a ring
    x, y = P(1.5, 1.5)
    p.append(f'<circle cx="{f2(x)}" cy="{f2(y)}" r="22" fill="none" stroke="#fff3b0" stroke-width="2.5" filter="url(#glow)"/>')
    p.append(f'<text x="{f2(x)}" y="{f2(y + 9)}" font-family="system-ui" font-size="28" font-weight="900" text-anchor="middle" fill="#fff3b0" filter="url(#glow)">3</text>')
    # 3×3 number pad on the right
    for i in range(9):
        cx = 520 + (i % 3) * 36; cy = 236 + (i // 3) * 36
        p.append(f'<rect x="{cx - 15}" y="{cy - 15}" width="30" height="30" rx="8" fill="#0f1d3a" stroke="{tones[i % 3]}" stroke-opacity=".75"/><text x="{cx}" y="{cy + 6}" font-family="system-ui" font-size="15" font-weight="800" text-anchor="middle" fill="#eef4ff">{i + 1}</text>')
    front = sparkle(x + 24, y - 24, 9, "#fff3b0") + sparkle(120, 90, 6) + sparkle(540, 80, 6, "#e0d0ff")
    return frame("#f3c55a", "#c58cff", "".join(p), seed=23, floor=False, front=front)
covers["corner-sudoku"] = sudoku()

# ---------- Bowling (strike, character pins) ----------
def pin_svg(x, y, s, idn, rot=0, mood="idle"):
    face = ""
    ey, ex, er = y - 41 * s, 2.2 * s, 1.6 * s
    if mood == "hit":
        face = "".join(f'<path d="M{f2(x + sd * ex - er)},{f2(ey - er)} L{f2(x + sd * ex + er)},{f2(ey + er)} M{f2(x + sd * ex + er)},{f2(ey - er)} L{f2(x + sd * ex - er)},{f2(ey + er)}" stroke="#1b1f2e" stroke-width="{f2(.7 * s)}"/>' for sd in (-1, 1))
        face += f'<ellipse cx="{f2(x)}" cy="{f2(ey + 3.6 * s)}" rx="{f2(1.4 * s)}" ry="{f2(1.1 * s)}" fill="#1b1f2e"/>'
    else:
        big = 1.25 if mood == "scared" else 1
        for sd in (-1, 1):
            face += f'<ellipse cx="{f2(x + sd * ex)}" cy="{f2(ey)}" rx="{f2(er * big)}" ry="{f2(er * 1.25 * big)}" fill="#fff" stroke="#1b1f2e" stroke-width="{f2(.3 * s)}"/><circle cx="{f2(x + sd * ex)}" cy="{f2(ey + .5 * s)}" r="{f2(er * (.4 if mood == "scared" else .6))}" fill="#1b1f2e"/>'
        if mood == "scared":
            face += f'<ellipse cx="{f2(x)}" cy="{f2(ey + 3.8 * s)}" rx="{f2(1.3 * s)}" ry="{f2(1.6 * s)}" fill="#1b1f2e"/><ellipse cx="{f2(x + 4.5 * s)}" cy="{f2(ey - 1 * s)}" rx="{f2(.7 * s)}" ry="{f2(1.2 * s)}" fill="#7fe3ee"/>'
        else:
            face += f'<path d="M{f2(x - 1.8 * s)},{f2(ey + 3 * s)} Q{f2(x)},{f2(ey + 4.8 * s)} {f2(x + 1.8 * s)},{f2(ey + 3 * s)}" stroke="#1b1f2e" stroke-width="{f2(.5 * s)}" fill="none"/>'
    return (f'<defs><linearGradient id="{idn}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9c2cf"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#9aa4b3"/></linearGradient></defs>'
            f'<ellipse cx="{f2(x)}" cy="{f2(y + 2)}" rx="{f2(9 * s)}" ry="{f2(3 * s)}" fill="#000" opacity=".35"/>'
            f'<g transform="rotate({rot} {f2(x)} {f2(y)})"><path d="M{f2(x)},{f2(y - 46 * s)} C{f2(x + 6 * s)},{f2(y - 46 * s)} {f2(x + 7 * s)},{f2(y - 38 * s)} {f2(x + 5 * s)},{f2(y - 32 * s)} C{f2(x + 4 * s)},{f2(y - 28 * s)} {f2(x + 11 * s)},{f2(y - 16 * s)} {f2(x + 10 * s)},{f2(y - 6 * s)} C{f2(x + 9 * s)},{f2(y)} {f2(x - 9 * s)},{f2(y)} {f2(x - 10 * s)},{f2(y - 6 * s)} C{f2(x - 11 * s)},{f2(y - 16 * s)} {f2(x - 4 * s)},{f2(y - 28 * s)} {f2(x - 5 * s)},{f2(y - 32 * s)} C{f2(x - 7 * s)},{f2(y - 38 * s)} {f2(x - 6 * s)},{f2(y - 46 * s)} {f2(x)},{f2(y - 46 * s)}Z" fill="url(#{idn})"/>'
            f'<rect x="{f2(x - 5 * s)}" y="{f2(y - 33 * s)}" width="{f2(10 * s)}" height="{f2(2.5 * s)}" fill="#e12d3f"/><rect x="{f2(x - 5.5 * s)}" y="{f2(y - 29 * s)}" width="{f2(11 * s)}" height="{f2(2.5 * s)}" fill="#e12d3f"/>{face}</g>')
def bowling():
    p = ['<defs><linearGradient id="lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4f2a"/><stop offset="1" stop-color="#e2b47a"/></linearGradient>'
         '<radialGradient id="hit" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3b0" stop-opacity=".9"/><stop offset="1" stop-color="#ff3d9a" stop-opacity="0"/></radialGradient></defs>',
         '<polygon points="246,40 394,40 580,400 60,400" fill="#151a28"/>',
         '<polygon points="262,40 378,40 520,400 120,400" fill="url(#lane)"/>',
         '<polygon points="262,40 378,40 400,120 240,120" fill="#fff" opacity=".08"/>']
    for k in range(1, 12):
        x0 = 262 + 116 * k / 12; x1 = 120 + 400 * k / 12
        p.append(f'<line x1="{f2(x0)}" y1="40" x2="{f2(x1)}" y2="400" stroke="#5a3519" stroke-opacity=".35" stroke-width="1"/>')
    for i in range(7):
        y = 270; t = (y - 40) / 360; half = 58 + 142 * t; x = 320 - half * .55 + half * 1.1 * i / 6
        yy = y + abs(i - 3) * 8
        p.append(f'<polygon points="{f2(x)},{yy - 9} {f2(x + 6)},{yy + 5} {f2(x - 6)},{yy + 5}" fill="#4a2a10" opacity=".75"/>')
    # neon gutters
    for side in (-1, 1):
        p.append(f'<line x1="{320 + side * 62}" y1="40" x2="{320 + side * 216}" y2="400" stroke="#7fe3ee" stroke-width="2" opacity=".6" filter="url(#glow)"/>')
    p.append('<rect x="246" y="14" width="148" height="28" fill="#0b1226"/><rect x="246" y="38" width="148" height="4" fill="#ff3d9a" filter="url(#glow)"/>')
    # impact flash + pins flying with dizzy faces; two scared pins still standing
    p.append('<circle cx="320" cy="118" r="96" fill="url(#hit)"/>')
    flying = [(236, 92, -58, 1.05), (404, 88, 52, 1.05), (182, 150, -100, 1.15), (462, 146, 104, 1.15), (290, 60, -22, .9), (352, 56, 28, .9), (140, 96, -140, 1.0), (506, 100, 150, 1.0)]
    for q, (x, y, rot, s) in enumerate(flying):
        p.append(trail([(320 + (x - 320) * .3, 110), (x, y)], "#ffffff", 8))
        p.append(pin_svg(x, y, s, f"pf{q}", rot, "hit"))
    p.append(pin_svg(282, 150, 1.15, "ps1", -6, "scared") + pin_svg(360, 152, 1.15, "ps2", 8, "scared"))
    p.append(confetti(41, 320, 100, 40, ["#ff3d9a", "#7fe3ee", "#ffd23f", "#b98cff"], 200))
    # ball rolling in with a long trail
    for i in range(7):
        p.append(f'<circle cx="{348 - i * 5}" cy="{318 + i * 13}" r="{38 - i * 3}" fill="#7a5cff" opacity="{.2 - i * .025:.3f}"/>')
    p.append(sphere(350, 306, 40, "#5b3cff", hi="#c9b8ff", shade="#1a0d55", idn="ball"))
    p.append('<path d="M318,300 Q350,284 384,306" fill="none" stroke="#ff7ad8" stroke-width="3" opacity=".5"/>')
    for (dx, dy) in [(-8, -14), (6, -18), (-2, -4)]:
        p.append(f'<circle cx="{350 + dx}" cy="{306 + dy}" r="4.5" fill="#120a33"/>')
    front = sparkle(320, 112, 14, "#fff8e0") + sparkle(140, 220, 6) + sparkle(520, 230, 7, "#ffd0f0")
    return frame("#ff3d9a", "#7a5cff", "".join(p), seed=24, floor=False, rays=False, front=front)
covers["bowling"] = bowling()

os.makedirs(OUT, exist_ok=True)
for name, svg in covers.items():
    open(os.path.join(OUT, f"{name}.svg"), "w").write(svg)
print("wrote", len(covers), "covers to", OUT)
