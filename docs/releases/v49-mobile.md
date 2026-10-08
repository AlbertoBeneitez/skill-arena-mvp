# v49-mobile · Maze Rush

Parte de v48-mobile validada. Reparado START dentro de un muro y sustituidos
movimiento/score/colisiones en setters React y timers reiniciables por un core
1.0 VERIFIED. 0.1 archivado; sin cambiar históricos ni infraestructura común.

Tres sectores seed-versionados conectados, 9×11/11×13/13×15, inicio seguro,
giros anticipados/STOP, nodos únicos, pulsos, tres escudos y recuperación.
Perseguidores BFS anticipados, densidad y ciclos de persecución/patrulla,
colisión de celda y cruces simultáneos. Scoring y replay autoritativos;
registry/lazy loader, RNG, lifecycle y adapter existentes. Target demo 26000,
alcanzable frente a 27300 sin daños; práctica conserva su recorrido completo.
Renderer original con fondo común/relieve y controles fuera del tablero.
Sin nuevo código ajeno/assets/dependencias ni producción real.

Golden 27300/tick 6228/hash en fixture. 384 mapas conectados y 32 recorridos
completos con planificador de información pública, replay, render 60/120/144,
inputs inválidos, giro/STOP/cooldown, consumo único, shields/pulse y edge swap.
Typecheck/lint, suite histórica, build y diff check pasan.

QA táctil Chromium sobre build de producción: vertical 27300/tick 9600 y
horizontal 27300/tick 7922, 216 nodos y tres escudos finales. Derrota vertical
500/tick 5040 y horizontal 300/tick 5040/PURSUER_COLLISION; envío único/replay del servidor, cancel de
swipe, sonido sin reset, Otra vez y rotación sin otro inicio pasan, sin errores.
Se corrigieron expectativas del harness: Otro juego vuelve al catálogo;
Otra vez repite. El controlador usa dibujos públicos y eventos táctiles nativos,
con rutas que evitan perseguidores; las partidas no alteran seed/rules/score.
Las derrotas observadas durante el ajuste del controlador también fueron
reconstruidas correctamente; no se ocultan como victorias ni bugs de producto.

17 VERIFIED y tres INTEGRATED. Pendientes: Orbit Shift, Solitaire/Piano, grupos,
integración pública privada de Mine y límites externos auth/PG/ledger/RGPD.
QA física a cargo del propietario, sin bloquear continuidad ni pedir aprobación.
Estado central actualizado; no se declara backlog completo.
