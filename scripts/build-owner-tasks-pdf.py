"""Builds docs/TAREAS_PROPIETARIO.pdf: the tasks only the owner can do, step by step (v186).

Run: python3 scripts/build-owner-tasks-pdf.py
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
    canvas.drawString(20 * mm, 12 * mm, "Galactic Games · Tareas del propietario · v188 · 13 de noviembre de 2026")
    canvas.drawRightString(190 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


story = [
    Paragraph("Tareas que solo puedes hacer tú", title),
    Paragraph(
        "Galactic Games · versión v188 · 13 de noviembre de 2026. Cada tarea dice por qué importa, cuándo hacerla y los "
        "pasos exactos. Marca la casilla al terminar. Si un paso no coincide con lo que ves en pantalla, para y "
        "pregúntale a Claude con una captura.",
        subtitle,
    ),
]

rules = Table([[Paragraph(
    "<b>Tres reglas que no se rompen nunca.</b><br/>"
    "1. Ninguna contraseña, clave o código secreto se pega en un chat (tampoco a Claude), un correo o un documento. "
    "Solo en el gestor de contraseñas y en la pantalla del servicio que lo pide.<br/>"
    "2. Lo público se puede compartir: la clave pública de copias (empieza por " + code("age1") + ") y las "
    "direcciones web.<br/>"
    "3. Si dudas de si algo es secreto, trátalo como secreto.",
    body)]], colWidths=[176 * mm])
rules.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), SOFT), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#c9d36a")),
    ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
    ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
]))
story += [rules, Spacer(1, 6)]

summary = [
    ["", "Tarea", "Cuándo", "¿Imprescindible?"],
    ["1", "Gestor de contraseñas: todas las claves en un solo sitio", "Ahora", "Sí"],
    ["2", "Verificación en dos pasos en Google, GitHub y Vercel", "Ahora", "Sí"],
    ["3", "Claves distintas para pruebas y producción", "Antes de que jueguen otros móviles", "Sí"],
    ["4", "Copias de seguridad: tu clave y la conexión", "Antes de que jueguen otros móviles", "Sí, en cuanto haya datos de jugadores"],
    ["5", "Dar acceso a otros móviles", "Cuando decidas", "Decisión tuya"],
    ["6", "Dominio y correo", "Cuando los compres", "Sí, para lanzar en serio"],
    ["7", "Abogado de juego y visibilidad del código", "Antes de dinero real", "Sí, antes de dinero"],
]
t = Table([[Paragraph(c, small if r == 0 else body) for c in row] for r, row in enumerate(summary)],
          colWidths=[8 * mm, 82 * mm, 46 * mm, 40 * mm])
t.setStyle(TableStyle([
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK), ("LINEBELOW", (0, 1), (-1, -1), 0.3, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [Paragraph("Resumen", h1), t, Spacer(1, 6), Paragraph(
    "Ya no son tareas tuyas: el aviso de mantenimiento (es automático), comprobar la protección de forks (lo comprueba "
    "Claude) y volver a una versión anterior o recuperar datos (está en el manual de operación por si algún día hace "
    "falta, pero no hay que hacer nada ahora). El aviso de salud se configura con el dominio (tarea 6).", small), PageBreak()]

story.append(task(
    "1", "Gestor de contraseñas: todas las claves en un solo sitio", "Ahora", "20 min",
    "Hoy las claves del proyecto están repartidas entre Vercel, GitHub, Neon y tu memoria. Un gestor las guarda "
    "cifradas en un único sitio, las genera largas y te avisa si alguna se filtra. Es la «centralización» que pediste.",
    [
        "Instala <b>Bitwarden</b> (gratis) en el ordenador y en el móvil: bitwarden.com › Get started. Vale cualquier "
        "otro gestor serio (1Password, Proton Pass).",
        "Elige una <b>contraseña maestra</b> larga que no uses en ningún otro sitio (por ejemplo, cuatro o cinco "
        "palabras al azar). Apúntala en papel y guárdala en casa: si la olvidas, nadie puede recuperar el gestor.",
        "Crea una carpeta <b>Galactic Games</b> y guarda dentro: tu cuenta de Google, GitHub y Vercel, los códigos de "
        "recuperación de la tarea 2 y, más adelante, la clave privada de copias (tarea 4) y el registro del dominio "
        "(tarea 6).",
        "Cambia las contraseñas débiles o repetidas de esas cuentas por otras generadas por el gestor.",
    ],
    heading="Ahora: proteger tus cuentas",
))
story.append(task(
    "2", "Verificación en dos pasos en Google, GitHub y Vercel", "Ahora", "15 min",
    "Quien entre en una de esas cuentas controla el proyecto entero: el código, la web y la base de datos. Con la "
    "verificación en dos pasos, además de la contraseña hace falta tu móvil.",
    [
        "Instala una app de códigos en el móvil (Google Authenticator, Microsoft Authenticator o la propia de "
        "Bitwarden).",
        "<b>Google:</b> myaccount.google.com › Seguridad › Verificación en dos pasos › Activar.",
        "<b>GitHub:</b> foto de perfil › Settings › Password and authentication › Enable two-factor authentication.",
        "<b>Vercel:</b> foto de perfil › Account Settings › Authentication › Two-Factor Authentication. Si entras en "
        "Vercel con GitHub o Google, protege esa cuenta (pasos anteriores).",
        "En cada servicio te dan <b>códigos de recuperación</b>: guárdalos en el gestor. Sin ellos, si pierdes el "
        "móvil pierdes la cuenta.",
    ],
))
story.append(task(
    "3", "Claves distintas para pruebas y producción", "Antes de que jueguen otros móviles", "15 min, con Claude",
    "La revisión de seguridad independiente avisó: si las pruebas y la producción comparten la misma clave de firma, "
    "algo creado en una prueba valdría en producción. Cada entorno debe tener la suya.",
    [
        "Vercel › proyecto › Settings › <b>Environment Variables</b>.",
        "Para " + code("MATCH_SIGNING_SECRET") + " (y " + code("AUTH_SECRET") + " si existe): edita la de "
        "<b>Production</b> y pon un valor nuevo generado por el gestor (64 caracteres, letras y números).",
        "Haz lo mismo con la de <b>Preview</b>, con otro valor distinto. Guarda ambos en el gestor.",
        "Dile a Claude «claves separadas»: él publicará una versión para que se apliquen y comprobará que todo funciona.",
    ],
    heading="Antes de que jueguen otros móviles",
))
story.append(task(
    "4", "Copias de seguridad: tu clave y la conexión", "Antes de que jueguen otros móviles", "20 min",
    "Cada día se hará una copia cifrada de la base. La clave <b>pública</b> solo sirve para cifrar y va en el código; "
    "la <b>privada</b> es la única que abre las copias y solo la tienes tú. Mientras nadie más juegue, la base está "
    "casi vacía y no corre prisa; en cuanto haya partidas de otros, sí.",
    [
        "En Windows, abre <b>PowerShell</b> y escribe: " + code("winget install FiloSottile.age") + " (acepta si pregunta). "
        "Cierra y vuelve a abrir PowerShell.",
        "Escribe: " + code("age-keygen -o galactic-backup-key.txt") + ". Verás «Public key: age1…»: esa línea es "
        "pública, cópiala y pégasela a Claude.",
        "El archivo " + code("galactic-backup-key.txt") + " es la <b>clave privada</b>: guárdalo en el gestor y en un "
        "USB en casa, y bórralo del ordenador.",
        "Vercel › Storage › galactic-games › <b>Open in Neon</b> › <b>Connect</b>: rama main, base neondb, "
        "<b>Connection pooling</b> desactivado, <b>Show password</b>, copia la dirección " + code("postgresql://…") + ".",
        "GitHub › skill-arena-mvp › Settings › Secrets and variables › Actions › <b>New repository secret</b>: Name "
        + code("BACKUP_DATABASE_URL") + ", Secret: la dirección. <b>Add secret</b>. Avisa a Claude sin pegarla.",
    ],
    "Sin la clave privada, las copias no se pueden abrir: ni tú, ni Claude, ni nadie. Guárdala en dos sitios.",
))
story.append(task(
    "5", "Dar acceso a otros móviles", "Cuando decidas", "5 min",
    "Hoy toda la web pide iniciar sesión en Vercel, así que otros móviles no pueden entrar. Hay dos formas de abrirla; "
    "Claude te recomendará cuál según lo que quieras probar.",
    [
        "<b>Solo para probar con unos pocos:</b> un enlace de invitación de la versión de pruebas (Vercel › la "
        "publicación de mobile-test › <b>Share</b>). Quien tenga el enlace entra sin cuenta de Vercel.",
        "<b>Para lanzar:</b> Claude lleva a producción la versión que apruebes; luego Vercel › Settings › "
        "<b>Deployment Protection</b> › Vercel Authentication › <b>Only Preview Deployments</b>. Producción queda "
        "abierta y las pruebas siguen con candado.",
        "En los dos casos se juega con saldo ficticio, y la app lo dice.",
    ],
))
story.append(task(
    "6", "Dominio y correo", "Cuando los compres", "30 min, con Claude",
    "Un dominio propio (por ejemplo galacticgames.es) da una dirección seria, permite el inicio de sesión con Google y "
    "Apple con tu marca y es necesario para el correo de contacto y de privacidad.",
    [
        "Cómpralo en un registrador conocido (por ejemplo, el propio Vercel › Domains, Cloudflare o Namecheap). Activa "
        "en el registrador la verificación en dos pasos y el bloqueo de transferencia, y guarda el acceso en el gestor.",
        "Vercel › proyecto › Settings › <b>Domains</b> › Add: escribe el dominio y sigue los registros DNS que pide. "
        "Claude comprueba que queda bien y actualiza la app (dirección pública, inicio de sesión, avisos).",
        "Correo: créalo con un proveedor (Google Workspace, Zoho o el de tu registrador) para direcciones como "
        "contacto@ y privacidad@. Añade los registros SPF, DKIM y DMARC que te indique; Claude te los revisa.",
        "Aviso de salud: GitHub › Settings › Secrets and variables › Actions › Variables › " + code("HEALTH_URL")
        + " = " + code("https://tu-dominio/api/health") + ". Si falla, te llega un correo.",
    ],
    heading="Cuando compres el dominio y el correo",
))
story.append(task(
    "7", "Abogado de juego y visibilidad del código", "Antes de dinero real", "Decisiones",
    "Son decisiones de negocio y legales: Claude no las toma ni las activa.",
    [
        "<b>Abogado especializado en juego online.</b> Torneos con premio en dinero están dentro de la Ley 13/2011 "
        "(juego y concursos), aunque dependan de la habilidad y aunque no haya pago por entrar. Pregúntale qué licencia "
        "hace falta, si la comisión del 5 % al cambiar euros por ₡ cambia algo, qué exige la verificación de "
        "identidad, y que revise las condiciones para estudios.",
        "<b>Código público o privado.</b> Hoy cualquiera puede leer el código (no cambiarlo). Para dinero real conviene "
        "privado. Se cambia en GitHub › Settings › General › Danger Zone › Change visibility; es decisión tuya.",
    ],
    heading="Antes de cualquier dinero real",
))

story.append(Spacer(1, 4))
story.append(Paragraph(
    "Lo que Claude nunca hace sin ti: borrar ramas, cambiar la rama de producción, tocar variables de producción, "
    "cambiar la visibilidad del repositorio, activar dinero real o inicios de sesión en producción, y migraciones que "
    "borren datos.",
    small,
))

doc = SimpleDocTemplate(
    "docs/TAREAS_PROPIETARIO.pdf", pagesize=A4, leftMargin=17 * mm, rightMargin=17 * mm, topMargin=16 * mm,
    bottomMargin=20 * mm, title="Galactic Games · Tareas del propietario", author="Galactic Games",
)
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print("docs/TAREAS_PROPIETARIO.pdf")
