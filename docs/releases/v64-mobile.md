# v64-mobile · Maze Rush: giros legibles y avance autoritativo

Parte de v63. Conserva el generador único de70 nodos, contactos/cruces, arming,
pulsos960ticks, escudos y scoring del kernel congelado V2. La nueva V3 sustituye
únicamente los deadlines después de cada update: jugador38→30ticks, perseguidores
132→100. Mantiene warning/apertura y no reconstruye tablero. Height es el número
de nodos únicos recogidos, conservado tras daño; el servidor lo reconstruye.
Registry3.0/adapter append-only/input protocol1, históricos V1/V2 intactos.

El renderer añade confirmación breve de input y giro en cola dentro de la casilla,
anillo de protección que se vacía, pulso/recogida y silueta de perseguidor. Nodos
proporcionales más claros en horizontal: viewport visual opt-in del driver común,
sin cambiar dimensiones/rules competitivas. Targets44px reales conservados al
presionar, sin transform de escala. HUD por nodos, resultado por avance verificado;
comparador global histórico pendiente, no se deriva avance de score cliente.

Golden: misma seed histórica MazeV2, nueva secuencia46inputs; score8400,70nodos,
tick3752, won; sha256:4940cd12e3cdddbbe574e8cc38b619baedff6616fa6847345a2ac3b4e54e2aea.
Cuatro wins/cuatro pérdidas deliberadas, generación/condiciones iniciales V2,
retención de avance, reinicios limpios, deadlines/cadencia, replay repetido,
60/120/144Hz, inputs inválidos y relojes/RNG no controlados comprobados. Registro
común cubre33versiones. Typecheck/lint, suite determinista histórica, build y
checks de diff completados antes de publicar.

QA Chromium producción local, touch CDP sin modificar seed/target/reloj: wins
vertical6873ticks/7900/70nodos/dosvidas/105inputs; horizontal9243/8400/70/tresvidas/
97inputs. En ambos se verifica el registro enviado con replay y resultado exactos,
reinicio con nuevo manifest, orientación/320px, cancel y controles reales. Pérdida
vertical deliberada5138/24nodos/1400/16inputs y horizontal6704/25nodos/1700/25inputs;
captura/feedback revisados. Una partida
vertical anterior perdió57nodos: replay válido, no se borró ni ocultó esa evidencia;
el actor posterior busca pulsos con5s de margen acorde a la nueva cadencia. No
se alteró el core para garantizar una victoria del actor.

La política visual compartida mantiene contain por defecto; QA de montaje/abandono
36registros de18juegos/ambas orientaciones pasó antes del ajuste de cadencia, que
solo afecta MazeV3. No se repiten montajes ajenos por cambios del test-player.
No código/assets de terceros reutilizados. Física en dispositivos queda para el
propietario, sin bloquear avances. CI/Vercel se revisan antes de FF mobile-test.

Pendientes concretos en PRODUCT_BACKLOG_STATUS.md; ninguna afirmación de backlog
completo, rotación1000 sin repetición, identidad/ledger/dinero reales ni garantías
de entrega offline/durabilidad.
