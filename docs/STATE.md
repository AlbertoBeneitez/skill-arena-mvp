# Estado actual — Galactic Games

Fuente única del estado del producto. Prevalece sobre `PRODUCT_BACKLOG_STATUS.md`
(congelado en v98) y sobre las notas de versión antiguas. Cada pull request que
cambie algo de lo que aparece aquí lo actualiza.

Actualizado: 21 de noviembre de 2026 · base `mobile-test` en v227-saturn (app 2.27); v228-saturn (logo, BotID, retención, abandono) en su rama, sin subir: el propietario no quiere subidas con coste sin su orden (21-nov).

> **Traspaso (21-nov):** dónde se quedó el trabajo, respuestas y decisiones pendientes en [TRASPASO.md](TRASPASO.md).
>
> **Servicios a contratar (decisión del propietario):** [documento vivo](https://claude.ai/artifact/BWap6G5AZ3i6ioQiF9wuPP) · copia en [SERVICIOS_A_CONTRATAR.md](SERVICIOS_A_CONTRATAR.md).

## Catálogo

**Roulette visible de nuevo (v200):** al final del catálogo, fila Alternativos y Nuevos, siempre sin entrada. Pasos históricos para mostrarla (ya hechos): en `lib/games.ts`, `enabled: true` en su entrada y `"galactic-roulette"` de nuevo al
principio de `CATALOG_ORDER` con una fila en `GAME_SHELF` (y, si se quiere, la fila `casino` en `CatalogShelf`,
`CATALOG_SHELVES`, `SHELF_ACCENTS` y `PROPOSAL_SHELVES`). Todo lo demás sigue en su sitio.

13 juegos visibles: 11 verificados por replay en servidor y 2 integrados con
resultado aún no verificado de extremo a extremo. Roulette está oculta desde v152
(registro, núcleos, verificadores y portada se conservan; ver abajo).

| id interno | Nombre visible | Versión | Estado |
| --- | --- | --- | --- |
| galactic-roulette | Roulette (de nuevo visible desde v200, nunca por dinero) | 21.0.0 | VERIFIED |
| galactic-slot | Slot | 4.0.0 | VERIFIED |
| darts | Dardos | 3.0.0 | VERIFIED |
| billiards | Billar | 7.0.0 | VERIFIED |
| tower-drop | Tower Drop | 5.0.0 | VERIFIED |
| stack-shift | Stack Shift | 4.0.0 | VERIFIED |
| orb-burst | Orb Burst (puntúa burbujas eliminadas) | 8.0.0 | VERIFIED |
| precision-stack | Stack | 4.0.0 | VERIFIED |
| reaction-test | Shot Gallery | 13.0.0 | VERIFIED |
| pinball | Pinball | 14.0.0 | VERIFIED |
| bowling | Bowling | 3.0.0 | VERIFIED |
| corner-sudoku | Galoku | 4.0.0 | VERIFIED |
| solitaire-sprint | Solitaire Sprint | 0.2.0 | INTEGRATED |
| mine-grid | Mine Grid | 0.2.0 | INTEGRATED |

Fuera del catálogo: Memoria (`memory-match` 2.0.0, desactivado; cores conservados
para replay). Fuente de verdad: `lib/games.ts`.

## Infraestructura

| Pieza | Estado |
| --- | --- |
| Producción (`skill-arena-mvp.vercel.app`) | Sirve `main` del 29 de septiembre (demo inicial). Decidido el 12 de noviembre: `main` es producción y `mobile-test` el banco de pruebas; `main` es antecesor directo de `mobile-test`, así que lanzar es un avance normal. Toda la web (también producción) pide iniciar sesión en Vercel |
| Vistas previas | Cada push a `mobile-test` y `vNN-saturn`; protegidas por inicio de sesión de Vercel |
| Node | 24 (`.nvmrc`, Vercel). La CI repite el determinismo en Node 22 |
| Variables en Vercel | `MATCH_SIGNING_SECRET` y `ALLOW_LEGACY_STATELESS_TRAINING` en producción y preview; `DATABASE_URL` y `DATABASE_*` de Neon (sensibles) desde el 12 de noviembre |
| Repositorio | **Público** en GitHub. Historial revisado el 13 de noviembre: sin claves reales |
| Cortafuegos | Vercel Firewall: dos límites de peticiones (configuración versión 4, `docs/security/vercel-firewall.json`). El aviso de mantenimiento es automático en la app |
| Recepción de juegos de estudios | Cerrada (falta `STUDIO_UPLOADS_OPEN=1`) hasta exigir inicio de sesión o anti-bots |
| PostgreSQL alojado | **Neon** (elegido el 12 de noviembre), proyecto `galactic-games` en Frankfurt (AWS eu-central-1), plan gratis, creado desde Vercel › Storage. `DATABASE_URL` en Production y Preview (sensible; la puso la integración, nadie la ha copiado). Migraciones 001–006 aplicadas por el propietario el 12 de noviembre con `db/setup/001-006-nueva-base.sql` en el editor SQL de Neon; desde v192 las migraciones se aplican solas al arrancar el servidor (`instrumentation.ts`, solo las que añaden, todas o ninguna) y `/api/health` dice cuál es la última (`schema`). Funciones de Vercel en `fra1` (`vercel.json`). Encendido solo lo que no tiene interruptor propio: la recepción de juegos de estudios. Partidas públicas (`ALLOW_PERSISTED_MATCH_TRAINING`), ranking real (`RANKING_READ_MODEL_READY`), autoridad de comandos (`COMMAND_AUTHORITY_READY`) y entrenamiento oculto siguen apagados; antes de encenderlos, aceptar en código el `sslmode` de Neon, porque hoy se exige `verify-full` |
| Identidad | Cookie anónima y perfil local. Inicio de sesión con Google, Apple, X, Discord y Microsoft activado en el código (v122); cada proveedor se enciende al poner sus credenciales en Vercel (`docs/AUTH_PROVIDERS.md`). Hoy no hay ninguna |
| Saldo y premios | Ficticios, calculados en el navegador (`localStorage`) |
| CI | `build-v4.yml` (typecheck, determinismo, PostgreSQL, build, smoke móvil), CodeQL, Dependabot. Dependabot y el CodeQL semanal leen `main`, que aún no tiene `.github/`, así que no se ejecutan. El flujo antiguo «Sync Mobile Test» (forzaba `mobile-test`) se desactivó el 29 de octubre |

## Decisiones del propietario

- [x] Archivar las versiones de núcleo anteriores al lanzamiento (solo la vigente por juego). Aprobado el 29 de octubre.
- [x] Convertir las ramas `vNN-*` en etiquetas y borrar las ramas. Aprobado el 29 de octubre.
- [x] Integrar `chore/fase-0-orden` (revisión y limpieza). Aprobado e integrado el 30 de octubre (v124).
- [ ] Borrar las ramas de trabajo antiguas (`archive/pre-saturn`, `audit/…`, `feature/…`, `improve/…`, `qa/…`, `refactor/…`, `skillarena2`). Aprobado el 30 de octubre y confirmado de nuevo el 31 (también `chore/fase-0-orden`, ya contenida en `mobile-test`). Pendiente de ejecutar por el propietario: la sesión de Claude recibe 403 de la política de git al borrar ramas o subir etiquetas; copia completa en un git bundle entregado al propietario.
  Comando: `git push origin --delete archive/pre-saturn audit/production-readiness-v97 feature/dino-dash-professional feature/precision-stack-pro feature/precision-stack-professional improve/alien-sky-river qa/gameplay-polish-v99 qa/precision-stack-professional-pass refactor/game-architecture skillarena2 chore/fase-0-orden`
- [ ] Publicar en producción lo que se prueba en las vistas previas.
- [ ] Hacer privado el repositorio.
- [ ] Mantener `mobile-test` o probar solo desde la vista previa de cada pull request.
- [ ] Tolerar cortes breves de conexión durante la partida (C3: cambia cuándo se pierde por abandono).
- [ ] Dejar de borrar los datos locales al abrir una pestaña nueva (C6).
- [x] **Grupos (1 de noviembre):**
  - al crear un grupo se elige el formato: liga de partidas individuales (cada uno juega cuando quiere y suma sus resultados) o liga de enfrentamientos 1 contra 1 (misma semilla para los dos); además, el torneo;
  - una sola cuota de entrada da derecho a todas las partidas hasta el final; va al bote menos la comisión;
  - antes de empezar se fija el final: N partidas por jugador, o cuando la mayoría vote cerrarlo;
  - mientras no termine se pueden seguir jugando partidas aunque se cierre la app (el estado vive en el servidor).
  - Comisión del 5 % (1 de noviembre). Liga puntuada por victorias.
  - Hecho en v128 con reglas puras (`lib/groupCompetition.ts`), rivales simulados (`lib/demo/groupRivals.ts`) y guardado en el dispositivo; con saldo ficticio hasta la fase 4. Cuando haya servidor e identidad, el mismo módulo corre allí y el servidor emite las semillas.
- [x] **Ruleta (1 de noviembre):** el salto actual no es realista porque la bola se asienta demasiado rápido; debe dar más botes y tardar más en quedarse en el número (núcleo nuevo).
- [x] **Especificación de la plataforma de juegos externos (1 de noviembre):** documento editable en https://claude.ai/artifact/UVovKYHAQV3f4C722uNzsh (paquete, funciones del núcleo, SDK, admisión, producción, versiones, datos, reparto, contrato, fases y decisiones abiertas).
- [x] **Catálogo por filas (1 de noviembre):**
  - orden: Populares (los 8 con más partidas), Nuevos, Bar, Míticos, Dinámicos y Alternativos (Casino se quitó en v152; el Slot está en Alternativos);
  - cada fila se desliza y muestra 2 tarjetas y media, ordenadas por popularidad;
  - la popularidad es un orden fijo editable (`CATALOG_ORDER` en `lib/games.ts`) hasta que el servidor dé partidas reales;
  - los juegos externos eligen categoría, salvo Populares.
  - Botón de jugar: cristal oscuro con borde cian.
- [x] **Sistema de diseño (1 de noviembre):** `DESIGN.md` en la raíz recoge los tokens reales; tipografías Unbounded / Chakra Petch / JetBrains Mono. «DESPEGAR» se descartó: el botón del alta vuelve a «CONTINUAR».
- [x] **Imágenes iniciales (1 de noviembre, v134):** Saturno en primer plano dramático, retroiluminado en creciente sobre negro, sin órbita ni lunas de juego; icono a juego con la G grande.
- [x] **Ruleta realista (1 de noviembre, v133):** física de la bola nueva desde cero (`galacticRouletteCore.v15`): pared con rozamiento, se suelta sola, baja en espiral, rombos, rotor en contra y trastes, reposo en la casilla; 12–16 s por tirada.
- [x] **Estética y orden (1 de noviembre, v132):**
  - fondo negro en lugar del azul marino;
  - fila «Nuevos» tras Populares, con los juegos de los últimos 30 días;
  - ninguna imagen entre pulsar un juego y verlo;
  - nada puede solaparse en ningún momento: los botones van fuera del tablero y `scripts/qa-overlap.cjs` lo comprueba.
- [x] **Ruleta V16 y bordes (1 de noviembre, v136):** la bola se lanza de verdad desde el lanzador y entra con su velocidad (sin círculo forzado ni velocidad mínima); bordes de tarjeta con un color por categoría.
- [x] **Pinball V9 (1 de noviembre, v137):** bloqueo y multibola de tres bolas, jackpots crecientes, súper jackpot y modos de 20 s.
- [ ] **Solitaire Sprint 1.0.0 con cartas ocultas (22 de noviembre, en curso, sin conectar):** decisión del propietario: reparto por partida desde el servidor, igual para los dos rivales; gana quien lo resuelve en menos tiempo, máximo 5 minutos (sin resolver = pierde). Hecho: núcleo privado `solitaireCore.v1.server.ts` (Klondike de una carta, vueltas ilimitadas; el móvil solo ve las cartas boca arriba), emisor que solo entrega repartos que el solucionador demuestra ganables (`lib/server/solitaireDeals.ts`) y `scripts/verify-solitaire-v1.ts`. Pendiente: reloj del servidor y límite de 5 min, partidas por pares para juegos ocultos (también para que Mine Grid dé el mismo campo a los dos), pantalla táctil y catálogo. El catálogo sigue en 0.2.0.
- [x] **Logo, BotID, retención y abandono (21 de noviembre, v228, app 2.28):** átomo pixelado como icono, pestaña e imagen al compartir ([design/logo](design/logo/README.md)); Vercel BotID Basic en inicio de partida, cuenta y grupos; acciones de las partidas borradas a los 90 días (migración 018, resultado conservado); en grupos, abandonar es perder con 0 puntos; privacidad actualizada.
- [x] **Seguridad fase 0 y simulador automático (21 de noviembre, v227, app 2.27):** sin tope global de partidas (límite diario por cuenta y por cookie, freno de almacenamiento a 870 MB), en grupos solo cuenta la primera partida, nombres sin mezclar alfabetos; simulador de bots en GitHub Actions; propuesta de logo (aprobada en v228) y estética retro (pendiente) en [design/logo](design/logo/).
- [x] **Fecha del ranking y sin Apple (20 de noviembre, v226, app 2.26):** cápsula con cantidad y fecha completa arriba del gráfico; «Continuar con Apple» oculto; [servicios a contratar](SERVICIOS_A_CONTRATAR.md); política anti-bots de Billar y Pinball.
- [x] **Simulador de bots y revisión de seguridad (20 de noviembre, v225, sin cambios en la app):** `scripts/sim` (local, 0 €, bots «Bot …», también Mine Grid y Solitaire) y [revisión de seguridad](security/REVISION_2026-11.md). Pendiente decidir la fase 0: tope de partidas por cuenta y día, límites por cuenta, partida de la jornada emitida por el servidor en grupos y nombres confundibles.
- [x] **Ranking y perfil más limpios (20 de noviembre, v224, app 2.24):** línea discontinua en el gráfico de Juegos; fuera los avisos de ejemplo, plataforma y mejor marca; lápiz discreto a la derecha del nombre, sin «Conectado con Google» y con el beneficio neto más grande; editar el perfil vuelve a Avatar › Perfil con «CONTINUAR» bajo el nombre; grupos vacíos sin «Ir a Grupos». Los rankings siguen separados por plataforma aunque no se diga.
- [x] **Buscador y Ranking › Juegos (20 de noviembre, v223, app 2.23):** categorías a todo el ancho, X cuadrada a la derecha de la búsqueda, juegos más separados; sin «DATOS DE EJEMPLO» ni «Último mes» (los ingresos por juego siguen siendo de ejemplo hasta que exista el registro de comisiones); etiqueta del gráfico con cantidad arriba y fecha abajo.
- [x] **Textos de grupos (20 de noviembre, v222, app 2.22):** sin el aviso de rivales inventados; 1 vs 1 explicado como «duelo… Ganas: +2 puntos. Pierdes: 0.».
- [x] **Átomo controlable (20 de noviembre, v221, app 2.21):** derecha sube (absorbe luz y oscurece la zona), izquierda baja (anillo y fotón que salen de la pantalla); color por salto 1↔2 violeta, 2↔3 azul, 3↔4 verde, 4↔5 rojo; átomo más arriba y última órbita menor; cae solo tras ~8 s; «Hola de nuevo» con el nombre más cerca de «Entrar».
- [x] **Átomo de inicio y más ligas (19 de noviembre, v220, app 2.20):** fondo de bienvenida = átomo retro interactivo (`AtomScene`, normas de luz WCAG 2.3.1); ligas Madera/Ámbar/Perla tras Diamante (80/120/175 victorias); once imágenes de grupo elegibles (online por el dueño, migración 017); «Lanzar reto» / «Aceptar retos»; clasificación de las competiciones del grupo en lugar del ranking de grupos.
- [x] **Arranque y Tu selección (19 de noviembre, v219, app 2.19):** pantalla de marca hasta conocer sesión y cuenta (sin parpadeos); Tu selección solo con juegos jugados, del más jugado al menos, con conteo guardado también en el servidor por cuenta (migración 016, `/api/account/plays`); Populares del tamaño del resto; la X de juegos quita el último; megáfono = activar/silenciar (sin selector de música) y sin pitidos sueltos; el reto a otro grupo usa el buscador de juegos.
- [x] **Ligas por victorias y perfil (18 de noviembre, v218, app 2.18):** el nivel de cada juego se gana por victorias en ese juego (Plata 5, Oro 15, Platino 30, Diamante 50; no se pierde; cuentan todas las partidas ganadas). El avatar muestra solo los dos juegos con más rango y, al final, la clasificación de los grupos del jugador. Papelera discreta en lugar del botón rojo de borrar grupo. Imágenes de grupo por defecto tipo película (`scripts/render-group-art.py`).
- [x] **Modalidades de grupo (18 de noviembre, v217, app 2.17, ADR 009):** al crear una competición se elige modalidad: todos vs todos (N … 1 puntos por jornada), 1 vs 1 contra jugadores de otro grupo (2/0) o relevos contra otro grupo del mismo tamaño (cada uno tras el anterior, puntos sumados, 2/0 por grupo). Botón «Buscar grupo rival» por jornada; clasificación al final de la pestaña. Sin conexión, las tres con grupos inventados; con conexión solo todos vs todos hasta la fase 2 (partidas de grupo online, búsqueda en el servidor y aviso en el móvil por Web Push con claves VAPID del propietario). Retirado de la interfaz el juego grupal de Stack (v211).
- [x] **Inicio con cuenta y menos compilaciones (18 de noviembre, v216, app 2.16):** al abrir la app con una cuenta ya cargada aparece «Hola de nuevo» con avatar y nombre, «Entrar» y «Usar otra cuenta» (cierra la sesión y vuelve a la bienvenida); justo después de iniciar sesión se va directo a Juegos. «Tu selección» tiene las tarjetas más grandes del catálogo (dos por pantalla), Populares las segundas. Vercel solo compila `mobile-test` y `main` (antes cada subida compilaba dos veces: la rama de versión y `mobile-test`); una subida por sesión.
- [x] **Bowling (17 de noviembre, v215, app 2.15):** el letrero del fondo de la pista muestra el logo y «GALACTIC GAMES» (antes un planeta y «GALACTIC LANES»). En ordenador el ratón es más sensible: el mismo trazo da más dirección, efecto y fuerza, con zonas muertas menores, lo que lo hace más difícil de controlar. En móvil no cambia nada; reglas y acciones grabadas iguales (Bowling 3.0.0).
- [x] **Portada de Tower Drop (17 de noviembre, v214, app 2.14):** el contenedor siguiente cuelga recto de un cable, separado por encima de la torre; sin fantasmas de balanceo ni destellos, para que no parezca un contenedor encajado entre otros dos. Una línea discontinua marca dónde aterrizará.
- [x] **Interfaz (17 de noviembre, v213, app 2.13):** sin textos ni QR junto al marco de ordenador; pestaña «Grupos»; texto más grande en toda la app (≤ 9 px +1, 10–18 px +2); la X de borrar juegos va justo a la derecha de «2 Juegos» y siempre visible; al cambiar Online/Offline aparece «Modo Online»/«Modo Offline» en el centro. Paquete `qrcode-generator` retirado.
- [x] **Next.js 16.4.5 (17 de noviembre, v212, app 2.12):** corrige dos avisos moderados de seguridad de 16.4.2 (caché con `'use cache'`/`unstable_cache`, que la app no usa). `pnpm audit --prod`: sin vulnerabilidades.
- [x] **Juego grupal (17 de noviembre, v211, app 2.11):** botón «Juego grupal» en los grupos online: el grupo construye una sola torre de Stack, cada turno sigue la torre del anterior (3, 5 o 10 bloques por turno). Solo uno juega a la vez: el que empieza después recibe al momento quién juega y desde cuándo; un turno fuera de plazo, de otro o jugado más rápido que el tiempo real no cuenta y se avisa. Resultado común y bloques por jugador. ADR 008, migración 015. **Retirado de la interfaz en v217** (lo sustituye la modalidad «Relevos», ADR 009); API y datos conservados.
- [x] **Círculo morado (17 de noviembre, v210, app 2.10):** el círculo de cada juego del catálogo se pone morado (gana al verde) cuando tienes una partida de ese juego por jugar: el siguiente partido de tu competición de grupo en curso. Los turnos del juego grupal se añadirán aquí. Las competiciones de grupo online aún no se pueden jugar, así que todavía no encienden el círculo.
- [x] **Shot Gallery V14 (17 de noviembre, v209, app 2.09):** cada pantalla sigue hasta abatir todos los blancos (sin plazo ni «tres fallos»); disparar a un señuelo suma 400 ms, lo esconde y hace salir un blanco nuevo en otro escondite; disparar antes de tiempo suma 600 ms sin saltar la pantalla; seguro de 30 s solo para partidas abandonadas. Mismas pantallas que V13 por semilla; toques por escondite (`PICK_n`). V1–V13 congeladas con sus verificadores.
- [x] **Regla online V2 (17 de noviembre, v208, app 2.08):** las partidas públicas nuevas se deciden por la puntuación de cada juego en su dirección y luego por tiempo (migración 014, ADR007). Stack: más bloques; a igual altura, más superficie (antes desempataba el tiempo). Shot Gallery: menos milisegundos (V1 ya lo hacía bien a través de `height`; el aviso de v207 era erróneo). Las partidas V1 se resuelven como siempre.
- [x] **QA online (16 de noviembre, v207, app 2.07):** el segundo jugador no podía unirse a ninguna partida pública (503): el guardián de inmutabilidad de `arena_matches` veía cambiar las columnas generadas de 008; migración 013 lo arregla. El duelo offline se perdía siempre (decidía el emparejamiento del servidor, que en partidas solo no existe) y mostraba «Rival pendiente». Las muestras de rival pasan a `/api/verified-match/rival-samples` para que llegue la cookie del jugador y no le toque su propia partida. Resuelto en v208 (regla V2). Vista previa: falta `ALLOW_PERSISTED_MATCH_TRAINING=1`, así que allí no hay emparejamiento online real.
- [x] **Imágenes de grupo (16 de noviembre, v206, app 2.06):** 6 ilustraciones propias (`public/groups/`: tripulación, sistema, constelación, flota, base lunar, cometas) como imagen por defecto de cada grupo, elegida por su código (`lib/groupArt.ts`); la foto propia sigue sustituyéndola.
- [x] **Retoques (16 de noviembre, v205, app 2.05):** tarjetas de Populares más grandes; sin barra encima del formato elegido en Grupo; «Iniciar sesión» sin subtítulo; con entrada, el reto entre grupos no ofrece juegos sin apuestas (Roulette).
- [x] **Online igual que Offline (16 de noviembre, v204, app 2.04):** la pantalla de grupo Online es la misma que la Offline (GroupHub) con datos del servidor: crear/unirse, miembros reales, renombrar (dueño), nueva competición con el mismo formulario (el creador entra pagando), competición abierta con Entrar/Empezar/Cancelar, retar a otro grupo, retos abiertos y ranking de grupos con los mismos paneles. Jugar las partidas de una competición online sigue pendiente.
- [x] **Offline también en 1 contra 1 (16 de noviembre, v203, app 2.03):** con el globo en Offline, cada duelo es contra un rival inventado que juega una partida verificada real de otro jugador (si la hay; si no, el rival de liga simulado), sin entrada. Las partidas Offline y de grupo local se verifican en el servidor como partidas «solo» (migración 012): nunca se emparejan ni se ofrecen a otros. Arregla un fallo de v199: en la vista previa una partida de grupo Offline podía quedar «esperando rival» y no anotarse.
- [x] **Ajustes de Grupo y ranking (16 de noviembre, v202, app 2.02):** aviso del globo solo «Offline»/«Online»; sin botón Rankings en Juegos (el ranking sigue en Perfil › Ranking); Grupo sin «Grupos» ni subtítulo; categorías en filas (máx. 3); X junto a «2 Juegos» que borra búsqueda, categoría y juegos elegidos; ingresos del ranking de juegos en ₡.
- [x] **Roulette de vuelta, sin dinero (16 de noviembre, v200, app 2.00):** visible con botón negro (desde v201 sin la etiqueta «Sin dinero» en ningún juego sin apuestas), se juega siempre sin entrada aunque haya una seleccionada; los rivales inventados llevan un retrato que nadie del grupo tiene. Sin conexión, el catálogo de Juegos es el mismo (decisión del propietario).
- [x] **Sin conexión / online (16 de noviembre, v199, app 1.99):** globo en la cabecera; grupo sin conexión con rivales inventados que juegan partidas verificadas reales de otros jugadores (`/api/rival-samples`), gratis; botón negro para juegos sin dinero; traducciones completas. Copia de seguridad diaria funcionando (secreto puesto, primera copia el 16-nov). Regla: Claude no juega partidas.
- [x] **Guía de entrada con Google (16 de noviembre, v198):** `docs/GUIA_ENTRADA_CON_GOOGLE.pdf` (AUTH_SECRET, AUTH_URL, cliente de Google en modo Pruebas, Vercel Authentication). Vercel Pro se mantiene hasta el 12 de diciembre (ya pagado). Con Vercel Authentication activa, los amigos no pueden abrir la web de pruebas.
- [x] **Grupos en el servidor: rutas y pantalla Online (16 de noviembre, v197, app 1.97):** `/api/groups`, pestaña Online en Grupo (crear/unirse, competiciones, buscar rival, ranking). Falta jugar las partidas desde la pantalla.
- [x] **Medición de jugadores (16 de noviembre, v196, app 1.96):** consentimiento versionado y eventos de catálogo solo-añadir (migración 011), vista de partidas por persona, totales recalculables, retención 12 meses (pendiente de confirmar). `docs/EVENTOS.md`.
- [x] **Cada partida, de una persona (16 de noviembre, v195, app 1.95):** el inicio de partida pública guarda `account_id` tomado de la sesión firmada (nunca del navegador); invitado = sin persona.
- [x] **Círculo de partida y buscador de grupos (16 de noviembre, v194, app 1.94):** círculo verde/blanco en las tarjetas del catálogo en lugar de la estrella; X de borrar y categorías en el buscador de juegos de Grupos.
- [x] **Cimientos de la base de datos (16 de noviembre, v193, app 1.93):** persona unida a las partidas (`account_id`), libro de partida doble (saldo leído del libro), borrar = anonimizar, grupos/competiciones/desafíos/ranking en el servidor (migraciones 008–010, `lib/server/groups.ts`, `ledger.ts`; pruebas `verify-groups`). Faltan rutas y pantalla de grupos. Guía de copia: `docs/GUIA_COPIA_DE_SEGURIDAD.pdf`. Regla de avisar de costes en `CLAUDE.md`; Vercel Pro pendiente de que el propietario lo cancele.
- [x] **Slot por dinero, migraciones automáticas, grupo contra grupo (15 de noviembre, v192):** Slot vuelve a ser juego por dinero (solo Ruleta, apagada, es de azar); sin rejilla de fondo y líneas más finas; «Crear un grupo» crea el grupo directamente; botón rojo de borrar grupo con confirmación (devuelve la entrada si la competición no terminó); migraciones automáticas al arrancar (la 007 ya no se pega a mano); reglas de grupo contra grupo en `lib/groupVersus.ts` (liga: gana la menor suma de posiciones; torneo: fuera los dos peores de cada ronda, gana el grupo que conserva jugadores). Falta la pestaña para buscar grupo rival y el ranking de grupos: necesitan grupos en el servidor.
- [x] **Alta de jugadores como será (15 de noviembre, v191):** cuentas en el servidor (nombre único, avatar, saldo ficticio con libro de movimientos y comisión del 5 %), `/api/account` y `/api/wallet`. Se activa con el inicio de sesión de Google en Preview (propietario); la migración 007 se aplica sola desde v192.
- [x] **Protección de datos al día (15 de noviembre, v190):** borrado automático de propuestas (30/180 días), política de privacidad reescrita en 10 idiomas y registro de actividades de tratamiento. Falta la identidad del responsable y el correo (con el dominio).
- [x] **Juegos de azar y por dinero, periodos (13–15 de noviembre, v189):** Slot y Ruleta son de azar (nunca por dinero, también en el servidor) y no generan ingresos; los juegos por dinero se ven dorados; rankings con 1S, 1M, 6M, 1A y Todo.
- [x] **Ranking Juegos y copia sin comentarios (13 de noviembre, v188):** Ranking › Jugadores | Juegos con ingresos por juego (datos de ejemplo hasta el libro de cuentas); `scripts/studio-strip-comments.mjs` para integrar juegos de estudios; diseño anti-bots en `docs/ANTIBOT.md`; tareas del propietario reducidas a 7.
- [x] **Recuento de partidas y aviso automático (13 de noviembre, v187):** el 50 % de la comisión del cambio se reparte entre juegos según partidas verificadas (máx. 20 por jugador, juego y día); condiciones de estudios `studio-terms-2026-11-13`; aviso de mantenimiento solo automático.
- [x] **Comisión solo al cambiar y revisión de seguridad (13 de noviembre, v186):** grupos sin comisión (los antiguos conservan su 5 %); 5 % al ingresar y al retirar; aviso de mantenimiento automático y manual; arreglos de la revisión independiente (.zip trampa, buzón de estudios cerrado, copias con `age`, salud cacheada, pool robusto). Pendientes de la revisión en `docs/releases/v186-saturn.md`.
- [x] **Seguridad mínima (13 de noviembre, v185):** límites a los envíos de estudios, cortafuegos con límites de peticiones, copia diaria cifrada, comprobación de salud y `docs/MANUAL_OPERACION.md`. Pendiente del propietario: secretos de las copias y `HEALTH_URL` en GitHub, verificación en dos pasos en GitHub, Vercel y Google.
- [x] **Base de datos en Neon (12 de noviembre, v184):** PostgreSQL creado en Frankfurt con las tablas 001–006; servidores de la app en Frankfurt.
- [x] **Banderas en el selector de idioma (12 de noviembre, v183):** cada idioma lleva la bandera de la región de su formato de números (inglés EE. UU., portugués Brasil, árabe Arabia Saudí, español sin escudo); en la bienvenida, la bandera del idioma elegido sustituye al globo.
- [x] **Arrastre en ordenador y portada de Orb Burst (12 de noviembre, v182):** el ratón desliza las filas en el marco de ordenador; Orb Burst con cañón y dos filas.
- [x] **Grupo sin simulados (12 de noviembre, v181):** sin NOVA, KAI ni RHEA; EMPEZAR necesita otro jugador real (pendiente: grupos reales en servidor); competiciones antiguas con simulados retiradas con devolución de la entrada.
- [x] **Ranking sin «Ver ejemplo» (12 de noviembre, v180):** Avatar › Ranking sin el selector real/ejemplo.
- [x] **Signo ₡ y dos plataformas (12 de noviembre, v179):** cosmicoin con signo ₡ (fuente `gg-coin.woff`); el ordenador ya no se bloquea: ve la misma app en un marco de móvil y compite solo contra ordenadores (partidas públicas por plataforma con la migración aditiva 006, grupos con código M/D, rankings por plataforma). Migración 006 aplicada en Neon el 12 de noviembre (v184).
- [x] **Portadas, formato 2 de estudios, Avatar, ranking y cartera (12 de noviembre, v178):** portadas de Billar (triángulo), Bowling, Orb Burst (v162) y Stack Shift (3D realista); paquetes de estudio en formato 2 (TypeScript como la app, imagen de presentación obligatoria, integración como versión); perfil sin filas de ajustes y edición desde la ficha; ranking con selector Global y buscador de juegos; cartera con aspecto de Grupo, cantidad en € y retirada hacia un proveedor de pago aún no conectado (solo saldo ficticio).
- [x] **Medallas y ajustes de Grupo (12 de noviembre, v177):** × arriba a la derecha y números arriba a la izquierda; medallas de oro, plata y bronce en el reparto; INGRESAR en pistacho.
- [x] **Modalidades de liga sin explicaciones (11 de noviembre, v176):** «Todos contra todos» y «Duelos 1 vs 1» solo con su nombre.
- [x] **Aleatorio como juego y ajustes (11 de noviembre, v175):** Aleatorio repetible y sorteado al empezar su ronda (`RANDOM_GAME`/`randomPool`); × por juego elegido; premios solo con premio y comisión; «Rondas eliminatorias»; textos nuevos de Enviar juego; portada de Mine Grid hasta arriba; gráfica del perfil bajo la ficha; sin esquinas decorativas en Grupo y Avatar.
- [x] **Cosmicoins, desempates y auditoría (11 de noviembre, v174):** saldo en CC (1 CC = 1 €); Grupo con «EMPEZAR»; Enviar juego con notas «i» por paso; desempate por tiempo y sorteo con semilla (`tieBreak: "time-v1"`, sin cambiar competiciones guardadas); oxlint en `pnpm lint`; cartera y bienvenida como componentes.
- [x] **Colores de Grupo y Avatar (11 de noviembre, v173):** Telemetría con acento cítrico (`#d2df3a`), por defecto en Grupo y Avatar; el resto de la app sigue igual.
- [x] **Cartera manual, Tu selección y juegos (11 de noviembre, v173):** cantidad escrita a mano; «Tu selección» siempre; dardos separados en la portada; tablero oculto hasta tener el escenario del servidor; cifras de Galoku centradas; Billar sin paneles inferiores.
- [x] **Grupo, cartera y Enviar juego (11 de noviembre, v171):** foto y nombre del grupo; Liga con modalidades y número de jornadas; Eliminatorias con eliminados por ronda; reparto por posiciones ±5 %; cartera en la cabecera; «Enviar juego» con pantalla inicial e instrucciones; Avatar sin cuadro de saldo.
- [x] **Avatares 9:16 y Grupo sin destellos (11 de noviembre, v170):** fichas verticales en el selector de avatar; botones elegidos de Grupo solo con filo dorado; cabecera sin «Grupo» repetido.
- [x] **Negro y oro metálico en Grupo y Avatar (11 de noviembre, v169):** el propietario eligió la propuesta negra; se elabora con oro metálico, grano y filetes dorados, y se retiran las propuestas `?tema=`.
- [x] **Colores de Grupo y Avatar (10 de noviembre, v168):** tres propuestas para ver con `?tema=1`, `?tema=2` o `?tema=3` (Brawl, Candy, Tapete), a la espera de que el propietario elija. En la misma versión: selector de avatar 4 × 4 con los retratos enteros, fila «Tu selección», juegos repetibles con buscador y orden en Grupo, € dentro de la entrada con flechas, y sonido silenciado en segundo plano.
- [x] **Grupo en negro y oro (10 de noviembre, v167):** diseño propio negro y oro; juegos elegidos por su portada (liga y torneo con varios, en orden); luz verde cuando un rival espera; sin sombra arriba de las portadas; «Enviar juego» algo más visible y su bienvenida sin degradados; avatar del chacal con la cabeza entera.
- [x] **Fichas cuadradas y pestaña de Grupo (10 de noviembre, v166):** fichas cuadradas más pequeñas; botones sin círculos brillantes; portadas de Dardos, Galoku, Stack y Tower Drop; Grupo con código que se copia, un botón de compartir con apps, pasos numerados y reparto del bote con barras (70 · 20 · 10, de mayor a menor); sin «ficticio» ni «simulado» en pantallas, salvo los textos legales y de ayuda y el ranking de ejemplo, que se sigue llamando así.
- [x] **Botones de inicio a medida y carga completa (10 de noviembre, v165):** «Enviar juego» y «Rankings» iguales; los controles de inicio y cabecera con un mismo diseño; portadas que llenan la ficha; Mine Grid clásico y sin contador; los juegos esperan a sus imágenes. Bowling confirmado por el propietario.
- [x] **Rival a pantalla completa y dardos con el avatar (10 de noviembre, v164):** cuenta atrás con retrato grande, nombre, puntos y autor del juego (`creator`); números de marcador con un único diseño; aletas de los dardos con el avatar del jugador; cabecera y «Enviar juego» renovados; fichas sin medalla; portadas de Solitaire, Mine Grid y Orb Burst, y Pinball de v161.
- [x] **Celebraciones de Bowling de estudio y marcador del rival (10 de noviembre, v163):** plató en 3D con bolos iluminados, reflejos, cámara lenta y triángulo-trofeo; la barra del rival en la cuenta atrás es la misma pieza que el marcador del juego.
- [x] **Pinball V14, marcador común y Dardos (9 de noviembre, v162):** mesa más alta (arco de y 42 a y 12) justo bajo el marcador y Saturno en ojo de buey; marcador con el número a la derecha igual en los 13 juegos; diana y dardos realistas; celebraciones de Bowling más rápidas con final de fuegos artificiales; portadas de Mine Grid, Orb Burst, Solitaire Sprint, Dardos y Bowling; avatares con cabeza y hombros.
- [x] **Pinball V13 (9 de noviembre, v161):** recorridos con curvas suaves (spline entera), divisores de goma en el centro, estrellas en el carril central; neón de alto contraste y espacio vacío ocupado por carriles, arena, cometas y escaleras de progreso.
- [x] **Pinball V12 (9 de noviembre, v160):** mesa nueva con la estructura de la referencia (rampas con boca central, órbitas, agujero tras dianas en V y bajo tejadillo, triángulo de bumpers); cada recorrido con un color fijo; luces calmadas; portada generada por el juego.
- [x] **Retratos con versión (9 de noviembre, v159):** URL versionadas (`lib/avatars.ts`, subir `AVATAR_VERSION` al cambiar las imágenes); hoja de 16 en horizontal.
- [x] **Avatar, Enviar juego y Shot Gallery (9 de noviembre, v158):** la hoja de avatares muestra el mismo círculo que se elige; solo «Nombre ya elegido»; «Enviar juego» con monedas y recuadro de primera vez «Crea tu juego y gana dinero»; Shot Gallery con «Objetivo» visual (nebulosa del color o forma sin color), sin cañones y con explosión en el punto pulsado.
- [x] **Avatares nuevos (9 de noviembre, v157):** 16 retratos del propietario (`portrait-01…16`), cada uno con recortes centrados en la cara para el círculo (512 y 192 px) y para la hoja de elección (2:1).
- [x] **Avatar, Slot, Billar y rendimiento (9 de noviembre, v156):** progreso por juego en el avatar; avatar aleatorio al darse de alta; botones sin «ficticio» (el alcance sigue en etiquetas y textos); premios del Slot más grandes y pasos en degradado; portada del Slot con sus 7; panel inferior del Billar simétrico; Dardos, Slot y Billar cachean lo estático.
- [x] **Shot Gallery V13 y portadas (8 de noviembre, v155):** jungla espacial con tres formas de ser y cuatro auras; órdenes por aura o por forma, sin filas; portadas de Stack, Bowling, Galoku, Tower Drop y Pinball centradas bajo la insignia de nivel.
- [x] **Grupo y envío de juegos (3 de noviembre, v139):** botón «ENVIAR JUEGO» (desde v153, pestaña pequeña arriba a la izquierda de Juegos); pestaña Grupo con una sola línea de indicaciones y tarjeta grafito con Saturno y avatares.
- [x] **Portadas con más impacto (3 de noviembre, v140):** carteles del momento culminante de Shot Gallery, Bowling, Tower Drop, Solitaire Sprint, Pinball, Mine Grid, Slot y Dardos; Galoku con el cuadrado del vértice grande y centrado; Roulette con fondo oscuro; todas a 1600 × 1100.
- [x] **Portadas en acción y botones (3 de noviembre, v141):** Tower Drop más cerca con el bloque bajando; Pinball, Solitaire Sprint y Mine Grid vuelven a su escena anterior captada en plena jugada; detalles de Orb Burst y Stack Shift; botones de jugar con borde mecanizado y un barrido de luz sutil.
- [x] **Envío de juegos por archivo (3 de noviembre, v142):** un .zip con `galactic.json`, `game.html`, `core.wasm` sin importaciones y portada; comprobación automática al subirlo; bandeja del propietario con prueba en marco aislado y repetición del núcleo; condiciones `studio-terms-2026-11-03` (propiedad del estudio, 50 % de la comisión neta). Falta la fase 2: publicar en el catálogo (`docs/STUDIO_SUBMISSIONS.md`).
- [x] **Portadas (1 de noviembre, v138):** sin destello horizontal, fondos en negro, Pinball con multibola y Roulette con la bola en la pista.
- [x] **Proponer un juego (1 de noviembre, v135):** botón en Juegos, formulario con condiciones y consentimiento, bandeja solo para el propietario (`STUDIO_OWNER_ACCOUNTS`).
  - Para recibir propuestas faltan PostgreSQL (`DATABASE_URL`) y la migración 004; hasta entonces el formulario avisa de que la recepción no está abierta.
- [x] **Arte (1 de noviembre, v131):** se desarrollan Saturno y sus anillos (bienvenida) y el icono de la app; se retira la G plana `app/icon.svg`.
- [ ] **Pagos y obligaciones de información:** investigación en `docs/PAYMENTS_AND_LEGAL.md`. Newly y RevenueCat no sirven para cuotas con premio (Apple y Stripe lo prohíben); en la fase 4, una pasarela especializada en juego con licencia DGOJ. Pendiente de revisión por un abogado.
- [x] **Formato de juegos externos (1 de noviembre):** núcleo en WebAssembly sin importaciones + interfaz web en marco aislado. Confirmado por el propietario.
- [x] **Plataforma para desarrolladores externos (1 de noviembre):**
  - el creador recibe el 50 % de la comisión neta (comisión de las partidas de su juego menos costes de pago e impuestos) y conserva sus derechos;
  - mercado: España primero (licencia DGOJ) y después expansión;
  - formato recomendado: núcleo en WebAssembly sin importaciones y una interfaz web en un marco aislado; admisión automática en una máquina virtual desechable y aprobación final del propietario;
  - el juego nunca recibe datos personales ni accede a bases de datos;

## Revisión de código

La del 29 de octubre está en `docs/reviews/2026-10-29/` (servidor, cliente, estructura, calidad), con hallazgos S*, C*, E* y Q*. Al arreglar uno, cita su id en el pull request.

## Hoja de ruta

| Fase | Contenido | Estado |
| --- | --- | --- |
| 0 · Orden | `CLAUDE.md`, este documento, código muerto, Node alineado, CI en ramas `vNN-saturn` | En curso |
| 1 · Flujo | `main` como producción, pull requests con vista previa, protección de `main`, Issues | Pendiente de decisiones |
| 2 · Modularización | Un juego por carpeta, límites de capas en ESLint, partir `DemoApp.tsx` y `globals.css` | Pendiente |
| 3 · Plataforma | PostgreSQL gestionado, identidad, ledger en servidor, límite de peticiones, captura de errores | Pendiente de cuentas |
| 4 · Dinero real | Pagos regulados, KYC/AML, antibot, revisión jurídica | Sin fecha |
| 5 · Juegos externos | SDK y formato WASM, admisión automática en VM, panel del desarrollador, reparto del 50 % de la comisión neta | En diseño |

## Cómo comprobar este documento

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test:determinism && pnpm build
```

`pnpm lint` ejecuta `tsc --noEmit` y oxlint (`.oxlintrc.json`) desde v174.
