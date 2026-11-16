"""Builds docs/GUIA_COPIA_DE_SEGURIDAD.pdf: how to set up the daily database backup, step by step (v193).

Run: python3 scripts/build-backup-guide-pdf.py
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
    canvas.drawString(20 * mm, 12 * mm, "Galactic Games · Guía de la copia de seguridad · v193 · 16 de noviembre de 2026")
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
    Paragraph("Copia de seguridad en 3 pasos", title),
    Paragraph("Coste 0 €. Unos 15 minutos, una sola vez. Después se hace sola cada noche y se guarda 30 días.", subtitle),
    box(
        "<b>Regla única:</b> lo que empieza por " + code("age1") + " se puede compartir. Lo que empieza por "
        + code("AGE-SECRET-KEY") + " o por " + code("postgresql://") + " <b>no se pega nunca en el chat</b>, solo donde "
        "esta guía lo dice.", body, SOFT, "#c9d36a"),
    Spacer(1, 8),
]

story.append(task(
    "1", "Crear tu clave de cifrado", "", "5 min",
    "Cifra las copias. La pública cierra; la privada abre y es solo tuya.",
    [
        "Instala la herramienta. Windows: " + code("winget install FiloSottile.age") + ". Mac: " + code("brew install age") + ".",
        "Abre una ventana nueva y escribe " + code("age-keygen -o galactic-backup-key.txt") + ".",
        "Copia la línea <b>Public key: age1…</b> que aparece. <b>Pégamela a mí en el chat</b> (esa sí es pública).",
        "Guarda el archivo " + code("galactic-backup-key.txt") + " en tu gestor de contraseñas y en un USB. Luego bórralo del ordenador.",
    ],
    "Si pierdes ese archivo, las copias no se pueden abrir nunca. No se lo envíes a nadie, ni a mí.",
))

story.append(task(
    "2", "Copiar la dirección de la base de datos", "", "5 min",
    "Es la llave de Neon. GitHub la guarda cifrada y la usa cada noche.",
    [
        "vercel.com › equipo Skill Arena › Storage › galactic-games › <b>Open in Neon</b> › botón <b>Connect</b>.",
        "<b>Apaga «Connection pooling»</b> y pulsa copiar la cadena " + code("postgresql://…") + ".",
        "GitHub › repositorio skill-arena-mvp › <b>Settings › Secrets and variables › Actions › New repository secret</b>.",
        "Name: " + code("BACKUP_DATABASE_URL") + ". Secret: pega la cadena. <b>Add secret</b>.",
    ],
))

story.append(task(
    "3", "Comprobar que funciona", "", "5 min",
    "Cuando yo te avise de que la clave pública está guardada.",
    [
        "Repositorio › <b>Actions › Copia de la base de datos › Run workflow</b> (rama main).",
        "Si sale <b>verde</b>, listo: en Artifacts está la copia cifrada. Si sale amarillo o rojo, mándame una captura.",
    ],
))

story.append(Paragraph(
    "<b>Opcional, cuando haya dominio:</b> Settings › Secrets and variables › Actions › Variables › " + code("HEALTH_URL")
    + " = " + code("https://tudominio.com/api/health") + ", para que GitHub avise si la web se cae. Pública, no secreta.", body))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "<b>Una vez, esta semana:</b> descarga una copia y pruébala: " + code("age -d -i galactic-backup-key.txt -o copia.dump archivo.dump.age")
    + ". Si crea " + code("copia.dump") + ", tu clave funciona. Borra después " + code("copia.dump") + " (contiene datos).", body))

doc = SimpleDocTemplate(
    "docs/GUIA_COPIA_DE_SEGURIDAD.pdf", pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
    title="Guía de la copia de seguridad · Galactic Games", author="Galactic Games",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote docs/GUIA_COPIA_DE_SEGURIDAD.pdf")
