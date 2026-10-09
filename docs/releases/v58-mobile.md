# v58-mobile · Maze Rush continuo

Parte de v57. Maze V2 mantiene un único laberinto conectado de 11×13 con 70
nodos: no reconstruye paredes, no introduce pausas de sector y no teletransporta
al jugador tras recibir daño. Tres pulsos protegen durante ocho segundos; tres
escudos y giros anticipados/STOP conservan controles claros. La velocidad aumenta
gradualmente según nodos recogidos. Cada perseguidor necesita tiempo y progreso
y anuncia su activación durante 180 ticks antes de moverse o causar daño.

La auditoría reprodujo daño inmediato al activarse junto al jugador; regresión
corregida en esta versión inédita. Nodos de radio 6/8 y llegada con ease-out
corto mejoran lectura y tacto, sin anticipar casillas no visitadas. El rival
simulado usa una referencia alcanzable por estas reglas. Registry actual V2,
adapter adicional, escenario/inputs/replay/lifecycle comunes; V1, reglas/hashes
y golden históricos intactos. No assets, dependencias ni código externo nuevos.

Typecheck/lint, suite determinista/histórica y build de producción pasan.
Golden V2: score8400, tick2574, 45inputs, hash
`sha256:5b031e7d2170b8408262ffdadd79847572abcb285cd6c4f1688bedea34786043`.
32 victorias completas incluyen ambos perseguidores; 128 tableros conectados,
render60/120/144, inputs inválidos, aviso adyacente, protección, STOP, contacto
con intercambio de casillas, nodos no repetibles y derrota reproducible pasan.

Chromium táctil nativo sobre producción local, sin modificar seed/target/core:
victorias vertical/horizontal (70 nodos, 3vidas, ticks2715/2370), derrotas por
perseguidor en ambas orientaciones (tick4492), reinicio con manifest nuevo,
swipe/cancel/audio/rotación, controles≥44px, submit único y replay de score/tiempo.
Paredes y dimensiones constantes, nodos nunca repuestos; cero errores importantes
de consola. Capturas revisadas. El QA físico del propietario sigue recomendable
y no bloquea la siguiente unidad.

Publicación: comprobar CI y deployment ready antes del fast-forward mobile-test.
Pendientes: registro preterminal, persistencia/delivery durable, legacy Mine y
Solitaire, y niveles reales restantes en nuevas versiones; no se declara el
backlog completo ni se activa identidad/dinero/competición real.
