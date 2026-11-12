"""v179 · Builds public/fonts/gg-coin.woff: one glyph, the cosmicoin sign — a C with two vertical bars inside it (the
owner's choice «C · dentro de la C») — mapped to U+20A1 (₡). The app's font stacks list "GG Coin" first with
unicode-range U+20A1, so every amount shows this sign; anywhere the font is not applied the system's ₡ shows instead.
Usage: python3 scripts/build-coin-font.py"""
import math, os
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

UPM, ADV = 1000, 740
CX, CY, RO, RI = 370, 350, 330, 252        # the C: centre, outer and inner radius (cap height 700)
OPEN = math.radians(42)                     # half-opening of the C, on the right
BARS = [(312, 374), (430, 492)]             # the two bars, inside the C
BAR_Y = (CY - RI - 4, CY + RI + 4)          # they meet the C's inner edge

def arc(pen):
    n = 64
    a0, a1 = OPEN, 2 * math.pi - OPEN
    outer = [(CX + RO * math.cos(a0 + (a1 - a0) * i / n), CY + RO * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]
    inner = [(CX + RI * math.cos(a1 - (a1 - a0) * i / n), CY + RI * math.sin(a1 - (a1 - a0) * i / n)) for i in range(n + 1)]
    # round caps: a half circle bulging past each end of the C, along the arc's direction
    r = (RO - RI) / 2
    def cap(a, sign, forward):
        mx, my = CX + (RO + RI) / 2 * math.cos(a), CY + (RO + RI) / 2 * math.sin(a)
        ux, uy, tx, ty = math.cos(a), math.sin(a), -math.sin(a) * sign, math.cos(a) * sign
        ths = [math.pi * k / 12 for k in range(1, 12)]
        if not forward:
            ths = ths[::-1]
        return [(mx + r * (ux * math.cos(th) + tx * math.sin(th)), my + r * (uy * math.cos(th) + ty * math.sin(th))) for th in ths]
    pts = (outer + cap(a1, 1, True) + inner + cap(a0, -1, False))[::-1]  # clockwise, like the bars (TrueType outer contours)
    pen.moveTo(tuple(map(round, pts[0])))
    for p in pts[1:]:
        pen.lineTo(tuple(map(round, p)))
    pen.closePath()

def bar(pen, x0, x1):
    y0, y1 = BAR_Y
    pen.moveTo((x0, y0))
    pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()

def glyph():
    pen = TTGlyphPen(None)
    arc(pen)
    for x0, x1 in BARS:
        bar(pen, x0, x1)
    return pen.glyph()

def empty():
    return TTGlyphPen(None).glyph()

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder([".notdef", "coin"])
fb.setupCharacterMap({0x20A1: "coin"})
fb.setupGlyf({".notdef": empty(), "coin": glyph()})
fb.setupHorizontalMetrics({".notdef": (500, 0), "coin": (ADV, 0)})
fb.setupHorizontalHeader(ascent=900, descent=-250)
fb.setupNameTable({"familyName": "GG Coin", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, usWinAscent=900, usWinDescent=250)
fb.setupPost()
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
out = os.path.join(root, "public", "fonts", "gg-coin.woff")
os.makedirs(os.path.dirname(out), exist_ok=True)
fb.font.flavor = "woff"
fb.save(out)
print("wrote", out, os.path.getsize(out), "bytes")
