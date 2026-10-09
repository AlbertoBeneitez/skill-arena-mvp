# v67-mobile · Alien Dash: decisiones encadenadas y avance

Nueva versión `dino-dash@3.0.0`, protocolo2 conservado. V1/Dino y V2/Alien,
adapters y goldens siguen reproducibles. El nuevo generador usa RNG/seed/versiones
comunes y compone literalmente física, acciones, colisiones, escudos, scoring y
terminal14400ticks de V2. Una única partida de120s, sin rebuild ni niveles.

Cuatro obstáculos de aprendizaje antes de decisiones combinadas: salto/agachado,
plataformas amplias, refugios frente a disparos anticipados, techos bajos, saltos
entre plataformas y secuencias de tres acciones. Recogibles opcionales sobre
tejados y recuperaciones en espacios de descanso cada cuatro patrones; no se
limita la progresión a multiplicar velocidad. Height=actores realmente pasados,
monotónico tras daño; score técnico histórico sigue en core, oculto del HUD.

Controles↑/↓ mantienen labels accesibles y held/cancel/blur del lifecycle común.
Retirados AGACHAR y coaching flotante; conservada anticipación visual del
centinela mediante carga/rayo. Pasos/polvo, recogibles/escudos, impacto/finale350ms
usan efectos visuales sin decidir física. Terminal envía registro antes de
animación; abandono es receipt de prefijo sin adjudicación.

32 recorridos sin daño y32 con controles retrasados67ms llegan a120s;
128 aperturas seguras,1000 geometrías jugables distintas (huella sin seed/IDs),
plataformas15–22% del tiempo, duck sobre techo/salto apoyado realmente usados,
centinelas disparan y vidas se recogen. Igualdad física con V2 tick a tick sobre
geometría V3, replay/golden/render60/120/144, inputs inválidos/semánticos y guards
RNG/reloj. Golden26400/avance56/t14400/71inputs,
sha256:8edb707e573a53e379530e87eac5744c3facace29e6d4ebd73915e80c073f736.
Registro común35versiones y prueba de terminal servidor rechazan height/score/
resultado del navegador: reconstruyen56/26400/120000ms. Escenarios/lifecycle,
typecheck/lint y build pasan. Cámara horizontal visual opt-in reutiliza el canvas común: FOV X0..390 fijo,
recorte Y300..575 que contiene salto máximo real/carga/disparos, sin amenazas
adicionales ni cambio de inputs. Render/finale comparten la transformación;
reserva HUD40px/controles120px y utiliza DPR común. Prueba geométrica incluye
portrait centrado/zoomoutDPR0.8 y recuperación del frame para finale.

QA Chromium producción con touch nativo: victorias de120.000s en vertical
(avance59/28040/vidas3/81inputs) y horizontal(60/28040/vidas3/79inputs),
con atacantes y recogibles realmente activos. Registro/score/height/time_ms
coinciden con replay de servidor, no con el actor externo. Cancel/blur/dobletap,
reinicio/rotación/abandono y consola comprobados; capturas de suelo/tejado y
resultado revisadas. Las derrotas completan agotamiento de escudos con avance2/5inputs a8.833s
vertical y8.975s horizontal, con el mismo registro y lifecycle. Plan de acciones en worker externo, sincronizado mediante
fase del suelo y segundo del timer públicamente renderizados: sin modificar
manifest/seed/target/clock/state de la app. Los fallos previos del observador se
conservan fuera del repositorio, con replays válidos; no se suavizan asserts ni
se atribuye su resultado al escenario sin comprobarlo. QA física es seguimiento
del propietario, no bloqueo para continuar.

La rotación sin repetición de1000escenarios y el comparador común por avance/
tiempo decimal continúan pendientes; no se activan auth/ledger/dinero reales.
Este checkpoint no declara todo el backlog completado. Memoria, fondo, Tower,
Stack y mute de v65/v66 se conservan.
