# v62-mobile · River Dash sin reinicios del campo

Parte de v61. River V3 genera un campo conectado de65filas una sola vez. Salida
fila64, llegada fila0; no teletransporte, rebuild ni incremento de sector. Filas
seguras intercaladas, máximo dos peligros consecutivos y ocho filas iniciales
amplias para aprender. Después varían tipos, fases, anchuras/gaps y velocidades.
Tráfico/plataformas mantienen fases incluso fuera de cámara y al retroceder.

Reutiliza geometría, soporte completo, integrador de fase y carry congelados V1;
movimiento/límites/cooldown24 son V3. High-water se acredita tras evaluar colisión,
sin farming DOWN/UP. Score100/fila+50cada8+800llegada(max7600) es monótono con el
avance válido. Esta codificación no migra el comparador de todos los juegos ni
el desempate del contrato histórico. El runtime conserva el target firmado,
que puede finalizar antes de fila0; práctica1e9 recorre todo el campo.

Registry/protocolo actual3, adapter adicional, V1/V2/goldens intactos. Cámara y
llegada suavizadas por ticks exclusivamente en presentación; controles/swipe
comunes. Impacto420ms mantiene terminal/inputlog congelado y envío inmediato.
HUD muestra AVANCE sin puntos. El resultado común propaga height ya reconstruido
por servidor y lo muestra cuando está disponible; nunca deriva avance de score
ni de una declaración cliente. Demás métricas/comparación permanecen pendientes.

Golden independiente del solver: seed
`3de0ad1cf1ce6755b4da066e445ddb5b52ef30ad332b11210d4dca4a76eeea79`,
73inputs, tick1728, height64, score7600, won, hash
`sha256:d7b2428426924963ac77932da82c142f1759f537a346e7c84c3b18ad3d5b89b5`.
384 aperturas(128×delays0/240/600),16 recorridos completos, replay repetido,
render60/120/144, registro congelado, cooldown/límites/inputs inválidos, fases,
carry, colisiones, farming, derrota/reinicio/timeout pasan. Registro común ahora
31versiones; campos de height/score cliente ignorados. Typecheck/lint, suite
histórica/determinista, build y diff-check pasan.

QA Chromium touch nativo en producción local sin cambiar seed/clock/target:
swipe ascendente real y controles en partidas completas vertical/horizontal
(height64/score7600, ticks2777/2833,79/80inputs), derrota deliberada al entrar al
tráfico desde su borde(ticks175/176,height0,no premio por entrada inválida),
reinicio/manifest nuevo, cancel/blur, rotación/320px, controles>=44px, resultado
de avance exacto, submit único y replay de inputs enviados. Capturas revisadas;
cero errores de consola. Solver solo existe en scripts, no se envía al cliente.

Pendientes: Jet menos alineado, entretenimiento Maze adicional, enemigo Sky,
métricas/desempate comunes,1000 cursos únicos/rotación, otros cortes y migraciones
privadas Mine/Solitaire, persistencia durable/offline. No backlog completo ni
activación de identidad/dinero/competición real. CI/Vercel antes de FF mobile-test.
