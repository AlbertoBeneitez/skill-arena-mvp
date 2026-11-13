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
    canvas.drawString(20 * mm, 12 * mm, "Galactic Games · Tareas del propietario · v187 · 13 de noviembre de 2026")
    canvas.drawRightString(190 * mm, 12 * mm, f"Página {doc.page}")
    canvas.restoreState()


story = [
    Paragraph("Tareas que solo puedes hacer tú", title),
    Paragraph(
        "Galactic Games · versión v187 · 13 de noviembre de 2026. Cada tarea dice por qué importa, cuándo hacerla y los "
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
    ["", "Tarea", "Cuándo"],
    ["1", "Gestor de contraseñas: todas las claves en un solo sitio", "Ahora"],
    ["2", "Verificación en dos pasos en Google, GitHub y Vercel", "Ahora"],
    ["3", "Tu par de claves para las copias de la base", "Esta semana"],
    ["4", "Conexión de las copias en GitHub", "Esta semana"],
    ["5", "Claves distintas para pruebas y producción", "Antes de abrir a amigos"],
    ["6", "Comprobar la protección de copias del repositorio (forks)", "Antes de abrir a amigos"],
    ["7", "Aprobar el lanzamiento y abrir el acceso", "Cuando decidas lanzar"],
    ["8", "Aviso de salud en GitHub", "Justo después de lanzar"],
    ["9", "Si algo falla: volver atrás o recuperar datos", "Cuando haga falta"],
    ["10", "Abogado de juego y visibilidad del código", "Antes de dinero real"],
]
t = Table([[Paragraph(c, small if r == 0 else body) for c in row] for r, row in enumerate(summary)],
          colWidths=[10 * mm, 120 * mm, 46 * mm])
t.setStyle(TableStyle([
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK), ("LINEBELOW", (0, 1), (-1, -1), 0.3, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
]))
story += [Paragraph("Resumen", h1), t, PageBreak()]

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
        "recuperación de la tarea 2 y la clave privada de copias de la tarea 3.",
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
    "3", "Tu par de claves para las copias de la base", "Esta semana", "10 min",
    "Cada día se hace una copia de la base y se cifra. La clave <b>pública</b> sirve solo para cifrar y va en el "
    "código; la clave <b>privada</b> es la única que abre las copias y solo la tienes tú. Así, aunque alguien "
    "descargue una copia, no puede leerla.",
    [
        "En Windows, abre <b>PowerShell</b> (tecla Windows, escribe «PowerShell», Intro).",
        "Instala la herramienta: " + code("winget install FiloSottile.age") + " (acepta si pregunta).",
        "Cierra y vuelve a abrir PowerShell. Escribe: " + code("age-keygen -o galactic-backup-key.txt"),
        "Verás una línea «Public key: age1…». <b>Esa línea es pública</b>: cópiala y pégasela a Claude, que la pondrá "
        "en el proyecto.",
        "El archivo " + code("galactic-backup-key.txt") + " es la <b>clave privada</b>. Guárdalo en el gestor de "
        "contraseñas (como archivo adjunto o nota segura) y en un USB que guardes en casa. Después bórralo del "
        "ordenador.",
    ],
    "Sin la clave privada, las copias no se pueden abrir: ni tú, ni Claude, ni nadie. Guárdala en dos sitios.",
    heading="Esta semana: copias de seguridad",
))
story.append(task(
    "4", "Conexión de las copias en GitHub", "Esta semana", "10 min",
    "La copia diaria necesita poder leer la base. Le das la dirección de conexión como «secreto» de GitHub: queda "
    "cifrada y nadie puede volver a verla, ni tú.",
    [
        "Vercel › Storage › galactic-games › <b>Open in Neon</b>. En Neon, pulsa <b>Connect</b>.",
        "Comprueba: rama <b>main</b>, base <b>neondb</b>. Desactiva <b>Connection pooling</b> (las copias necesitan "
        "conexión directa). Pulsa <b>Show password</b> y <b>Copy snippet</b> de la dirección que empieza por "
        + code("postgresql://") + ".",
        "GitHub › repositorio skill-arena-mvp › <b>Settings</b> › Secrets and variables › <b>Actions</b> › "
        "<b>New repository secret</b>.",
        "Name: " + code("BACKUP_DATABASE_URL") + ". Secret: pega la dirección. Pulsa <b>Add secret</b>.",
        "Borra la dirección del portapapeles copiando cualquier otra cosa. Avisa a Claude: «secreto de copias "
        "puesto» (sin pegarlo).",
    ],
    "Las copias automáticas empiezan cuando el código llegue a producción (rama main). Hasta entonces Claude puede "
    "lanzarlas a mano para comprobar que funcionan.",
))

story.append(task(
    "5", "Claves distintas para pruebas y producción", "Antes de abrir", "15 min, con Claude",
    "La revisión de seguridad independiente avisó: si las vistas de prueba y la producción comparten la misma clave de "
    "firma, algo creado en una prueba valdría en producción. Cada entorno debe tener la suya.",
    [
        "Vercel › proyecto › Settings › <b>Environment Variables</b>.",
        "Para " + code("MATCH_SIGNING_SECRET") + " (y " + code("AUTH_SECRET") + " si existe): edita la de "
        "<b>Production</b> y pon un valor nuevo generado por el gestor (64 caracteres, letras y números).",
        "Haz lo mismo con la de <b>Preview</b>, con otro valor distinto. Guarda ambos en el gestor.",
        "Dile a Claude «claves separadas»: él publicará una versión para que se apliquen y comprobará que todo funciona.",
    ],
    heading="Antes de abrir la web a tus amigos",
))
story.append(task(
    "6", "Comprobar la protección de copias del repositorio (forks)", "Antes de abrir", "2 min",
    "El código es público. Si alguien hace una copia del repositorio (fork) y propone cambios, Vercel no debe "
    "publicarlos con tus claves.",
    [
        "Vercel › proyecto › Settings › <b>Git</b>.",
        "Busca <b>Git Fork Protection</b> y comprueba que está activado. Si no, actívalo y guarda.",
    ],
))
story.append(task(
    "7", "Aprobar el lanzamiento y abrir el acceso", "Cuando decidas lanzar", "5 min",
    "Hoy toda la web, también producción, pide iniciar sesión en Vercel: tus amigos no podrían entrar. Lanzar es "
    "llevar a producción (rama main) una versión que ya probaste en mobile-test; abrir es quitar ese candado solo en "
    "producción.",
    [
        "Prueba la versión en mobile-test en tu móvil. Si te convence, escribe a Claude: «lanza vNNN a producción».",
        "Claude la lleva a main y comprueba que se publica. Tú abres la dirección de producción y la revisas.",
        "Para abrirla: Vercel › proyecto › Settings › <b>Deployment Protection</b> › Vercel Authentication › elige "
        "<b>Only Preview Deployments</b> y guarda. Producción queda abierta; las pruebas siguen con candado.",
        "Comparte con tus amigos solo la dirección de producción.",
    ],
    "Abrir no activa dinero real. Tus amigos juegan con saldo ficticio, y la app lo dice.",
))
story.append(task(
    "8", "Aviso de salud en GitHub", "Justo después de lanzar", "3 min",
    "Cada 3 horas GitHub pregunta a la app si funciona. Si no, te envía un correo.",
    [
        "GitHub › skill-arena-mvp › Settings › Secrets and variables › Actions › pestaña <b>Variables</b> › "
        "<b>New repository variable</b>.",
        "Name: " + code("HEALTH_URL") + ". Value: la dirección de producción terminada en " + code("/api/health")
        + " (por ejemplo " + code("https://skill-arena-mvp.vercel.app/api/health") + "). Guarda.",
        "Comprueba que te llegan los correos de GitHub: foto de perfil › Settings › Notifications › Actions › "
        "«Notify me: Failed workflows only» activado.",
    ],
))

story.append(task(
    "9", "Volver atrás o recuperar datos", "Cuando haga falta", "1–10 min",
    "Acciones rápidas que no necesitan a Claude. El aviso de mantenimiento a los jugadores es automático: no tienes que "
    "hacer nada. El manual completo está en docs/MANUAL_OPERACION.md.",
    [
        "<b>Una versión ha roto algo:</b> Vercel › Deployments › la publicación anterior que funcionaba › menú «⋯» › "
        "<b>Instant Rollback</b>. Segundos, sin tocar datos.",
        "<b>Datos borrados o estropeados hace menos de 6 horas:</b> Neon › proyecto › Postgres database › <b>Backup "
        "&amp; Restore</b> › elige el momento anterior.",
        "<b>Datos más antiguos:</b> GitHub › Actions › «Copia de la base de datos» › la del día › descarga el archivo. "
        "Claude te guía para abrirlo con tu clave privada sin verla.",
    ],
    heading="Cuando algo falle",
))

story.append(task(
    "10", "Abogado de juego y visibilidad del código", "Antes de dinero real", "Decisiones",
    "Son decisiones de negocio y legales: Claude no las toma ni las activa.",
    [
        "<b>Abogado especializado en juego online.</b> Torneos con inscripción en dinero y premio en dinero están "
        "dentro de la Ley 13/2011 (juego y concursos), aunque dependan de la habilidad. Pregúntale qué licencia hace "
        "falta, si la comisión del 5 % al cambiar euros por ₡ cambia algo, qué exige la verificación de identidad, y "
        "que revise las condiciones para estudios (el 50 % de la comisión del cambio se reparte según las partidas de "
        "cada juego).",
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
