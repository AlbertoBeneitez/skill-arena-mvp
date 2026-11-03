"""Catalogue covers v3 (original art): full-bleed 16:11 close-ups that fill the card (640×440 SVG source).

v138: no anamorphic lens streak (the thin horizontal flare read as a cut across the card), backgrounds and shadows
in the app's black instead of navy (the same lightness, no blue cast; violet and warm game colours stay), the
Pinball cover shows a multiball (V9) and the Roulette ball is mid-throw on the track (V16).

v140: posters of each game's peak moment (strike, laser hit, eruption, win cascade, bumper discharge, bull) for
Bowling, Shot Gallery, Tower Drop, Solitaire, Pinball, Mine Grid, Slot and Darts; a darker Roulette room; the
Galoku corner box large in the centre; rendered at 1600×1100.

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


def cine(fx, fy, key="#ffd9a0", flare="#9fefff", beam=None, strength=.82, flare_w=300, streak=False, bloom=True):
    """v121 film grade, layered over a cover: focus vignette that pulls the eye to (fx, fy), a soft key-light bloom,
    an anamorphic streak through the focal point and (optionally) a volumetric light shaft from `beam` = (x, y, spread)."""
    uid = f"{int(fx)}x{int(fy)}"
    d = (f'<radialGradient id="cv{uid}" gradientUnits="userSpaceOnUse" cx="{f(fx)}" cy="{f(fy)}" r="430">'
         f'<stop offset=".18" stop-color="#02040a" stop-opacity="0"/><stop offset=".62" stop-color="#02040a" stop-opacity="{strength * .55:.2f}"/>'
         f'<stop offset="1" stop-color="#02040a" stop-opacity="{strength:.2f}"/></radialGradient>'
         f'<linearGradient id="cb{uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6e0" stop-opacity=".22"/><stop offset="1" stop-color="#fff6e0" stop-opacity="0"/></linearGradient>')
    out = [f'<defs>{d}</defs>']
    if beam:
        bx, by, sp = beam
        ang = math.atan2(fy - by, fx - bx); L = math.hypot(fx - bx, fy - by) * 1.35
        nx, ny = -math.sin(ang), math.cos(ang)
        ex, ey = bx + math.cos(ang) * L, by + math.sin(ang) * L
        pts = f"{f(bx + nx * 10)},{f(by + ny * 10)} {f(bx - nx * 10)},{f(by - ny * 10)} {f(ex - nx * sp)},{f(ey - ny * sp)} {f(ex + nx * sp)},{f(ey + ny * sp)}"
        out.append(f'<polygon points="{pts}" fill="url(#cb{uid})" filter="url(#soft)" style="mix-blend-mode:screen"/>')
    out.append(f'<rect width="640" height="440" fill="url(#cv{uid})"/>')
    if bloom:
        out.append(f'<radialGradient id="ck{uid}"><stop offset="0" stop-color="{key}" stop-opacity=".3"/><stop offset=".45" stop-color="{key}" stop-opacity=".1"/><stop offset="1" stop-color="{key}" stop-opacity="0"/></radialGradient>'
                   f'<circle cx="{f(fx)}" cy="{f(fy)}" r="150" fill="url(#ck{uid})" style="mix-blend-mode:screen"/>')
    if streak:
        out.append(f'<ellipse cx="{f(fx)}" cy="{f(fy)}" rx="{flare_w}" ry="2.2" fill="{flare}" opacity=".55" filter="url(#glow)" style="mix-blend-mode:screen"/>')
        out.append(f'<ellipse cx="{f(fx)}" cy="{f(fy)}" rx="{flare_w * .45:.0f}" ry="1" fill="#ffffff" opacity=".7" style="mix-blend-mode:screen"/>')
    return "".join(out)


covers = {}
ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
RED = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}


# ---------- Roulette: low, close view of a huge wheel, ball in a pocket, chips out of focus ----------
def roulette():
    cx, cy, rx, ry = 320, 330, 470, 190
    k = ry / rx
    d = ('<radialGradient id="room" cx="50%" cy="10%" r="90%"><stop offset="0" stop-color="#170a12"/><stop offset=".6" stop-color="#08050a"/><stop offset="1" stop-color="#020203"/></radialGradient>'
         '<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e09a4a"/><stop offset=".4" stop-color="#8a4a18"/><stop offset="1" stop-color="#2e1606"/></linearGradient>'
         '<radialGradient id="cone" cx="48%" cy="30%" r="70%"><stop offset="0" stop-color="#ffe9b0"/><stop offset=".45" stop-color="#b08938"/><stop offset="1" stop-color="#3b2a10"/></radialGradient>'
         '<radialGradient id="spot" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff2d6" stop-opacity=".12"/><stop offset="1" stop-color="#fff2d6" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#room)"/>', bokeh(11, ["#ffcf7a", "#ff6a8a", "#ffa040"], 14, 200, 10, 34, (.05, .14))]
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
    # v138: the ball riding the track against the rim, a long curved trail behind it (a real throw)
    a = -1.15
    bx, by = cx + (rx - 44) * math.cos(a), cy + (rx - 44) * math.sin(a) * k - 6
    arc = [(cx + (rx - 44) * math.cos(a + t * .045), cy + (rx - 44) * math.sin(a + t * .045) * k - 6) for t in range(14)]
    p.append(trail(arc, "#ffffff", 14, .55))
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






# ---------- Stack Shift: the well fills the frame, a line clearing ----------
def stackshift():
    """v121 · The real Stack Shift well in close-up: 8 columns, the game's six block colours and bevel, the falling
    piece over its dashed landing ghost, a full line clearing, the mint floor and the "next" tray; slight camera tilt."""
    cols = ["#5fd4e8", "#f5ba5b", "#73d69d", "#a986e8", "#ef7d94", "#6f96ed"]
    shapes = [[(0, 0), (1, 0), (2, 0)], [(0, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (1, 1), (2, 1)], [(0, 0), (1, 0), (0, 1), (1, 1)],
              [(0, 0), (0, 1), (1, 1), (1, 2), (2, 2)], [(0, 0), (0, 1), (0, 2), (1, 2)]]
    d = ('<radialGradient id="ssbg" cx="40%" cy="30%" r="90%"><stop offset="0" stop-color="#15204a"/><stop offset=".6" stop-color="#070d22"/><stop offset="1" stop-color="#03060f"/></radialGradient>'
         '<linearGradient id="ssflash" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d2fff5" stop-opacity="0"/><stop offset=".5" stop-color="#d2fff5" stop-opacity=".95"/><stop offset="1" stop-color="#d2fff5" stop-opacity="0"/></linearGradient>')
    CS, COLS, ROWS = 50, 8, 9
    X0, FLOOR = 118, 418  # well left edge and floor line (screen units before the tilt)

    def block(i, j, k, ghost=False):
        x = X0 + i * CS; y = FLOOR - (j + 1) * CS
        if ghost:
            return f'<rect x="{x + 6}" y="{y + 6}" width="{CS - 12}" height="{CS - 12}" fill="none" stroke="{cols[k]}" stroke-width="2.4" stroke-dasharray="5 5" opacity=".6"/>'
        return (f'<rect x="{x + 3}" y="{y + 3}" width="{CS - 6}" height="{CS - 6}" fill="{cols[k]}"/>'
                f'<rect x="{x + 4}" y="{y + 4}" width="{CS - 8}" height="5" fill="#fff" opacity=".3"/>'
                f'<rect x="{x + 4}" y="{y + CS - 9}" width="{CS - 8}" height="5" fill="#000" opacity=".26"/>'
                f'<rect x="{x + 3.5}" y="{y + 3.5}" width="{CS - 7}" height="{CS - 7}" fill="none" stroke="#fff" stroke-opacity=".2"/>')
    p = ['<rect width="640" height="440" fill="url(#ssbg)"/>', stars(44, 90), bokeh(12, ["#5fd4e8", "#a986e8", "#ef7d94"], 10, 440, 24, 60, (.06, .16))]
    g = ['<g transform="translate(320 250) rotate(-4) skewX(-3) translate(-320 -250)">']
    g.append(f'<rect x="{X0 - 6}" y="-40" width="{COLS * CS + 12}" height="{FLOOR + 46}" fill="#040c19" fill-opacity=".94" stroke="#335e79" stroke-width="2.5"/>')
    for i in range(COLS + 1):
        g.append(f'<line x1="{X0 + i * CS}" y1="-40" x2="{X0 + i * CS}" y2="{FLOOR}" stroke="#a7cfeb" stroke-opacity=".08"/>')
    for j in range(ROWS + 1):
        g.append(f'<line x1="{X0}" y1="{FLOOR - j * CS}" x2="{X0 + COLS * CS}" y2="{FLOOR - j * CS}" stroke="#a7cfeb" stroke-opacity=".08"/>')
    stack_rows = [
        [0, 5, 2, 2, 1, 4, None, 3],
        [3, 3, 0, 1, 1, 4, 5, 5],      # full: clearing
        [None, 3, 0, None, 2, 2, 5, None],
        [None, None, 0, None, 2, None, None, None],
    ]
    for j, row in enumerate(stack_rows):
        if j == 1:
            continue
        for i, k in enumerate(row):
            if k is not None:
                g.append(block(i, j, k))
    # the clearing line: blocks bleaching into the mint flash
    for i, k in enumerate(stack_rows[1]):
        g.append(f'<g opacity=".55">{block(i, 1, k)}</g>')
    g.append(f'<rect x="{X0}" y="{FLOOR - 2 * CS}" width="{COLS * CS}" height="{CS}" fill="url(#ssflash)" filter="url(#glow)"/>')
    g.append(f'<rect x="{X0 - 10}" y="{FLOOR - 2 * CS + CS / 2 - 1.5}" width="{COLS * CS + 20}" height="3" fill="#ffffff" filter="url(#glow)"/>')
    rr = random.Random(9)
    for q in range(22):
        x = rr.uniform(X0, X0 + COLS * CS); y = FLOOR - 1.5 * CS - rr.uniform(0, 120)
        g.append(f'<rect x="{f(x)}" y="{f(y)}" width="{rr.choice([6, 8, 10])}" height="{rr.choice([6, 8, 10])}" fill="{rr.choice(cols)}" opacity="{rr.uniform(.5, .95):.2f}" transform="rotate({rr.randint(0, 90)} {f(x)} {f(y)})"/>')
    # active piece (the game's 4-cell zigzag) and its landing ghost
    k = 2; px, py = 3, 6; gy = 3
    for (cx, cy) in shapes[k]:
        g.append(block(px + cx, gy + 1 - cy, k, ghost=True))
    g.append('<g filter="url(#shadow)">' + "".join(block(px + cx, py + 1 - cy, k) for (cx, cy) in shapes[k]) + '</g>')
    g.append(f'<rect x="{X0 - 8}" y="{FLOOR}" width="{COLS * CS + 16}" height="6" fill="#8edbda" filter="url(#glow)"/>')
    g.append(f'<rect x="{X0 - 6}" y="-40" width="{COLS * CS + 12}" height="{FLOOR + 46}" fill="none" stroke="#a0f1e9" stroke-opacity=".55" stroke-width="3" filter="url(#glow)"/>')
    g.append('</g>')
    p += g
    # "next" tray, right, like the game
    tx, ty = 548, 40
    p.append(f'<rect x="{tx - 10}" y="{ty}" width="84" height="150" rx="10" fill="#040c19" fill-opacity=".85" stroke="#335e79"/>')
    p.append(f'<text x="{tx}" y="{ty + 20}" font-family="Arial, sans-serif" font-size="12" font-weight="700" fill="#9bc1d5">NEXT</text>')
    for n, (kk, op) in enumerate(((4, 1), (0, .5))):
        for (cx, cy) in shapes[kk]:
            p.append(f'<rect x="{tx + 6 + cx * 18}" y="{ty + 34 + n * 62 + cy * 18}" width="16" height="16" fill="{cols[kk]}" opacity="{op}"/>')
    p.append(sparkle(X0 + COLS * CS - 26, FLOOR - 1.5 * CS - 6, 16) + sparkle(84, 110, 9, "#e0f6ff"))
    p.append(cine(X0 + 4 * CS, FLOOR - 1.5 * CS, key="#d2fff5", flare="#bff6f0", strength=.66, flare_w=220))
    return svg("".join(p), extra_defs=d)
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




# ---------- Bowling: low view at the pin deck, the ball smashing in ----------
def pin(x, y, s, idn, rot=0):
    return (f'<defs><linearGradient id="{idn}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#aeb8c6"/><stop offset=".42" stop-color="#ffffff"/><stop offset="1" stop-color="#8f9aab"/></linearGradient></defs>'
            f'<ellipse cx="{f(x)}" cy="{f(y + 2)}" rx="{f(10 * s)}" ry="{f(3 * s)}" fill="#000" opacity=".4"/>'
            f'<g transform="rotate({rot} {f(x)} {f(y)})"><path d="M{f(x)},{f(y - 46 * s)} C{f(x + 6 * s)},{f(y - 46 * s)} {f(x + 7 * s)},{f(y - 38 * s)} {f(x + 5 * s)},{f(y - 32 * s)} C{f(x + 4 * s)},{f(y - 28 * s)} {f(x + 11 * s)},{f(y - 16 * s)} {f(x + 10 * s)},{f(y - 6 * s)} C{f(x + 9 * s)},{f(y)} {f(x - 9 * s)},{f(y)} {f(x - 10 * s)},{f(y - 6 * s)} C{f(x - 11 * s)},{f(y - 16 * s)} {f(x - 4 * s)},{f(y - 28 * s)} {f(x - 5 * s)},{f(y - 32 * s)} C{f(x - 7 * s)},{f(y - 38 * s)} {f(x - 6 * s)},{f(y - 46 * s)} {f(x)},{f(y - 46 * s)}Z" fill="url(#{idn})"/>'
            f'<rect x="{f(x - 5 * s)}" y="{f(y - 33 * s)}" width="{f(10 * s)}" height="{f(2.5 * s)}" fill="#e12d3f"/><rect x="{f(x - 5.5 * s)}" y="{f(y - 29 * s)}" width="{f(11 * s)}" height="{f(2.5 * s)}" fill="#e12d3f"/></g>')




# ---------- Galoku: the five-box board fills the frame ----------
def galoku():
    U = 78; K = U / math.sqrt(2); OX = 320; OY = 220 - 3 * K
    boxes = [(0, 0), (0, 3), (0, 6), (3, 0), (6, 0)]
    tones = ["#f3c55a", "#7fe3ee", "#5fb8ff", "#ff7ab8", "#c58cff"]
    P = lambda c, r: (OX + (c - r) * K, OY + (c + r) * K)
    poly = lambda c, r, w, h: " ".join(f"{f(x)},{f(y)}" for x, y in [P(c, r), P(c + w, r), P(c + w, r + h), P(c, r + h)])
    rr = random.Random(6)
    p = ['<rect width="640" height="440" fill="#070809"/>', bokeh(23, tones, 12, 440, 20, 60)]
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
        p.append(f'<polygon points="{poly(c0, r0, 3, 3)}" fill="none" stroke="{tones[i]}" stroke-width="7" stroke-linejoin="round" filter="url(#glow)"/>')
    digits = {(0, 0): 5, (2, 2): 8, (0, 4): 7, (1, 7): 2, (4, 1): 9, (7, 2): 4, (2, 5): 6, (5, 0): 1, (8, 1): 6, (1, 3): 1, (0, 8): 9, (6, 2): 3, (2, 0): 4, (3, 1): 2, (1, 5): 4, (2, 7): 3, (7, 0): 8}
    for (r, c), dg in digits.items():
        x, y = P(c + .5, r + .5)
        p.append(f'<text x="{f(x)}" y="{f(y + 18)}" font-family="Arial, sans-serif" font-size="50" font-weight="800" text-anchor="middle" fill="{"#7fe3ee" if (r * 3 + c) % 4 == 0 else "#eef4ff"}">{dg}</text>')
    x, y = P(1.5, 1.5)
    p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="48" fill="none" stroke="#fff3b0" stroke-width="5" filter="url(#glow)"/><text x="{f(x)}" y="{f(y + 22)}" font-family="Arial Black, sans-serif" font-size="64" text-anchor="middle" fill="#fff3b0" filter="url(#glow)">3</text>')
    p.append(sparkle(x + 56, y - 48, 20, "#fff3b0"))
    # v121 · a single overhead light on the solved cell; the rest of the board falls into shadow
    p.append(cine(x, y, key="#fff3b0", flare="#ffe7a8", beam=(x, -60, 110), strength=.88, flare_w=260))
    return svg("".join(p))
covers["corner-sudoku"] = galoku()



# ---------- v140 posters: the peak moment of each game, low close camera, rim light, bloom, sparks ----------
def burst(x, y, n, r0, r1, col, seed, w=3.0, op=.85):
    """Radial light rays from an impact."""
    r = random.Random(seed)
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n + r.uniform(-.12, .12)
        l1 = r1 * r.uniform(.55, 1.0)
        out.append(f'<line x1="{f(x + r0 * math.cos(a))}" y1="{f(y + r0 * math.sin(a))}" x2="{f(x + l1 * math.cos(a))}" y2="{f(y + l1 * math.sin(a))}" '
                   f'stroke="{col}" stroke-width="{f(w * r.uniform(.5, 1.4))}" stroke-linecap="round" opacity="{op * r.uniform(.45, 1):.2f}"/>')
    return f'<g filter="url(#glow)" style="mix-blend-mode:screen">{"".join(out)}</g>'


def sparks(x, y, n, seed, cols, spread=220, lmin=6, lmax=26, down=.25):
    """Hot sparks flying out of an impact (short streaks along their direction)."""
    r = random.Random(seed)
    out = []
    for _ in range(n):
        a = r.uniform(0, 2 * math.pi); d = r.uniform(20, spread); l = r.uniform(lmin, lmax)
        sx, sy = x + d * math.cos(a), y + d * math.sin(a) + d * d * down / spread
        out.append(f'<line x1="{f(sx)}" y1="{f(sy)}" x2="{f(sx - l * math.cos(a))}" y2="{f(sy - l * math.sin(a))}" stroke="{r.choice(cols)}" stroke-width="{f(r.uniform(1.5, 3.4))}" stroke-linecap="round" opacity="{r.uniform(.6, 1):.2f}"/>')
    return f'<g filter="url(#glow)">{"".join(out)}</g>'


def flash(x, y, r, col, op=.9):
    gid = f"fl{int(x)}{int(y)}{int(r)}"
    return (f'<defs><radialGradient id="{gid}"><stop offset="0" stop-color="#ffffff" stop-opacity="{op}"/><stop offset=".25" stop-color="{col}" stop-opacity="{op * .8:.2f}"/>'
            f'<stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient></defs><circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="url(#{gid})" style="mix-blend-mode:screen"/>')


# ---------- Bowling: STRIKE — the ball bursts into the pin deck, pins flying at the camera ----------
def bowling():
    d = ('<linearGradient id="bbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14051f"/><stop offset=".5" stop-color="#0a0612"/><stop offset="1" stop-color="#050307"/></linearGradient>'
         '<linearGradient id="lane" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4b22"/><stop offset=".45" stop-color="#d79a5a"/><stop offset="1" stop-color="#f2c48a"/></linearGradient>'
         '<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
         '<radialGradient id="bball" cx="32%" cy="28%" r="80%"><stop offset="0" stop-color="#ffd2ff"/><stop offset=".18" stop-color="#ff3fb8"/><stop offset=".55" stop-color="#6a14c8"/><stop offset="1" stop-color="#14022e"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#bbg)"/>', bokeh(41, ["#ff3fb8", "#7fe3ee", "#b48cff", "#ffd36a"], 22, 170, 8, 30, (.15, .4))]
    # neon strip over the pin deck
    p.append('<rect x="120" y="128" width="400" height="5" rx="2" fill="#ff3fb8" filter="url(#bigglow)"/><rect x="120" y="128" width="400" height="2.5" fill="#ffd6f2"/>')
    # the lane, low and wide, boards converging to the pins
    p.append('<polygon points="232,200 408,200 700,440 -60,440" fill="url(#lane)"/>')
    for k in range(-14, 15):
        p.append(f'<line x1="{f(320 + k * 6.3)}" y1="200" x2="{f(320 + k * 27)}" y2="440" stroke="#5a3210" stroke-opacity=".35" stroke-width="1"/>')
    p.append('<polygon points="300,200 340,200 430,440 210,440" fill="url(#gloss)"/>')
    p.append('<polygon points="232,200 210,200 -110,440 -60,440" fill="#120a16"/><polygon points="408,200 430,200 750,440 700,440" fill="#120a16"/>')
    for i, x in enumerate([250, 285, 320, 355, 390]):
        y = 352
        p.append(f'<polygon points="{f(320 + (x - 320) * 1.9)},{y} {f(320 + (x - 320) * 1.9 - 7)},{y + 16} {f(320 + (x - 320) * 1.9 + 7)},{y + 16}" fill="#3a1d08" opacity=".7"/>')
    # impact flash at the head pin
    p.append(flash(318, 196, 190, "#ffd36a", .95))
    p.append(burst(318, 196, 34, 22, 260, "#fff1c4", seed=7, w=3.4))
    # pins flying: far ones soft, near ones sharp and big
    rr = random.Random(12)
    far = [(212, 118, -34), (262, 86, 22), (400, 92, 41), (452, 140, -18), (348, 64, 70), (180, 176, 58)]
    for i, (x, y, rot) in enumerate(far):
        p.append(f'<g filter="url(#dof)">{pin(x, y, 1.45, f"pf{i}", rot)}</g>')
    near = [(150, 238, -62, 2.1), (492, 230, 48, 2.3), (268, 174, 18, 1.7), (378, 168, -26, 1.8)]
    for i, (x, y, rot, s) in enumerate(near):
        p.append(f'<g filter="url(#shadow)">{pin(x, y, s, f"pn{i}", rot)}</g>')
    p.append(sparks(318, 196, 70, 3, ["#fff1c4", "#ffd36a", "#ff9d5c", "#ffffff"], 300))
    # the ball, rim-lit in magenta, with its run up the lane
    bx, by, br = 322, 250, 54
    p.append(trail([(bx + 30 - t * 1.0, by + 170 - t * 17) for t in range(11)], "#ff9ddf", 80, .32))
    p.append(f'<ellipse cx="{bx + 6}" cy="{by + br * .92}" rx="{br * .95}" ry="{br * .22}" fill="#000" opacity=".55" filter="url(#soft)"/>')
    p.append(f'<circle cx="{bx}" cy="{by}" r="{br + 14}" fill="#ff3fb8" opacity=".35" filter="url(#bigglow)"/>')
    p.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="url(#bball)"/>')
    p.append(f'<path d="M{bx - br * .9},{by + br * .1} A{br},{br} 0 0 0 {bx + br * .6},{by + br * .82}" fill="none" stroke="#7fe3ee" stroke-width="4" opacity=".75"/>')
    for (hx, hy) in [(-10, -16), (8, -20), (-1, -2)]:
        p.append(f'<circle cx="{bx + hx}" cy="{by + hy}" r="6" fill="#1a0430"/>')
    p.append(f'<ellipse cx="{bx - 18}" cy="{by - 24}" rx="16" ry="8" fill="#fff" opacity=".7" transform="rotate(-30 {bx - 18} {by - 24})"/>')
    p.append(sparkle(bx + 36, by - 40, 16, "#ffffff"))
    p.append(cine(318, 210, key="#ffd9a0", strength=.7, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["bowling"] = bowling()


# ---------- Shot Gallery: an alien target blown back by a laser hit under the crosshair ----------
def alien(x, y, s, body, idn, hit=False, rot=0):
    eye = "#ffffff" if not hit else "#fff3b0"
    return (f'<defs><radialGradient id="{idn}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".25" stop-color="{body}"/><stop offset="1" stop-color="#05170c"/></radialGradient></defs>'
            f'<g transform="rotate({rot} {f(x)} {f(y + 60 * s)})">'
            f'<rect x="{f(x - 5 * s)}" y="{f(y + 40 * s)}" width="{f(10 * s)}" height="{f(110 * s)}" fill="#5a3a1c" stroke="#1a0f06" stroke-width="{f(2 * s)}"/>'
            f'<line x1="{f(x - 22 * s)}" y1="{f(y - 50 * s)}" x2="{f(x - 34 * s)}" y2="{f(y - 86 * s)}" stroke="#0b2414" stroke-width="{f(6 * s)}" stroke-linecap="round"/>'
            f'<line x1="{f(x + 22 * s)}" y1="{f(y - 50 * s)}" x2="{f(x + 34 * s)}" y2="{f(y - 86 * s)}" stroke="#0b2414" stroke-width="{f(6 * s)}" stroke-linecap="round"/>'
            f'<circle cx="{f(x - 34 * s)}" cy="{f(y - 88 * s)}" r="{f(10 * s)}" fill="#ff3fb8" filter="url(#glow)"/><circle cx="{f(x + 34 * s)}" cy="{f(y - 88 * s)}" r="{f(10 * s)}" fill="#ff3fb8" filter="url(#glow)"/>'
            f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(62 * s)}" ry="{f(58 * s)}" fill="url(#{idn})" stroke="#04140a" stroke-width="{f(6 * s)}"/>'
            f'<ellipse cx="{f(x)}" cy="{f(y - 8 * s)}" rx="{f(30 * s)}" ry="{f(28 * s)}" fill="{eye}" stroke="#04140a" stroke-width="{f(4 * s)}"/>'
            f'<circle cx="{f(x + 4 * s)}" cy="{f(y - 6 * s)}" r="{f(13 * s)}" fill="#0a0a12"/><circle cx="{f(x + 9 * s)}" cy="{f(y - 12 * s)}" r="{f(4.5 * s)}" fill="#fff"/>'
            f'<path d="M{f(x - 24 * s)},{f(y + 32 * s)} Q{f(x)},{f(y + 48 * s)} {f(x + 24 * s)},{f(y + 32 * s)}" fill="none" stroke="#04140a" stroke-width="{f(5 * s)}" stroke-linecap="round"/></g>')


def gallery():
    d = ('<linearGradient id="gbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b0612"/><stop offset=".6" stop-color="#0b0710"/><stop offset="1" stop-color="#040306"/></linearGradient>'
         '<linearGradient id="awn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff2d55"/><stop offset=".5" stop-color="#ff2d55"/><stop offset=".5" stop-color="#fff3e6"/><stop offset="1" stop-color="#fff3e6"/></linearGradient>'
         '<linearGradient id="laser" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe3ee" stop-opacity="0"/><stop offset=".6" stop-color="#7fe3ee"/><stop offset="1" stop-color="#ffffff"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#gbg)"/>']
    # striped awning and marquee bulbs at the top
    p.append('<g>' + "".join(f'<path d="M{x},0 L{x + 40},0 L{x + 40},44 Q{x + 20},66 {x},44Z" fill="{"#ff2d55" if (x // 40) % 2 == 0 else "#fff3e6"}"/>' for x in range(-20, 660, 40)) + '</g>')
    p.append("".join(f'<circle cx="{x}" cy="78" r="5" fill="{"#ffd36a" if (x // 32) % 2 else "#ff9ddf"}" filter="url(#glow)"/>' for x in range(16, 640, 32)))
    # back row of targets on a rail, out of focus
    p.append('<rect x="-10" y="300" width="660" height="14" fill="#2a1a10"/><rect x="-10" y="300" width="660" height="3" fill="#ffd36a" opacity=".5"/>')
    for i, (x, col) in enumerate([(70, "#8a3cff"), (180, "#ff7a2a"), (470, "#2fb6ff"), (575, "#ff3fb8")]):
        p.append(f'<g filter="url(#dof2)" opacity=".85">{alien(x, 196, .78, col, f"ga{i}", rot=(-1) ** i * 4)}</g>')
    # the laser beam from the bottom right to the hit
    hx, hy = 382, 128
    p.append(f'<polygon points="700,470 724,430 {hx + 6},{hy - 4} {hx - 4},{hy + 6}" fill="url(#laser)" opacity=".85" filter="url(#glow)"/>')
    p.append(f'<line x1="712" y1="452" x2="{hx}" y2="{hy}" stroke="#ffffff" stroke-width="3" opacity=".9"/>')
    # the hero target, blown back
    p.append(f'<g filter="url(#shadow)">{alien(300, 236, 1.5, "#39d353", "gh", hit=True, rot=-12)}</g>')
    p.append(flash(hx, hy, 96, "#7fe3ee", .75))
    p.append(burst(hx, hy, 22, 22, 130, "#e9feff", seed=4, w=2.6))
    p.append(sparks(hx, hy, 46, 9, ["#ffffff", "#7fe3ee", "#ffd36a", "#ff9ddf"], 240))
    # crosshair
    p.append(f'<g stroke="#ff2d55" stroke-width="3.2" fill="none" filter="url(#glow)"><circle cx="{hx}" cy="{hy}" r="46"/><circle cx="{hx}" cy="{hy}" r="8"/>'
             f'<line x1="{hx - 70}" y1="{hy}" x2="{hx - 54}" y2="{hy}"/><line x1="{hx + 54}" y1="{hy}" x2="{hx + 70}" y2="{hy}"/>'
             f'<line x1="{hx}" y1="{hy - 70}" x2="{hx}" y2="{hy - 54}"/><line x1="{hx}" y1="{hy + 54}" x2="{hx}" y2="{hy + 70}"/></g>')
    # counter rail in the foreground
    p.append('<rect x="-10" y="392" width="660" height="60" fill="#3a1408"/><rect x="-10" y="392" width="660" height="6" fill="#ffb03a" opacity=".7"/>')
    p.append(cine(hx, hy, key="#bff6ff", strength=.72, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["shot-gallery"] = gallery()


# ---------- Tower Drop: looking up a towering stack at dusk, the next container swinging from the crane ----------
def tower():
    d = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0614"/><stop offset=".55" stop-color="#3a1240"/><stop offset=".85" stop-color="#d2502e"/><stop offset="1" stop-color="#ffb35a"/></linearGradient>'
         '<radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff1c4"/><stop offset=".35" stop-color="#ffb35a" stop-opacity=".8"/><stop offset="1" stop-color="#ff6a2a" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#sky)"/>', stars(17, 90, 200)]
    p.append('<circle cx="140" cy="430" r="220" fill="url(#sun)"/>')
    # searchlights crossing behind
    for (x, a, c) in [(80, -28, "#ffe2b0"), (560, 24, "#bff6ff")]:
        p.append(f'<polygon points="{x},440 {x - 30 + a * 6},-20 {x + 30 + a * 6},-20" fill="{c}" opacity=".12" filter="url(#soft)"/>')
    # city skyline
    rr = random.Random(8)
    sk = []
    x = -10
    while x < 650:
        w = rr.randint(26, 60); h = rr.randint(40, 140)
        sk.append(f'<rect x="{x}" y="{440 - h}" width="{w}" height="{h}" fill="#0b0710"/>')
        for wy in range(440 - h + 8, 440, 14):
            for wx in range(x + 5, x + w - 5, 10):
                if rr.random() < .35:
                    sk.append(f'<rect x="{wx}" y="{wy}" width="4" height="6" fill="#ffcf7a" opacity=".6"/>')
        x += w + rr.randint(2, 10)
    p.append(f'<g filter="url(#dof)">{"".join(sk)}</g>')
    # the stack, foreshortened upward (low camera): wide at the bottom, narrower above, a slight sway
    cols = [("#e0582f", "#7a2510"), ("#1f9aa8", "#0d4a52"), ("#d63345", "#6e1220"), ("#e8b627", "#7a5a08"), ("#3a6fe0", "#173a80"), ("#7a3fd0", "#3a1a70")]
    y = 440
    for i in range(6):
        h = 66 - i * 6; w = 380 - i * 34; sway = [0, 6, -4, 10, -8, 14][i]
        y -= h
        face, shade = cols[i]
        p.append(container(320 - w / 2 + sway, y, w, h, face, shade, f"GX-0{i + 1}", f"tc{i}"))
    top = y
    # crane cable and the swinging container with its motion arc
    hx, hy = 470, top - 84
    p.append(f'<line x1="560" y1="-10" x2="{hx}" y2="{hy - 28}" stroke="#c9d2dc" stroke-width="3"/>')
    p.append(f'<path d="M{hx - 120},{hy + 36} Q{hx - 40},{hy + 70} {hx + 60},{hy + 22}" fill="none" stroke="#ffe2b0" stroke-width="2.5" stroke-dasharray="6 7" opacity=".7"/>')
    for k, op in [(-34, .18), (-18, .32)]:
        p.append(f'<g opacity="{op}" transform="rotate({k / 2} {hx} {hy - 28}) translate({k} 6)">{container(hx - 95, hy, 190, 46, "#5cffb0", "#16704a", "GX-07", f"tg{abs(k)}")}</g>')
    p.append(f'<g filter="url(#shadow)" transform="rotate(-9 {hx} {hy - 28})">{container(hx - 95, hy, 190, 46, "#5cffb0", "#16704a", "GX-07", "tg0")}</g>')
    p.append(f'<rect x="{hx - 10}" y="{hy - 34}" width="20" height="14" rx="3" fill="#e9c27a"/>')
    # where it will land: a lit target ring on the top container
    p.append(f'<ellipse cx="330" cy="{top + 2}" rx="96" ry="12" fill="none" stroke="#fff1c4" stroke-width="3" filter="url(#glow)"/>')
    p.append(sparks(330, top + 2, 26, 21, ["#fff1c4", "#ffd36a"], 110, 4, 14, .1))
    p.append(cine(360, top + 10, key="#ffe2b0", strength=.66, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["tower-drop"] = tower()


# ---------- Solitaire Sprint: the winning cascade — cards bouncing off the felt, leaving trails ----------
def solitaire():
    d = ('<radialGradient id="felt" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1f9a5a"/><stop offset=".55" stop-color="#0c5a32"/><stop offset="1" stop-color="#031a0e"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#felt)"/>']
    rr = random.Random(9)
    for _ in range(900):
        p.append(f'<circle cx="{f(rr.uniform(0, 640))}" cy="{f(rr.uniform(0, 440))}" r=".7" fill="#000" opacity=".12"/>')
    # the four foundations, complete, glowing gold along the top left
    for i, (rank, suit, red) in enumerate([("K", "♠", False), ("K", "♥", True), ("K", "♣", False), ("K", "♦", True)]):
        x = 24 + i * 84
        p.append(f'<rect x="{x - 4}" y="14" width="80" height="110" rx="10" fill="#ffd36a" opacity=".3" filter="url(#bigglow)"/>')
        p.append(card(x, 18, rank, suit, red, 0, .48))
    # the win cascade: cards leave the foundations and bounce across the felt, stamping a trail of copies
    for (x0, vx, vy0, n, (rank, suit, red)) in [(300, 3.1, -2.0, 34, ("Q", "♦", True)), (216, 2.3, -3.5, 40, ("Q", "♣", False)), (132, 1.6, -1.0, 46, ("J", "♥", True))]:
        x, y, vy = x0, 18.0, vy0
        pts = []
        for t in range(n):
            x += vx * 4; vy += 1.0; y += vy * 4
            if y > 300: y = 300; vy = -vy * .74
            pts.append((x, y))
        for k, (px, py) in enumerate(pts[::2]):
            op = .1 + .9 * ((k + 1) / len(pts[::2])) ** 1.6
            p.append(f'<g opacity="{op:.2f}">{card(px, py, rank, suit, red, 0, .48)}</g>')
        p.append(sparkle(pts[-1][0] + 74, pts[-1][1] + 4, 14, "#fff3b0"))
    # the last card played, close to the camera
    p.append('<circle cx="560" cy="360" r="150" fill="#ffd36a" opacity=".16" filter="url(#bigglow)"/>')
    p.append(card(476, 236, "A", "♠", False, 14, 1.1))
    p.append(sparks(330, 300, 36, 31, ["#fff3b0", "#ffd36a", "#ffffff"], 300, 4, 12, .05))
    p.append(cine(330, 250, key="#fff1c8", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["solitaire-sprint"] = solitaire()


# ---------- Pinball: the ball smashes a bumper — an electric discharge in the middle of a multiball ----------
def pinball():
    d = ('<radialGradient id="pf" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#3a0f6a"/><stop offset=".6" stop-color="#160628"/><stop offset="1" stop-color="#050208"/></radialGradient>'
         '<radialGradient id="chromeBall" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#e8f1fb"/><stop offset=".45" stop-color="#7d8aa6"/><stop offset=".62" stop-color="#2a3150"/><stop offset=".8" stop-color="#ff4fa0"/><stop offset=".9" stop-color="#5a6a9a"/><stop offset="1" stop-color="#0c1022"/></radialGradient>'
         '<linearGradient id="flip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7cde0"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#pf)"/>', stars(22, 60, 440)]
    # neon ramps sweeping across, sharp pink and cyan
    for path, col in [("M-30,300 C80,120 240,60 400,70 S640,150 680,100", "#ff3fb8"), ("M680,330 C560,170 420,120 260,140", "#7fe3ee")]:
        p.append(f'<path d="{path}" fill="none" stroke="{col}" stroke-width="20" opacity=".35" filter="url(#bigglow)"/><path d="{path}" fill="none" stroke="{col}" stroke-width="6"/><path d="{path}" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".8"/>')
    # bumpers: the struck one blazing
    bumpers = [(230, 190, 40, "#ffb81f", False), (430, 176, 44, "#2f8fff", True), (330, 290, 38, "#e12d3f", False)]
    for (x, y, r, c, hit) in bumpers:
        g = f'<circle cx="{x + 4}" cy="{y + 9}" r="{r + 9}" fill="#000" opacity=".5" filter="url(#soft)"/><circle cx="{x}" cy="{y}" r="{r + 8}" fill="#141024"/>'
        g += f'<circle cx="{x}" cy="{y}" r="{r + (40 if hit else 18)}" fill="{c}" opacity="{.6 if hit else .3}" filter="url(#bigglow)"/>'
        g += sphere(x, y, r, c, f"bp{x}", shadow=False) + f'<circle cx="{x}" cy="{y}" r="{r * .55:.1f}" fill="#f2f6fb"/><g fill="{c}">{shape("star", x, y, r * .36)}</g>'
        p.append(g if hit else f'<g filter="url(#dof)">{g}</g>')
    # electric discharge from the struck bumper
    rr = random.Random(5)
    bx0, by0 = 430, 176
    for k in range(9):
        a = rr.uniform(0, 2 * math.pi); pts = [(bx0, by0)]
        for s in range(6):
            a += rr.uniform(-.6, .6); ln = rr.uniform(16, 30)
            pts.append((pts[-1][0] + ln * math.cos(a), pts[-1][1] + ln * math.sin(a)))
        dd = " ".join(f"{f(x)},{f(y)}" for x, y in pts)
        p.append(f'<polyline points="{dd}" fill="none" stroke="#bfe6ff" stroke-width="3" filter="url(#glow)" opacity=".9"/><polyline points="{dd}" fill="none" stroke="#ffffff" stroke-width="1.2"/>')
    p.append(flash(bx0, by0, 150, "#7fb8ff", .8))
    # multiball: three chrome balls, the hero right at the bumper
    for (mx, my, mr, blur) in [(180, 300, 22, True), (540, 260, 18, True), (372, 214, 34, False)]:
        g = f'<circle cx="{mx}" cy="{my}" r="{mr + 12}" fill="#ff6fd8" opacity=".3" filter="url(#bigglow)"/><circle cx="{mx}" cy="{my}" r="{mr}" fill="url(#chromeBall)"/>'
        g += f'<ellipse cx="{mx - mr * .3:.1f}" cy="{my - mr * .4:.1f}" rx="{mr * .3:.1f}" ry="{mr * .16:.1f}" fill="#fff" opacity=".85"/>'
        p.append(f'<g filter="url(#dof)">{g}</g>' if blur else g)
    p.append(trail([(372 - 70 + t * 7, 214 + 120 - t * 12) for t in range(11)], "#bdf6ff", 50, .45))
    p.append(sparks(400, 196, 50, 13, ["#ffffff", "#bfe6ff", "#ff9ddf"], 220))
    # flippers huge in the foreground
    p.append('<g filter="url(#shadow)"><path d="M-30,370 L240,424 Q258,432 242,444 L-30,444 Z" fill="url(#flip)" stroke="#e12d3f" stroke-width="7"/>'
             '<path d="M670,370 L470,416 Q452,422 462,440 L670,444 Z" fill="url(#flip)" stroke="#e12d3f" stroke-width="7"/></g>')
    p.append(cine(410, 190, key="#bfe6ff", strength=.62, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["pinball"] = pinball()


# ---------- Mine Grid: a mine erupts out of the grid — fireball, shockwave, tiles flung into the air ----------
def mine():
    d = ('<linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050506"/><stop offset="1" stop-color="#1a0d08"/></linearGradient>'
         '<radialGradient id="fire" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#fff1a8"/><stop offset=".45" stop-color="#ff8a1f"/><stop offset=".75" stop-color="#c02a0a" stop-opacity=".7"/><stop offset="1" stop-color="#300a04" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#msky)"/>']
    # tiles in perspective from a low camera
    hz, cxp = 150, 320
    def tile(c, r):
        def P(cc, rrr):
            z = 1 + rrr * .55
            return (cxp + (cc * 58) / (z * .62), hz + 300 * (1 - 1 / z))
        a, b, cc, dd = P(c, r), P(c + 1, r), P(c + 1, r + 1), P(c, r + 1)
        return f"{f(a[0])},{f(a[1])} {f(b[0])},{f(b[1])} {f(cc[0])},{f(cc[1])} {f(dd[0])},{f(dd[1])}"
    rr = random.Random(4)
    nums = {(-2, 2): "1", (-1, 2): "2", (-1, 3): "1", (0, 3): "3", (-3, 4): "1", (-2, 4): "1", (1, 4): "2", (-1, 5): "1"}
    for r in range(0, 9):
        for c in range(-8, 8):
            near = abs(c - 1) + abs(r - 2) <= 1
            fill = "#15161c" if (c + r) % 2 else "#1b1c24"
            p.append(f'<polygon points="{tile(c, r)}" fill="{fill}" stroke="#2fd3ff" stroke-opacity="{.5 if near else .22}" stroke-width="1.4"/>')
    for (c, r), n in nums.items():
        pts = tile(c, r).split(" ")
        xs = [float(q.split(",")[0]) for q in pts]; ys = [float(q.split(",")[1]) for q in pts]
        sz = (max(ys) - min(ys)) * 1.1
        p.append(f'<text x="{f(sum(xs) / 4)}" y="{f(sum(ys) / 4 + sz * .35)}" font-family="Arial Black, sans-serif" font-size="{f(sz)}" fill="{"#ff8a5c" if n == "3" else "#7fe3ee"}" text-anchor="middle" filter="url(#glow)">{n}</text>')
    # red flags
    for (c, r) in [(-5, 3), (3, 6)]:
        pts = tile(c, r).split(" "); x = float(pts[0].split(",")[0]) + 8; y = float(pts[3].split(",")[1])
        s = 1 + r * .1
        p.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x)}" y2="{f(y - 60 * s)}" stroke="#e6e9ef" stroke-width="{f(3 * s)}"/><polygon points="{f(x)},{f(y - 60 * s)} {f(x + 36 * s)},{f(y - 48 * s)} {f(x)},{f(y - 36 * s)}" fill="#ff2d3d"/>')
    # the eruption
    ex, ey = 392, 226
    p.append(f'<ellipse cx="{ex}" cy="{ey + 30}" rx="230" ry="44" fill="none" stroke="#ffb35a" stroke-width="6" opacity=".55" filter="url(#glow)"/>')
    p.append(f'<ellipse cx="{ex}" cy="{ey + 30}" rx="150" ry="28" fill="none" stroke="#fff1a8" stroke-width="4" opacity=".7" filter="url(#glow)"/>')
    p.append(f'<circle cx="{ex}" cy="{ey - 20}" r="160" fill="url(#fire)"/>')
    p.append(burst(ex, ey - 10, 40, 30, 300, "#fff1a8", seed=5, w=3.6))
    for k in range(16):
        a = rr.uniform(-math.pi, 0); d0 = rr.uniform(70, 230); s = rr.uniform(10, 26)
        x, y = ex + d0 * math.cos(a), ey - 20 + d0 * math.sin(a)
        p.append(f'<rect x="{f(x - s / 2)}" y="{f(y - s / 2)}" width="{f(s)}" height="{f(s)}" fill="#1b1c24" stroke="#2fd3ff" stroke-width="1.5" transform="rotate({rr.randint(0, 90)} {f(x)} {f(y)})"/>')
    p.append(sparks(ex, ey - 20, 80, 17, ["#fff1a8", "#ffb35a", "#ff6a2a", "#ffffff"], 300))
    p.append(sphere(ex - 6, ey - 34, 22, "#2a2a30", "mb", hi="#9aa3b5", shadow=False, gloss=.5))
    for a in range(8):
        aa = a * math.pi / 4
        p.append(f'<line x1="{f(ex - 6 + 22 * math.cos(aa))}" y1="{f(ey - 34 + 22 * math.sin(aa))}" x2="{f(ex - 6 + 32 * math.cos(aa))}" y2="{f(ey - 34 + 32 * math.sin(aa))}" stroke="#2a2a30" stroke-width="6" stroke-linecap="round"/>')
    p.append(cine(ex, ey - 20, key="#ffcf8a", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["mine-grid"] = mine()


# ---------- Slot: a real cabinet — curved reel drums with three symbols each, a chrome window, bulbs ----------
def slot():
    d = ('<linearGradient id="drum" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4f5e"/><stop offset=".16" stop-color="#d8dce6"/><stop offset=".5" stop-color="#ffffff"/><stop offset=".84" stop-color="#d8dce6"/><stop offset="1" stop-color="#4a4f5e"/></linearGradient>'
         '<linearGradient id="seven" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6dc"/><stop offset=".45" stop-color="#ff2d48"/><stop offset="1" stop-color="#7a0618"/></linearGradient>'
         '<linearGradient id="cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a0c14"/><stop offset=".5" stop-color="#2a0508"/><stop offset="1" stop-color="#120204"/></linearGradient>'
         '<linearGradient id="chromeF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdff"/><stop offset=".3" stop-color="#9aa3b5"/><stop offset=".55" stop-color="#4a5266"/><stop offset="1" stop-color="#e3e8f0"/></linearGradient>'
         '<linearGradient id="glassR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#cab)"/>']
    for i in range(24):
        x = 12 + i * 27
        p.append(f'<circle cx="{x}" cy="14" r="6" fill="{"#fff3b0" if i % 2 else "#ff4fa3"}" filter="url(#glow)"/><circle cx="{x}" cy="426" r="6" fill="{"#ff4fa3" if i % 2 else "#fff3b0"}" filter="url(#glow)"/>')
    # the reel window: chrome frame, three drums
    X0, Y0, W, H = 46, 48, 548, 344
    p.append(f'<rect x="{X0 - 14}" y="{Y0 - 14}" width="{W + 28}" height="{H + 28}" rx="20" fill="url(#chromeF)" filter="url(#shadow)"/>')
    p.append(f'<rect x="{X0}" y="{Y0}" width="{W}" height="{H}" rx="10" fill="#0a0a0d"/>')
    rw = (W - 24) / 3
    def symbol(kind, cx, cy, sy):
        # sy: vertical squash of the drum at this height (1 in the middle, smaller near the edges)
        t = f'transform="translate({f(cx)} {f(cy)}) scale(1 {sy:.2f}) translate({f(-cx)} {f(-cy)})"'
        if kind == "7":
            return f'<text {t} x="{f(cx)}" y="{f(cy + 40)}" font-family="Impact, Arial Black, sans-serif" font-size="118" text-anchor="middle" fill="url(#seven)" stroke="#2a0710" stroke-width="6" paint-order="stroke">7</text>'
        if kind == "BAR":
            return (f'<g {t}><rect x="{f(cx - 62)}" y="{f(cy - 24)}" width="124" height="48" rx="8" fill="#14143a" stroke="#ffd36a" stroke-width="3"/>'
                    f'<text x="{f(cx)}" y="{f(cy + 12)}" font-family="Arial Black, sans-serif" font-size="32" fill="#f4f2ff" text-anchor="middle">BAR</text></g>')
        if kind == "cherry":
            return (f'<g {t}><path d="M{f(cx - 12)},{f(cy - 4)} Q{f(cx)},{f(cy - 52)} {f(cx + 26)},{f(cy - 44)} M{f(cx + 18)},{f(cy - 2)} Q{f(cx + 16)},{f(cy - 34)} {f(cx + 26)},{f(cy - 44)}" stroke="#3f8a4a" stroke-width="5" fill="none"/>'
                    f'<circle cx="{f(cx - 14)}" cy="{f(cy + 10)}" r="22" fill="#e3153a"/><circle cx="{f(cx + 20)}" cy="{f(cy + 14)}" r="22" fill="#b80e2c"/><circle cx="{f(cx - 20)}" cy="{f(cy + 2)}" r="6" fill="#fff" opacity=".6"/></g>')
        return (f'<g {t}><polygon points="{f(cx)},{f(cy - 36)} {f(cx + 34)},{f(cy)} {f(cx)},{f(cy + 36)} {f(cx - 34)},{f(cy)}" fill="#33d1ff" stroke="#0a4a6a" stroke-width="3"/>'
                f'<polygon points="{f(cx)},{f(cy - 36)} {f(cx + 12)},{f(cy)} {f(cx)},{f(cy + 36)} {f(cx - 12)},{f(cy)}" fill="#bff3ff" opacity=".6"/></g>')
    strips = [["cherry", "7", "BAR"], ["BAR", "7", "gem"], ["gem", "7", "cherry"]]
    for i in range(3):
        x = X0 + 6 + i * (rw + 6)
        p.append(f'<rect x="{f(x)}" y="{Y0 + 6}" width="{f(rw)}" height="{H - 12}" rx="6" fill="url(#drum)"/>')
        for j, kind in enumerate(strips[i]):
            cy = Y0 + H / 2 + (j - 1) * 112
            p.append(symbol(kind, x + rw / 2, cy, 1 if j == 1 else .62))
        p.append(f'<rect x="{f(x)}" y="{Y0 + 6}" width="{f(rw)}" height="{H - 12}" rx="6" fill="url(#glassR)"/>')
        p.append(f'<rect x="{f(x)}" y="{Y0 + 6}" width="{f(rw)}" height="60" fill="#000" opacity=".35"/><rect x="{f(x)}" y="{Y0 + H - 66}" width="{f(rw)}" height="60" fill="#000" opacity=".35"/>')
    # win payline across the three 7s
    yl = Y0 + H / 2
    p.append(f'<rect x="{X0 - 10}" y="{f(yl - 3)}" width="{W + 20}" height="6" fill="#fff3b0" filter="url(#bigglow)"/><rect x="{X0 - 10}" y="{f(yl - 1)}" width="{W + 20}" height="2" fill="#ffffff"/>')
    p.append(f'<polygon points="{X0 - 30},{f(yl - 14)} {X0 - 8},{f(yl)} {X0 - 30},{f(yl + 14)}" fill="#fff3b0"/><polygon points="{X0 + W + 30},{f(yl - 14)} {X0 + W + 8},{f(yl)} {X0 + W + 30},{f(yl + 14)}" fill="#fff3b0"/>')
    # a few coins at the camera, and the glass reflection over the window
    r = random.Random(5)
    for q in range(6):
        x, y, s = r.uniform(-10, 650), r.uniform(408, 470), r.uniform(1.0, 1.7)
        p.append(f'<g filter="url(#dof)" transform="rotate({r.randint(-50, 50)} {f(x)} {f(y)})"><ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(14 * s)}" ry="{f(22 * s)}" fill="url(#gold)" stroke="#8a5200" stroke-width="2"/></g>')
    p.append(f'<polygon points="{X0},{Y0} {X0 + 180},{Y0} {X0 + 60},{Y0 + H} {X0},{Y0 + H}" fill="#fff" opacity=".05"/>')
    p.append(sparkle(X0 + rw / 2 + 50, yl - 50, 16, "#fff3b0") + sparkle(X0 + W - 70, yl + 40, 12, "#fff3b0"))
    p.append(cine(320, yl, key="#fff1c8", strength=.5, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["galactic-slot"] = slot()


# ---------- Darts: a dark pub, one spotlight, the board at an angle and a dart driving into the bull ----------
def darts():
    cx, cy, R = 350, 218, 230
    d = ('<radialGradient id="pubbg" cx="55%" cy="40%" r="75%"><stop offset="0" stop-color="#2a0a0c"/><stop offset=".55" stop-color="#0e0506"/><stop offset="1" stop-color="#030203"/></radialGradient>'
         '<linearGradient id="beamD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1c8" stop-opacity=".42"/><stop offset="1" stop-color="#fff1c8" stop-opacity="0"/></linearGradient>'
         '<linearGradient id="fl1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff6ff"/><stop offset="1" stop-color="#2f5bff"/></linearGradient>'
         '<linearGradient id="fl2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#ff2a2a"/></linearGradient>'
         '<linearGradient id="barrel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5468"/><stop offset=".4" stop-color="#f0f4fa"/><stop offset="1" stop-color="#2a3040"/></linearGradient>'
         '<radialGradient id="boardLight" cx="45%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#pubbg)"/>', bokeh(19, ["#ff3a2a", "#ffcf7a", "#13914c"], 14, 440, 14, 50, (.12, .3))]
    # the spotlight cone from above onto the board, with dust in it
    p.append(f'<polygon points="{cx - 40},-20 {cx + 40},-20 {cx + 300},460 {cx - 300},460" fill="url(#beamD)" filter="url(#soft)"/>')
    rr = random.Random(2)
    for _ in range(60):
        y = rr.uniform(0, 440); half = 40 + (y + 20) * .56
        p.append(f'<circle cx="{f(cx + rr.uniform(-half, half))}" cy="{f(y)}" r="{rr.choice([.8, 1.1, 1.5])}" fill="#fff1c8" opacity="{rr.uniform(.2, .7):.2f}"/>')
    # the board, turned a little away (fake perspective), deep crimson and emerald
    order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
    def ring(r0, r1, cA, cB):
        out = []
        for i in range(20):
            a0 = math.radians(-99 + i * 18); a1 = a0 + math.radians(18)
            pts = [(cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)), (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)), (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1)), (cx + r0 * math.cos(a0), cy + r0 * math.sin(a0))]
            out.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for x, y in pts)}" fill="{cA if i % 2 == 0 else cB}"/>')
        return "".join(out)
    b = [f'<circle cx="{cx}" cy="{cy}" r="{R + 44}" fill="#0c0b0d"/>', ring(R * .66, R, "#121214", "#e9dcbc"), ring(R * .9, R, "#e0182e", "#12a552"),
         ring(R * .14, R * .66, "#121214", "#e9dcbc"), ring(R * .56, R * .66, "#e0182e", "#12a552"),
         f'<circle cx="{cx}" cy="{cy}" r="{R * .14}" fill="#12a552"/><circle cx="{cx}" cy="{cy}" r="{R * .065}" fill="#e0182e"/>']
    for rr2 in (R * .065, R * .14, R * .56, R * .66, R * .9, R):
        b.append(f'<circle cx="{cx}" cy="{cy}" r="{f(rr2)}" fill="none" stroke="#c9d2dc" stroke-width="1.6"/>')
    for i, n in enumerate(order):
        a = math.radians(-90 + i * 18)
        b.append(f'<text x="{f(cx + (R + 24) * math.cos(a))}" y="{f(cy + (R + 24) * math.sin(a) + 8)}" font-family="Arial Black, sans-serif" font-size="22" fill="#f2f4f8" text-anchor="middle">{n}</text>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 44}" fill="url(#boardLight)"/>')
    p.append(f'<g transform="translate({cx} {cy}) rotate(-10) scale(.86 1) skewY(-6) translate({-cx} {-cy})" filter="url(#shadow)">{"".join(b)}</g>')

    def dart(tx, ty, ang, fl, s, blur=False):
        c, sn = math.cos(ang), math.sin(ang)
        P = lambda dd, w=0: (tx + c * dd - sn * w, ty + sn * dd + c * w)
        tip, b0, b1, sh0, sh1, f0 = P(0), P(30 * s), P(110 * s), P(110 * s), P(190 * s), P(170 * s)
        fa, fb, fc = P(260 * s, 52 * s), P(260 * s, -52 * s), P(225 * s)
        g = f'<g filter="url({"#dof2" if blur else "#shadow"})">'
        g += f'<line x1="{f(tip[0])}" y1="{f(tip[1])}" x2="{f(b0[0])}" y2="{f(b0[1])}" stroke="#c9d2dc" stroke-width="{f(4 * s)}" stroke-linecap="round"/>'
        g += f'<line x1="{f(b0[0])}" y1="{f(b0[1])}" x2="{f(b1[0])}" y2="{f(b1[1])}" stroke="url(#barrel)" stroke-width="{f(16 * s)}" stroke-linecap="round"/>'
        g += f'<line x1="{f(sh0[0])}" y1="{f(sh0[1])}" x2="{f(sh1[0])}" y2="{f(sh1[1])}" stroke="#1d2433" stroke-width="{f(8 * s)}" stroke-linecap="round"/>'
        g += f'<polygon points="{f(f0[0])},{f(f0[1])} {f(fa[0])},{f(fa[1])} {f(fc[0])},{f(fc[1])}" fill="url(#{fl})"/><polygon points="{f(f0[0])},{f(f0[1])} {f(fb[0])},{f(fb[1])} {f(fc[0])},{f(fc[1])}" fill="url(#{fl})" opacity=".75"/></g>'
        return g
    # the hero dart driving into the bull, with an impact ring and sparks
    p.append(flash(cx, cy, 80, "#ff6a3a", .55))
    p.append(f'<ellipse cx="{cx}" cy="{cy}" rx="44" ry="30" fill="none" stroke="#fff1c8" stroke-width="3" opacity=".8" filter="url(#glow)"/>')
    p.append(sparks(cx, cy, 40, 11, ["#fff1c8", "#ffcf7a", "#ff6a3a"], 160, 4, 14, .1))
    p.append(dart(cx + 2, cy - 2, math.radians(-38), "fl2", 1.05))
    # two more: one in the treble 20, one close to the camera, out of focus
    p.append(dart(cx - 30, cy - R * .6, math.radians(-70), "fl1", .78))
    p.append(f'<g filter="url(#dof)">{dart(196, 318, math.radians(150), "fl1", 1.5)}</g>')
    p.append(cine(cx, cy, key="#ffd9a0", strength=.7, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["darts"] = darts()
covers["reaction-test"] = covers["shot-gallery"]


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    import re
    def black(m):
        h = m.group(1); r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        # Dark navy or teal (blue above red, green not below red, v140: not a green felt): same lightness in neutral black.
        if max(r, g, b) > 130 or b < r + 6 or g < r - 2 or g > b + 12 or max(r, g, b) - min(r, g, b) < 8:
            return m.group(0)
        y = round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 0.82 + 1)
        return "#%02x%02x%02x" % (y, y, min(255, round(y * 1.06 + 1)))
    for name, body in covers.items():
        open(os.path.join(OUT, f"{name}.svg"), "w").write(re.sub(r"#([0-9a-fA-F]{6})\b", black, body))
    print("wrote", len(covers), "covers to", OUT)
