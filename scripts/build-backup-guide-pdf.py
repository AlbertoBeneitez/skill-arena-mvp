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
    Paragraph("Guía de la copia de seguridad", title),
    Paragraph(
        "Cómo conseguir que cada noche se haga una copia cifrada de tu base de datos, y cómo comprobar que funciona. "
        "Son cuatro tareas y unos 30 minutos la primera vez; después no tienes que hacer nada. Si un paso no coincide "
        "con lo que ves en pantalla, para y mándale a Claude una captura (sin claves visibles).",
        subtitle,
    ),
    box(
        "<b>Qué es cada cosa.</b><br/>"
        "<b>La dirección de la base de datos</b> (empieza por " + code("postgresql://") + ") es la llave que abre Neon, donde "
        "viven las cuentas, los grupos y el dinero ficticio. <b>Es secreta</b>: va solo a GitHub, nunca a un chat, correo "
        "o documento.<br/>"
        "<b>Tu clave de cifrado</b> son dos partes. La <b>pública</b> (" + code("age1…") + ") cierra la copia y se puede compartir. "
        "La <b>privada</b> (" + code("AGE-SECRET-KEY-…") + ") la abre y <b>no sale de tu poder</b>: sin ella las copias no se "
        "pueden leer, ni tú ni nadie.",
        body, SOFT, "#c9d36a"),
    Spacer(1, 6),
    box(
        "<b>Coste: 0 €.</b> El repositorio es público, así que las tareas de GitHub son gratis y sin límite de minutos. Las "
        "copias se guardan 30 días como archivos de la propia tarea, también gratis. Neon despierta un minuto al día "
        "para la copia, dentro del plan gratis. Nada de esta guía pide dar de alta un servicio de pago.",
        body, colors.HexColor("#eef7ee"), "#9bc99b"),
    Spacer(1, 4),
]

story.append(task(
    "1", "Crear tu par de claves de cifrado", "Una sola vez", "10 min",
    "Sin esto la copia no puede cifrarse. Se hace en tu ordenador, no en una web.",
    [
        "<b>Instala la herramienta " + code("age") + ".</b> En Windows, abre «Símbolo del sistema» y escribe "
        + code("winget install FiloSottile.age") + ". En Mac, abre «Terminal» y escribe " + code("brew install age")
        + " (si no tienes Homebrew, dime y lo hacemos de otra forma).",
        "Cierra y vuelve a abrir esa ventana. Escribe " + code("age-keygen -o galactic-backup-key.txt")
        + " y pulsa Intro. Se crea el archivo " + code("galactic-backup-key.txt") + " en la carpeta donde estés.",
        "En pantalla verás una línea " + code("Public key: age1…") + ". <b>Esa es la clave pública.</b> Cópiala entera, desde "
        + code("age1") + " hasta el final.",
        "Abre " + code("galactic-backup-key.txt") + ". La línea que empieza por " + code("AGE-SECRET-KEY-")
        + " es la privada. <b>Guarda el archivo entero</b> en tu gestor de contraseñas como nota adjunta y en un USB, "
        "en dos sitios distintos.",
        "Cuando estés seguro de que está guardado en los dos sitios, <b>borra el archivo del ordenador</b>.",
    ],
    "<b>Si pierdes la clave privada, todas las copias quedan ilegibles para siempre.</b> No hay forma de recuperarla. Y "
    "<b>nunca</b> mandes la privada a nadie, ni a Claude: solo la pública.",
    heading="Tarea 1 · Tu clave de cifrado",
))

story.append(task(
    "2", "Copiar la dirección de la base de datos", "Una sola vez", "5 min",
    "GitHub necesita la dirección para conectarse a Neon cada noche y hacer la copia.",
    [
        "Entra en <b>vercel.com</b> › equipo <b>Skill Arena</b> › pestaña <b>Storage</b> › <b>galactic-games</b> › "
        "<b>Open in Neon</b>.",
        "En el panel de tu proyecto, pulsa el botón <b>Connect</b> (arriba a la derecha).",
        "<b>Apaga el interruptor «Connection pooling».</b> La copia necesita la conexión directa, no la agrupada.",
        "Elige la rama <b>main</b> (o production), la base <b>neondb</b> y el rol que te ofrezca. Pulsa el icono de copiar "
        "junto a la cadena que empieza por " + code("postgresql://") + ". Debe contener " + code("sslmode=require") + " al final y "
        "<b>no</b> debe contener la palabra " + code("-pooler") + " en la dirección.",
        "No la pegues en ningún sitio todavía. Pasa a la tarea 3 con ella en el portapapeles.",
    ],
    "Esa cadena lleva tu contraseña de la base de datos dentro. Si la ves en pantalla con la contraseña, no hagas "
    "captura de esa ventana. Si alguna vez se te escapa, avisa a Claude: se cambia la contraseña en Neon en un minuto.",
    heading="Tarea 2 · La dirección de la base de datos",
))

story.append(task(
    "3", "Ponerla como secreto en GitHub", "Una sola vez", "5 min",
    "Un «secreto» de GitHub queda guardado cifrado: las tareas lo usan, pero nadie puede volver a verlo, ni tú.",
    [
        "Entra en <b>github.com/AlbertoBeneitez/skill-arena-mvp</b>.",
        "Pulsa <b>Settings</b> (la pestaña con el engranaje, arriba a la derecha del repositorio).",
        "En el menú de la izquierda: <b>Secrets and variables</b> › <b>Actions</b>.",
        "Pestaña <b>Secrets</b> › botón verde <b>New repository secret</b>.",
        "En <b>Name</b> escribe exactamente " + code("BACKUP_DATABASE_URL") + " (mayúsculas, con guiones bajos).",
        "En <b>Secret</b> pega la dirección que copiaste en la tarea 2. Pulsa <b>Add secret</b>.",
        "Comprueba que sale en la lista con ese nombre. Si te equivocas, lo borras y lo creas otra vez.",
    ],
    "Escribe el nombre exacto. Si falta una letra, la copia no se hace y la tarea solo muestra un aviso amarillo.",
    heading="Tarea 3 · El secreto de GitHub",
))

story.append(task(
    "4", "Darle a Claude tu clave pública", "Una sola vez", "2 min",
    "La copia se cifra con la clave pública, que va en el repositorio. Puedes compartirla sin riesgo.",
    [
        "Escríbele a Claude, en este chat: «Mi clave pública es " + code("age1…") + "» y pega <b>solo</b> la línea que "
        "empieza por " + code("age1") + " (la de «Public key»).",
        "Claude la guarda en " + code("ops/backup-recipient.txt") + " y te avisa. No hace falta que toques GitHub.",
        "<b>Comprueba antes de enviarlo</b> que lo que pegas empieza por " + code("age1") + " y no por "
        + code("AGE-SECRET-KEY") + ".",
    ],
    "Si por error pegas la privada, avisa de inmediato: se crea un par nuevo y se descarta el anterior.",
    heading="Tarea 4 · Tu clave pública",
))

story.append(PageBreak())
story.append(Paragraph("Probar que funciona", h1))
story.append(task(
    "5", "Lanzar una copia a mano", "Cuando Claude avise del paso 4", "5 min",
    "No esperes a mañana: así sabes hoy que la copia se hace bien.",
    [
        "En el repositorio, pestaña <b>Actions</b>. En la lista de la izquierda, <b>Copia de la base de datos</b>.",
        "Botón <b>Run workflow</b> › rama <b>main</b> › <b>Run workflow</b>. Espera un minuto y recarga.",
        "Debe aparecer un círculo <b>verde</b>. Ábrelo: abajo, en <b>Artifacts</b>, aparece un archivo "
        + code("galactic-games-db-…") + ". Ese contiene la copia cifrada (termina en " + code(".dump.age") + ").",
        "Si sale <b>amarillo</b> con «Copias sin configurar», falta el secreto (tarea 3) o la clave pública (tarea 4). Si sale "
        "<b>rojo</b>, abre el paso que falló y mándale a Claude una captura.",
    ],
)) 
story.append(task(
    "6", "Comprobar una vez que sabes abrirla", "Una vez, esta semana", "10 min",
    "Una copia que no sabes abrir no es una copia. Con esto ves que tu clave privada funciona.",
    [
        "Descarga el archivo de <b>Artifacts</b> (es un .zip; descomprímelo) y deja " + code("galactic-games-….dump.age")
        + " en una carpeta.",
        "Recupera tu archivo de clave del gestor de contraseñas o del USB y ponlo en esa carpeta.",
        "En esa carpeta, escribe: " + code("age -d -i galactic-backup-key.txt -o copia.dump galactic-games-….dump.age")
        + " (cambia los puntos por el nombre real del archivo).",
        "Si se crea " + code("copia.dump") + " sin errores, funciona. Borra " + code("copia.dump") + " y la clave de esa carpeta: "
        "la copia descifrada contiene datos de jugadores.",
    ],
    "Cuando haya jugadores reales, una copia abierta es un dato personal: no la dejes en descargas ni en la nube.",
))

story.append(Paragraph("Opcional: aviso si la web se cae", h1))
story.append(task(
    "7", "Comprobación de salud cada 3 horas", "Cuando haya dominio", "5 min",
    "GitHub pregunta cada 3 horas a la web si responde y te manda un correo si no. Hoy la web de pruebas está tras el "
    "acceso de Vercel, y con la dirección de pruebas haría falta un permiso especial; con tu dominio es más sencillo.",
    [
        "En <b>Settings › Secrets and variables › Actions</b>, pestaña <b>Variables</b> › <b>New repository variable</b>.",
        "<b>Name:</b> " + code("HEALTH_URL") + ". <b>Value:</b> la dirección de la web terminada en " + code("/api/health")
        + " (por ejemplo " + code("https://tudominio.com/api/health") + "). Es una dirección pública, no es secreta.",
        "Mientras no tengas dominio, deja la variable sin crear: la tarea solo avisa de que está sin configurar.",
    ],
    "Cada comprobación despierta la base de datos unos minutos. Con 8 al día se queda muy por debajo del plan gratis de "
    "Neon, así que no cuesta nada.",
))

story.append(Paragraph("Lo que pasa a partir de ahora", h1))
story.append(Paragraph(
    "Cada madrugada se hace una copia cifrada y se guarda 30 días; si falla, GitHub te manda un correo. No tienes que "
    "hacer nada más. Cada tres meses, repite la tarea 6. Cuando un jugador borre su cuenta, desaparece de la base al "
    "instante y de las copias a los 30 días, cuando caducan.",
    body))

doc = SimpleDocTemplate(
    "docs/GUIA_COPIA_DE_SEGURIDAD.pdf", pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
    title="Guía de la copia de seguridad · Galactic Games", author="Galactic Games",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("wrote docs/GUIA_COPIA_DE_SEGURIDAD.pdf")
