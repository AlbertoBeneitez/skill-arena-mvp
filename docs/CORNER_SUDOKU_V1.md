# Corner Sudoku V1 (`corner-sudoku@1.0.0`)

Diseño original (sin código ni recursos de terceros).

- Tablero: dos lados de un sudoku que se unen en la esquina, la banda superior (cuadrados A, B, D) y la columna izquierda (A, C, E). Son 5 cuadrados de 3×3 y 45 casillas. En pantalla se gira 45°: la esquina queda arriba en el centro, la banda baja hacia la derecha y la columna hacia la izquierda, con los números siempre derechos.
- Reglas: cada cuadrado, cada una de las 3 filas de arriba y cada una de las 3 columnas de la izquierda llevan del 1 al 9 sin repetir.
- Partida: 5 sudokus generados desde la semilla del escenario (backtracking con RNG sembrado y vaciado comprobando solución única). Pistas objetivo: 32/30/28/26/25 de 45.
- Entrada: `PUT_<casilla>_<dígito>` (405 acciones). La selección de casilla o número es solo de presentación.
- Puntuación: +20 por número correcto. Uno erróneo se rechaza y resta 50 (mínimo 0). Con 5 errores termina la partida (`MISTAKES`). Resolver un sudoku da +400 y un bonus de rapidez de máx(0, 1200 − ticks/12). Reloj de 8 minutos (`TIME_LIMIT`). Si se resuelven los 5, la partida termina como `won`.
- Información pública: la solución única se deduce de las pistas, así que no hay estado oculto que proteger. Como en cualquier sudoku, un solucionador externo es posible.
- Tests: `scripts/verify-corner-sudoku-v1.ts` comprueba validez, unicidad, progresión, reglas, replay y 3 fixtures dorados.
