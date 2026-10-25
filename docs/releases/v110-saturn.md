# v110-saturn — Corner Sudoku, ligas por niveles y ranking por juego (25-oct-2026)

Base: v109-saturn (d99fb97).

## Nuevo juego: Sudoku Esquina (`corner-sudoku@1.0.0`, verificado por replay)
- Dos lados de un sudoku, los 5 cuadrados de la fila de arriba y de la columna de la izquierda, girados 45°: la esquina arriba en el centro (algo por encima de la mitad) y un brazo bajando a cada lado. Los números se leen derechos.
- Cada cuadrado, cada fila de arriba y cada columna de la izquierda llevan del 1 al 9. Hay 5 sudokus por partida, con solución única y menos pistas en cada uno. Ver `docs/CORNER_SUDOKU_V1.md`.
- Toca una casilla y luego un número, o al revés. El número correcto queda fijo; el erróneo se rechaza y resta puntos. Los números ya completos se apagan en el teclado.

## Ligas por niveles (versión demo, rivales simulados)
- Una liga por juego: Bronce, Plata, Oro, Platino y Diamante.
- Los emparejamientos son por nivel: cada partida enfrenta a un rival simulado de tu liga, cuya puntuación es el objetivo a batir (en Ruleta y Slot, el saldo con el que hay que terminar).
- Una serie son 5 partidas de ese juego: con 3 o más victorias subes, con 1 o menos bajas y con 2 te quedas.
- Se ve en la tarjeta de cada juego (liga y bolitas de la serie), en la presentación de la partida (rival y su marca) y en el resultado (victoria o derrota, progreso de la serie, ascenso o descenso).
- Abandonar o una partida no verificada cuenta como derrota. Los grupos no cuentan para la liga.
- "Reiniciar estadísticas" pone también a cero ligas y mejores marcas. Las Reglas de competición explican las ligas.

## Ranking de cada juego
- La pantalla de Ranking tiene dos pestañas: "Por juego" (selector de juego, tu mejor marca, tu liga y tu posición frente a jugadores de ejemplo) y "Global" (el ranking de beneficio de antes).
- El botón de inicio pasa a "Rankings". También se han traducido tres textos del ranking global que estaban solo en español.

## Tests
- Nuevos `verify-corner-sudoku-v1` y `verify-leagues`. i18n: 10 idiomas × 561 claves. Pasan el determinismo completo, el typecheck, el build y el smoke móvil de los 13 juegos. Además se jugó un sudoku completo desde la interfaz.
