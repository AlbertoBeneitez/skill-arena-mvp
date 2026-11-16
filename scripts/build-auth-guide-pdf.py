"""Builds docs/GUIA_ENTRADA_CON_GOOGLE.pdf: how to let friends sign in with Google, step by step (v197).

Run: python3 scripts/build-auth-guide-pdf.py
"""
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

FONT_DIR = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("Sans", FONT_DIR + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Bold", FONT_DIR + "DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Mono", FONT_DIR + "DejaVuSansMono.ttf"))
pdfmetrics.registerFontFamily("Sans", normal="Sans", bold="Sans-Bold", italic="Sans", boldItalic="Sans-Bold")

INK = colors.HexColor("#15171c")
MUTE = colors.HexColor("#5b6270")
ACCENT = colors.HexColor("#6b7a00")
SOFT = colors.HexColor("#f3f5e3")
LINE = colors.HexColor("#d9dce2")
WARN = colors.HexColor("#8a4b00")
WARN_BG = colors.HexColor("#fff3e0")

title = ParagraphStyle("title", fontName="Sans-Bold", fontSize=22, leading=27, textColor=INK, spaceAfter=4)
subtitle = ParagraphStyle("subtitle", fontName="Sans", fontSize=10.5, leading=15, textColor=MUTE, spaceAfter=10)
h1 = ParagraphStyle("h1", fontName="Sans-Bold", fontSize=15, leading=19, textColor=INK, spaceBefore=14, spaceAfter=6)
h2 = ParagraphStyle("h2", fontName="Sans-Bold", fontSize=11.5, leading=15, textColor=INK, spaceBefore=2, spaceAfter=3)
body = ParagraphStyle("body", fontName="Sans", fontSize=9.6, leading=14, textColor=INK, alignment=TA_LEFT)
small = ParagraphStyle("small", parent=body, fontSize=8.6, leading=12, textColor=MUTE)
step = ParagraphStyle("step", parent=body, leftIndent=14, firstLineIndent=-14, spaceAfter=2)
why = ParagraphStyle("why", parent=body, textColor=MUTE, fontSize=9, leading=13, spaceAfter=4)
warn = ParagraphStyle("warn", parent=body, textColor=WARN)


def code(text: str) -> str:
    return f'<font name="Mono" size="8.8">{text}</font>'


def task(number: str, name: str, when: str, minutes: str, why_text: str, steps: list[str], note: str | None = None, heading: str | None = None):
    head = Table(
        [[Paragraph(f"<b>☐ {number}. {name}</b>", h2), Paragraph(f"{when} · {minutes}", small)]],
        colWidths=[120 * mm, 50 * mm],
    )
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    parts = [head, Paragraph(why_text, why)]
    parts += [Paragraph(f"{i}.&nbsp;&nbsp;{s}", step) for i, s in enumerate(steps, 1)]
    if note:
        box = Table([[Paragraph(note, warn)]], colWidths=[170 * mm])
        box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), WARN_BG), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#f0c27a")),
            ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
            ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        parts += [Spacer(1, 4), box]
    card = Table([[parts]], colWidths=[176 * mm])
    card.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    lead = [Paragraph(heading, h1)] if heading else []
    return KeepTogether(lead + [card, Spacer(1, 8)])



def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Sans", 7.5)
    canvas.setFillColor(MUTE)
    canvas.drawString(20 * mm, 12 * mm, "Galactic Games · Guía de entrada con Google · v197 · 16 de noviembre de 2026")
    canvas.drawRightString(190 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


def box(text, style=warn, bg=WARN_BG, edge="#f0c27a"):
    t = Table([[Paragraph(text, style)]], colWidths=[176 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor(edge)),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


story = [
    Paragraph("Entrada con Google para el piloto", title),
    Paragraph("Coste 0 €. Unos 30 minutos, una sola vez. Al terminar, tus amigos entran con su cuenta de Google.", subtitle),
    box("<b>Regla única:</b> el valor de " + code("AUTH_SECRET") + " y el «secreto de cliente» de Google <b>no se pegan nunca en el chat</b>: "
        "se copian de una pantalla a otra. A mí solo dime «hecho».", body, SOFT, "#c9d36a"),
    Spacer(1, 8),
]

story.append(task(
    "1", "Crear la clave de firma (AUTH_SECRET)", "", "5 min",
    "Firma la sesión de cada jugador para que nadie pueda falsificarla. Es una cadena aleatoria que solo conoce Vercel.",
    [
        "Windows: abre PowerShell y pega (todo en una línea): " + code("$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)"),
        "Mac: abre Terminal y escribe " + code("openssl rand -base64 48") + ".",
        "Aparece una cadena larga. Cópiala (selecciónala y copia). No la guardes en ningún archivo ni la mandes por mensaje.",
    ],
))
story.append(task(
    "2", "Guardarla en Vercel", "", "5 min",
    "Vercel la entrega a la app cuando arranca. Después hay que redesplegar.",
    [
        "vercel.com › equipo Skill Arena › proyecto <b>skill-arena-mvp</b> › <b>Settings › Environment Variables</b>.",
        "<b>Add</b>: Key " + code("AUTH_SECRET") + ", Value = la cadena copiada. Marca <b>Production</b> y <b>Preview</b> y activa <b>Sensitive</b>. Guardar.",
        "Otra variable: Key " + code("AUTH_URL") + ", Value " + code("https://skill-arena-mvp-git-mobile-test-skill-arena2.vercel.app")
        + " (la dirección estable de la rama de pruebas), Production y Preview.",
        "Comprueba que ya existe " + code("DATABASE_URL") + " (la crea Neon). Si no está, avísame.",
    ],
    "No pulses Redeploy todavía: primero el paso 3.",
))
story.append(task(
    "3", "Crear el acceso en Google", "", "15 min",
    "Google comprueba quién es cada jugador. Es gratis y no pide tarjeta.",
    [
        "console.cloud.google.com con tu cuenta › selector de proyecto › <b>Proyecto nuevo</b>, nombre «Galactic Games».",
        "Menú › <b>APIs y servicios › Pantalla de consentimiento OAuth</b> (o «Google Auth Platform») › Empezar › nombre de la app «Galactic Games», "
        "tu correo de asistencia › Público: <b>Externo</b>.",
        "En <b>Público</b> deja la app en estado <b>Pruebas</b> y añade como <b>usuarios de prueba</b> el Gmail de cada amigo (hasta 100). "
        "Así solo ellos pueden entrar.",
        "<b>Credenciales › Crear credenciales › ID de cliente de OAuth</b> › tipo <b>Aplicación web</b>.",
        "En <b>URI de redireccionamiento autorizados</b> añade exactamente: " + code("https://skill-arena-mvp-git-mobile-test-skill-arena2.vercel.app/api/auth/google/callback") + ".",
        "Crear. Aparecen <b>ID de cliente</b> y <b>secreto de cliente</b>. En Vercel crea " + code("AUTH_GOOGLE_CLIENT_ID") + " y "
        + code("AUTH_GOOGLE_CLIENT_SECRET") + " (Production y Preview, Sensitive) pegando cada valor.",
        "Ahora sí: Vercel › Deployments › el último de <b>mobile-test</b> › <b>Redeploy</b>.",
    ],
))
story.append(task(
    "4", "Dejar que tus amigos abran la web", "", "2 min",
    "Ahora mismo Vercel pide iniciar sesión en Vercel para abrir cualquier dirección vercel.app, y tus amigos no tienen cuenta.",
    [
        "Vercel › proyecto › <b>Settings › Deployment Protection</b> › <b>Vercel Authentication</b> › desactivar › Guardar.",
        "Con eso la dirección se abre a quien tenga el enlace. Los datos siguen protegidos: solo entran con Google los usuarios de prueba del paso 3.",
    ],
    "Es un cambio de permisos de tu proyecto: hazlo solo si te parece bien. Se puede volver a activar en cualquier momento.",
))
story.append(task(
    "5", "Probar", "", "3 min",
    "",
    [
        "Abre " + code("https://skill-arena-mvp-git-mobile-test-skill-arena2.vercel.app/api/health") + ": debe decir <b>database ok</b> y <b>schema 011</b>.",
        "Abre la web, «Continuar con Google» con tu cuenta, elige nombre y avatar. Debes ver 25 ₡ ficticios.",
        "Si algo falla, mándame una captura (sin claves visibles).",
    ],
))
story.append(Paragraph(
    "<b>Apple:</b> «Continuar con Apple» exige una cuenta de pago de Apple Developer (99 USD al año). No lo activamos para el piloto; "
    "si algún día lo quieres, te digo el importe y cómo cancelarlo antes de contratar nada.", body))

doc = SimpleDocTemplate(
    "docs/GUIA_ENTRADA_CON_GOOGLE.pdf", pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
    title="Guía de entrada con Google · Galactic Games", author="Galactic Games",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote docs/GUIA_ENTRADA_CON_GOOGLE.pdf")
