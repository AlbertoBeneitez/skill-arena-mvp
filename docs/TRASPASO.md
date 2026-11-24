# Traspaso de trabajo (21-nov-2026) — para la siguiente sesión o cuenta

Léelo después de `docs/STATE.md`. Cuenta dónde se quedó el trabajo, qué está decidido y qué falta.

## Dónde está todo

| Qué | Dónde |
|---|---|
| App en el móvil | `mobile-test` = **v227-saturn** (app 2.27). **v228**, **v229** y **v230-saturn** (la más reciente, contiene las anteriores) están en sus ramas, sin subir: solo se sube con orden expresa del propietario |
| Último trabajo | Rama **v227-saturn**: seguridad fase 0 (C2, A1, A2, B1), simulador en GitHub Actions, propuesta de logo y estética retro |
| Servicios a contratar | **[Documento vivo en Claude](https://claude.ai/artifact/BWap6G5AZ3i6ioQiF9wuPP)** (decisión del propietario; copia en [SERVICIOS_A_CONTRATAR.md](SERVICIOS_A_CONTRATAR.md)) |
| Simulador de bots | `scripts/sim/` y `.github/workflows/sim-bots.yml` — guía en [SIMULADOR_BOTS.md](SIMULADOR_BOTS.md) |
| Revisión de seguridad | [security/REVISION_2026-11.md](security/REVISION_2026-11.md) (lo arreglado en v227 está marcado) |
| Propuesta de logo | [design/logo/](design/logo/) (`logo-propuesta.png`, `retro-propuesta.png`; fuentes en `gen.py`, `*.html`) |
| Normas del propietario | `CLAUDE.md` y `AGENTS.md` (una sola subida a `mobile-test` por sesión; nada de pago sin permiso; Vercel Pro no se cancela antes del 12-dic-2026, recordárselo ese día) |

Para retomar el simulador en una máquina nueva: crear la base `skill_arena_sim`, `pnpm build`, arrancar
`scripts/sim/start-server.sh` y lanzar `pnpm sim` (ver la guía). Los informes quedan en `sim-reports/` (fuera de git).

## Siguiente trabajo (21-nov), en orden

1. **Logo:** aprobado y aplicado en v228 ([design/logo/README.md](design/logo/README.md)). **Estética retro: rechazada**
   (21-nov); no aplicarla.
   **Subidas:** el propietario prohíbe subir nada que cueste dinero sin su orden (21-nov, en `CLAUDE.md`): ni
   `mobile-test` ni `main`. v228 espera en su rama.
2. **Avisos dentro de la app: hechos en v230** ([releases/v230-saturn.md](releases/v230-saturn.md)). Pendiente: Web Push
   (claves VAPID del propietario), animación de liga y récord, y los avisos de 1 vs 1 y Relevos con conexión. Texto original de la tarea:
   solo buenas noticias (rival encontrado o reto aceptado, tu turno,
   ganas jornada o competición); subir de liga y récord son animación en el momento; ajuste «Dónde» con App y Móvil;
   logo en los avisos. Los avisos al móvil necesitan las claves VAPID, que pone el propietario en Vercel.
3. **Información oculta por pasos** (aprobada el 20-nov): Solitaire primero (el servidor revela cada carta), después Tower,
   Stack y Dardos; Billar y Pinball no cambian. Luego la capa de detección de comportamiento (solo observar) y la
   identidad por fases. Es versión competitiva nueva en cada juego: conservar las antiguas.
4. **Decidido el 21-nov (aplicado en v228):** retención de 90 días, abandono en grupos = 0 puntos, BotID Basic, ligas
   Ámbar y Perla. **Pendiente del propietario:** cambiar `AUTH_SECRET` de producción y poner las claves VAPID (él, en
   Vercel); fusionar con `main`. **Grupos:** hecho en v229 (Liga con tres modalidades, Eliminatoria v2 entre dos
   grupos: 5 jornadas, puntos por puesto, uno fuera por jornada). Falta decidir qué hacer con el panel «Retar a otro
   grupo»: decidido en v229 (solo liga grupo contra grupo; el propietario lo revisará).
   **Costes de Vercel (22-nov):** el 21-nov hubo además un despliegue de producción desde `main` (PR #11, otra
   sesión) y despliegues cancelados de ramas de otras sesiones (`feat/solitaire-v1-oculto`,
   `chore/especificaciones-juegos`, `feat/game-spec-integrity`). `main` no tiene `vercel.json`: sus ramas no llevan
   el bloqueo de despliegues de v229.
5. **Comprobar tras subir v228 a `mobile-test`:** que la app empieza partidas, crea cuenta y actúa en grupos con
   BotID (si apareciera `BOT_DETECTED` a jugadores reales, quitar la ruta de `lib/botRoutes.ts`), y `schema` 018 en
   `/api/health`.

## Preguntas del propietario (20-nov, 18:00) y respuestas

**1. Bots de Mine Grid y Solitaire.** Hechos y probados (v225). Mine Grid juega por el protocolo oculto del servidor
y gana 5 de 6 partidas viendo solo lo que ve un móvil; todas las trampas de protocolo se rechazan. Solitaire juega en
un navegador real tocando cartas. Descubrió que la partida no termina si te quedas sin jugadas (observación en la
revisión).

**1b. Por qué se saltan Slot, Galoku y Reaction Test en tiempo real, y qué efecto tiene.** El servidor exige que una
partida dure lo que dura de verdad, y con los bots genéricos esas tres pasan de 150 s (no saben resolver un sudoku ni
cuándo plantarse, así que llegan al límite de tiempo). Efecto: su camino de servidor no se ejecutó en la campaña en
tiempo real. Sí pasaron la comprobación fuera de línea (el servidor acepta sus partidas). En la app no cambia nada.
Para cubrirlas: una campaña larga con `SIM_MAX_MATCH_S=900`, o bots específicos.

**2. Cómo evitar que un bot pruebe jugadas en una copia del juego.** No hay una solución única, porque hoy el móvil
recibe la semilla y puede calcular el futuro. Las opciones, de más fuerte a más débil:
- **Servidor con autoridad en tiempo real.** El juego corre en el servidor y el móvil solo manda toques; nunca conoce
  el futuro. Es lo más seguro, pero necesita un servicio en tiempo real (de pago, fuera de Vercel Functions) y añade
  retardo.
- **Información oculta por pasos**, como ya hace Mine Grid. El servidor revela el azar solo cuando toca (siguiente
  carta, pieza, diana o mesa). Encaja con los juegos por turnos o con «siguiente elemento» (Solitaire, Tower, Stack,
  Dardos, Billar por tiros) a coste 0 € en Vercel. Un bot sigue pudiendo ser preciso, pero ya no puede ver el futuro.
- **Semilla por tramos.** El servidor entrega el azar en trozos de pocos segundos. Limita la anticipación a ese trozo.
- **Detección de comportamiento.** Para lo que queda (precisión inhumana): tiempos de reacción, varianza y
  constancia, comparados con humanos. El simulador da ejemplos de bot para calibrarla.
- **Identidad y fricción.** BotID, una cuenta por persona y KYC con dinero. No impiden el bot, pero lo encarecen.

Recomendación: información oculta por pasos en los juegos que lo permitan, detección en los de tiempo real e identidad
cuando haya dinero. Es lo que hacen las plataformas de habilidad: el ajedrez online, por ejemplo, vive de la detección.

**3. ¿Se puede subir el tope de 2000 partidas para jugar sin límite?** Sí. El tope solo protege la base de datos
gratuita de Neon (1 GB; si se llena deja de escribir, no cobra). Lo correcto no es subirlo, sino quitarlo:
- límite por cuenta y día en vez de un tope global;
- limpieza automática: guardar las entradas completas unos 30 días y después solo el resultado (cientos de bytes).

Medido en local: cada partida guardada ocupa unos 2 KB de partida, más sus entradas (de 1 a 15 KB). Sin limpieza caben
del orden de 100 000 partidas en 1 GB; con limpieza, muchas más. Es la fase 0 de la revisión (0 €): **pendiente de que
el propietario diga «sí»**.

**4. Notificaciones de buenas y malas noticias cuando una jugada afecta al jugador.** Pendiente de diseño con el
propietario. Propuesta para validar:
- **Buenas:** te ha tocado un rival; aceptan tu reto; ganas una jornada o una competición; subes de liga en un juego;
  superas tu récord; te toca jugar en relevos; tu grupo gana.
- **Malas:** alguien supera tu récord o tu puesto en la clasificación del grupo; pierdes una jornada; tu reto caduca o
  lo rechazan; tu rival termina antes que tú (presión de turno); te expulsan de un grupo.
- **Dónde:** dentro de la app, un aviso breve arriba (verde con «▲» para buenas, coral con «▼» para malas, siempre con
  texto, no solo color) y un buzón con el historial. Fuera de la app, notificación del móvil (Web Push), que necesita
  las claves VAPID que pone el propietario en Vercel (nunca por chat).
- **Base técnica:** tabla `arena_notifications` (cuenta, tipo, tono, datos, leída) que escriben los servicios de
  servidor que ya deciden esos hechos (grupos, partidas y ligas), y nunca el móvil. `GET /api/notifications` y marcar
  como leída.
- **Preguntas para el propietario:** ¿qué eventos de la lista sí y cuáles no?, ¿solo dentro de la app al principio o
  también notificaciones del móvil (claves VAPID)?, ¿avisos de malas noticias también fuera de la app o solo dentro?,
  ¿límite diario de avisos para no saturar?


## Mensaje del propietario (20-nov, 18:46) — estado y órdenes

| Punto | Estado |
|---|---|
| 0 · Logo de Galactic Games y estética hacia lo retro | **SIGUIENTE PROCESO (prioridad 1).** Logo muy original con al menos 3 versiones: icono de app / acceso directo del móvil (sin texto, legible a 48 px), marca para la pantalla del ordenador y una tercera (sello para carga o para compartir). Más una propuesta de estética retro basada en la app actual: al propietario le gusta lo retro y el aspecto actual; rechazó «Marea Coral» y 12 ecosistemas nuevos, así que debe ser una evolución del aspecto actual, no un cambio total. Entregar imágenes (`SendUserFile`) y esperar aprobación antes de implantar |
| 0.5 · Montar el simulador | **Pendiente (prioridad 2):** `.github/workflows/sim-bots.yml`, nocturno, en GitHub Actions (gratis, repositorio público; no compila en Vercel). PostgreSQL como servicio, `pnpm build`, `scripts/sim/start-server.sh`, `pnpm sim` (sin «cuota»), `pnpm sim:ui -- 6 50` y el informe `sim-reports/` como artefacto. El propietario ya dijo «monta el simulador»: aprobado |
| 1–4 · Notificaciones (cambios sobre `design/avisos/avisos-propuesta.jpg`) | **Aprobado con cambios, sin programar:** (1) fuera el aviso «subes de liga o nuevo récord»: eso debe ser una **animación en el momento** en que pasa; (2) fuera **todos** los avisos de malas noticias; (3) en «Dónde», dos opciones: **App** y **Móvil**; (4) que aparezca el **logo de Galactic Games** (depende del punto 0). Quedan como avisos: rival encontrado o reto aceptado, te toca jugar (relevos y turnos) y ganas una jornada o competición. Los avisos fuera de la app necesitan las claves VAPID (las pone el propietario en Vercel) |
| 5 · Apple | **Hecho (v226):** opción oculta; la lista de servicios está en `SERVICIOS_A_CONTRATAR.md` |
| 6 · Formato de fecha del ranking | **Hecho (v226)** según la imagen |
| 7 · Billar y Pinball | **Hecho (v226), como política:** los juegos no cambian; la política anti-bots está en la revisión |

## Mensaje del propietario (20-nov, 18:27) — estado

| Punto | Estado |
|---|---|
| 7 · Enseñar las notificaciones | **Hecho**: propuesta visual en [design/avisos/avisos-propuesta.jpg](design/avisos/avisos-propuesta.jpg) (aviso bueno, aviso malo, buzón, notificación del móvil, ajustes y tabla de textos). **Esperando validación** antes de programar |
| 1 · Logos muy originales (app del móvil / acceso directo, pantalla del ordenador y otro) | **Siguiente proceso.** Respetar «Galactic Games», 3 versiones como mínimo: icono de app (legible a 48 px, sin texto), marca horizontal para ordenador y una tercera (por ejemplo, sello animado para la pantalla de carga o insignia para compartir). Entregar imágenes y esperar aprobación |
| 2 · ¿Hay que lanzar el simulador a mano? | Respondido: puede ir en paralelo con **GitHub Actions** cada noche (gratis en repositorio público; no compila en Vercel). Falta el «sí» del propietario para crear `.github/workflows/sim-bots.yml` (servidor local + PostgreSQL de servicio + `pnpm sim`; el informe se guarda como artefacto) |
| 3 · Cuenta de Apple | Respondido: el código ya lo soporta (v122). Para activarlo hace falta el Apple Developer Program, **99 $ al año**, que se cancela no renovándolo. Las credenciales las pone el propietario en Vercel. Pendiente de su decisión por el coste |
| 4 · Fechas de rankings «como en la imagen» | **No llegó ninguna imagen.** Pedirla de nuevo |
| 5 · ¿Por qué no salen los bots en los rankings? | Respondido: los bots juegan solo en la copia local, con su propia base de datos, y los rankings de Vercel solo muestran datos reales del servidor (hoy vacíos: las partidas durables no están activadas en Vercel). Meter bots en Vercel costaría uso de pago y ensuciaría los rankings reales. Si se quiere verlos, que sea en una rama de base de datos de Neon aparte (gratis) y con la marca «Bot» |
| 6 · Información oculta por pasos + detección + identidad | **Aprobado por el propietario; pendiente de empezar.** Matiz que hay que mantener: en juegos de física (Billar, Pinball…) el resultado de tu propio tiro se puede calcular siempre; lo que se oculta es el azar futuro (siguiente mesa, pieza, carta, diana, rebote aleatorio). Contra la precisión imposible, detección. Orden propuesto: (a) fase 0 de seguridad (C2, A1, A2); (b) protocolo oculto por pasos reutilizando el de Mine Grid: primero Solitaire, después Tower y Stack (siguiente pieza) y Dardos (siguiente diana); (c) capa de comportamiento en modo observación, calibrada con el simulador; (d) identidad: una cuenta por persona y KYC antes del dinero. Cada juego cambiado es una versión competitiva nueva (las antiguas se conservan) |

## Decisiones pendientes del propietario

1. Fase 0 de seguridad (0 €): quitar el tope global con límite por cuenta y día más limpieza, límites por cuenta,
   partida de la jornada emitida por el servidor en grupos y nombres confundibles.
2. Cambiar `AUTH_SECRET` de producción para que no sea el mismo que el de la vista previa (lo hace el propietario en
   Vercel; cierra las sesiones abiertas).
3. Instalar BotID Basic (gratis).
4. Notificaciones: aprobadas con cambios (ver arriba); falta el logo y las claves VAPID para los avisos fuera de la app.
5. Apple queda para el futuro (ver `SERVICIOS_A_CONTRATAR.md`).
6. Arrastradas de antes: nombres de ligas Ámbar y Perla; fase 2 de grupos (juego online entre grupos y Web Push);
   `ALLOW_PERSISTED_MATCH_TRAINING=1` en la vista previa (solo después de arreglar el tope global, C2).

## Forma de trabajar que espera el propietario

Español. Calidad antes que cantidad. Preguntar ante cualquier duda. Avisar de fallos y de costes antes de incurrir en
ellos. Entregar imágenes con `SendUserFile` en lugar de lienzos. No jugar partidas con la propia mano ni con scripts,
salvo los bots del simulador, solo en local. Cada versión: rama `vNNN-saturn`, notas en `docs/releases/`, `STATE.md` y
`PRODUCT_BACKLOG.md`; validar con `verify-i18n`, `lint`, `test:determinism`, `test:repository`, `build` y
`git diff --check`.
