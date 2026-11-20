# Traspaso de trabajo (20-nov-2026, 18:30) — para la siguiente sesión o cuenta

Léelo después de `docs/STATE.md`. Cuenta dónde se quedó el trabajo, qué está decidido y qué falta.

## Dónde está todo

| Qué | Dónde |
|---|---|
| App en el móvil | `mobile-test` = **v224-saturn** (app 2.24), comprobada en Vercel (`/api/health` → 2.24, esquema 017) |
| Último trabajo | Rama **v225-saturn** (en GitHub): simulador de bots y revisión de seguridad. **No cambia la app**: no hace falta subirla a `mobile-test` |
| Simulador de bots | `scripts/sim/` — guía en [SIMULADOR_BOTS.md](SIMULADOR_BOTS.md) |
| Revisión de seguridad | [security/REVISION_2026-11.md](security/REVISION_2026-11.md) |
| Normas del propietario | `CLAUDE.md` y `AGENTS.md` (una sola subida a `mobile-test` por sesión; nada de pago sin permiso; Vercel Pro no se cancela antes del 12-dic-2026, recordárselo ese día) |

Para retomar el simulador en una máquina nueva: crear la base `skill_arena_sim`, `pnpm build`, arrancar
`scripts/sim/start-server.sh` y lanzar `pnpm sim` (ver la guía). Los informes quedan en `sim-reports/` (fuera de git).

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

## Decisiones pendientes del propietario

1. Fase 0 de seguridad (0 €): quitar el tope global con límite por cuenta y día más limpieza, límites por cuenta,
   partida de la jornada emitida por el servidor en grupos y nombres confundibles.
2. Cambiar `AUTH_SECRET` de producción para que no sea el mismo que el de la vista previa (lo hace el propietario en
   Vercel; cierra las sesiones abiertas).
3. Instalar BotID Basic (gratis).
4. Notificaciones: respuestas a las preguntas del punto 4.
5. Arrastradas de antes: nombres de ligas Ámbar y Perla; fase 2 de grupos (juego online entre grupos y Web Push);
   `ALLOW_PERSISTED_MATCH_TRAINING=1` en la vista previa (solo después de arreglar el tope global, C2).

## Forma de trabajar que espera el propietario

Español. Calidad antes que cantidad. Preguntar ante cualquier duda. Avisar de fallos y de costes antes de incurrir en
ellos. Entregar imágenes con `SendUserFile` en lugar de lienzos. No jugar partidas con la propia mano ni con scripts,
salvo los bots del simulador, solo en local. Cada versión: rama `vNNN-saturn`, notas en `docs/releases/`, `STATE.md` y
`PRODUCT_BACKLOG.md`; validar con `verify-i18n`, `lint`, `test:determinism`, `test:repository`, `build` y
`git diff --check`.
