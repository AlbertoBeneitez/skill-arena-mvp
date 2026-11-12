"""Catalogue covers v3 (original art): full-bleed 16:11 close-ups that fill the card (640×440 SVG source).

v138: no anamorphic lens streak (the thin horizontal flare read as a cut across the card), backgrounds and shadows
in the app's black instead of navy (the same lightness, no blue cast; violet and warm game colours stay), the
Pinball cover shows a multiball (V9) and the Roulette ball is mid-throw on the track (V16).

v140: posters of each game's peak moment (strike, laser hit, eruption, win cascade, bumper discharge, bull) for
Bowling, Shot Gallery, Tower Drop, Solitaire, Pinball, Mine Grid, Slot and Darts; a darker Roulette room; the
Galoku corner box large in the centre; rendered at 1600×1100.

v141: Tower Drop closer with the container lowered onto the tower; Pinball, Solitaire and Mine Grid back to the
v138 scenes, now caught mid-action (flipper shot, the ace flying to its pile, the shockwave); finer Orb Burst and
Stack Shift details (rim light, bevels, falling streaks, shards).

v143: Stack built of textured, machined modules (brushed sides, woven top plates, bevels, grooves and rivets); the
Solitaire cover is a tableau staircase alternating red and black with the 6♦ landing on it; Shot Gallery in Hangar 7
with the game's crew drawn in detail (mantis struck by the laser, kraken, wraith, drone, golem, slime).

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
def billiards(sparks=True):
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
    p.append("<!--rack-->")
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
    p.append("<!--fg-->")
    p.append(f'<g filter="url(#dof2)">{sphere(70, 430, 92, "#e12d3f", "bf1", shade="#2a0508", shadow=False)}{sphere(590, 452, 80, "#ffd23f", "bf2", shade="#3a2a00", shadow=False)}</g>')
    p.append(f'<g filter="url(#dof)"><line x1="330" y1="620" x2="{f(ix)}" y2="{f(iy + 70)}" stroke="url(#bcue)" stroke-width="30" stroke-linecap="round"/></g>')
    if sparks:
        p.append(sparkle(ix + 34, iy - 30, 13, "#fff6d6") + sparkle(ix - cr * .4, iy - cr * .5, 9, "#ffffff"))
    return svg("".join(p), extra_defs=d)
covers["billiards"] = billiards()


def billiards_rack():
    """v178 · The opening rack, as the owner asked: fifteen balls touching in the characteristic triangle (1 at the apex,
    8 in the middle of the third row), the cue ball waiting in front and the cue lined up behind it, under the same lamp."""
    src = billiards(sparks=False)
    start, end = src.index("<!--rack-->"), src.index("<!--fg-->")
    FY, NY, FW, NW = 156, 520, 250, 560
    def P(u, v):
        y = FY + (NY - FY) * v
        w = FW + (NW - FW) * v
        return 320 + u * w, y, w / NW
    cols = {1: "#ffd23f", 2: "#2f6bff", 3: "#e12d3f", 4: "#7b3cff", 5: "#ff7a1f", 6: "#159a52", 7: "#8a1c2a", 8: "#111111"}
    rows = [[1], [9, 2], [10, 8, 3], [4, 14, 7, 11], [12, 6, 15, 13, 5]]
    du, dv, av = 72 / NW * 1.01, .056, .30   # touching across; rows foreshortened in depth; set back so cards show it
    q = []
    balls = []
    for row, nums in enumerate(rows):
        for i, n in enumerate(nums):
            balls.append((av - row * dv, (i - row / 2) * du, n))
    # One soft shadow under the whole rack, then the balls back to front.
    bx0, by0, _ = P(0, av - 4 * dv)
    bx1, by1, s1 = P(0, av)
    q.append(f'<ellipse cx="{f(bx1)}" cy="{f((by0 + by1) / 2 + 26 * s1)}" rx="{f(150 * s1)}" ry="{f((by1 - by0) / 2 + 30 * s1)}" fill="#000" opacity=".35" filter="url(#soft)"/>')
    for v, u, n in sorted(balls):
        x, y, sc = P(u, v)
        r = 36 * sc
        q.append(f'<ellipse cx="{f(x + r * .15)}" cy="{f(y + r * .82)}" rx="{f(r * .9)}" ry="{f(r * .26)}" fill="#000" opacity=".5"/>')
        q.append(sphere(x, y, r, cols[n if n <= 8 else n - 8], f"rk{n}", shade="#050505", shadow=False))
        if n > 8:
            q.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r * .97)}" ry="{f(r * .45)}" fill="#f6f2e6" opacity=".85"/>')
        q.append(f'<circle cx="{f(x - r * .1)}" cy="{f(y - r * .05)}" r="{f(r * .38)}" fill="#fbf8ef"/><text x="{f(x - r * .1)}" y="{f(y + r * .13)}" font-family="Arial Black, sans-serif" font-size="{f(r * .44)}" text-anchor="middle" fill="#111">{n}</text>')
    # The cue ball on the head spot, the cue drawn back behind it, aimed at the apex.
    cx, cy, cs = P(0, .54)
    cr = 36 * cs
    q.append(f'<ellipse cx="{f(cx + cr * .15)}" cy="{f(cy + cr * .82)}" rx="{f(cr * .9)}" ry="{f(cr * .26)}" fill="#000" opacity=".5"/>')
    q.append(sphere(cx, cy, cr, "#f6f3ea", "rkcb", shade="#7f7b70", shadow=False, gloss=.8))
    body = "".join(q)
    out = src[:start] + body + src[end:]
    # Cue: pulled back, its tip a hand's width from the cue ball.
    a = out.index('<g filter="url(#dof)"><line')
    b = out.index("</g>", a) + 4
    out = out[:a] + f'<g filter="url(#dof)"><line x1="338" y1="640" x2="{f(cx + 2)}" y2="{f(cy + cr + 26)}" stroke="url(#bcue)" stroke-width="30" stroke-linecap="round"/></g>' + out[b:]
    return out
covers["billiards"] = billiards_rack()


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
         '<linearGradient id="dPoint" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b626e"/><stop offset=".45" stop-color="#ffffff"/><stop offset="1" stop-color="#4b5260"/></linearGradient>'
         '<linearGradient id="dBarrel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2127"/><stop offset=".3" stop-color="#9aa3b0"/><stop offset=".45" stop-color="#f6f8fb"/><stop offset=".62" stop-color="#7d8592"/><stop offset="1" stop-color="#15181d"/></linearGradient>'
         '<linearGradient id="dShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4350"/><stop offset=".35" stop-color="#e9eef5"/><stop offset="1" stop-color="#2b313b"/></linearGradient>'
         '<filter id="sisal" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="5"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.05"/></filter>'
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
    # v162: pressed-sisal grain, the radial wires of the spider (shadow + lit edge) and the wire number ring
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="#000" filter="url(#sisal)" opacity=".55"/>')
    for i in range(20):
        a0 = math.radians(-99 + i * 18)
        for (dx, dy2, col, wdt) in ((1.2, 1.6, "#000", 2.4), (0, 0, "#c9d2dc", 1.5), (-.5, -.6, "#ffffff", .6)):
            b.append(f'<line x1="{f(cx + dx + R * .14 * math.cos(a0))}" y1="{f(cy + dy2 + R * .14 * math.sin(a0))}" x2="{f(cx + dx + R * math.cos(a0))}" y2="{f(cy + dy2 + R * math.sin(a0))}" stroke="{col}" stroke-width="{wdt}" opacity="{.45 if col == "#000" else .9}"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 7}" fill="none" stroke="#c9d2dc" stroke-width="1.4" opacity=".8"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R + 44}" fill="url(#boardLight)"/>')
    p.append(f'<g transform="translate({cx} {cy}) rotate(-10) scale(.86 1) skewY(-6) translate({-cx} {-cy})" filter="url(#shadow)">{"".join(b)}</g>')

    def dart(tx, ty, ang, fl, s, blur=False):
        # v162: a real steel-tip dart: needle point, knurled tungsten barrel, ringed shaft, two flights with a stripe
        k = f"{int(tx)}_{int(ty)}"
        g = f'<g filter="url({"#dof2" if blur else "#shadow"})" transform="translate({f(tx)} {f(ty)}) rotate({math.degrees(ang):.1f}) scale({s})">'
        g += '<polygon points="0,0 34,-2.6 34,2.6" fill="url(#dPoint)"/>'
        g += '<path d="M34,-4 C44,-9 52,-9.5 60,-9.5 L104,-8.6 C109,-8.4 112,-6 112,-4 L112,4 C112,6 109,8.4 104,8.6 L60,9.5 C52,9.5 44,9 34,4 Z" fill="url(#dBarrel)"/>'
        g += "".join(f'<line x1="{x0}" y1="-9.4" x2="{x0}" y2="9.4" stroke="#0a0c10" stroke-width="1.6" opacity=".7"/><line x1="{x0 + 1.6}" y1="-9" x2="{x0 + 1.6}" y2="9" stroke="#ffffff" stroke-width=".8" opacity=".35"/>' for x0 in range(62, 102, 5))
        g += f'<rect x="54" y="-9.6" width="4" height="19.2" fill="url(#{fl})"/>'
        g += '<rect x="112" y="-3.8" width="62" height="7.6" rx="2" fill="url(#dShaft)"/>'
        g += "".join(f'<rect x="{x0}" y="-3.8" width="2" height="7.6" fill="#0d1118" opacity=".6"/>' for x0 in (124, 138, 152, 166))
        wing = "M170,-2 L206,-30 Q246,-60 268,-50 L264,-3 Z"
        g += f'<clipPath id="wc{k}"><path d="{wing}"/></clipPath><clipPath id="wd{k}"><path d="{wing}" transform="scale(1 -1)"/></clipPath>'
        for (clip, tr, op) in ((f"wc{k}", "", 1), (f"wd{k}", ' transform="scale(1 -1)"', .78)):
            g += (f'<g opacity="{op}"><path d="{wing}"{tr} fill="url(#{fl})" stroke="#06080e" stroke-width="1.6"/>'
                  f'<g clip-path="url(#{clip})"><polygon points="190,{"-70" if not tr else "70"} 214,{"-70" if not tr else "70"} 200,0 176,0" fill="#ffffff" opacity=".85"/>'
                  f'<polygon points="226,{"-70" if not tr else "70"} 240,{"-70" if not tr else "70"} 226,0 212,0" fill="#0b0f18" opacity=".55"/></g></g>')
        g += '<rect x="168" y="-1.4" width="98" height="2.8" fill="#0b0f18" opacity=".85"/></g>'
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


# ---------- v141 ----------
def motion_ghosts(svg_fn, pts, n_op=(.08, .4)):
    """Copies of a drawing along its recent path, fading towards the oldest (a camera smear of fast movement)."""
    out = []
    for k, (x, y) in enumerate(pts):
        op = n_op[0] + (n_op[1] - n_op[0]) * k / max(1, len(pts) - 1)
        out.append(f'<g opacity="{op:.2f}">{svg_fn(x, y)}</g>')
    return "".join(out)


def speed_lines(pts_dir, n, seed, col, spread=40, lmin=30, lmax=90, op=(.2, .6), w=(1.2, 2.6)):
    """Thin streaks parallel to a direction of travel; pts_dir = (x, y, dx, dy) at the moving object."""
    x0, y0, dx, dy = pts_dir
    L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    r = random.Random(seed)
    out = []
    for _ in range(n):
        o = r.uniform(-spread, spread); back = r.uniform(10, 140); l = r.uniform(lmin, lmax)
        sx, sy = x0 + nx * o - ux * back, y0 + ny * o - uy * back
        out.append(f'<line x1="{f(sx)}" y1="{f(sy)}" x2="{f(sx - ux * l)}" y2="{f(sy - uy * l)}" stroke="{col}" stroke-width="{f(r.uniform(*w))}" stroke-linecap="round" opacity="{r.uniform(*op):.2f}"/>')
    return f'<g filter="url(#glow)">{"".join(out)}</g>'


# ---------- Tower Drop: closer — the next container is coming down onto the tower, about to lock ----------
def tower():
    d = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0614"/><stop offset=".55" stop-color="#3a1240"/><stop offset=".85" stop-color="#d2502e"/><stop offset="1" stop-color="#ffb35a"/></linearGradient>'
         '<radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff1c4"/><stop offset=".35" stop-color="#ffb35a" stop-opacity=".8"/><stop offset="1" stop-color="#ff6a2a" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#sky)"/>', stars(17, 90, 200)]
    p.append('<circle cx="120" cy="440" r="240" fill="url(#sun)"/>')
    for (x, a, c) in [(70, -28, "#ffe2b0"), (580, 24, "#bff6ff")]:
        p.append(f'<polygon points="{x},440 {x - 30 + a * 6},-20 {x + 30 + a * 6},-20" fill="{c}" opacity=".12" filter="url(#soft)"/>')
    rr = random.Random(8)
    sk = []
    x = -10
    while x < 650:
        w = rr.randint(26, 60); h = rr.randint(40, 150)
        sk.append(f'<rect x="{x}" y="{440 - h}" width="{w}" height="{h}" fill="#0b0710"/>')
        for wy in range(440 - h + 8, 440, 14):
            for wx in range(x + 5, x + w - 5, 10):
                if rr.random() < .35:
                    sk.append(f'<rect x="{wx}" y="{wy}" width="4" height="6" fill="#ffcf7a" opacity=".6"/>')
        x += w + rr.randint(2, 10)
    p.append(f'<g filter="url(#dof2)">{"".join(sk)}</g>')
    # everything in the foreground is 1.3× closer than v140, pivoting on the top of the tower
    g = ['<g transform="translate(330 250) scale(1.3) translate(-330 -196)">']
    cols = [("#e0582f", "#7a2510"), ("#1f9aa8", "#0d4a52"), ("#d63345", "#6e1220"), ("#e8b627", "#7a5a08"), ("#3a6fe0", "#173a80"), ("#7a3fd0", "#3a1a70")]
    y = 440
    for i in range(6):
        h = 66 - i * 6; w = 380 - i * 34; sway = [0, 6, -4, 10, -8, 14][i]
        y -= h
        g.append(container(320 - w / 2 + sway, y, w, h, face=cols[i][0], shade=cols[i][1], label=f"GX-0{i + 1}", idn=f"tc{i}"))
    top = y
    # the next container, lowered right over the tower: a short swing still settling
    hx, hy = 372, top - 66
    g.append(f'<line x1="452" y1="-60" x2="{hx}" y2="{hy - 28}" stroke="#c9d2dc" stroke-width="2.6"/>')
    for k, op in [(-30, .14), (-16, .28)]:
        g.append(f'<g opacity="{op}" transform="rotate({k / 3} {hx} {hy - 28}) translate({k} 2)">{container(hx - 95, hy, 190, 46, "#5cffb0", "#16704a", "GX-07", f"tg{abs(k)}")}</g>')
    g.append(f'<g filter="url(#shadow)" transform="rotate(-4 {hx} {hy - 28})">{container(hx - 95, hy, 190, 46, "#5cffb0", "#16704a", "GX-07", "tg0")}</g>')
    g.append(f'<rect x="{hx - 10}" y="{hy - 34}" width="20" height="14" rx="3" fill="#e9c27a"/>')
    # the gap closing: its shadow on the roof below and the lit landing frame
    g.append(f'<ellipse cx="{hx - 6}" cy="{top + 4}" rx="98" ry="9" fill="#000" opacity=".4" filter="url(#soft)"/>')
    g.append(f'<rect x="{hx - 101}" y="{top - 3}" width="190" height="6" rx="3" fill="none" stroke="#fff1c4" stroke-width="2.4" filter="url(#glow)"/>')
    g.append(sparks(hx - 6, top, 22, 21, ["#fff1c4", "#ffd36a"], 90, 3, 11, .1))
    g.append('</g>')
    p += g
    p.append(cine(360, 170, key="#ffe2b0", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["tower-drop"] = tower()


# ---------- Pinball: the right flipper has just fired — the ball rockets up the table towards the lit bumper ----------
def pinball():
    d = ('<linearGradient id="pf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f4a"/><stop offset=".6" stop-color="#2a1a6c"/><stop offset="1" stop-color="#0a0f2e"/></linearGradient>'
         '<linearGradient id="ramp" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9fe8ff" stop-opacity=".2"/><stop offset=".5" stop-color="#9fe8ff" stop-opacity=".85"/><stop offset="1" stop-color="#9fe8ff" stop-opacity=".2"/></linearGradient>'
         '<radialGradient id="chromeBall" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".18" stop-color="#e8f1fb"/><stop offset=".45" stop-color="#7d8aa6"/><stop offset=".62" stop-color="#2a3150"/><stop offset=".8" stop-color="#ff4fa0"/><stop offset=".9" stop-color="#5a6a9a"/><stop offset="1" stop-color="#0c1022"/></radialGradient>'
         '<linearGradient id="flip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c7cde0"/></linearGradient>'
         '<linearGradient id="backbox" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".5" stop-color="#ffb03a"/><stop offset="1" stop-color="#7fe3ee"/></linearGradient>'
         '<linearGradient id="streak" x1="1" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#bdf6ff" stop-opacity="0"/><stop offset=".7" stop-color="#bdf6ff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".95"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#pf)"/>', stars(22, 50, 200)]
    for k in range(-7, 8):
        p.append(f'<line x1="{320 + k * 26}" y1="60" x2="{320 + k * 120}" y2="440" stroke="#9fe8ff" stroke-opacity="{.05 if k % 2 else .1}" stroke-width="1.5"/>')
    p.append('<g filter="url(#dof2)"><rect x="150" y="-30" width="340" height="70" rx="12" fill="url(#backbox)" opacity=".55"/>'
             '<rect x="210" y="4" width="220" height="38" rx="6" fill="#120700" stroke="#ff8a1f" stroke-width="3"/>'
             '<text x="320" y="33" font-family="Menlo, monospace" font-size="26" font-weight="900" fill="#ffb03a" text-anchor="middle">2.450.000</text></g>')
    for (x, y, r, c) in [(150, 150, 170, "rgba(255,61,154,.28)"), (520, 210, 190, "rgba(30,170,220,.26)")]:
        p.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" filter="url(#soft)"/>')
    ramps = ["M-20,250 C90,90 250,60 380,80 S600,150 660,110", "M660,280 C560,150 430,120 300,130"]
    for path in ramps:
        p.append(f'<g filter="url(#dof)"><path d="{path}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="26" transform="translate(5 8)"/><path d="{path}" fill="none" stroke="url(#ramp)" stroke-width="22"/>'
                 f'<path d="{path}" fill="none" stroke="#e9f2fb" stroke-width="2.5" transform="translate(0 -10)"/><path d="{path}" fill="none" stroke="#e9f2fb" stroke-width="2.5" transform="translate(0 10)"/></g>')
    # light chasing along the ramps (the game's ramp lamps running)
    for path, off in [(ramps[0], 0), (ramps[1], 40)]:
        p.append(f'<path d="{path}" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-dasharray="3 26" stroke-dashoffset="{off}" opacity=".85" filter="url(#glow)"/>')
    # bumpers: the yellow one is where the ball is heading, already lit and pulsing
    for (x, y, r, c, lit) in [(220, 178, 34, "#e12d3f", False), (330, 150, 30, "#ffb81f", True), (430, 186, 36, "#2f8fff", False)]:
        g = f'<circle cx="{x + 4}" cy="{y + 8}" r="{r + 8}" fill="#000" opacity=".45" filter="url(#soft)"/><circle cx="{x}" cy="{y}" r="{r + 7}" fill="#141a2c"/>'
        g += f'<circle cx="{x}" cy="{y}" r="{r + (44 if lit else 22)}" fill="{c}" opacity="{.5 if lit else .25}" filter="url(#bigglow)"/>'
        g += sphere(x, y, r, c, f"bp{x}", shadow=False) + f'<circle cx="{x}" cy="{y}" r="{r * .55:.1f}" fill="#f2f6fb"/><g fill="{c}">{shape("star", x, y, r * .36)}</g>'
        if lit:
            g += "".join(f'<circle cx="{x}" cy="{y}" r="{r + 14 + k * 12}" fill="none" stroke="#ffe08a" stroke-width="{2.4 - k * .6:.1f}" opacity="{.7 - k * .2:.2f}"/>' for k in range(3))
        p.append(f'<g filter="url(#dof)">{g}</g>')
    # inlane guides, left flipper resting, right flipper snapped up (it just hit the ball)
    p.append('<path d="M-10,300 L120,352" stroke="#d6dde6" stroke-width="6" stroke-linecap="round"/><path d="M650,300 L560,340" stroke="#d6dde6" stroke-width="6" stroke-linecap="round"/>')
    p.append('<g filter="url(#shadow)"><path d="M-30,352 L250,420 Q268,428 252,440 L-30,440 Z" fill="url(#flip)" stroke="#e12d3f" stroke-width="7"/>'
             '<g transform="rotate(26 652 404)"><path d="M670,352 L470,404 Q452,410 462,428 L670,440 Z" fill="url(#flip)" stroke="#e12d3f" stroke-width="7"/></g></g>')
    # the flipper's swing: two faint arcs behind it
    p.append('<path d="M478,418 Q470,380 488,344" fill="none" stroke="#ffffff" stroke-width="3" opacity=".35"/><path d="M500,424 Q490,388 506,352" fill="none" stroke="#ffffff" stroke-width="2" opacity=".2"/>')
    # impact at the flipper tip
    tipx, tipy = 486, 352
    p.append(flash(tipx, tipy, 60, "#ff9ddf", .7))
    p.append(sparks(tipx, tipy, 26, 4, ["#ffffff", "#ff9ddf", "#ffd36a"], 70, 4, 14, .05))
    # multiball: two more balls in play further up the table, out of focus, with their own short trails
    for (mx, my, mr, dx, dy) in [(262, 236, 22, -18, 30), (552, 214, 18, 22, 26)]:
        p.append(f'<g filter="url(#dof)">{trail([(mx + dx * (1 - t / 6), my + dy * (1 - t / 6)) for t in range(7)], "#ffc6ee", 26, .3)}'
                 f'<circle cx="{mx}" cy="{my}" r="{mr + 14}" fill="#ff6fd8" opacity=".28" filter="url(#bigglow)"/><circle cx="{mx}" cy="{my}" r="{mr}" fill="url(#chromeBall)"/>'
                 f'<ellipse cx="{mx - mr * .3:.1f}" cy="{my - mr * .4:.1f}" rx="{mr * .3:.1f}" ry="{mr * .16:.1f}" fill="#fff" opacity=".8"/></g>')
    # hero ball: off the flipper tip, flying up-left at the yellow bumper; a tapered streak and motion ghosts
    bx, by, br = 398, 262, 44
    path = [((1 - t) ** 2 * tipx + 2 * (1 - t) * t * (bx + 74) + t * t * bx, (1 - t) ** 2 * tipy + 2 * (1 - t) * t * (by + 70) + t * t * by) for t in [q / 14 for q in range(15)]]
    p.append(f'<g filter="url(#glow)">{trail(path, "#bdf6ff", 78, .5)}</g>')
    p.append(speed_lines((bx, by, -0.9, -1.0), 14, 6, "#bdf6ff", 46, 30, 80))

    def ball(x, y):
        return f'<circle cx="{f(x)}" cy="{f(y)}" r="{br}" fill="url(#chromeBall)"/>'
    p.append(motion_ghosts(ball, [(bx + 56, by + 62), (bx + 36, by + 40), (bx + 17, by + 19)], (.1, .3)))
    p.append(f'<circle cx="{bx}" cy="{by}" r="{br + 12}" fill="#7fe3ee" opacity=".26" filter="url(#bigglow)"/>')
    p.append(ball(bx, by))
    p.append(f'<path d="M{bx - br * .8},{by + br * .2} A{br},{br * .55} 0 0 0 {bx + br * .8},{by + br * .2}" fill="none" stroke="#7fe3ee" stroke-opacity=".7" stroke-width="3"/>')
    p.append(f'<path d="M{bx + br * .2},{by - br * .95} A{br},{br} 0 0 1 {bx + br * .95},{by - br * .1}" fill="none" stroke="#ffd36a" stroke-opacity=".75" stroke-width="3"/>')
    p.append(f'<ellipse cx="{bx - br * .32}" cy="{by - br * .42}" rx="{br * .3}" ry="{br * .16}" fill="#fff" opacity=".9" transform="rotate(-28 {bx - br * .32} {by - br * .42})"/>')
    # playfield lamps, chasing
    for i in range(7):
        on = i in (2, 3, 4)
        p.append(f'<circle cx="{70 + i * 34}" cy="420" r="7" fill="{"#5cffb0" if on else "#24463a"}" filter="url(#glow)"/>')
    p.append(sparkle(bx - 22, by - 34, 18, "#ffffff"))
    p.append(cine(bx - 20, by - 40, key="#bdf6ff", flare="#9fefff", beam=(330, -40, 140), strength=.74, flare_w=320))
    return svg("".join(p), extra_defs=d)
covers["pinball"] = pinball()


# ---------- Solitaire Sprint: the race to the foundations — the ace flies off the deck to the empty pile ----------
def solitaire():
    d = ('<radialGradient id="felt" cx="58%" cy="42%" r="78%"><stop offset="0" stop-color="#1fae7a"/><stop offset=".45" stop-color="#0d6448"/><stop offset="1" stop-color="#021510"/></radialGradient>'
         '<radialGradient id="lamp" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff4d6" stop-opacity=".5"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a14"/><stop offset=".5" stop-color="#8a5a30"/><stop offset="1" stop-color="#2a160a"/></linearGradient>'
         '<linearGradient id="back" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a1a2e"/><stop offset="1" stop-color="#2e0812"/></linearGradient>'
         '<linearGradient id="goldrim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#e9b730"/><stop offset="1" stop-color="#8a5a10"/></linearGradient>'
         '<linearGradient id="arcstreak" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff3c8" stop-opacity="0"/><stop offset=".8" stop-color="#fff3c8" stop-opacity=".5"/><stop offset="1" stop-color="#ffffff" stop-opacity=".9"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#felt)"/>']
    r = random.Random(2)
    for _ in range(1100):
        p.append(f'<circle cx="{f(r.uniform(0, 640))}" cy="{f(r.uniform(0, 440))}" r=".8" fill="#000" opacity=".13"/>')
    p.append('<g filter="url(#dof2)"><path d="M-20,400 Q320,350 660,400 L660,460 L-20,460 Z" fill="url(#rim)"/><path d="M-20,400 Q320,350 660,400" fill="none" stroke="#e8b87a" stroke-opacity=".5" stroke-width="4"/></g>')
    # the four foundations, sharp (they are the goal): three already climbing, the first one empty and lit for the ace
    fx0, fy0 = 360, 40
    p.append(f'<rect x="{fx0 - 6}" y="{fy0 - 6}" width="70" height="94" rx="10" fill="#ffd36a" opacity=".45" filter="url(#bigglow)"/>')
    p.append(f'<rect x="{fx0}" y="{fy0}" width="58" height="82" rx="7" fill="#06301f" fill-opacity=".6" stroke="#ffe7a0" stroke-width="2.6" stroke-dasharray="7 5" filter="url(#glow)"/>')
    for k, (rk, s, red) in enumerate([("4", "♥", True), ("3", "♣", False), ("5", "♦", True)]):
        x, y = fx0 + (k + 1) * 66, fy0 + (k + 1) * 3
        p.append(f'<rect x="{x}" y="{y}" width="58" height="82" rx="7" fill="#fbfaf5" stroke="url(#goldrim)" stroke-width="3" filter="url(#shadow)"/>'
                 f'<text x="{x + 8}" y="{y + 22}" font-family="Georgia, serif" font-size="18" font-weight="700" fill="{"#cf1b30" if red else "#121826"}">{rk}</text>'
                 f'<text x="{x + 29}" y="{y + 62}" font-family="Arial, sans-serif" font-size="30" fill="{"#cf1b30" if red else "#121826"}" text-anchor="middle">{s}</text>')
    # the deck, lower left, burgundy backs, the top card just lifted
    for k in range(6):
        p.append(f'<g filter="url(#dof)"><rect x="{40 + k * 1.5}" y="{300 - k * 2}" width="96" height="134" rx="10" fill="url(#back)" stroke="#ffd0a0" stroke-opacity=".45"/></g>')
    # the flight path, deck → empty foundation: a glowing arc with the ace's trail along it
    arc = lambda t: ((1 - t) ** 2 * 120 + 2 * (1 - t) * t * 170 + t * t * 380, (1 - t) ** 2 * 300 + 2 * (1 - t) * t * 40 + t * t * 70)
    pts = " ".join(f"{f(arc(t / 30)[0])},{f(arc(t / 30)[1])}" for t in range(31))
    p.append(f'<polyline points="{pts}" fill="none" stroke="#fff6d8" stroke-opacity=".4" stroke-width="2" stroke-dasharray="2 9" filter="url(#glow)"/>')
    # cards already flying ahead of the ace, smeared by speed
    for i, (t, rk, s, red) in enumerate([(.86, "2", "♣", False), (.74, "6", "♦", True)]):
        x, y = arc(t)
        p.append(f'<g opacity=".7" filter="url(#dof)">{card(x - 30, y - 40, rk, s, red, 8 - i * 6, .42)}</g>')
    # the ace: sharp in the lamp light, tilted into its turn, with ghost copies along the arc behind it
    t0 = .48
    ax, ay = arc(t0)

    def ace(x, y, op_card=True):
        return card(x - 64, y - 90, "A", "♠", False, 18, .86)
    p.append('<ellipse cx="300" cy="140" rx="300" ry="190" fill="url(#lamp)" style="mix-blend-mode:screen"/>')
    p.append(motion_ghosts(ace, [arc(t0 - .3), arc(t0 - .2), arc(t0 - .1)], (.08, .3)))
    p.append(f'<path d="M{f(arc(t0 - .34)[0])},{f(arc(t0 - .34)[1])} Q{f(arc(t0 - .17)[0] - 12)},{f(arc(t0 - .17)[1] - 6)} {f(ax)},{f(ay)}" fill="none" stroke="url(#arcstreak)" stroke-width="16" stroke-linecap="round" filter="url(#glow)" opacity=".7"/>')
    p.append(ace(ax, ay))
    p.append(speed_lines((ax, ay, 1.0, -.55), 12, 8, "#fff3c8", 60, 26, 70, (.18, .5)))
    p.append(sparkle(ax + 66, ay - 82, 14, "#fff3b0") + sparkle(fx0 + 30, fy0 + 40, 16, "#fff3b0") + sparkle(578, 152, 9, "#ffffff"))
    p.append(cine(330, 200, key="#fff1c8", flare="#ffe7a8", beam=(300, -60, 170), strength=.72, flare_w=280))
    return svg("".join(p), extra_defs=d)
covers["solitaire-sprint"] = solitaire()


# ---------- Mine Grid: a mine goes off in the middle distance — fireball, shockwave racing over the tiles ----------
def mine():
    d = ('<linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7aa0e6"/><stop offset="1" stop-color="#2f4a86"/></linearGradient>'
         '<linearGradient id="open" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17264a"/><stop offset="1" stop-color="#0c1630"/></linearGradient>'
         '<linearGradient id="msky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070f"/><stop offset=".7" stop-color="#1b1d33"/><stop offset="1" stop-color="#3a2a3a"/></linearGradient>'
         '<radialGradient id="boom" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="#ffffff"/><stop offset=".14" stop-color="#fff6c8"/><stop offset=".34" stop-color="#ffb04a" stop-opacity=".95"/><stop offset=".62" stop-color="#ff3b5c" stop-opacity=".5"/><stop offset="1" stop-color="#ff3b5c" stop-opacity="0"/></radialGradient>'
         '<radialGradient id="glowfloor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".85"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="hfog" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a9ac8" stop-opacity="0"/><stop offset=".5" stop-color="#8a9ac8" stop-opacity=".28"/><stop offset="1" stop-color="#8a9ac8" stop-opacity="0"/></linearGradient>')
    HZ = 128
    p = ['<rect width="640" height="440" fill="url(#msky)"/>', stars(9, 40, HZ - 20)]
    nums = {(5, 4): 1, (6, 4): 2, (7, 4): 1, (5, 5): 1, (6, 5): 3, (7, 5): 2, (4, 6): 1, (5, 6): 1, (6, 6): 2, (7, 6): 1, (8, 6): 1, (5, 7): 1, (6, 7): 1}
    colors = {1: "#7fe3ee", 2: "#5cffb0", 3: "#ff8a4c"}
    ROWS, COLS = 10, 13

    def P(i, j):
        t = j / ROWS
        y = HZ + 330 * (t ** 1.7)
        half = 150 + 560 * (t ** 1.7)
        return 320 - half + 2 * half * i / COLS, y
    bi, bj = 9.5, 5.4
    mx, my = P(bi, bj)
    blown = {(9, 5)}
    for j in range(ROWS):
        rows = []
        for i in range(COLS):
            if (i, j) in blown: continue
            a, b, c, dd = P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)
            pad = 1 + j * .5
            pts = f"{f(a[0] + pad)},{f(a[1] + pad * .5)} {f(b[0] - pad)},{f(b[1] + pad * .5)} {f(c[0] - pad)},{f(c[1] - pad * .5)} {f(dd[0] + pad)},{f(dd[1] - pad * .5)}"
            opened = (i, j) in nums
            dist = math.hypot(i + .5 - bi, (j + .5 - bj) * 1.4)
            heat = max(0.0, 1 - dist / 4.2)
            stroke = "#23365e" if opened else "#b2ccf6"
            rows.append(f'<polygon points="{pts}" fill="{"url(#open)" if opened else "url(#tile)"}" stroke="{stroke}" stroke-width="{.6 + j * .15:.2f}"/>')
            if heat > 0:  # the blast lights the nearby tiles from the side
                rows.append(f'<polygon points="{pts}" fill="#ff8a3c" opacity="{heat * .55:.2f}" style="mix-blend-mode:screen"/><polygon points="{pts}" fill="none" stroke="#ffd6a0" stroke-opacity="{heat:.2f}" stroke-width="{1 + j * .2:.1f}"/>')
            if opened:
                cxx = (a[0] + b[0] + c[0] + dd[0]) / 4; cyy = (a[1] + b[1] + c[1] + dd[1]) / 4
                fs = 8 + j * 4.2
                rows.append(f'<text x="{f(cxx)}" y="{f(cyy + fs * .36)}" font-family="Arial Black, sans-serif" font-size="{f(fs)}" fill="{colors[nums[(i, j)]]}" text-anchor="middle" filter="url(#glow)">{nums[(i, j)]}</text>')
        blur = ' filter="url(#dof)"' if j <= 2 or j >= 9 else ""
        p.append(f'<g{blur}>{"".join(rows)}</g>')
    p.append(f'<rect x="0" y="{HZ - 30}" width="640" height="90" fill="url(#hfog)"/>')
    # the crater where the tile was
    a, b, c, dd = P(9, 5), P(10, 5), P(10, 6), P(9, 6)
    p.append(f'<polygon points="{f(a[0])},{f(a[1])} {f(b[0])},{f(b[1])} {f(c[0])},{f(c[1])} {f(dd[0])},{f(dd[1])}" fill="#120806" stroke="#ffb04a" stroke-width="2"/>')
    # floor glow and the shockwave rings racing outwards over the board
    p.append(f'<ellipse cx="{f(mx)}" cy="{f(my + 8)}" rx="260" ry="80" fill="url(#glowfloor)" style="mix-blend-mode:screen"/>')
    for k, (rx, ry, op, w) in enumerate([(96, 22, .85, 4.5), (170, 38, .55, 3.2), (260, 58, .3, 2.2)]):
        p.append(f'<ellipse cx="{f(mx)}" cy="{f(my + 8)}" rx="{rx}" ry="{ry}" fill="none" stroke="#ffe2b0" stroke-opacity="{op}" stroke-width="{w}" filter="url(#glow)"/>')
    # smoke column, lit from below
    for k in range(7):
        p.append(f'<ellipse cx="{f(mx - 20 + k * 9)}" cy="{f(my - 80 - k * 34)}" rx="{54 + k * 17}" ry="{28 + k * 10}" fill="{"#5a3428" if k < 2 else "#2a2c3a"}" opacity="{.55 - k * .05:.2f}" filter="url(#soft)"/>')
    p.append(f'<circle cx="{f(mx)}" cy="{f(my - 26)}" r="150" fill="url(#boom)"/>')
    p.append(burst(mx, my - 22, 30, 30, 210, "#ffe08a", seed=2, w=3.2))
    rr = random.Random(2)
    # tiles flung into the air, each with a short streak back to the blast
    for q in range(12):
        a0 = -math.pi * .95 + q * .16 + rr.uniform(-.05, .05); dd0 = rr.uniform(80, 190); s = rr.uniform(10, 22)
        x, y = mx + math.cos(a0) * dd0, my - 30 + math.sin(a0) * dd0 * .85
        p.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x - math.cos(a0) * 34)}" y2="{f(y - math.sin(a0) * 30)}" stroke="#ffcf8a" stroke-width="2" opacity=".5" stroke-linecap="round"/>')
        p.append(f'<rect x="{f(x - s / 2)}" y="{f(y - s / 3)}" width="{f(s)}" height="{f(s * .66)}" fill="url(#tile)" stroke="#ffd6a0" stroke-width="1" transform="rotate({rr.randint(0, 80)} {f(x)} {f(y)})"/>')
    p.append(sparks(mx, my - 24, 70, 12, ["#fff6c8", "#ffcf6a", "#ff8a4c"], 230, 4, 16, .3))
    p.append(sphere(mx, my - 58, 16, "#3a3f4c", "mine", hi="#ffd6a0", shadow=False))
    for k in range(8):
        aa = k * math.pi / 4
        p.append(f'<line x1="{f(mx + 16 * math.cos(aa))}" y1="{f(my - 58 + 16 * math.sin(aa))}" x2="{f(mx + 24 * math.cos(aa))}" y2="{f(my - 58 + 24 * math.sin(aa))}" stroke="#3a3f4c" stroke-width="5" stroke-linecap="round"/>')
    # flags: the near one whipping in the blast wind, lit orange on its blast side
    for (fi, fj, s) in [(3.3, 4.2, .8), (3.7, 8.4, 2.0)]:
        fx, fy = P(fi, fj)
        top, mid, low = fy - 44 * s, fy - 31 * s, fy - 18 * s
        p.append(f'<line x1="{f(fx)}" y1="{f(fy + 10 * s)}" x2="{f(fx + 3 * s)}" y2="{f(top)}" stroke="#e9f4ff" stroke-width="{f(3.5 * s)}"/>'
                 f'<path d="M{f(fx + 3 * s)},{f(top)} Q{f(fx - 14 * s)},{f(top - 2 * s)} {f(fx - 34 * s)},{f(mid - 6 * s)} Q{f(fx - 18 * s)},{f(mid + 2 * s)} {f(fx - 30 * s)},{f(low + 2 * s)} Q{f(fx - 12 * s)},{f(low - 4 * s)} {f(fx + 2 * s)},{f(low)} Z" fill="#ff3b5c"/>'
                 f'<line x1="{f(fx + 4.5 * s)}" y1="{f(fy + 8 * s)}" x2="{f(fx + 4.5 * s)}" y2="{f(top + 2 * s)}" stroke="#ffb04a" stroke-width="{f(1.2 * s)}" opacity=".8"/>')
    p.append(cine(mx - 30, my - 30, key="#ffb04a", flare="#ffd9a0", beam=None, strength=.72, flare_w=360))
    return svg("".join(p), extra_defs=d)
covers["mine-grid"] = mine()


# ---------- Orb Burst: a matching trio bursts, orbs drop, the shot already on its way ----------
ORB_SKIP = set()  # v164: grid cells left empty (the gap between the cluster and the cannon)


def orb():
    d = ('<radialGradient id="obbg" cx="50%" cy="20%" r="90%"><stop offset="0" stop-color="#1c1240"/><stop offset=".6" stop-color="#0a0a1c"/><stop offset="1" stop-color="#030308"/></radialGradient>'
         '<linearGradient id="dropTrail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#ffffff" stop-opacity=".45"/></linearGradient>'
         '<linearGradient id="launcher" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2e3c"/><stop offset="1" stop-color="#0b0c12"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#obbg)"/>', bokeh(17, ["#ff6f91", "#4fa8ff", "#ffd23f"], 10, 440, 20, 60, (.06, .18))]
    cols = ["#4fa8ff", "#ff6f91", "#ffd23f", "#5cffb0", "#b98cff", "#ff9a3c"]
    r = random.Random(7)
    R = 34
    hole = {(2, 5), (2, 6), (3, 5), (3, 6), (3, 4), (1, 6)}

    def orb_at(x, y, rad, c, idn):
        # sphere + coloured rim light at the lower right + contact shadow above the next row
        return (f'<circle cx="{f(x + 2)}" cy="{f(y + 5)}" r="{f(rad)}" fill="#000" opacity=".35" filter="url(#dof)"/>'
                + sphere(x, y, rad, c, idn, shadow=False, gloss=.75)
                + f'<path d="M{f(x + rad * .2)},{f(y + rad * .96)} A{f(rad)},{f(rad)} 0 0 0 {f(x + rad * .96)},{f(y + rad * .2)}" fill="none" stroke="{c}" stroke-width="2.2" opacity=".9" filter="url(#glow)"/>')
    for row in range(5):
        n = 11 if row % 2 == 0 else 10
        for i in range(-1, n + 1):
            if (row, i) in hole: continue
            if row == 4 and r.random() < .4: continue
            x = 20 + i * 2 * R + (R if row % 2 else 0)
            y = 20 + row * R * 1.73
            col = r.choice(cols)
            if (row, i) in ORB_SKIP: continue
            p.append(orb_at(x, y, R - 1.5, col, f"o{row}_{i}"))
    # the burst: three gold orbs that matched, cracking apart around a white core
    bx, by = 400, 160
    for k, (ox, oy) in enumerate([(-34, -30), (34, -30), (0, 28)]):
        x, y = bx + ox * 1.25, by + oy * 1.25
        p.append(f'<g opacity=".55">{sphere(x, y, 30, "#ffd23f", f"pop{k}", shadow=False)}</g>')
        p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="36" fill="none" stroke="#fff3b0" stroke-width="2.5" stroke-dasharray="10 7" opacity=".85" filter="url(#glow)"/>')
    p.append(flash(bx, by, 120, "#ffd23f", .85))
    p.append(f'<circle cx="{bx}" cy="{by}" r="92" fill="none" stroke="#ffe08a" stroke-width="4" opacity=".75" filter="url(#glow)"/><circle cx="{bx}" cy="{by}" r="120" fill="none" stroke="#ffe08a" stroke-width="2" opacity=".35"/>')
    for q in range(22):
        a = q * 2 * math.pi / 22 + r.uniform(-.1, .1); dd = r.uniform(70, 150)
        x, y = bx + math.cos(a) * dd, by + math.sin(a) * dd
        p.append(f'<line x1="{f(bx + math.cos(a) * (dd - 26))}" y1="{f(by + math.sin(a) * (dd - 26))}" x2="{f(x)}" y2="{f(y)}" stroke="#ffe08a" stroke-width="2" opacity=".5"/>')
        p.append(f'<polygon points="{f(x)},{f(y - 8)} {f(x + 6)},{f(y)} {f(x)},{f(y + 8)} {f(x - 6)},{f(y)}" fill="#ffd23f" transform="rotate({q * 25} {f(x)} {f(y)})" filter="url(#glow)"/>')
    # orbs cut loose by the burst, falling with soft streaks
    for (x, y, c) in [(240, 300, "#b98cff"), (520, 316, "#5cffb0"), (468, 372, "#4fa8ff")]:
        p.append(trail([(x, y - 90 + t * 9) for t in range(10)], c, 30, .28))
        p.append(orb_at(x, y, 26, c, f"dr{x}"))
    # aim guide from the launcher to the gap, dots shrinking with distance
    sx, sy = 320, 404
    for q in range(1, 13):
        t = q / 13
        x, y = sx + (bx - 30 - sx) * t, sy + (by + 70 - sy) * t
        p.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(4.6 - t * 2.4)}" fill="#e9fbff" opacity="{.95 - t * .55:.2f}" filter="url(#glow)"/>')
    # launcher: a ring base with lit segments, the loaded shot and the next one waiting
    p.append('<ellipse cx="320" cy="456" rx="150" ry="46" fill="url(#launcher)" stroke="#7fe3ee" stroke-width="3"/>')
    for k in range(14):
        a = math.pi + k * math.pi / 13
        p.append(f'<circle cx="{f(320 + 132 * math.cos(a))}" cy="{f(456 + 38 * math.sin(a))}" r="3" fill="{"#7fe3ee" if k % 2 else "#2a5560"}" filter="url(#glow)"/>')
    p.append(f'<circle cx="{sx}" cy="{sy}" r="48" fill="#ff6f91" opacity=".25" filter="url(#bigglow)"/>')
    p.append(sphere(sx, sy, 36, "#ff6f91", "shot", shadow=False, gloss=.8))
    p.append(f'<g opacity=".8">{sphere(420, 428, 18, "#5cffb0", "nextshot", shadow=False)}</g>')
    p.append(sparkle(bx, by, 24, "#fff8e0"))
    p.append(cine(bx, by + 40, key="#fff1c8", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)
covers["orb-burst"] = orb()


# ---------- Stack Shift: the piece drops into the well, a full line flashes and breaks into shards ----------
def stackshift():
    cols = ["#5fd4e8", "#f5ba5b", "#73d69d", "#a986e8", "#ef7d94", "#6f96ed"]
    shapes = [[(0, 0), (1, 0), (2, 0)], [(0, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (1, 1), (2, 1)], [(0, 0), (1, 0), (0, 1), (1, 1)],
              [(0, 0), (0, 1), (1, 1), (1, 2), (2, 2)], [(0, 0), (0, 1), (0, 2), (1, 2)]]
    d = ('<radialGradient id="ssbg" cx="40%" cy="30%" r="90%"><stop offset="0" stop-color="#15204a"/><stop offset=".6" stop-color="#070d22"/><stop offset="1" stop-color="#03060f"/></radialGradient>'
         '<linearGradient id="ssflash" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d2fff5" stop-opacity="0"/><stop offset=".5" stop-color="#d2fff5" stop-opacity=".95"/><stop offset="1" stop-color="#d2fff5" stop-opacity="0"/></linearGradient>'
         '<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".09"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/></linearGradient>'
         '<linearGradient id="dropline" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#73d69d" stop-opacity="0"/><stop offset="1" stop-color="#bff7d6" stop-opacity=".6"/></linearGradient>')
    CS, COLS, ROWS = 50, 8, 9
    X0, FLOOR = 118, 418

    def block(i, j, k, ghost=False):
        x = X0 + i * CS; y = FLOOR - (j + 1) * CS
        if ghost:
            return f'<rect x="{x + 6}" y="{y + 6}" width="{CS - 12}" height="{CS - 12}" rx="3" fill="{cols[k]}" fill-opacity=".08" stroke="{cols[k]}" stroke-width="2.4" stroke-dasharray="5 5" opacity=".75"/>'
        a, b = x + 3, y + 3; s = CS - 6; e = 7  # bevel width
        return (f'<rect x="{a}" y="{b}" width="{s}" height="{s}" rx="3" fill="{cols[k]}"/>'
                f'<polygon points="{a},{b} {a + s},{b} {a + s - e},{b + e} {a + e},{b + e}" fill="#fff" opacity=".34"/>'
                f'<polygon points="{a},{b} {a + e},{b + e} {a + e},{b + s - e} {a},{b + s}" fill="#fff" opacity=".16"/>'
                f'<polygon points="{a + s},{b} {a + s},{b + s} {a + s - e},{b + s - e} {a + s - e},{b + e}" fill="#000" opacity=".18"/>'
                f'<polygon points="{a},{b + s} {a + s},{b + s} {a + s - e},{b + s - e} {a + e},{b + s - e}" fill="#000" opacity=".3"/>'
                f'<rect x="{a + e + 3}" y="{b + e + 3}" width="{s * .32:.1f}" height="4" rx="2" fill="#fff" opacity=".45"/>')
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
    # the clearing line: blocks bleaching, the flash beam and shards thrown sideways out of the well
    for i, k in enumerate(stack_rows[1]):
        g.append(f'<g opacity=".5">{block(i, 1, k)}</g>')
    ly = FLOOR - 1.5 * CS
    g.append(f'<rect x="{X0}" y="{FLOOR - 2 * CS}" width="{COLS * CS}" height="{CS}" fill="url(#ssflash)" filter="url(#glow)"/>')
    g.append(f'<rect x="{X0 - 40}" y="{ly - 1.5}" width="{COLS * CS + 80}" height="3" fill="#ffffff" filter="url(#glow)"/>')
    rr = random.Random(9)
    for q in range(30):
        side = -1 if q % 2 else 1
        x = X0 + COLS * CS / 2 + side * rr.uniform(40, 260); y = ly + rr.uniform(-36, 30)
        s = rr.choice([6, 8, 10, 12]); c = rr.choice(cols)
        g.append(f'<line x1="{f(x)}" y1="{f(y)}" x2="{f(x - side * rr.uniform(14, 40))}" y2="{f(y)}" stroke="{c}" stroke-width="2" opacity=".45"/>')
        g.append(f'<rect x="{f(x)}" y="{f(y)}" width="{s}" height="{s}" fill="{c}" opacity="{rr.uniform(.6, 1):.2f}" transform="rotate({rr.randint(0, 90)} {f(x)} {f(y)})"/>')
    # active piece dropping: speed streaks above it, its landing ghost below
    k = 2; px, py = 3, 6; gy = 3
    for (cx, cy) in shapes[k]:
        g.append(block(px + cx, gy + 1 - cy, k, ghost=True))
    for (cx, cy) in shapes[k]:
        if cy == 1:  # streaks from the piece's top cells
            x = X0 + (px + cx) * CS
            g.append(f'<rect x="{x + 10}" y="{FLOOR - (py + 2 - cy) * CS - 110}" width="{CS - 20}" height="110" fill="url(#dropline)"/>')
    g.append('<g filter="url(#shadow)">' + "".join(block(px + cx, py + 1 - cy, k) for (cx, cy) in shapes[k]) + '</g>')
    g.append(f'<rect x="{X0 - 8}" y="{FLOOR}" width="{COLS * CS + 16}" height="6" fill="#8edbda" filter="url(#glow)"/>')
    g.append(f'<rect x="{X0 - 6}" y="-40" width="{COLS * CS + 12}" height="{FLOOR + 46}" fill="url(#glass)"/>')
    g.append(f'<rect x="{X0 - 6}" y="-40" width="{COLS * CS + 12}" height="{FLOOR + 46}" fill="none" stroke="#a0f1e9" stroke-opacity=".55" stroke-width="3" filter="url(#glow)"/>')
    g.append('</g>')
    p += g
    # the "next" tray, right, without words
    tx, ty = 548, 40
    p.append(f'<rect x="{tx - 10}" y="{ty}" width="84" height="132" rx="12" fill="#040c19" fill-opacity=".85" stroke="#335e79"/><rect x="{tx - 10}" y="{ty}" width="84" height="132" rx="12" fill="url(#glass)"/>')
    for n, (kk, op) in enumerate(((4, 1), (0, .5))):
        for (cx, cy) in shapes[kk]:
            p.append(f'<rect x="{tx + 6 + cx * 18}" y="{ty + 16 + n * 62 + cy * 18}" width="16" height="16" rx="2" fill="{cols[kk]}" opacity="{op}"/><rect x="{tx + 7 + cx * 18}" y="{ty + 17 + n * 62 + cy * 18}" width="14" height="3" fill="#fff" opacity="{op * .35:.2f}"/>')
    p.append(f'<text x="{X0 + COLS * CS - 40}" y="{ly - 30}" font-family="Arial Black, sans-serif" font-size="30" fill="#fff3b0" text-anchor="middle" filter="url(#glow)" transform="rotate(-4 {X0 + COLS * CS - 40} {ly - 30})">+400</text>')
    p.append(sparkle(X0 + COLS * CS - 26, ly - 6, 16) + sparkle(84, 110, 9, "#e0f6ff"))
    p.append(cine(X0 + 4 * CS, ly, key="#d2fff5", flare="#bff6f0", strength=.62, flare_w=220))
    return svg("".join(p), extra_defs=d)
covers["stack-shift"] = stackshift()


# ---------- v143 ----------
import colorsys


def hsl(h, s, l):
    r, g, b = colorsys.hls_to_rgb((h % 360) / 360, max(0, min(1, l)), max(0, min(1, s)))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


V143_DEFS = (
    # Material grain laid over a shape (soft-light grey noise, clipped to the shape itself).
    '<filter id="grainmat" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="5" result="n"/>'
    '<feColorMatrix in="n" type="saturate" values="0" result="g"/><feBlend in="g" in2="SourceGraphic" mode="soft-light" result="b"/><feComposite in="b" in2="SourceGraphic" operator="in"/></filter>'
    # Brushed metal: noise stretched along one axis.
    '<filter id="brushmat" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .7" numOctaves="2" seed="11" result="n"/>'
    '<feColorMatrix in="n" type="matrix" values=".33 0 0 0 .33  .33 0 0 0 .33  .33 0 0 0 .33  0 0 0 0 1" result="g"/><feBlend in="g" in2="SourceGraphic" mode="soft-light" result="b"/><feComposite in="b" in2="SourceGraphic" operator="in"/></filter>'
)


# ---------- Stack: the same tower, now built of machined modules — brushed sides, a woven top plate, bevels ----------
def iso_tex(cx, cy, w, dd, h, hue, idn, lit=.6, sat=.72):
    t = [(cx, cy - dd), (cx + w, cy), (cx, cy + dd), (cx - w, cy)]
    lf = [(cx - w, cy), (cx, cy + dd), (cx, cy + dd + h), (cx - w, cy + h)]
    rt = [(cx, cy + dd), (cx + w, cy), (cx + w, cy + h), (cx, cy + dd + h)]
    F = lambda pts: " ".join(f"{f(x)},{f(y)}" for x, y in pts)
    n = 7  # top plate tiles per side
    d = (f'<linearGradient id="tt{idn}" gradientUnits="userSpaceOnUse" x1="{f(t[0][0])}" y1="{f(t[0][1])}" x2="{f(t[2][0])}" y2="{f(t[2][1])}">'
         f'<stop offset="0" stop-color="{hsl(hue, sat + .1, lit + .14)}"/><stop offset=".45" stop-color="{hsl(hue, sat, lit)}"/><stop offset="1" stop-color="{hsl(hue + 8, sat - .04, lit - .12)}"/></linearGradient>'
         f'<linearGradient id="tl{idn}" gradientUnits="userSpaceOnUse" x1="0" y1="{f(cy)}" x2="0" y2="{f(cy + dd + h)}">'
         f'<stop offset="0" stop-color="{hsl(hue, sat - .08, lit - .2)}"/><stop offset="1" stop-color="{hsl(hue + 10, sat, lit - .38)}"/></linearGradient>'
         f'<linearGradient id="tr{idn}" gradientUnits="userSpaceOnUse" x1="0" y1="{f(cy)}" x2="0" y2="{f(cy + dd + h)}">'
         f'<stop offset="0" stop-color="{hsl(hue, sat, lit - .06)}"/><stop offset="1" stop-color="{hsl(hue + 10, sat, lit - .27)}"/></linearGradient>'
         # Top plate tiles: one light and one dark line per tile, laid along the plate's own axes.
         f'<pattern id="tw{idn}" width="1" height="1" patternUnits="userSpaceOnUse" patternTransform="matrix({w / n:.3f} {dd / n:.3f} {-w / n:.3f} {dd / n:.3f} {f(t[0][0])} {f(t[0][1])})">'
         f'<path d="M0,.02 H1 M.02,0 V1" stroke="#fff" stroke-opacity=".22" stroke-width=".04" fill="none"/><path d="M0,.98 H1 M.98,0 V1" stroke="#000" stroke-opacity=".2" stroke-width=".04" fill="none"/>'
         f'<circle cx=".5" cy=".5" r=".05" fill="#fff" fill-opacity=".18"/></pattern>')
    out = [f'<defs>{d}</defs>']
    out.append(f'<polygon points="{F(lf)}" fill="url(#tl{idn})" filter="url(#brushmat)"/><polygon points="{F(rt)}" fill="url(#tr{idn})" filter="url(#brushmat)"/>')
    # groove with rivets round the sides, a third of the way down
    gy = h * .36
    for a, b, lo in ((lf[0], lf[1], .2), (rt[0], rt[1], .32)):
        out.append(f'<line x1="{f(a[0])}" y1="{f(a[1] + gy)}" x2="{f(b[0])}" y2="{f(b[1] + gy)}" stroke="#000" stroke-opacity=".38" stroke-width="2.2"/>'
                   f'<line x1="{f(a[0])}" y1="{f(a[1] + gy + 1.8)}" x2="{f(b[0])}" y2="{f(b[1] + gy + 1.8)}" stroke="#fff" stroke-opacity="{lo}" stroke-width="1.1"/>')
        for k in range(1, 6):
            q = k / 6
            out.append(f'<circle cx="{f(a[0] + (b[0] - a[0]) * q)}" cy="{f(a[1] + (b[1] - a[1]) * q + h * .68)}" r="1.8" fill="#fff" fill-opacity="{lo + .15:.2f}"/>')
    out.append(f'<polygon points="{F(t)}" fill="url(#tt{idn})" filter="url(#grainmat)"/><polygon points="{F(t)}" fill="url(#tw{idn})"/>')
    # engraved inset panel on the top plate
    k = .16
    it = [(cx, cy - dd * (1 - k)), (cx + w * (1 - k), cy), (cx, cy + dd * (1 - k)), (cx - w * (1 - k), cy)]
    out.append(f'<polygon points="{F(it)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="2"/>'
               f'<polyline points="{F([(x, y + 1.6) for x, y in (it[3], it[2], it[1])])}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.2"/>')
    # bevels: bright back edges, a softer front corner, dark seams at the bottom
    out.append(f'<polyline points="{F([t[3], t[0], t[1]])}" fill="none" stroke="{hsl(hue, .9, .93)}" stroke-width="2.4" stroke-linecap="round"/>'
               f'<polyline points="{F([t[3], t[2], t[1]])}" fill="none" stroke="{hsl(hue, .9, .86)}" stroke-opacity=".6" stroke-width="1.6"/>'
               f'<line x1="{f(t[2][0])}" y1="{f(t[2][1])}" x2="{f(t[2][0])}" y2="{f(t[2][1] + h)}" stroke="#fff" stroke-opacity=".35" stroke-width="1.4"/>'
               f'<polyline points="{F([lf[3], lf[2], rt[2]])}" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="1.6"/>')
    return "".join(out)


def stack_v143():
    d = ('<radialGradient id="sbg" cx="50%" cy="36%" r="85%"><stop offset="0" stop-color="#262a4a"/><stop offset=".6" stop-color="#0e0f1c"/><stop offset="1" stop-color="#050509"/></radialGradient>'
         '<radialGradient id="sring" cx="50%" cy="50%" r="50%"><stop offset=".7" stop-color="#fff3b0" stop-opacity="0"/><stop offset=".92" stop-color="#fff3b0" stop-opacity=".5"/><stop offset="1" stop-color="#fff3b0" stop-opacity="0"/></radialGradient>' + V143_DEFS)
    p = ['<rect width="640" height="440" fill="url(#sbg)"/>', stars(31, 80, 300), bokeh(15, ["#7fe3ee", "#b996ff", "#ff9ad8", "#ffd36a"], 12, 440, 20, 55, (.06, .2))]
    hues = [186, 222, 262, 318, 152, 200, 284, 340, 170]
    g = ['<g transform="translate(0 128)">']
    for i in range(9):
        g.append(iso_tex(320 + (i % 2) * 6 - 3, 470 - i * 46, 230 - i * 6, 116 - i * 3, 38, hues[i], f"s{i}", lit=.56 - (8 - i) * .012))
    # landing ring and light column under the falling block
    g.append('<ellipse cx="320" cy="84" rx="206" ry="100" fill="url(#sring)"/>')
    g.append('<ellipse cx="320" cy="84" rx="200" ry="98" fill="none" stroke="#fff3b0" stroke-width="4" opacity=".7" filter="url(#glow)"/>')
    g.append('<polygon points="270,-140 572,-140 570,40 272,30" fill="#fff3b0" opacity=".07" filter="url(#soft)"/>')
    g.append(iso_tex(420, 30, 150, 76, 34, 46, "gold", lit=.6, sat=.9))
    for q in range(1, 5):
        g.append(f'<rect x="{410 + q * 3}" y="{-60 - q * 14}" width="{4 + q}" height="{28 - q * 3}" rx="2" fill="#ffe066" opacity="{.6 - q * .12:.2f}"/>')
    g.append('</g>')
    p += g
    # the sliced overhang tumbling off with chips of the cut
    p.append(f'<g transform="rotate(26 570 250)">{iso_tex(570, 250, 46, 24, 30, 46, "chip", lit=.58, sat=.9)}</g>')
    rr = random.Random(43)
    for _ in range(9):
        x, y, s = rr.uniform(520, 625), rr.uniform(170, 330), rr.uniform(3, 7)
        p.append(f'<rect x="{f(x)}" y="{f(y)}" width="{f(s)}" height="{f(s * .7)}" fill="{rr.choice(["#ffe066", "#fff3b0", "#c99a1c"])}" transform="rotate({rr.randint(0, 90)} {f(x)} {f(y)})" opacity=".9"/>')
    p.append(speed_lines((570, 250, .25, 1), 8, 5, "#fff3b0", 26, 20, 60, (.15, .45)))
    p.append(sparkle(150, 200, 14, "#fff3b0") + sparkle(540, 140, 10) + sparkle(432, 160, 8, "#fff3b0"))
    p.append(cine(400, 180, key="#fff1c8", strength=.6, flare_w=0, bloom=True))
    return svg("".join(p), extra_defs=d)


covers["precision-stack"] = stack_v143()
covers["stack-3d"] = covers["precision-stack"]


# ---------- Solitaire Sprint: a tableau staircase, red and black alternating down the felt; the 6♦ lands on it ----------
def card_v143(x, y, rank, suit, red, rot, s, idn):
    col = "#d11f3a" if red else "#131a2a"
    w, h = 150 * s, 212 * s
    face = {"K": "♚", "Q": "♛", "J": "♞"}.get(rank)
    big = (f'<text x="{f(x + w / 2)}" y="{f(y + h * .66)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="{f(92 * s)}" fill="{col}" text-anchor="middle">{face}</text>'
           f'<text x="{f(x + w / 2)}" y="{f(y + h * .86)}" font-family="Arial, sans-serif" font-size="{f(34 * s)}" fill="{col}" text-anchor="middle">{suit}</text>') if face else \
        f'<text x="{f(x + w / 2)}" y="{f(y + h * .7)}" font-family="Arial, sans-serif" font-size="{f(96 * s)}" fill="{col}" text-anchor="middle">{suit}</text>'
    glow = "#ff4a62" if red else "#7fb4ff"
    return (f'<defs><linearGradient id="cf{idn}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset=".7" stop-color="#f6f1e4"/><stop offset="1" stop-color="#e9e1cc"/></linearGradient></defs>'
            f'<g transform="rotate({rot} {f(x + w / 2)} {f(y + h / 2)})">'
            f'<rect x="{f(x - 3)}" y="{f(y - 3)}" width="{f(w + 6)}" height="{f(h + 6)}" rx="{f(16 * s)}" fill="{glow}" opacity=".32" filter="url(#glow)"/>'
            f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}" rx="{f(14 * s)}" fill="url(#cf{idn})" stroke="#c9cfd8" filter="url(#shadow)"/>'
            f'<rect x="{f(x + 7 * s)}" y="{f(y + 7 * s)}" width="{f(w - 14 * s)}" height="{f(h - 14 * s)}" rx="{f(10 * s)}" fill="none" stroke="#d8b86a" stroke-opacity=".7" stroke-width="{f(1.4 * s)}"/>'
            f'<text x="{f(x + 15 * s)}" y="{f(y + 40 * s)}" font-family="Georgia, serif" font-size="{f(36 * s)}" font-weight="700" fill="{col}">{rank}</text>'
            f'<text x="{f(x + 17 * s)}" y="{f(y + 70 * s)}" font-family="Arial, sans-serif" font-size="{f(27 * s)}" fill="{col}">{suit}</text>'
            f'<text x="{f(x + w - 16 * s)}" y="{f(y + 36 * s)}" font-family="Arial, sans-serif" font-size="{f(24 * s)}" fill="{col}" text-anchor="end">{suit}</text>'
            f'{big}</g>')


def solitaire_v143():
    d = ('<radialGradient id="felt" cx="46%" cy="40%" r="82%"><stop offset="0" stop-color="#1fb07c"/><stop offset=".42" stop-color="#0c6446"/><stop offset="1" stop-color="#021510"/></radialGradient>'
         '<radialGradient id="lamp" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fff4d6" stop-opacity=".45"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2a14"/><stop offset=".5" stop-color="#8a5a30"/><stop offset="1" stop-color="#2a160a"/></linearGradient>'
         '<linearGradient id="arcstreak" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd0d8" stop-opacity="0"/><stop offset=".75" stop-color="#ffd0d8" stop-opacity=".45"/><stop offset="1" stop-color="#ffffff" stop-opacity=".9"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#felt)"/>']
    r = random.Random(2)
    for _ in range(1100):
        p.append(f'<circle cx="{f(r.uniform(0, 640))}" cy="{f(r.uniform(0, 440))}" r=".8" fill="#000" opacity=".13"/>')
    # neighbouring tableau columns, far and soft, so the staircase reads as part of a game in progress
    for k, (x0, y0) in enumerate([(-40, 150), (560, 20)]):
        for i in range(4):
            p.append(f'<g filter="url(#dof2)" opacity=".55"><rect x="{x0 + i * 4}" y="{y0 + i * 30}" width="100" height="140" rx="10" fill="{"#7a1a2e" if i < 3 else "#f2ecdc"}" stroke="#ffd0a0" stroke-opacity=".35"/></g>')
    p.append('<g filter="url(#dof2)"><path d="M-20,410 Q320,372 660,410 L660,460 L-20,460 Z" fill="url(#rim)"/><path d="M-20,410 Q320,372 660,410" fill="none" stroke="#e8b87a" stroke-opacity=".5" stroke-width="4"/></g>')
    p.append('<ellipse cx="300" cy="120" rx="320" ry="210" fill="url(#lamp)" style="mix-blend-mode:screen"/>')
    # the staircase: K♠ Q♥ J♣ 10♦ 9♠ 8♥ 7♣, each overlapping the last, swinging gently into a curve
    seq = [("K", "♠", False), ("Q", "♥", True), ("J", "♣", False), ("10", "♦", True), ("9", "♠", False), ("8", "♥", True), ("7", "♣", False)]
    s = .7
    pos = []
    for i, (rk, su, red) in enumerate(seq):
        x = 46 + i * 58 + 6 * math.sin(i * .9)
        y = 66 + i * 33 - 4 * i * (i - 6) * .35
        rot = -9 + i * 2.6
        pos.append((x, y))
        p.append(card_v143(x, y, rk, su, red, rot, s, f"st{i}"))
    # the 6♦ arriving from the upper right, about to land on the 7♣: ghosts, streak, speed lines
    lx, ly = pos[-1][0] + 58, pos[-1][1] + 33
    fx, fy = lx + 56, ly - 92
    six = lambda x, y: card_v143(x, y, "6", "♦", True, 21, s, f"g{int(x)}")
    p.append(motion_ghosts(six, [(fx + 120, fy - 96), (fx + 80, fy - 64), (fx + 40, fy - 32)], (.06, .26)))
    w6, h6 = 150 * s, 212 * s
    p.append(f'<path d="M{f(fx + 160 + w6 / 2)},{f(fy - 130 + h6 / 2)} Q{f(fx + 70 + w6 / 2)},{f(fy - 70 + h6 / 2)} {f(fx + w6 / 2)},{f(fy + h6 / 2)}" fill="none" stroke="url(#arcstreak)" stroke-width="18" stroke-linecap="round" filter="url(#glow)" opacity=".6"/>')
    p.append(six(fx, fy))
    p.append(speed_lines((fx + w6 / 2, fy + h6 / 2, -1, .8), 12, 8, "#ffe3e8", 56, 26, 70, (.16, .45)))
    # sparkles along the stair
    p.append(sparkle(pos[0][0] + 98, pos[0][1] + 8, 11, "#fff3b0") + sparkle(lx + 40, ly - 10, 14, "#fff3b0") + sparkle(600, 120, 9, "#ffffff"))
    p.append(cine(330, 220, key="#fff1c8", flare="#ffe7a8", beam=(300, -60, 180), strength=.66, flare_w=0))
    return svg("".join(p), extra_defs=d)


covers["solitaire-sprint"] = solitaire_v143()


# ---------- Shot Gallery: Hangar 7 — the crew of creatures pops up behind the cover; a mantis takes the laser hit ----------
def _rg(idn, stops, cx="35%", cy="30%", r="75%"):
    return f'<radialGradient id="{idn}" cx="{cx}" cy="{cy}" r="{r}">' + "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops) + '</radialGradient>'


def _lg(idn, stops, x1=0, y1=0, x2=0, y2=1):
    return f'<linearGradient id="{idn}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">' + "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops) + '</linearGradient>'


def g_mantis(x, y, s, idn, hit=False):
    """Raised serrated scythes, a segmented thorax, a wedge head with faceted compound eyes and glowing feelers."""
    d = (_lg(f"{idn}a", [(0, "#c8ff7a"), (.45, "#62c23a"), (1, "#14400c")], 0, 0, 1, 1) + _rg(f"{idn}b", [(0, "#e9ff9a"), (.35, "#7bd64a"), (1, "#1a4a10")]) +
         _rg(f"{idn}e", [(0, "#fff6c8"), (.35, "#ffb02a"), (.8, "#a54a06"), (1, "#3a1402")], "40%", "35%", "70%"))
    o = [f'<defs>{d}</defs><g transform="translate({f(x)} {f(y)}) scale({s})">']
    for sx in (-1, 1):
        # scythe: upper arm and blade with serrations along the inner edge
        o.append(f'<path d="M{sx * 14},6 Q{sx * 44},-2 {sx * 52},-46 Q{sx * 60},-76 {sx * 40},-96 Q{sx * 52},-64 {sx * 38},-40 Q{sx * 34},-14 {sx * 20},16 Z" fill="url(#{idn}a)" stroke="#0b2a06" stroke-width="2.2"/>')
        o.append("".join(f'<path d="M{f(sx * (40 - k * 1.4))},{f(-88 + k * 9)} l{f(sx * -7)},{f(3)} l{f(sx * 6)},{f(4)}Z" fill="#e9ffb0" opacity=".85"/>' for k in range(6)))
        o.append(f'<path d="M{sx * 50},-46 Q{sx * 58},-74 {sx * 41},-94" fill="none" stroke="#f4ffc8" stroke-width="2" opacity=".8"/>')
    # abdomen and thorax, segmented
    for k in range(5):
        o.append(f'<ellipse cx="0" cy="{f(30 + k * 11)}" rx="{f(22 - k * 1.5)}" ry="9" fill="url(#{idn}b)" stroke="#123a0a" stroke-width="1.6"/>'
                 f'<path d="M{f(-16 + k)},{f(27 + k * 11)} Q0,{f(22 + k * 11)} {f(16 - k)},{f(27 + k * 11)}" fill="none" stroke="#e2ff9a" stroke-opacity=".45" stroke-width="1.4"/>')
    o.append(f'<ellipse cx="0" cy="10" rx="17" ry="20" fill="url(#{idn}b)" stroke="#123a0a" stroke-width="2"/>')
    # feelers with lit tips
    for sx in (-1, 1):
        o.append(f'<path d="M{sx * 6},-40 Q{sx * 14},-74 {sx * 36},-82" fill="none" stroke="#2a5a14" stroke-width="2.4" stroke-linecap="round"/>'
                 f'<circle cx="{sx * 37}" cy="-83" r="4" fill="#e2ff7a" filter="url(#glow)"/>')
    # wedge head
    o.append(f'<path d="M-36,-40 Q0,-58 36,-40 Q18,-12 0,2 Q-18,-12 -36,-40 Z" fill="url(#{idn}a)" stroke="#0b2a06" stroke-width="2.4"/>')
    o.append('<path d="M-30,-40 Q0,-54 30,-40" fill="none" stroke="#f4ffc8" stroke-width="1.8" opacity=".7"/>')
    for sx in (-1, 1):
        o.append(f'<ellipse cx="{sx * 17}" cy="-36" rx="13" ry="10.5" fill="url(#{idn}e)" stroke="#2a1002" stroke-width="1.6" transform="rotate({sx * 22} {sx * 17} -36)"/>')
        o.append("".join(f'<circle cx="{f(sx * 17 + (i % 4 - 1.5) * 5.2)}" cy="{f(-36 + (i // 4 - 1) * 5)}" r="1.3" fill="#000" opacity=".22"/>' for i in range(12)))
        o.append(f'<ellipse cx="{sx * 17 - 4}" cy="-40" rx="4" ry="2.4" fill="#fff" opacity=".85" transform="rotate({sx * 22} {sx * 17} -36)"/>')
        o.append(f'<path d="M{sx * 4},-8 Q{sx * 11},-2 {sx * 6},6" fill="none" stroke="#0b2a06" stroke-width="3" stroke-linecap="round"/>')
    if hit:
        o.append('<path d="M-36,-40 Q0,-58 36,-40 Q18,-12 0,2 Q-18,-12 -36,-40 Z" fill="#ffffff" opacity=".45"/>')
    o.append('</g>')
    return "".join(o)


def g_kraken(x, y, s, idn):
    """One huge lidded eye in a speckled dome, curling tentacles with rows of suckers."""
    d = _rg(f"{idn}a", [(0, "#e7c8ff"), (.3, "#9b5cff"), (1, "#2a0a5e")]) + _rg(f"{idn}i", [(0, "#fffbd0"), (.5, "#ffe14a"), (1, "#8a5a00")], "45%", "40%", "60%")
    o = [f'<defs>{d}</defs><g transform="translate({f(x)} {f(y)}) scale({s})">']
    for (x0, y0, cx_, cy_, x1, y1, w0) in [(-24, 16, -70, 0, -58, -52, 16), (24, 16, 72, 4, 62, -46, 16), (-16, 26, -30, 60, -46, 84, 15), (16, 26, 34, 58, 48, 84, 15)]:
        o.append(f'<path d="M{x0},{y0} Q{cx_},{cy_} {x1},{y1}" fill="none" stroke="#2a0a5e" stroke-width="{w0 + 4}" stroke-linecap="round"/>'
                 f'<path d="M{x0},{y0} Q{cx_},{cy_} {x1},{y1}" fill="none" stroke="url(#{idn}a)" stroke-width="{w0}" stroke-linecap="round"/>')
        for k in range(1, 7):
            t = k / 7; u = 1 - t
            px, py = u * u * x0 + 2 * u * t * cx_ + t * t * x1, u * u * y0 + 2 * u * t * cy_ + t * t * y1
            o.append(f'<circle cx="{f(px + 3)}" cy="{f(py + 3)}" r="{f(3.4 - t * 1.8)}" fill="#ffb3ec" stroke="#6a2a8a" stroke-width=".8"/>')
        o.append(f'<circle cx="{x1}" cy="{y1}" r="6" fill="url(#{idn}a)" stroke="#2a0a5e" stroke-width="2"/>')
    o.append(f'<ellipse cx="0" cy="-14" rx="40" ry="46" fill="url(#{idn}a)" stroke="#1a0640" stroke-width="3"/>')
    rr = random.Random(len(idn))
    o.append("".join(f'<circle cx="{f(rr.uniform(-30, 30))}" cy="{f(rr.uniform(-54, -30))}" r="{f(rr.uniform(1.5, 4))}" fill="#ff7ad9" opacity=".5"/>' for _ in range(10)))
    o.append('<path d="M-34,-36 Q-12,-60 18,-56" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round"/>')
    o.append('<ellipse cx="0" cy="-8" rx="21" ry="17" fill="#f6f2ff" stroke="#1a0640" stroke-width="2.4"/>'
             f'<circle cx="2" cy="-7" r="12" fill="url(#{idn}i)"/><ellipse cx="2" cy="-7" rx="3.2" ry="10" fill="#090410"/>'
             '<circle cx="-4" cy="-13" r="3.2" fill="#fff"/><path d="M-22,-10 Q0,-30 22,-10" fill="#7a3ad8" stroke="#1a0640" stroke-width="2.4"/>')
    o.append('</g>')
    return "".join(o)


def g_wraith(x, y, s, idn):
    """Tattered hooded cloak with folds, a void face with two burning eyes, a ring of runes and drifting embers."""
    d = _lg(f"{idn}c", [(0, "#6a7aa8"), (.45, "#2e3a5e"), (1, "#070912")]) + _rg(f"{idn}g", [(0, "#5ef0ff"), (1, "#5ef0ff00")], "50%", "50%", "50%")
    o = [f'<defs>{d}</defs><g transform="translate({f(x)} {f(y)}) scale({s})">']
    o.append(f'<circle cx="0" cy="-20" r="74" fill="url(#{idn}g)" opacity=".35"/>')
    o.append('<g fill="none" stroke="#5ef0ff" stroke-opacity=".55" stroke-width="1.6" filter="url(#glow)"><ellipse cx="0" cy="-22" rx="62" ry="16"/></g>')
    o.append("".join(f'<text x="{f(62 * math.cos(a))}" y="{f(-22 + 16 * math.sin(a) + 3)}" font-family="DejaVu Sans, sans-serif" font-size="8" fill="#a6fdff" text-anchor="middle" opacity=".8">{ch}</text>'
                     for a, ch in zip([i * math.pi / 4 for i in range(8)], "ᚠᚢᚦᚨᚱᚲᚷᚹ")))
    o.append(f'<path d="M0,-70 Q34,-58 36,-22 Q54,0 52,64 L40,54 L30,66 L18,54 L6,68 L-6,54 L-18,66 L-30,54 L-40,66 L-52,64 Q-54,0 -36,-22 Q-34,-58 0,-70 Z" fill="url(#{idn}c)" stroke="#05060c" stroke-width="2.4"/>')
    for k, xx in enumerate([-30, -14, 2, 20, 36]):
        o.append(f'<path d="M{xx},{-8 + abs(xx) * .3} Q{xx + 4},24 {xx - 2},58" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="3"/>'
                 f'<path d="M{xx + 3},{-6 + abs(xx) * .3} Q{xx + 7},24 {xx + 1},56" fill="none" stroke="#9fb0e0" stroke-opacity=".18" stroke-width="1.6"/>')
    o.append('<path d="M0,-70 Q32,-58 34,-24" fill="none" stroke="#a6fdff" stroke-opacity=".5" stroke-width="2"/>')
    o.append('<ellipse cx="0" cy="-30" rx="19" ry="24" fill="#010204"/>')
    for sx in (-1, 1):
        o.append(f'<ellipse cx="{sx * 8}" cy="-32" rx="5.5" ry="2" fill="#a6fdff" transform="rotate({-sx * 16} {sx * 8} -32)" filter="url(#glow)"/>')
    # claws
    o.append("".join(f'<path d="M{sx * 34},6 Q{sx * (46 + k * 3)},{-4 - k * 4} {sx * (50 + k * 2)},{-16 - k * 6}" fill="none" stroke="#dfe6f4" stroke-width="2.4" stroke-linecap="round"/>' for sx in (-1, 1) for k in range(3)))
    rr = random.Random(5)
    o.append("".join(f'<circle cx="{f(rr.uniform(-50, 50))}" cy="{f(rr.uniform(-80, 30))}" r="{f(rr.uniform(.8, 2))}" fill="#a6fdff" opacity="{rr.uniform(.4, .9):.2f}" filter="url(#glow)"/>' for _ in range(10)))
    o.append('</g>')
    return "".join(o)


def g_drone(x, y, s, idn):
    """Chrome sphere with panel seams and rivets, a glowing visor slit, side blasters, antenna and thruster."""
    d = _rg(f"{idn}m", [(0, "#ffffff"), (.25, "#c9d3e2"), (.7, "#5a6678"), (1, "#1a2030")])
    o = [f'<defs>{d}</defs><g transform="translate({f(x)} {f(y)}) scale({s})">']
    o.append(flash(0, 44, 22, "#ff5a3a", .7).replace("mix-blend-mode:screen", "mix-blend-mode:screen"))
    for sx in (-1, 1):
        o.append(f'<rect x="{-54 if sx < 0 else 30}" y="-14" width="24" height="18" rx="5" fill="#2c3442" stroke="#0b0f16" stroke-width="2"/>'
                 f'<rect x="{-52 if sx < 0 else 32}" y="-12" width="20" height="4" rx="2" fill="#cfd8e6" opacity=".7"/>'
                 f'<circle cx="{sx * 50}" cy="2" r="5" fill="#0b0f16"/><circle cx="{sx * 50}" cy="2" r="2.2" fill="#ff5a3a" filter="url(#glow)"/>')
    o.append('<path d="M10,-34 L22,-62" stroke="#5a6678" stroke-width="2.6"/><circle cx="23" cy="-64" r="3.4" fill="#ff3b3b" filter="url(#glow)"/>')
    o.append(f'<circle cx="0" cy="-6" r="34" fill="url(#{idn}m)" stroke="#0b0f16" stroke-width="2.6"/>')
    o.append('<path d="M-34,-4 Q0,10 34,-4" fill="none" stroke="#0b0f16" stroke-opacity=".6" stroke-width="2"/><path d="M0,-40 Q8,-6 0,28" fill="none" stroke="#0b0f16" stroke-opacity=".35" stroke-width="1.6"/>')
    o.append("".join(f'<circle cx="{f(c)}" cy="{f(v)}" r="1.4" fill="#eef4ff" opacity=".8"/>' for c, v in [(-24, 8), (-14, 16), (14, 16), (24, 8), (-28, -18), (28, -18)]))
    o.append('<rect x="-26" y="-24" width="52" height="16" rx="8" fill="#07090e" stroke="#2c3442" stroke-width="1.6"/>'
             '<rect x="-21" y="-18" width="42" height="4" rx="2" fill="#ff3b3b" filter="url(#glow)"/><circle cx="6" cy="-16" r="3.6" fill="#ffd0c8" filter="url(#glow)"/>')
    o.append('<ellipse cx="-12" cy="-30" rx="12" ry="5" fill="#fff" opacity=".55" transform="rotate(-24 -12 -30)"/>')
    o.append('</g>')
    return "".join(o)


def g_slime(x, y, s, idn):
    """Translucent orange blob with a lit core, bubbles inside, three eyes, a toothy grin and drips."""
    d = _rg(f"{idn}s", [(0, "#ffe6c4"), (.3, "#ff9a3a"), (.85, "#a83a06"), (1, "#5a1a02")], "38%", "30%", "75%") + _rg(f"{idn}k", [(0, "#fff3b0"), (1, "#ffd36a00")], "50%", "50%", "50%")
    o = [f'<defs>{d}</defs><g transform="translate({f(x)} {f(y)}) scale({s})">']
    pts = []
    for k in range(64):
        a = k / 64 * 2 * math.pi; r = 40 + 4 * math.sin(a * 3 + 1) + 2.5 * math.sin(a * 5 + 2)
        pts.append(f"{f(math.cos(a) * r * 1.06)},{f(-4 + math.sin(a) * r * (1.22 if math.sin(a) > 0 else 1))}")
    o.append(f'<polygon points="{" ".join(pts)}" fill="url(#{idn}s)" stroke="#4a1402" stroke-width="2.4" opacity=".96"/>')
    o.append(f'<circle cx="4" cy="12" r="20" fill="url(#{idn}k)" opacity=".5"/>')
    for (bx, by, br) in [(20, 14, 5), (-24, 18, 3.6), (8, 30, 3), (26, -8, 2.6), (-8, 22, 2.2)]:
        o.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="#fff3d0" fill-opacity=".25" stroke="#fff3d0" stroke-opacity=".5" stroke-width=".8"/>')
    for (dx, dl) in [(-30, 14), (14, 18), (32, 10)]:
        o.append(f'<path d="M{dx - 4},40 Q{dx},{40 + dl} {dx + 4},40" fill="#d95a10" stroke="#4a1402" stroke-width="1.4"/>')
    o.append('<ellipse cx="-17" cy="-30" rx="11" ry="5" fill="#fff" opacity=".6" transform="rotate(-28 -17 -30)"/>')
    for (ex, ey, er) in [(-14, -15, 9.5), (12, -22, 7.5), (5, -4, 5.2)]:
        o.append(f'<circle cx="{ex}" cy="{ey}" r="{er}" fill="#fff" stroke="#4a1402" stroke-width="1.4"/><circle cx="{f(ex + er * .2)}" cy="{f(ey + er * .15)}" r="{f(er * .5)}" fill="#1a0a02"/>'
                 f'<circle cx="{f(ex - er * .15)}" cy="{f(ey - er * .25)}" r="{f(er * .18)}" fill="#fff"/>')
    o.append('<path d="M-22,8 Q0,32 24,6 Q0,18 -22,8 Z" fill="#2a0d02"/>' + "".join(f'<path d="M{f(-16 + k * 6.6)},10 l3,6 l3,-6Z" fill="#fff6e6"/>' for k in range(6)))
    o.append('</g>')
    return "".join(o)


def g_golem(x, y, s, idn):
    """Faceted boulder body, stone fists, magma cracks and ember eyes."""
    o = [f'<g transform="translate({f(x)} {f(y)}) scale({s})">']
    facets = [([(-36, -40), (-10, -58), (4, -30)], "#b8a48e"), ([(-10, -58), (24, -52), (4, -30)], "#a08c76"), ([(24, -52), (40, -18), (4, -30)], "#7a6856"),
              ([(-36, -40), (4, -30), (-40, -8)], "#94826f"), ([(4, -30), (40, -18), (34, 22)], "#5e4e40"), ([(-40, -8), (4, -30), (0, 30), (-32, 22)], "#806e5c"), ([(4, -30), (34, 22), (0, 30)], "#4a3e33")]
    for sx in (-1, 1):
        o.append(f'<polygon points="{sx * 60},-30 {sx * 46},-48 {sx * 30},-42 {sx * 28},-16 {sx * 42},-4 {sx * 58},-12" fill="#8a7864" stroke="#2f2721" stroke-width="2"/>'
                 f'<path d="M{sx * 50},-40 L{sx * 40},-24" stroke="#ff6a1f" stroke-width="2" filter="url(#glow)"/>')
    for pts, col in facets:
        o.append(f'<polygon points="{" ".join(f"{a},{b}" for a, b in pts)}" fill="{col}" stroke="#2f2721" stroke-width="1.6" stroke-linejoin="round"/>')
    o.append('<path d="M-24,-30 L-12,-20 L-16,-6 L-4,6 M18,-38 L10,-24 L20,-10" fill="none" stroke="#ff6a1f" stroke-width="2.4" filter="url(#glow)"/>')
    o.append('<rect x="-20" y="-28" width="40" height="11" rx="4" fill="#1a1410"/>' + "".join(f'<circle cx="{sx * 9}" cy="-22.5" r="3" fill="#ffc04a" filter="url(#glow)"/>' for sx in (-1, 1)))
    o.append('<path d="M-34,-40 L-10,-57 L22,-51" fill="none" stroke="#e8dccb" stroke-opacity=".5" stroke-width="1.6"/>')
    o.append('</g>')
    return "".join(o)


def gallery_v143():
    d = (_lg("hw", [(0, "#0d1018"), (.55, "#141823"), (1, "#07080c")]) + _lg("win", [(0, "#060814"), (1, "#1a1030")]) +
         _rg("planet", [(0, "#ffe2a8"), (.4, "#d8782a"), (.85, "#5a2410"), (1, "#2a0e06")], "35%", "35%", "70%") +
         _lg("steel", [(0, "#4a5262"), (.5, "#2a303c"), (1, "#151820")]) + _lg("crate", [(0, "#5a6a3a"), (1, "#2a3418")]) +
         '<linearGradient id="laser" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe3ee" stop-opacity="0"/><stop offset=".6" stop-color="#7fe3ee"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'
         '<pattern id="haz" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="22" height="22" fill="#1a1a1a"/><rect width="11" height="22" fill="#e8b020"/></pattern>')
    p = ['<rect width="640" height="440" fill="url(#hw)"/>']
    # the hangar's big viewport onto space with a planet, framed by struts
    p.append('<rect x="-10" y="18" width="660" height="196" fill="url(#win)"/>' + stars(77, 90, 210))
    p.append('<g opacity=".7"><circle cx="560" cy="60" r="120" fill="url(#planet)"/><ellipse cx="560" cy="60" rx="190" ry="22" fill="none" stroke="#ffd9a0" stroke-opacity=".25" stroke-width="4" transform="rotate(-10 560 60)"/></g>')
    for x in range(-20, 680, 160):
        p.append(f'<polygon points="{x},18 {x + 26},18 {x + 40},214 {x + 14},214" fill="url(#steel)"/>')
    p.append('<rect x="-10" y="10" width="660" height="14" fill="url(#steel)"/><rect x="-10" y="210" width="660" height="10" fill="url(#steel)"/>')
    p.append("".join(f'<circle cx="{x}" cy="232" r="3" fill="#ff3b3b" opacity=".8" filter="url(#glow)"/>' for x in range(40, 640, 120)))
    # back row (soft): drone, golem and slime behind the far railing
    back = [g_drone(110, 190, .95, "bd"), g_golem(330, 206, .9, "bg"), g_slime(548, 206, .9, "bs")]
    p.append(f'<g filter="url(#dof)" opacity=".92">{"".join(back)}</g>')
    p.append('<g filter="url(#dof)"><rect x="-10" y="242" width="660" height="10" fill="#3a4252"/><rect x="-10" y="242" width="660" height="2" fill="#aab6c8" opacity=".6"/>'
             + "".join(f'<rect x="{x}" y="252" width="6" height="34" fill="#2a303c"/>' for x in range(10, 640, 44)) + '<rect x="-10" y="284" width="660" height="20" fill="#1c212b"/></g>')
    # middle row: kraken behind a crate on the left, wraith behind the barricade on the right
    p.append(g_kraken(118, 300, 1.05, "mk"))
    p.append(g_wraith(566, 292, 1.05, "mw"))
    for (x, w) in [(40, 160)]:
        p.append(f'<rect x="{x}" y="328" width="{w}" height="86" rx="4" fill="url(#crate)" stroke="#121a08" stroke-width="3"/><rect x="{x + 10}" y="338" width="{w - 20}" height="66" fill="none" stroke="#8a9a5a" stroke-opacity=".4" stroke-width="2"/>'
                 f'<line x1="{x + 10}" y1="338" x2="{x + w - 10}" y2="404" stroke="#8a9a5a" stroke-opacity=".3" stroke-width="2"/><rect x="{x + w / 2 - 22}" y="362" width="44" height="12" fill="#1a2210"/>')
    p.append('<rect x="476" y="326" width="180" height="88" fill="url(#steel)" stroke="#0b0d12" stroke-width="3"/><rect x="476" y="326" width="180" height="16" fill="url(#haz)" opacity=".9"/>')
    # the hero: the mantis in the middle, struck under the crosshair
    hx, hy = 242, 126
    p.append(f'<polygon points="700,470 724,430 {hx + 6},{hy - 4} {hx - 4},{hy + 6}" fill="url(#laser)" opacity=".85" filter="url(#glow)"/>')
    p.append(f'<line x1="712" y1="452" x2="{hx}" y2="{hy}" stroke="#ffffff" stroke-width="3" opacity=".9"/>')
    p.append(f'<g filter="url(#shadow)" transform="rotate(-6 300 330)">{g_mantis(300, 272, 1.6, "hm")}</g>')
    p.append(flash(hx, hy, 64, "#7fe3ee", .8))
    p.append(burst(hx, hy, 20, 14, 92, "#e9feff", seed=4, w=2.2))
    p.append(sparks(hx, hy, 34, 9, ["#ffffff", "#7fe3ee", "#e2ff7a", "#ffd36a"], 150))
    # chips of the struck scythe
    rr = random.Random(12)
    p.append("".join(f'<polygon points="{f(hx + a)},{f(hy + b)} {f(hx + a + 7)},{f(hy + b + 3)} {f(hx + a + 2)},{f(hy + b + 8)}" fill="#c8ff7a" stroke="#14400c" stroke-width="1" transform="rotate({rr.randint(0, 180)} {f(hx + a)} {f(hy + b)})"/>'
                     for a, b in [(rr.uniform(-70, 70), rr.uniform(-60, 40)) for _ in range(9)]))
    p.append(f'<g stroke="#ff2d55" stroke-width="3" fill="none" filter="url(#glow)"><circle cx="{hx}" cy="{hy}" r="42"/><circle cx="{hx}" cy="{hy}" r="7"/>'
             f'<line x1="{hx - 64}" y1="{hy}" x2="{hx - 50}" y2="{hy}"/><line x1="{hx + 50}" y1="{hy}" x2="{hx + 64}" y2="{hy}"/>'
             f'<line x1="{hx}" y1="{hy - 64}" x2="{hx}" y2="{hy - 50}"/><line x1="{hx}" y1="{hy + 50}" x2="{hx}" y2="{hy + 64}"/></g>')
    # floor edge and the two blasters at the bottom corners, the right one firing
    p.append('<rect x="-10" y="412" width="660" height="40" fill="#0b0d12"/><rect x="-10" y="412" width="660" height="8" fill="url(#haz)" opacity=".85"/>')
    for (bx, rot, firing) in [(70, 24, False), (612, -26, True)]:
        p.append(f'<g transform="rotate({rot} {bx} 470)"><rect x="{bx - 16}" y="350" width="32" height="130" rx="10" fill="url(#steel)" stroke="#05060a" stroke-width="3"/>'
                 f'<rect x="{bx - 10}" y="356" width="20" height="10" rx="3" fill="#7fe3ee" opacity="{.9 if firing else .5}" filter="url(#glow)"/><rect x="{bx - 12}" y="380" width="24" height="6" fill="#0b0d12"/>'
                 f'<rect x="{bx - 12}" y="392" width="24" height="6" fill="#0b0d12"/></g>')
    p.append(flash(600, 360, 40, "#bff6ff", .9))
    p.append(cine(330, 230, key="#bff6ff", strength=.62, flare_w=0))
    return svg("".join(p), extra_defs=d)


covers["shot-gallery"] = gallery_v143()
covers["reaction-test"] = covers["shot-gallery"]



# ---------- v153 ----------
# Orb Burst: the falling orbs lose their drop-shaped trails; the launcher becomes a real cannon (bolted turret plate,
# a tapered barrel with cooling fins and a lit muzzle aimed at the burst, the shot seated in the breech).
def orb_v153():
    src = orb()
    # drop the trail paths of the three falling orbs (they read as drops behind the orbs)
    for (x, y, c) in [(240, 300, "#b98cff"), (520, 316, "#5cffb0"), (468, 372, "#4fa8ff")]:
        src = src.replace(trail([(x, y - 90 + t * 9) for t in range(10)], c, 30, .28), "")
    # remove the old launcher (ring base, lit segments, pink halo and the loaded shot) and redraw it as a cannon
    old = ['<ellipse cx="320" cy="456" rx="150" ry="46" fill="url(#launcher)" stroke="#7fe3ee" stroke-width="3"/>',
           '<circle cx="320" cy="404" r="48" fill="#ff6f91" opacity=".25" filter="url(#bigglow)"/>',
           sphere(320, 404, 36, "#ff6f91", "shot", shadow=False, gloss=.8)]
    for k in range(14):
        a = math.pi + k * math.pi / 13
        old.append(f'<circle cx="{f(320 + 132 * math.cos(a))}" cy="{f(456 + 38 * math.sin(a))}" r="3" fill="{"#7fe3ee" if k % 2 else "#2a5560"}" filter="url(#glow)"/>')
    for o in old:
        assert o in src, o[:60]
        src = src.replace(o, "")
    cx, cy = 320, 404
    tx, ty = 370, 230  # aim: the gap under the burst
    ang = math.degrees(math.atan2(ty - cy, tx - cx))
    d = ('<linearGradient id="cnPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f7a98"/><stop offset=".45" stop-color="#1d3a54"/><stop offset="1" stop-color="#08121d"/></linearGradient>'
         '<linearGradient id="cnTube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4f7ff"/><stop offset=".28" stop-color="#7cc0da"/><stop offset=".62" stop-color="#22506e"/><stop offset="1" stop-color="#0a1a29"/></linearGradient>'
         '<linearGradient id="cnMuzzle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#ff6f91"/><stop offset="1" stop-color="#3a0a18"/></linearGradient>'
         '<radialGradient id="cnDome" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#b4e6f6"/><stop offset=".5" stop-color="#2a5878"/><stop offset="1" stop-color="#081626"/></radialGradient>')
    c = [f'<defs>{d}</defs>']
    # turret plate with a bevel, a lit inner ring and bolts
    c.append(f'<ellipse cx="{cx}" cy="{cy + 52}" rx="168" ry="50" fill="#000" opacity=".45" filter="url(#soft)"/>')
    c.append(f'<ellipse cx="{cx}" cy="{cy + 40}" rx="150" ry="44" fill="url(#cnPlate)" stroke="#9fe3f6" stroke-width="3"/>')
    c.append(f'<path d="M{cx - 132},{cy + 34} A132,34 0 0 1 {cx + 132},{cy + 34}" fill="none" stroke="#ffffff" stroke-opacity=".28" stroke-width="2"/>')
    c.append(f'<ellipse cx="{cx}" cy="{cy + 34}" rx="96" ry="26" fill="none" stroke="#ff6f91" stroke-width="3" opacity=".85" filter="url(#glow)"/>')
    for k in range(12):
        a = k * 2 * math.pi / 12 + .26
        bx, by = cx + 128 * math.cos(a), cy + 40 + 36 * math.sin(a)
        c.append(f'<circle cx="{f(bx)}" cy="{f(by)}" r="4.2" fill="#a9cede" stroke="#0a1622" stroke-width="1.4"/><circle cx="{f(bx - 1)}" cy="{f(by - 1.2)}" r="1.4" fill="#fff" opacity=".7"/>')
    # barrel: tapered, shaded across its width, fins, muzzle ring lit pink
    c.append(f'<g transform="translate({cx} {cy}) rotate({ang:.2f})" filter="url(#shadow)">'
             '<polygon points="20,-30 118,-21 118,21 20,30" fill="url(#cnTube)" stroke="#06111c" stroke-width="3"/>'
             + "".join(f'<line x1="{x0}" y1="{-28 + (x0 - 20) * .09:.1f}" x2="{x0}" y2="{28 - (x0 - 20) * .09:.1f}" stroke="#06111c" stroke-opacity=".75" stroke-width="3.2"/>' for x0 in (52, 64, 76))
             + '<rect x="28" y="-25" width="84" height="5" rx="2.5" fill="#ffffff" opacity=".55"/>'
             '<rect x="112" y="-26" width="18" height="52" rx="6" fill="url(#cnMuzzle)" stroke="#06111c" stroke-width="2.6"/>'
             '<rect x="114" y="-24" width="4" height="48" rx="2" fill="#fff" opacity=".5"/>'
             '<ellipse cx="131" cy="0" rx="5" ry="20" fill="#ff6f91" opacity=".55" filter="url(#glow)"/></g>')
    # breech housing and the loaded shot
    c.append(f'<circle cx="{cx}" cy="{cy}" r="54" fill="url(#cnDome)" stroke="#bdf0ff" stroke-width="3"/>')
    c.append(f'<circle cx="{cx}" cy="{cy}" r="45" fill="none" stroke="#06111c" stroke-width="4"/>')
    c.append(f'<path d="M{cx - 44},{cy - 18} A48,48 0 0 1 {cx + 10},{cy - 47}" fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>')
    c.append(f'<circle cx="{cx}" cy="{cy}" r="46" fill="#ff6f91" opacity=".22" filter="url(#bigglow)"/>')
    c.append(sphere(cx, cy, 36, "#ff6f91", "shot", shadow=False, gloss=.8))
    # aim dots now start at the muzzle: drop the first three that sat on the barrel
    sx, sy, bx, by = 320, 404, 400, 160
    for q in range(1, 5):
        t = q / 13
        x, y = sx + (bx - 30 - sx) * t, sy + (by + 70 - sy) * t
        dot = f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(4.6 - t * 2.4)}" fill="#e9fbff" opacity="{.95 - t * .55:.2f}" filter="url(#glow)"/>'
        src = src.replace(dot, "")
    # the next orb waits beside the plate (drawn after the cannon so it stays visible)
    nxt = f'<g opacity=".8">{sphere(420, 428, 18, "#5cffb0", "nextshot", shadow=False)}</g>'
    src = src.replace(nxt, "")
    i = src.index(sparkle(400, 160, 24, "#fff8e0"))
    return src[:i] + "".join(c) + f'<g opacity=".9">{sphere(470, 430, 20, "#5cffb0", "nextshot", shadow=False)}</g>' + src[i:]


covers["orb-burst"] = orb_v153()


# ---------- v162: Solitaire Sprint, finer cards ----------
# Real pip layouts on the number cards (the lower pips turned round, as printed), framed court portraits on K, Q and
# J, a woven felt and the game's blue striped backs on the columns around.
_card_v143 = card_v143
PIPS = {"6": [(.3, .2), (.7, .2), (.3, .5), (.7, .5), (.3, .8), (.7, .8)],
        "7": [(.3, .2), (.7, .2), (.5, .35), (.3, .5), (.7, .5), (.3, .8), (.7, .8)],
        "8": [(.3, .2), (.7, .2), (.5, .35), (.3, .5), (.7, .5), (.5, .65), (.3, .8), (.7, .8)],
        "9": [(.3, .2), (.7, .2), (.3, .4), (.7, .4), (.5, .5), (.3, .6), (.7, .6), (.3, .8), (.7, .8)],
        "10": [(.3, .2), (.7, .2), (.5, .3), (.3, .4), (.7, .4), (.3, .6), (.7, .6), (.5, .7), (.3, .8), (.7, .8)]}


def card_v162(x, y, rank, suit, red, rot, s, idn):
    col = "#d11f3a" if red else "#131a2a"
    w, h = 150 * s, 212 * s
    base = _card_v143(x, y, rank, suit, red, rot, s, idn)
    # strip the single big centre symbol of the v143 card and draw the real centre instead
    face = {"K": "♚", "Q": "♛", "J": "♞"}.get(rank)
    if face:
        big = (f'<text x="{f(x + w / 2)}" y="{f(y + h * .66)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="{f(92 * s)}" fill="{col}" text-anchor="middle">{face}</text>'
               f'<text x="{f(x + w / 2)}" y="{f(y + h * .86)}" font-family="Arial, sans-serif" font-size="{f(34 * s)}" fill="{col}" text-anchor="middle">{suit}</text>')
    else:
        big = f'<text x="{f(x + w / 2)}" y="{f(y + h * .7)}" font-family="Arial, sans-serif" font-size="{f(96 * s)}" fill="{col}" text-anchor="middle">{suit}</text>'
    assert big in base, rank
    if face:
        fx0, fy0, fw, fh = x + w * .24, y + h * .2, w * .52, h * .6
        band = "#2d5bd1" if not red else "#c8232f"
        centre = (f'<rect x="{f(fx0)}" y="{f(fy0)}" width="{f(fw)}" height="{f(fh)}" rx="{f(4 * s)}" fill="#f4e7c4" stroke="{band}" stroke-width="{f(2.4 * s)}"/>'
                  f'<rect x="{f(fx0 + 4 * s)}" y="{f(fy0 + 4 * s)}" width="{f(fw - 8 * s)}" height="{f(fh - 8 * s)}" rx="{f(3 * s)}" fill="none" stroke="#d8b86a" stroke-width="{f(1.2 * s)}"/>'
                  f'<line x1="{f(fx0)}" y1="{f(fy0 + fh / 2)}" x2="{f(fx0 + fw)}" y2="{f(fy0 + fh / 2)}" stroke="{band}" stroke-width="{f(1.2 * s)}" opacity=".6"/>'
                  f'<text x="{f(x + w / 2)}" y="{f(fy0 + fh * .47)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="{f(52 * s)}" fill="{col}" text-anchor="middle">{face}</text>'
                  f'<g transform="rotate(180 {f(x + w / 2)} {f(fy0 + fh * .75)})"><text x="{f(x + w / 2)}" y="{f(fy0 + fh * .97)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="{f(52 * s)}" fill="{col}" text-anchor="middle" opacity=".9">{face}</text></g>'
                  f'<text x="{f(fx0 + 9 * s)}" y="{f(fy0 + 20 * s)}" font-family="Arial, sans-serif" font-size="{f(16 * s)}" fill="{col}">{suit}</text>')
    elif rank in PIPS:
        centre = ""
        for (u, v) in PIPS[rank]:
            px, py = x + w * (.5 + (u - .5) * .78), y + h * (.25 + v * .6)
            flip = f' transform="rotate(180 {f(px)} {f(py - 26 * s * .36)})"' if v > .5 else ""
            centre += f'<text x="{f(px)}" y="{f(py)}" font-family="Arial, sans-serif" font-size="{f(26 * s)}" fill="{col}" text-anchor="middle"{flip}>{suit}</text>'
    else:
        centre = big
    return base.replace(big, centre)


def solitaire_v162():
    global card_v143
    card_v143 = card_v162
    try:
        src = solitaire_v143()
    finally:
        card_v143 = _card_v143
    # woven felt over the flat dots, and the game's striped blue backs on the soft side columns
    src = src.replace('<rect width="640" height="440" fill="url(#felt)"/>',
                      '<rect width="640" height="440" fill="url(#felt)"/><rect width="640" height="440" fill="#000" filter="url(#weave)" opacity=".22"/>', 1)
    src = src.replace('</defs>', '<filter id="weave" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .35" numOctaves="2" seed="9"/>'
                      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1"/></filter>'
                      '<pattern id="backStripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#2856b8"/><rect width="5" height="10" fill="#3a6fd6"/></pattern></defs>', 1)
    src = src.replace('fill="#7a1a2e" stroke="#ffd0a0" stroke-opacity=".35"', 'fill="url(#backStripes)" stroke="#bcd0ff" stroke-opacity=".45"')
    return src


covers["solitaire-sprint"] = solitaire_v162()


# ---------- v164: Solitaire Sprint — the victory cascade ----------
# The game's best moment: the four foundations are complete and glowing gold, and the kings leap off them in the
# classic bouncing cascade, each leaving a fan of card copies along its bounces across a lit green baize.
def solitaire_v164():
    d = ('<radialGradient id="sv4felt" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="#1fae78"/><stop offset=".45" stop-color="#0b6a48"/><stop offset="1" stop-color="#021a12"/></radialGradient>'
         '<radialGradient id="sv4lamp" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#fff4d6" stop-opacity=".5"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>'
         '<radialGradient id="sv4gold" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd76a" stop-opacity=".75"/><stop offset="1" stop-color="#ffd76a" stop-opacity="0"/></radialGradient>'
         '<filter id="sv4weave" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9 .35" numOctaves="2" seed="9"/>'
         '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1"/></filter>')
    p = ['<rect width="640" height="440" fill="url(#sv4felt)"/>', '<rect width="640" height="440" fill="#000" filter="url(#sv4weave)" opacity=".2"/>',
         '<ellipse cx="400" cy="40" rx="380" ry="260" fill="url(#sv4lamp)" style="mix-blend-mode:screen"/>']
    # the gold-stitched rail round the table
    p.append('<rect x="14" y="14" width="612" height="412" rx="26" fill="none" stroke="#e9c27a" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 6"/>')
    s = .5
    w, h = 150 * s, 212 * s
    # foundations, top right: the four kings on their completed piles, a gold glow under each
    found = [("Q", "♠", False), ("K", "♥", True), ("K", "♣", False), ("Q", "♦", True)]
    fx0, fy0 = 300, 26
    for i, (rk, su, red) in enumerate(found):
        x = fx0 + i * (w + 10)
        p.append(f'<ellipse cx="{f(x + w / 2)}" cy="{f(fy0 + h / 2)}" rx="{f(w * .9)}" ry="{f(h * .75)}" fill="url(#sv4gold)"/>')
        for k in range(3):
            p.append(f'<rect x="{f(x + k * 1.6)}" y="{f(fy0 + k * 1.6)}" width="{f(w)}" height="{f(h)}" rx="7" fill="#efe6cf" stroke="#bfa66a" stroke-width=".8"/>')
        p.append(card_v162(x - 3, fy0 - 3, rk, su, red, 0, s, f"f{i}"))
    # the cascade: two kings bouncing out, each leaving its fan of copies
    def bounce(x0, y0, vx, g, floor, n, step):
        pts, x, y, vy = [], x0, y0, -2.0
        for _ in range(n):
            pts.append((x, y))
            x += vx * step; vy += g * step; y += vy * step
            if y > floor: y, vy = floor, -abs(vy) * .78
        return pts
    # the classic victory cascade: two kings leap off their piles and bounce across the baize, each bounce printed
    # as a ribbon of opaque copies (newest on top), the leading card sharp and lit
    ribbons = [("K", "♠", False, 300, -8.6, 30, 1.05, "ka"), ("K", "♦", True, 300 + 3 * (w + 10), -6.2, 34, 1.0, "kd")]
    ends = []
    for (rk, su, red, x0, vx, n, step, tag) in ribbons:
        pts = bounce(x0, fy0, vx, 3.0, 440 - h - 8, n, step)[3:]
        for j, (x, y) in enumerate(pts):
            p.append(card_v162(x, y, rk, su, red, 0, s, f"{tag}{j}"))
        ends.append(pts[-1])
    for (x, y) in ends:
        p.append(f'<ellipse cx="{f(x + w / 2)}" cy="{f(y + h / 2)}" rx="{f(w * .9)}" ry="{f(h * .7)}" fill="url(#sv4gold)" opacity=".55" style="mix-blend-mode:screen"/>')
    pts = [ends[0]]
    lx, ly = pts[-1]
    p.append(sparkle(fx0 + w * 2.2, fy0 + 6, 13, "#fff3b0") + sparkle(fx0 + w * 4.3, fy0 + h - 10, 11, "#fff3b0") + sparkle(lx + w * 1.1, ly + 4, 14, "#ffffff") + sparkle(lx - 10, ly + h * .9, 9, "#fff3b0"))
    p.append(cine(360, 160, key="#fff1c8", flare="#ffe7a8", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)


covers["solitaire-sprint"] = solitaire_v164()

# ---------- v162: Orb Burst without the loose orbs on the right ----------
# The two orbs falling on the right and the next orb beside the cannon read as orbs crossing the line (a lost game):
# they go. The burst gets gold glass shards flying out of it instead.
def orb_v162():
    src = orb_v153()
    def orb_at(x, y, rad, c, idn):
        return (f'<circle cx="{f(x + 2)}" cy="{f(y + 5)}" r="{f(rad)}" fill="#000" opacity=".35" filter="url(#dof)"/>'
                + sphere(x, y, rad, c, idn, shadow=False, gloss=.75)
                + f'<path d="M{f(x + rad * .2)},{f(y + rad * .96)} A{f(rad)},{f(rad)} 0 0 0 {f(x + rad * .96)},{f(y + rad * .2)}" fill="none" stroke="{c}" stroke-width="2.2" opacity=".9" filter="url(#glow)"/>')
    for (x, y, c) in [(520, 316, "#5cffb0"), (468, 372, "#4fa8ff")]:
        o = orb_at(x, y, 26, c, f"dr{x}")
        assert o in src, x
        src = src.replace(o, "")
    nxt = f'<g opacity=".9">{sphere(470, 430, 20, "#5cffb0", "nextshot", shadow=False)}</g>'
    assert nxt in src
    src = src.replace(nxt, "")
    bx, by = 400, 160
    rr = random.Random(162)
    shards = []
    for q in range(16):
        a = q * 2 * math.pi / 16 + rr.uniform(-.2, .2); dd = rr.uniform(58, 128); sz = rr.uniform(5, 11)
        x, y = bx + math.cos(a) * dd, by + math.sin(a) * dd
        rot = math.degrees(a) + rr.uniform(-40, 40)
        shards.append(f'<g transform="translate({f(x)} {f(y)}) rotate({rot:.0f})"><polygon points="{f(-sz)},{f(-sz * .4)} {f(sz)},0 {f(-sz * .6)},{f(sz * .55)}" fill="#ffd23f" opacity=".9"/>'
                      f'<polygon points="{f(-sz)},{f(-sz * .4)} {f(sz)},0 {f(-sz * .2)},{f(-sz * .1)}" fill="#fff8d8" opacity=".85"/></g>')
    i = src.index(sparkle(400, 160, 24, "#fff8e0"))
    return src[:i] + f'<g filter="url(#glow)">{"".join(shards)}</g>' + src[i:]


covers["orb-burst"] = orb_v162()


# ---------- v164: Orb Burst with clear air between the cluster and the cannon ----------
def orb_v164():
    global ORB_SKIP
    ORB_SKIP = {(4, 3), (4, 4), (4, 5), (4, 6), (4, 7)}
    try:
        src = orb_v162()
    finally:
        ORB_SKIP = set()
    # the loose purple orb beside the cannon goes too
    def orb_at(x, y, rad, c, idn):
        return (f'<circle cx="{f(x + 2)}" cy="{f(y + 5)}" r="{f(rad)}" fill="#000" opacity=".35" filter="url(#dof)"/>'
                + sphere(x, y, rad, c, idn, shadow=False, gloss=.75)
                + f'<path d="M{f(x + rad * .2)},{f(y + rad * .96)} A{f(rad)},{f(rad)} 0 0 0 {f(x + rad * .96)},{f(y + rad * .2)}" fill="none" stroke="{c}" stroke-width="2.2" opacity=".9" filter="url(#glow)"/>')
    o = orb_at(240, 300, 26, "#b98cff", "dr240")
    assert o in src
    return src.replace(o, "")


# v178: the owner asked for the previous Orb Burst cover back (v162, with the loose orbs beside the cannon).
covers["orb-burst"] = orb_v162()

# ---------- v162: Mine Grid that reads as the game ----------
# A real minesweeper position: the gold start cell has just been tapped and the field opens around it; every number
# counts the mines around it, and the flags stand exactly on mines that those numbers prove. Graphite tiles and neon
# digits as in the game, under a Saturn-lit sky.
def mine_v162():
    COLS, ROWS = 12, 10
    mines = {(1, 1), (4, 0), (8, 1), (10, 2), (0, 4), (3, 3), (9, 4), (2, 6), (7, 7), (10, 7), (4, 8), (11, 9), (1, 9), (6, 0)}
    start = (6, 5)
    def around(c, r):
        return [(c + dc, r + dr) for dc in (-1, 0, 1) for dr in (-1, 0, 1) if (dc or dr) and 0 <= c + dc < COLS and 0 <= r + dr < ROWS]
    count = {(c, r): sum((q in mines) for q in around(c, r)) for c in range(COLS) for r in range(ROWS)}
    opened, todo = set(), [start]
    while todo:
        q = todo.pop()
        if q in opened or q in mines: continue
        opened.add(q)
        if count[q] == 0: todo += around(*q)
    flags = {m for m in mines if any(n in opened for n in around(*m))}
    # perspective: far rows smaller and higher
    HZ, FOOT, CW = -330.0, 560.0, 66.0
    def P(u, v):  # u along columns, v along rows (0 far … ROWS near)
        sc = 1 / (1 + (ROWS - v) * .085)
        return 320 + (u - COLS / 2) * CW * sc, HZ + (FOOT - HZ) * sc, sc
    d = ('<linearGradient id="mgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04050b"/><stop offset=".55" stop-color="#0d1022"/><stop offset="1" stop-color="#241a2c"/></linearGradient>'
         '<linearGradient id="mgTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5163"/><stop offset=".5" stop-color="#2a2f3b"/><stop offset="1" stop-color="#171a22"/></linearGradient>'
         '<linearGradient id="mgOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090c16"/><stop offset="1" stop-color="#121829"/></linearGradient>'
         '<linearGradient id="mgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#e9b443"/><stop offset="1" stop-color="#9a6a12"/></linearGradient>'
         '<radialGradient id="mgPlanet" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#f3d8a8"/><stop offset=".6" stop-color="#b9875a"/><stop offset="1" stop-color="#3a2416"/></radialGradient>'
         '<radialGradient id="mgPulse" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".9"/><stop offset=".5" stop-color="#7fe3ee" stop-opacity=".35"/><stop offset="1" stop-color="#7fe3ee" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="mgFlag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a6a"/><stop offset="1" stop-color="#b3122a"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#mgSky)"/>', stars(31, 70, 150)]
    # Saturn on the horizon, its rings tilted behind the field
    p.append('<g transform="rotate(-14 540 64)"><path d="M436,64 A104,20 0 0 1 644,64" fill="none" stroke="#d9b98a" stroke-width="6" opacity=".45"/>'
             '<circle cx="540" cy="64" r="40" fill="url(#mgPlanet)"/>'
             '<path d="M436,64 A104,20 0 0 0 644,64" fill="none" stroke="#f0d6a6" stroke-width="6" opacity=".75"/></g>')
    p.append(bokeh(23, ["#7fe3ee", "#ffd36a", "#b48cff"], 10, 200, 10, 34, (.06, .16)))
    num_col = {1: "#7fe3ee", 2: "#5cffb0", 3: "#ffd23f", 4: "#ff6fd8"}
    items, flag_items = [], []
    for r in range(ROWS):
        for c in range(COLS):
            g = .06  # gap
            a, b2, c2, d2 = P(c + g, r + g), P(c + 1 - g, r + g), P(c + 1 - g, r + 1 - g), P(c + g, r + 1 - g)
            poly = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in (a, b2, c2, d2))
            sc = (a[2] + c2[2]) / 2
            cxm, cym = (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2
            out = []
            if (c, r) in opened:
                out.append(f'<polygon points="{poly}" fill="url(#mgOpen)" stroke="#2a3550" stroke-width="{f(1.2 * sc)}"/>')
                n = count[(c, r)]
                if n:
                    col = num_col.get(n, "#ffffff")
                    out.append(f'<text x="{f(cxm)}" y="{f(cym + 13 * sc)}" font-family="Arial Black, sans-serif" font-size="{f(38 * sc)}" fill="{col}" text-anchor="middle" filter="url(#glow)" transform="translate({f(cxm)} {f(cym)}) scale(1 .8) translate({f(-cxm)} {f(-cym)})">{n}</text>')
            else:
                lift = 7 * sc
                top = " ".join(f"{f(x)},{f(y - lift)}" for (x, y, _) in (a, b2, c2, d2))
                side = f"{f(d2[0])},{f(d2[1] - lift)} {f(c2[0])},{f(c2[1] - lift)} {f(c2[0])},{f(c2[1])} {f(d2[0])},{f(d2[1])}"
                out.append(f'<polygon points="{side}" fill="#0b0d12"/>')
                out.append(f'<polygon points="{top}" fill="url(#mgTile)" stroke="#6d7790" stroke-opacity=".55" stroke-width="{f(1.1 * sc)}"/>')
                out.append(f'<line x1="{f(a[0] + 3 * sc)}" y1="{f(a[1] - lift + 1.5 * sc)}" x2="{f(b2[0] - 3 * sc)}" y2="{f(b2[1] - lift + 1.5 * sc)}" stroke="#ffffff" stroke-opacity=".28" stroke-width="{f(1.4 * sc)}"/>')
                if (c, r) in flags:
                    px, py = cxm - 6 * sc, cym - lift
                    hgt = 36 * sc
                    fl = []
                    fl.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(6 * sc)}" ry="{f(2.4 * sc)}" fill="#000" opacity=".5"/>')
                    fl.append(f'<line x1="{f(px)}" y1="{f(py)}" x2="{f(px)}" y2="{f(py - hgt)}" stroke="#d9dee8" stroke-width="{f(2.6 * sc)}" stroke-linecap="round"/>')
                    fl.append(f'<path d="M{f(px)},{f(py - hgt)} Q{f(px + 16 * sc)},{f(py - hgt - 4 * sc)} {f(px + 28 * sc)},{f(py - hgt + 8 * sc)} Q{f(px + 16 * sc)},{f(py - hgt + 14 * sc)} {f(px)},{f(py - hgt + 20 * sc)} Z" fill="url(#mgFlag)" filter="url(#glow)"/>')
                    flag_items.append((r, "".join(fl)))
            items.append((r, "".join(out)))
    p += [x for (_, x) in sorted(items, key=lambda t: t[0])]
    # the tapped gold start cell, glowing, with the reveal wave rippling out over the opened field
    c, r = start
    a, c2 = P(c + .06, r + .06), P(c + .94, r + .94)
    cxm, cym, sc = (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, (a[2] + c2[2]) / 2
    pts = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in (P(c + .06, r + .06), P(c + .94, r + .06), P(c + .94, r + .94), P(c + .06, r + .94)))
    p.append(f'<polygon points="{pts}" fill="url(#mgGold)" opacity=".92" filter="url(#glow)"/>')
    p.append(f'<ellipse cx="{f(cxm)}" cy="{f(cym)}" rx="{f(170 * sc)}" ry="{f(90 * sc)}" fill="url(#mgPulse)" style="mix-blend-mode:screen"/>')
    for k, rr in enumerate((70, 130, 200)):
        p.append(f'<ellipse cx="{f(cxm)}" cy="{f(cym)}" rx="{f(rr * sc)}" ry="{f(rr * sc * .5)}" fill="none" stroke="#ffe7a0" stroke-width="{3 - k * .8:.1f}" opacity="{.75 - k * .2:.2f}" filter="url(#glow)"/>')
    p.append(sparkle(cxm + 18, cym - 30, 16, "#fff6d8"))
    p += [x for (_, x) in sorted(flag_items, key=lambda t: t[0])]
    p.append(cine(cxm, cym - 40, key="#ffe7b8", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)


covers["mine-grid"] = mine_v162()


# ---------- v164: Mine Grid without the planet, closer and lit ----------
def mine_v164():
    COLS, ROWS = 12, 10
    mines = {(1, 1), (4, 0), (5, 1), (8, 1), (10, 2), (0, 4), (3, 3), (3, 4), (9, 4), (9, 3), (2, 6), (7, 7), (8, 7), (10, 7), (4, 8), (11, 9), (1, 9), (6, 0)}
    start = (6, 5)
    def around(c, r):
        return [(c + dc, r + dr) for dc in (-1, 0, 1) for dr in (-1, 0, 1) if (dc or dr) and 0 <= c + dc < COLS and 0 <= r + dr < ROWS]
    count = {(c, r): sum((q in mines) for q in around(c, r)) for c in range(COLS) for r in range(ROWS)}
    opened, todo = set(), [start]
    while todo:
        q = todo.pop()
        if q in opened or q in mines: continue
        opened.add(q)
        if count[q] == 0: todo += around(*q)
    flags = {m for m in mines if any(n in opened for n in around(*m))}
    # perspective: far rows smaller and higher
    HZ, FOOT, CW = -600.0, 640.0, 72.0
    def P(u, v):  # u along columns, v along rows (0 far … ROWS near)
        sc = 1 / (1 + (ROWS - v) * .085)
        return 320 + (u - COLS / 2) * CW * sc, HZ + (FOOT - HZ) * sc, sc
    d = ('<linearGradient id="mgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#04050b"/><stop offset=".55" stop-color="#0d1022"/><stop offset="1" stop-color="#241a2c"/></linearGradient>'
         '<linearGradient id="mgTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f6286"/><stop offset=".45" stop-color="#26304a"/><stop offset="1" stop-color="#121726"/></linearGradient>'
         '<linearGradient id="mgOpen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#090c16"/><stop offset="1" stop-color="#121829"/></linearGradient>'
         '<linearGradient id="mgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe7a0"/><stop offset=".5" stop-color="#e9b443"/><stop offset="1" stop-color="#9a6a12"/></linearGradient>'
         '<radialGradient id="mgHaze" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#3fd6e8" stop-opacity=".22"/><stop offset=".6" stop-color="#7a4dff" stop-opacity=".1"/><stop offset="1" stop-color="#7a4dff" stop-opacity="0"/></radialGradient>''<linearGradient id="mgShaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bff6ff"/><stop offset="1" stop-color="#bff6ff" stop-opacity="0"/></linearGradient>''<linearGradient id="mgRays" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".75"/><stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/></linearGradient>'
         '<radialGradient id="mgPulse" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".9"/><stop offset=".5" stop-color="#7fe3ee" stop-opacity=".35"/><stop offset="1" stop-color="#7fe3ee" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="mgFlag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a6a"/><stop offset="1" stop-color="#b3122a"/></linearGradient>')
    p = ['<rect width="640" height="440" fill="url(#mgSky)"/>', stars(31, 70, 150)]
    # a teal-violet haze over the far edge of the field and soft light shafts from above
    p.append('<ellipse cx="320" cy="120" rx="420" ry="120" fill="url(#mgHaze)"/>')
    for k, (x, w, op) in enumerate([(150, 70, .10), (300, 110, .14), (470, 80, .10)]):
        p.append(f'<polygon points="{x - w / 2},-10 {x + w / 2},-10 {x + w * 1.6},250 {x - w * 1.6},250" fill="url(#mgShaft)" opacity="{op}" filter="url(#soft)"/>')
    p.append(bokeh(23, ["#7fe3ee", "#ffd36a", "#b48cff"], 10, 200, 10, 34, (.06, .16)))
    num_col = {1: "#7fe3ee", 2: "#5cffb0", 3: "#ffd23f", 4: "#ff6fd8"}
    items, flag_items = [], []
    for r in range(ROWS):
        for c in range(COLS):
            g = .06  # gap
            a, b2, c2, d2 = P(c + g, r + g), P(c + 1 - g, r + g), P(c + 1 - g, r + 1 - g), P(c + g, r + 1 - g)
            poly = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in (a, b2, c2, d2))
            sc = (a[2] + c2[2]) / 2
            cxm, cym = (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2
            out = []
            if (c, r) in opened:
                out.append(f'<polygon points="{poly}" fill="url(#mgOpen)" stroke="#2a3550" stroke-width="{f(1.2 * sc)}"/>')
                n = count[(c, r)]
                if n:
                    col = num_col.get(n, "#ffffff")
                    out.append(f'<text x="{f(cxm)}" y="{f(cym + 13 * sc)}" font-family="Arial Black, sans-serif" font-size="{f(38 * sc)}" fill="{col}" text-anchor="middle" filter="url(#glow)" transform="translate({f(cxm)} {f(cym)}) scale(1 .8) translate({f(-cxm)} {f(-cym)})">{n}</text>')
            else:
                lift = 7 * sc
                top = " ".join(f"{f(x)},{f(y - lift)}" for (x, y, _) in (a, b2, c2, d2))
                side = f"{f(d2[0])},{f(d2[1] - lift)} {f(c2[0])},{f(c2[1] - lift)} {f(c2[0])},{f(c2[1])} {f(d2[0])},{f(d2[1])}"
                out.append(f'<polygon points="{side}" fill="#0b0d12"/>')
                out.append(f'<polygon points="{top}" fill="url(#mgTile)" stroke="#7fe3ee" stroke-opacity="{.18 + .3 * sc:.2f}" stroke-width="{f(1.3 * sc)}"/>')
                out.append(f'<line x1="{f(a[0] + 3 * sc)}" y1="{f(a[1] - lift + 1.5 * sc)}" x2="{f(b2[0] - 3 * sc)}" y2="{f(b2[1] - lift + 1.5 * sc)}" stroke="#ffffff" stroke-opacity=".28" stroke-width="{f(1.4 * sc)}"/>')
                if (c, r) in flags:
                    px, py = cxm - 6 * sc, cym - lift
                    hgt = 36 * sc
                    fl = []
                    fl.append(f'<ellipse cx="{f(px)}" cy="{f(py)}" rx="{f(6 * sc)}" ry="{f(2.4 * sc)}" fill="#000" opacity=".5"/>')
                    fl.append(f'<line x1="{f(px)}" y1="{f(py)}" x2="{f(px)}" y2="{f(py - hgt)}" stroke="#d9dee8" stroke-width="{f(2.6 * sc)}" stroke-linecap="round"/>')
                    fl.append(f'<path d="M{f(px)},{f(py - hgt)} Q{f(px + 16 * sc)},{f(py - hgt - 4 * sc)} {f(px + 28 * sc)},{f(py - hgt + 8 * sc)} Q{f(px + 16 * sc)},{f(py - hgt + 14 * sc)} {f(px)},{f(py - hgt + 20 * sc)} Z" fill="url(#mgFlag)" filter="url(#glow)"/>')
                    flag_items.append((r, "".join(fl)))
            items.append((r, "".join(out)))
    p += [x for (_, x) in sorted(items, key=lambda t: t[0])]
    oc = P(6.5, 5.5)
    p.append(f'<ellipse cx="{f(oc[0])}" cy="{f(oc[1])}" rx="240" ry="130" fill="#3fd6e8" opacity=".10" filter="url(#soft)" style="mix-blend-mode:screen"/>')
    # the tapped gold start cell, glowing, with the reveal wave rippling out over the opened field
    c, r = start
    a, c2 = P(c + .06, r + .06), P(c + .94, r + .94)
    cxm, cym, sc = (a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2, (a[2] + c2[2]) / 2
    pts = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in (P(c + .06, r + .06), P(c + .94, r + .06), P(c + .94, r + .94), P(c + .06, r + .94)))
    p.append(f'<polygon points="{pts}" fill="url(#mgGold)" opacity=".92" filter="url(#glow)"/>')
    p.append(f'<ellipse cx="{f(cxm)}" cy="{f(cym)}" rx="{f(170 * sc)}" ry="{f(90 * sc)}" fill="url(#mgPulse)" style="mix-blend-mode:screen"/>')
    for k, rr in enumerate((70, 130, 200)):
        p.append(f'<ellipse cx="{f(cxm)}" cy="{f(cym)}" rx="{f(rr * sc)}" ry="{f(rr * sc * .5)}" fill="none" stroke="#ffe7a0" stroke-width="{3 - k * .8:.1f}" opacity="{.75 - k * .2:.2f}" filter="url(#glow)"/>')
    for k in range(9):
        a0 = -math.pi / 2 + (k - 4) * .16
        x1, y1 = cxm + math.cos(a0) * 260, cym + math.sin(a0) * 260
        p.append(f'<polygon points="{f(cxm - 6)},{f(cym)} {f(cxm + 6)},{f(cym)} {f(x1 + 14)},{f(y1)} {f(x1 - 14)},{f(y1)}" fill="url(#mgRays)" opacity="{.35 - abs(k - 4) * .05:.2f}" style="mix-blend-mode:screen"/>')
    p.append(sparkle(cxm + 18, cym - 30, 16, "#fff6d8"))
    p += [x for (_, x) in sorted(flag_items, key=lambda t: t[0])]
    p.append(cine(cxm, cym - 40, key="#ffe7b8", strength=.6, flare_w=0))
    return svg("".join(p), extra_defs=d)




covers["mine-grid"] = mine_v164()


# ---------- v165: Mine Grid — the classic minesweeper close-up, in our space ----------
# The owner's reference (the classic grey board: raised tiles, a blue 1, a green 2, a red 3, the black mine, the red
# flag and the smiley) remade in the house style: a graphite glass board lit from above in deep space, bevelled
# raised tiles with a cyan rim, recessed open cells, the classic digit colours glowing, a glossy mine, the flag on its
# black stand and the gold smiley as the game's button. Every number counts the mines around it.
def mine_v165(HZ=-1514.0):
    COLS, ROWS = 5, 4
    MINE, FLAG, HIDDEN = (1, 1), (3, 2), (2, 3)
    mines = {MINE, FLAG, HIDDEN}
    covered = {(3, 0), (4, 0), (4, 1), (0, 3), HIDDEN, (4, 3)}
    def n_at(c, r):
        return sum((c + dc, r + dr) in mines for dc in (-1, 0, 1) for dr in (-1, 0, 1) if dc or dr)
    FOOT, CW = 430.0, 120.0
    def P(u, v):
        sc = 1 / (1 + (ROWS - v) * .055)
        return 320 + (u - COLS / 2) * CW * sc, HZ + (FOOT - HZ) * sc, sc
    d = ('<radialGradient id="m5bg" cx="50%" cy="30%" r="85%"><stop offset="0" stop-color="#1a2140"/><stop offset=".55" stop-color="#0a0d1c"/><stop offset="1" stop-color="#030409"/></radialGradient>'
         '<linearGradient id="m5tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#59647e"/><stop offset=".5" stop-color="#323a50"/><stop offset="1" stop-color="#1b2030"/></linearGradient>'
         '<linearGradient id="m5open" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0f1c"/><stop offset="1" stop-color="#151b2c"/></linearGradient>'
         '<radialGradient id="m5mine" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#9aa3b8"/><stop offset=".3" stop-color="#3a3f4f"/><stop offset="1" stop-color="#07080c"/></radialGradient>'
         '<radialGradient id="m5smile" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff6c4"/><stop offset=".45" stop-color="#ffd23f"/><stop offset="1" stop-color="#c47f00"/></radialGradient>'
         '<linearGradient id="m5flag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a74"/><stop offset="1" stop-color="#b3121f"/></linearGradient>'
         '<radialGradient id="m5lamp" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#bff6ff" stop-opacity=".28"/><stop offset="1" stop-color="#bff6ff" stop-opacity="0"/></radialGradient>')
    p = ['<rect width="640" height="440" fill="url(#m5bg)"/>', stars(51, 90, 440), bokeh(29, ["#7fe3ee", "#ffd36a", "#b48cff"], 10, 440, 12, 40, (.06, .16))]
    p.append('<ellipse cx="320" cy="0" rx="420" ry="300" fill="url(#m5lamp)"/>')
    # board plate under the cells
    a, b2, c2, d2 = P(-.12, -.12), P(COLS + .12, -.12), P(COLS + .12, ROWS + .12), P(-.12, ROWS + .12)
    plate = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in (a, b2, c2, d2))
    p.append(f'<polygon points="{plate}" fill="#05070e" stroke="#7fe3ee" stroke-opacity=".35" stroke-width="2" filter="url(#shadow)"/>')
    colours = {1: "#3d8bff", 2: "#33d46e", 3: "#ff3d4c", 4: "#6c5cff"}
    for r in range(ROWS):
        for c in range(COLS):
            g = .045
            q = [P(c + g, r + g), P(c + 1 - g, r + g), P(c + 1 - g, r + 1 - g), P(c + g, r + 1 - g)]
            sc = (q[0][2] + q[2][2]) / 2
            cx, cy = (q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2
            poly = " ".join(f"{f(x)},{f(y)}" for (x, y, _) in q)
            if (c, r) in covered or (c, r) == FLAG:
                lift = 9 * sc
                top = [(x, y - lift) for (x, y, _) in q]
                p.append(f'<polygon points="{f(q[3][0])},{f(q[3][1] - lift)} {f(q[2][0])},{f(q[2][1] - lift)} {f(q[2][0])},{f(q[2][1])} {f(q[3][0])},{f(q[3][1])}" fill="#0a0c14"/>')
                p.append(f'<polygon points="{" ".join(f"{f(x)},{f(y)}" for (x, y) in top)}" fill="url(#m5tile)" stroke="#7fe3ee" stroke-opacity=".38" stroke-width="{f(1.4 * sc)}"/>')
                # bevel: lit top and left edges, dark bottom and right (the classic raised tile)
                bw = 7 * sc
                (x0, y0), (x1, y1), (x2, y2), (x3, y3) = top
                p.append(f'<polygon points="{f(x0)},{f(y0)} {f(x1)},{f(y1)} {f(x1 - bw)},{f(y1 + bw)} {f(x0 + bw)},{f(y0 + bw)}" fill="#ffffff" opacity=".28"/>')
                p.append(f'<polygon points="{f(x0)},{f(y0)} {f(x0 + bw)},{f(y0 + bw)} {f(x3 + bw)},{f(y3 - bw)} {f(x3)},{f(y3)}" fill="#ffffff" opacity=".16"/>')
                p.append(f'<polygon points="{f(x3)},{f(y3)} {f(x3 + bw)},{f(y3 - bw)} {f(x2 - bw)},{f(y2 - bw)} {f(x2)},{f(y2)}" fill="#000" opacity=".4"/>')
                p.append(f'<polygon points="{f(x1)},{f(y1)} {f(x2)},{f(y2)} {f(x2 - bw)},{f(y2 - bw)} {f(x1 - bw)},{f(y1 + bw)}" fill="#000" opacity=".3"/>')
                if (c, r) == FLAG:
                    fx, fy = cx + 4 * sc, cy - lift + 22 * sc
                    p.append(f'<ellipse cx="{f(fx)}" cy="{f(fy)}" rx="{f(22 * sc)}" ry="{f(6 * sc)}" fill="#05060a"/>')
                    p.append(f'<rect x="{f(fx - 16 * sc)}" y="{f(fy - 9 * sc)}" width="{f(32 * sc)}" height="{f(8 * sc)}" rx="{f(2 * sc)}" fill="#11131a"/>')
                    p.append(f'<rect x="{f(fx - 2 * sc)}" y="{f(fy - 58 * sc)}" width="{f(4 * sc)}" height="{f(50 * sc)}" fill="#1a1c24"/>')
                    p.append(f'<polygon points="{f(fx + 2 * sc)},{f(fy - 58 * sc)} {f(fx + 2 * sc)},{f(fy - 28 * sc)} {f(fx - 30 * sc)},{f(fy - 43 * sc)}" fill="url(#m5flag)" filter="url(#glow)"/>')
            else:
                p.append(f'<polygon points="{poly}" fill="url(#m5open)" stroke="#2a3450" stroke-width="{f(1.2 * sc)}"/>')
                p.append(f'<polygon points="{f(q[0][0])},{f(q[0][1])} {f(q[1][0])},{f(q[1][1])} {f(q[1][0])},{f(q[1][1] + 6 * sc)} {f(q[0][0])},{f(q[0][1] + 6 * sc)}" fill="#000" opacity=".45"/>')
                if (c, r) == MINE:
                    rr = 24 * sc
                    p.append(f'<polygon points="{poly}" fill="#d81f2e" opacity=".55"/>')
                    for k in range(8):
                        an = k * math.pi / 4
                        p.append(f'<line x1="{f(cx)}" y1="{f(cy)}" x2="{f(cx + math.cos(an) * rr * 1.45)}" y2="{f(cy + math.sin(an) * rr * 1.45)}" stroke="#2c303b" stroke-width="{f(6 * sc)}" stroke-linecap="round"/>')
                    p.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(rr)}" fill="url(#m5mine)"/>')
                    p.append(f'<circle cx="{f(cx - rr * .35)}" cy="{f(cy - rr * .38)}" r="{f(rr * .22)}" fill="#ffffff" opacity=".9"/>')
                    p.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(rr * 2.2)}" fill="#ff3d4c" opacity=".12" filter="url(#soft)"/>')
                else:
                    n = n_at(c, r)
                    if n:
                        col = colours[n]
                        p.append(f'<text x="{f(cx)}" y="{f(cy + 22 * sc)}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="{f(66 * sc)}" fill="{col}" text-anchor="middle" filter="url(#glow)">{n}</text>')
                        p.append(f'<text x="{f(cx)}" y="{f(cy + 22 * sc)}" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="{f(66 * sc)}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="{f(1.2 * sc)}" text-anchor="middle">{n}</text>')
    # the gold smiley, the game's button, floating over the top-right corner
    sx, sy, sr = 572, 56, 36
    p.append(f'<circle cx="{sx}" cy="{sy + 6}" r="{sr + 4}" fill="#000" opacity=".45" filter="url(#soft)"/>')
    p.append(f'<circle cx="{sx}" cy="{sy}" r="{sr + 10}" fill="#ffd23f" opacity=".22" filter="url(#bigglow)"/>')
    p.append(f'<circle cx="{sx}" cy="{sy}" r="{sr}" fill="url(#m5smile)" stroke="#7a4b00" stroke-width="2.5"/>')
    p.append(f'<ellipse cx="{sx - 12}" cy="{sy - 9}" rx="5" ry="7" fill="#2a1a00"/><ellipse cx="{sx + 12}" cy="{sy - 9}" rx="5" ry="7" fill="#2a1a00"/>')
    p.append(f'<path d="M{sx - 20},{sy + 6} Q{sx},{sy + 28} {sx + 20},{sy + 6}" fill="none" stroke="#2a1a00" stroke-width="5" stroke-linecap="round"/>')
    p.append(f'<ellipse cx="{sx - 14}" cy="{sy - 22}" rx="12" ry="6" fill="#fff" opacity=".6" transform="rotate(-25 {sx - 14} {sy - 22})"/>')
    p.append(sparkle(sx + 36, sy - 30, 11, "#fff6d8"))
    p.append(cine(300, 220, key="#cfefff", strength=.55, flare_w=0))
    return svg("".join(p), extra_defs=d)


covers["mine-grid"] = mine_v165()


# v175 · The board reaches the top of the cover too (the owner saw an empty band above it in the catalogue): a lower
# horizon stretches the rows so the far edge sits just under the top border; the smiley floats over the corner tile.
covers["mine-grid"] = mine_v165(HZ=-1835.0)


# ---------- Stack: the gold block sits lower, just above the tower; no sliced chunk falling off the right ----------
def stack_v153():
    src = stack_v143()
    old_gold = iso_tex(420, 30, 150, 76, 34, 46, "gold", lit=.6, sat=.9)
    assert old_gold in src
    src = src.replace(old_gold, iso_tex(408, 66, 150, 76, 34, 46, "gold", lit=.6, sat=.9))
    for q in range(1, 5):
        a = f'<rect x="{410 + q * 3}" y="{-60 - q * 14}" width="{4 + q}" height="{28 - q * 3}" rx="2" fill="#ffe066" opacity="{.6 - q * .12:.2f}"/>'
        assert a in src
        src = src.replace(a, f'<rect x="{398 + q * 3}" y="{-24 - q * 14}" width="{4 + q}" height="{28 - q * 3}" rx="2" fill="#ffe066" opacity="{.6 - q * .12:.2f}"/>')
    chunk = f'<g transform="rotate(26 570 250)">{iso_tex(570, 250, 46, 24, 30, 46, "chip", lit=.58, sat=.9)}</g>'
    assert chunk in src
    src = src.replace(chunk, "")
    rr = random.Random(43)
    for _ in range(9):
        x, y, sz = rr.uniform(520, 625), rr.uniform(170, 330), rr.uniform(3, 7)
        col = rr.choice(["#ffe066", "#fff3b0", "#c99a1c"])
        chip = f'<rect x="{f(x)}" y="{f(y)}" width="{f(sz)}" height="{f(sz * .7)}" fill="{col}" transform="rotate({rr.randint(0, 90)} {f(x)} {f(y)})" opacity=".9"/>'
        assert chip in src
        src = src.replace(chip, "")
    lines = speed_lines((570, 250, .25, 1), 8, 5, "#fff3b0", 26, 20, 60, (.15, .45))
    assert lines in src
    src = src.replace(lines, "")
    return src


covers["precision-stack"] = stack_v153()
covers["stack-3d"] = covers["precision-stack"]


# ---------- Tower Drop: the next container comes down lower, right onto the tower ----------
def tower_v153():
    src = tower()
    # shift the hanging container (and its swing ghosts, hook and rope end) 22 units down, toward the landing frame
    i = src.index('<line x1="452" y1="-60"')
    j = src.index('<ellipse cx="', i)
    seg = src[i:j]
    return src[:i] + f'<g transform="translate(0 22)">{seg}</g>' + src[j:]


covers["tower-drop"] = tower_v153()


# ---------- Shot Gallery: the targets worked up — rim light from the laser side, shading, texture, more anatomy ----------
def _at(x, y, s, inner):
    return f'<g transform="translate({f(x)} {f(y)}) scale({s})">{inner}</g>'


def mantis_detail(idn):
    """Veined wing membranes behind the body, spiked forelegs, mandibles, hex facets and a cyan rim light."""
    d = _lg(f"{idn}w", [(0, "#e8ffd0"), (1, "#7ad65a")], 0, 0, 1, 1)
    o = [f'<defs>{d}</defs>']
    back, front = [], []
    for sx in (-1, 1):
        back.append(f'<path d="M{sx * 8},4 Q{sx * 70},-30 {sx * 84},30 Q{sx * 50},40 {sx * 10},26 Z" fill="url(#{idn}w)" fill-opacity=".28" stroke="#d9ffb0" stroke-opacity=".55" stroke-width="1.4"/>')
        back.append("".join(f'<path d="M{sx * 10},{14 + k * 3} Q{sx * (40 + k * 6)},{-6 + k * 10} {sx * (70 + k * 4)},{18 + k * 6}" fill="none" stroke="#e8ffd0" stroke-opacity=".35" stroke-width="1"/>' for k in range(4)))
        # spikes along the scythe's outer edge and a rim light (laser from the lower right)
        front.append("".join(f'<path d="M{f(sx * (48 + k * .8))},{f(-30 - k * 10)} l{f(sx * 8)},{f(-3)} l{f(sx * -6)},{f(-5)}Z" fill="#0b2a06"/>' for k in range(5)))
        front.append(f'<path d="M{sx * 20},16 Q{sx * 34},-14 {sx * 38},-40" fill="none" stroke="#bff6ff" stroke-opacity="{.75 if sx > 0 else .2}" stroke-width="2.2"/>')
        # mandibles
        front.append(f'<path d="M{sx * 3},-2 Q{sx * 12},4 {sx * 8},12 Q{sx * 5},6 {sx * 1},4 Z" fill="#c8ff7a" stroke="#0b2a06" stroke-width="1.4"/>')
    # hex facets on the eyes
    for sx in (-1, 1):
        for i in range(9):
            hx, hy = sx * 17 + (i % 3 - 1) * 6, -36 + (i // 3 - 1) * 5.4
            pts = " ".join(f"{f(hx + 2.6 * math.cos(a * math.pi / 3))},{f(hy + 2.6 * math.sin(a * math.pi / 3))}" for a in range(6))
            front.append(f'<polygon points="{pts}" fill="none" stroke="#fff3c8" stroke-opacity=".35" stroke-width=".7"/>')
    # thorax plates with a highlight and pores
    front.append('<path d="M-12,-2 Q0,-8 12,-2" fill="none" stroke="#e9ff9a" stroke-opacity=".6" stroke-width="1.6"/>')
    front.append("".join(f'<circle cx="{f(a)}" cy="{f(b)}" r="1" fill="#0b2a06" opacity=".5"/>' for a, b in [(-6, 8), (5, 12), (-2, 18), (8, 22), (-9, 26)]))
    front.append('<path d="M18,30 Q24,46 14,76" fill="none" stroke="#bff6ff" stroke-opacity=".55" stroke-width="2"/>')
    o_back = "".join(back)
    return o_back, "".join(o) + "".join(front)


def kraken_detail(idn):
    """Gradient skin spots, a ringed iris with veins in the white, tentacle rim lights and a dripping underside."""
    o = []
    rr = random.Random(9)
    for _ in range(14):
        x, y, r = rr.uniform(-34, 34), rr.uniform(-56, 18), rr.uniform(2, 5)
        if x * x / 1600 + (y + 14) ** 2 / 2116 > .85: continue
        o.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#4a1a8a" opacity=".45"/><circle cx="{f(x - r * .3)}" cy="{f(y - r * .3)}" r="{f(r * .35)}" fill="#f0d8ff" opacity=".35"/>')
    for a in [-2.6, -2.1, -1.0, -0.4, 2.9]:
        o.append(f'<path d="M{f(2 + 20 * math.cos(a))},{f(-8 + 16 * math.sin(a))} Q{f(2 + 15 * math.cos(a + .2))},{f(-8 + 12 * math.sin(a + .2))} {f(2 + 12 * math.cos(a))},{f(-8 + 9 * math.sin(a))}" fill="none" stroke="#ff5a7a" stroke-opacity=".6" stroke-width=".8"/>')
    o.append('<circle cx="2" cy="-7" r="12" fill="none" stroke="#8a5a00" stroke-width="1.4"/><circle cx="2" cy="-7" r="8" fill="none" stroke="#fff3a0" stroke-opacity=".6" stroke-width="1"/>')
    o.append("".join(f'<line x1="{f(2 + 4 * math.cos(a))}" y1="{f(-7 + 9 * math.sin(a))}" x2="{f(2 + 11 * math.cos(a))}" y2="{f(-7 + 11 * math.sin(a))}" stroke="#a87000" stroke-opacity=".55" stroke-width=".8"/>' for a in [i * math.pi / 8 for i in range(16)]))
    o.append('<path d="M-22,-10 Q0,-30 22,-10" fill="none" stroke="#c9a0ff" stroke-width="1.4"/>' + "".join(f'<path d="M{x},{-16 - abs(x) * .1:.1f} l{x * .06:.1f},-6" stroke="#1a0640" stroke-width="1.6"/>' for x in (-16, -8, 0, 8, 16)))
    o.append('<path d="M30,-40 Q42,-14 30,18" fill="none" stroke="#bff6ff" stroke-opacity=".6" stroke-width="2.4"/>')
    o.append('<path d="M-30,22 Q0,36 30,22" fill="none" stroke="#1a0640" stroke-opacity=".6" stroke-width="2"/>' + "".join(f'<path d="M{x - 3},{26 + abs(x) * -.2:.1f} q3,{8 + (x % 3)} 6,0" fill="#b77aff" stroke="#2a0a5e" stroke-width="1"/>' for x in (-18, -4, 12)))
    return "".join(o)


def wraith_detail(idn):
    """Smoky tattered hem, a hood seam with stitching, a glowing rune amulet on a chain, and eye flare streaks."""
    d = _lg(f"{idn}sm", [(0, "#5ef0ff"), (1, "#5ef0ff00")])
    o = [f'<defs>{d}</defs>']
    rr = random.Random(21)
    for k in range(9):
        x = -46 + k * 11.5
        o.append(f'<path d="M{f(x)},{f(60 + rr.uniform(-4, 4))} q{f(rr.uniform(-6, 6))},{f(14 + rr.uniform(0, 10))} {f(rr.uniform(-4, 4))},{f(24 + rr.uniform(0, 12))}" fill="none" stroke="#2e3a5e" stroke-width="{f(rr.uniform(3, 6))}" stroke-linecap="round" opacity=".7"/>')
    o.append(f'<ellipse cx="0" cy="74" rx="56" ry="10" fill="url(#{idn}sm)" opacity=".25" filter="url(#soft)"/>')
    o.append('<path d="M-30,-40 Q0,-74 30,-40" fill="none" stroke="#9fb0e0" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="3 3"/>')
    o.append('<path d="M-16,-4 Q0,10 16,-4" fill="none" stroke="#8a95b8" stroke-width="1.6"/>' + "".join(f'<circle cx="{f(-16 + k * 4)}" cy="{f(-4 + 7 * math.sin(k / 8 * math.pi))}" r="1.3" fill="none" stroke="#c8d2ec" stroke-width=".9"/>' for k in range(9)))
    o.append('<g filter="url(#glow)"><polygon points="0,6 7,14 0,22 -7,14" fill="#0b1a26" stroke="#5ef0ff" stroke-width="1.6"/><text x="0" y="17" font-family="DejaVu Sans, sans-serif" font-size="8" fill="#a6fdff" text-anchor="middle">ᛟ</text></g>')
    for sx in (-1, 1):
        o.append(f'<line x1="{sx * 4}" y1="-32" x2="{sx * 20}" y2="-34" stroke="#a6fdff" stroke-width="1" opacity=".7" filter="url(#glow)"/>')
    o.append('<path d="M34,-24 Q52,2 50,62" fill="none" stroke="#bff6ff" stroke-opacity=".5" stroke-width="2"/>')
    return "".join(o)


def drone_detail(idn):
    """An orbiting light ring, panel bands, a scanning beam from the visor and a thruster plume."""
    d = _lg(f"{idn}pl", [(0, "#ffd0a0"), (.4, "#ff6a2a"), (1, "#ff6a2a00")])
    o = [f'<defs>{d}</defs>']
    o.append(f'<path d="M-10,26 Q0,80 10,26 Z" fill="url(#{idn}pl)" opacity=".8" filter="url(#glow)"/>')
    o.append('<ellipse cx="0" cy="-2" rx="48" ry="11" fill="none" stroke="#2c3442" stroke-width="5"/><ellipse cx="0" cy="-2" rx="48" ry="11" fill="none" stroke="#9fefff" stroke-width="1.4" stroke-dasharray="4 7" filter="url(#glow)"/>')
    o.append('<path d="M-32,6 Q0,22 32,6" fill="none" stroke="#0b0f16" stroke-opacity=".45" stroke-width="1.4"/><path d="M-30,-26 Q0,-36 30,-26" fill="none" stroke="#0b0f16" stroke-opacity=".35" stroke-width="1.2"/>')
    o.append('<polygon points="-21,-16 -60,40 60,40 21,-16" fill="#ff3b3b" opacity=".08"/>')
    return "".join(o)


def slime_detail(idn):
    """Specular rim, floating debris inside (a coin and a bolt), extra drips and a puddle."""
    o = ['<path d="M-36,-20 Q-40,6 -26,30" fill="none" stroke="#fff3d0" stroke-opacity=".45" stroke-width="2.4" stroke-linecap="round"/>']
    o.append('<g opacity=".55"><circle cx="-18" cy="26" r="5" fill="#ffd36a" stroke="#8a5a00" stroke-width="1"/><rect x="18" y="20" width="9" height="4" rx="1" fill="#c9d3e2" transform="rotate(30 22 22)"/></g>')
    o.append('<ellipse cx="0" cy="48" rx="46" ry="6" fill="#d95a10" opacity=".55"/><ellipse cx="-8" cy="47" rx="16" ry="2" fill="#ffe6c4" opacity=".4"/>')
    o.append('<path d="M38,-6 Q46,14 36,34" fill="none" stroke="#bff6ff" stroke-opacity=".4" stroke-width="2"/>')
    return "".join(o)


def golem_detail(idn):
    """Moss patches, a crystal growth on the shoulder and a glowing rune on the chest."""
    o = []
    for (x, y, r) in [(-20, -48, 7), (12, -54, 5), (-34, -34, 4)]:
        o.append(f'<ellipse cx="{x}" cy="{y}" rx="{r * 1.4}" ry="{r * .6}" fill="#5a8a3a" opacity=".85"/><ellipse cx="{x - 2}" cy="{y - 1}" rx="{r * .6}" ry="{r * .25}" fill="#a8d870" opacity=".7"/>')
    o.append('<g filter="url(#glow)"><polygon points="30,-44 36,-64 42,-44" fill="#9fefff" stroke="#2a6a7a" stroke-width="1"/><polygon points="38,-42 46,-58 48,-40" fill="#5ef0ff" stroke="#2a6a7a" stroke-width="1"/></g>')
    o.append('<path d="M-4,4 L4,4 L0,12 Z" fill="none" stroke="#ff9a3a" stroke-width="1.6" filter="url(#glow)"/>')
    return "".join(o)


def gallery_v153():
    src = gallery_v143()
    # each target gets its detail layer, drawn in the same place and scale (wing/leg layers go under the mantis)
    def add(fn_call, x, y, s, idn, after=True, extra=""):
        nonlocal src
        orig = fn_call
        assert orig in src, idn
        src = src.replace(orig, orig + _at(x, y, s, extra) if after else _at(x, y, s, extra) + orig, 1)
    mb, mf = mantis_detail("hm")
    add(g_mantis(300, 272, 1.6, "hm"), 300, 272, 1.6, "hm", after=False, extra=mb)
    add(g_mantis(300, 272, 1.6, "hm"), 300, 272, 1.6, "hm", extra=mf)
    add(g_kraken(118, 300, 1.05, "mk"), 118, 300, 1.05, "mk", extra=kraken_detail("mk"))
    add(g_wraith(566, 292, 1.05, "mw"), 566, 292, 1.05, "mw", extra=wraith_detail("mw"))
    add(g_drone(110, 190, .95, "bd"), 110, 190, .95, "bd", extra=drone_detail("bd"))
    add(g_golem(330, 206, .9, "bg"), 330, 206, .9, "bg", extra=golem_detail("bg"))
    add(g_slime(548, 206, .9, "bs"), 548, 206, .9, "bs", extra=slime_detail("bs"))
    # the back row in focus, so its detail reads; depth comes from a thin cold haze instead of blur
    i = src.index('<g filter="url(#dof)" opacity=".92">')
    tail = g_slime(548, 206, .9, "bs") + _at(548, 206, .9, slime_detail("bs"))
    j = src.index(tail, i) + len(tail)
    assert src.startswith("</g>", j)
    j += 4
    back = src[i:j].replace('<g filter="url(#dof)" opacity=".92">', '<g opacity=".96">', 1)
    src = src[:i] + back + '<rect x="-10" y="120" width="660" height="130" fill="#0a1424" opacity=".16"/>' + src[j:]
    return src


covers["shot-gallery"] = gallery_v153()
covers["reaction-test"] = covers["shot-gallery"]


# ---------- v155 · subjects lower in the frame (clear of the catalogue's level badge, top left) ----------
def lowered(src, s, ax=320, ay=440, feather=26, dy=0):
    """Shrink the whole composition about (ax, ay) so the subject sits lower and more centred; the edges it uncovers
    fade into the background through a feathered mask (no visible seam)."""
    head_end = src.index("</defs>") + len("</defs>")
    bg_start = src.index("<rect", head_end)
    body_start = src.index("/>", bg_start) + 2
    body_end = src.rindex('<rect width="640" height="440" fill="url(#vig)"/>')
    body = src[body_start:body_end]
    x0, y0, w, h = ax - ax * s, ay - ay * s + dy, 640 * s, 440 * s
    m = (f'<filter id="lowblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{feather * .6:.1f}"/></filter>'
         f'<mask id="lowmask" maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="440">'
         f'<rect x="{f(x0 + feather)}" y="{f(y0 + feather)}" width="{f(w - 2 * feather)}" height="{f(h + 200)}" fill="#fff" filter="url(#lowblur)"/></mask>')
    m += '<filter id="lowamb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter>'
    # Behind: the same picture at full size, blurred and dimmed, so the uncovered edges keep its colours.
    amb = f'<g filter="url(#lowamb)" opacity=".5"><g transform="translate(320 {f(ay)}) scale({1 / s:.3f}) translate(-320 {f(-ay)})">{body}</g></g>'
    inner = f'<defs>{m}</defs>{amb}<g mask="url(#lowmask)"><g transform="translate({f(x0)} {f(y0)}) scale({s})">{body}</g></g>'
    return src[:body_start] + inner + src[body_end:]


def shifted(src, dy, feather=22):
    """v162: move the whole composition down by dy at full size (it keeps the card's full width); only the band it
    uncovers at the top fades into the blurred picture behind it."""
    head_end = src.index("</defs>") + len("</defs>")
    bg_start = src.index("<rect", head_end)
    body_start = src.index("/>", bg_start) + 2
    body_end = src.rindex('<rect width="640" height="440" fill="url(#vig)"/>')
    body = src[body_start:body_end]
    m = (f'<filter id="shblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{feather * .6:.1f}"/></filter>'
         f'<mask id="shmask" maskUnits="userSpaceOnUse" x="-100" y="-100" width="840" height="640">'
         f'<rect x="-100" y="{f(dy + feather)}" width="840" height="640" fill="#fff" filter="url(#shblur)"/></mask>'
         '<filter id="shamb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter>')
    amb = f'<g filter="url(#shamb)" opacity=".55">{body}</g>'
    inner = f'<defs>{m}</defs>{amb}<g mask="url(#shmask)"><g transform="translate(0 {f(dy)})">{body}</g></g>'
    return src[:body_start] + inner + src[body_end:]


def framed(src, s, cx, cy, tx=320, ty=196, feather=30):
    """v166: square catalogue cards show the middle 440×440 of the cover with the play button over its lower edge.
    Scale the composition by s about its subject's centre (cx, cy) and place that centre at (tx, ty), the optical
    centre of the visible square; the edges it uncovers fade into the same picture, blurred, behind it."""
    head_end = src.index("</defs>") + len("</defs>")
    bg_start = src.index("<rect", head_end)
    body_start = src.index("/>", bg_start) + 2
    body_end = src.rindex('<rect width="640" height="440" fill="url(#vig)"/>')
    body = src[body_start:body_end]
    x0, y0 = tx - cx * s, ty - cy * s
    m = (f'<filter id="frblur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="{feather * .6:.1f}"/></filter>'
         f'<mask id="frmask" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1040" height="840">'
         f'<rect x="{f(x0 + feather)}" y="{f(y0 + feather)}" width="{f(640 * s - 2 * feather)}" height="{f(440 * s + 400)}" fill="#fff" filter="url(#frblur)"/></mask>'
         '<filter id="framb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="30"/></filter>')
    amb = f'<g filter="url(#framb)" opacity=".5"><g transform="translate({f(tx)} {f(ty)}) scale({max(s, 1.15):.3f}) translate({f(-cx)} {f(-cy)})">{body}</g></g>'
    inner = f'<defs>{m}</defs>{amb}<g mask="url(#frmask)"><g transform="translate({f(x0)} {f(y0)}) scale({s})">{body}</g></g>'
    return src[:body_start] + inner + src[body_end:]


covers["precision-stack"] = framed(covers["precision-stack"], .78, 330, 270)
covers["stack-3d"] = covers["precision-stack"]
covers["bowling"] = shifted(covers["bowling"], -24)  # v178: raised (it was 46 lower since v162) so the ball clears the card label
covers["corner-sudoku"] = framed(covers["corner-sudoku"], .74, 322, 250)
covers["tower-drop"] = framed(covers["tower-drop"], .74, 330, 250)
covers["pinball"] = lowered(covers["pinball"], .82, dy=26)  # v156: a little lower again

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
