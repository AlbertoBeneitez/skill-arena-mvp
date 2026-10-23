# v101-mobile — ajustes de jugabilidad tras la revisión del propietario (23-oct-2026)

Base: v100-mobile (439fa45). Las reglas publicadas son inmutables: cada cambio de física, puntuación, vidas o
generación es un **núcleo nuevo** con adaptador, golden y test; los anteriores se conservan para replays históricos.

## Cambios por juego
- **Galactic Birds 8.0.0**: menos complejidad (6 niveles más sencillos, sin viento, menos cerdos y piezas) y banda del tirachinas elástica (tensado máx. 76 px, recuperación animada).
- **Tower Drop 4.0.0**: tres vidas con corazones; un fallo resta vida y la torre continúa.
- **Galactic Roulette 5.0.0**: saldo en **fichas** (no dinero), varias fichas por casilla y varias apuestas a la vez, botones QUITAR FICHA / LIMPIAR MESA, sin apuestas de columna (C1/C2/C3 2:1). La bola solo se lanza desde el **lanzador exterior** (swipe con dirección y potencia cuantizadas); un gesto sobre la ruleta no hace nada.
- **Mine Grid 0.2.0** (modo entrenamiento): tras tocar una mina el tablero se queda como está (mina resaltada) hasta pulsar VER RESULTADO; puntuación = casillas bien asignadas si no se resuelve, o por tiempo si se resuelve; **pulsación larga** marca/desmarca con cambio de color visible.
- **River Dash 5.0.0**: campo encuadrado (12 filas), botones ↑/↓ y gesto solo lateral; más dificultad.
- **Metro Shift 2.0.0**: rediseño completo como runner de tres vías (swipes ← → ↑ ↓): trenes, vallas que se saltan, vigas bajo las que hay que deslizarse, monedas, vida extra y jet; velocidad creciente; escena en perspectiva.
- **Sky Hop 4.0.0**: sin meta (altura infinita) y más dificultad progresiva.
- **Galactic Slot**: sin aviso +18 (no es juego de azar) y sin símbolo €; **Stack**: sin la flecha de ejes; **avatar inicial aleatorio** en el primer acceso.

## Pendiente / límites
- Mine Grid en modo autoridad privada (transporte durable): se añadió pulsación larga y que el tablero permanezca tras la mina, pero la puntuación por casillas/tiempo requiere un núcleo V3 con reloj de servidor.
- `MetroShiftVerified.tsx` y `qa-metro-touch.cjs` / `qa-river-v4-touch.cjs` siguen apuntando a núcleos anteriores.
