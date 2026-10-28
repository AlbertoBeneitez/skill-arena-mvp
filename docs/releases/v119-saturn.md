# v119-saturn — Pinball 8, Galoku V4 y Bowling V2 (28-oct-2026)

Base: v118-saturn (8417fad).

## Pinball 8 (`pinball@8.0.0`; V1–V7 intactos)
- **Reloj:** 100 segundos en lugar de 60, ampliables a 130 con las misiones de tiempo extra.
- **Sin trampas en los laterales:**
  - **El origen:** en V7 cada poste de los carriles laterales estaba unos 11 px por encima de su guía, y una bola que bajaba por la guía desde la pared se quedaba encajada contra el poste.
  - **El raíl izquierdo:** además, dejaba caer la bola en vertical sobre el poste derecho, donde podía quedarse en equilibrio.
  - **Con el desatasco de V7:** esas trampas formaban un bucle que jugaba solo (en una prueba, 311 800 puntos sin tocar las palas).
  - **El arreglo en V8:** se quitan los dos postes y los raíles terminan en diagonal, siguiendo la guía.
- **Rebote siempre igual:** si la bola se queda atrapada en un lado, sale siempre desde el mismo punto de ese lado y con el mismo empujón hacia su pala, así que el rebote es idéntico cada vez. Está comprobado con varias posiciones de la trampa y varias semillas.
- **Detección por posición:** cuenta como atascada una bola que pasa 2 s dentro de una caja de 12 px, esté quieta o temblando. Una bola acunada sobre una pala levantada nunca se empuja.
- **Raíles más vistosos (presentación):**
  - un chorro de energía de colores dentro del acrílico;
  - tiras LED con halo en los dos raíles cromados;
  - abrazaderas cromadas con tornillos;
  - flechas que corren hacia la salida;
  - un anillo luminoso en la salida.
  - Todo se acelera y brilla más mientras el raíl está activo.
- Liga y rival se ajustan al reloj más largo: referencia de liga de 40 000 a 65 000; rival de 60 000 a 100 000.

## Galoku V4 (`corner-sudoku@4.0.0`, protocolo 3; V1–V3 intactos)
- **Dos sudokus por partida** (unos 30 y 26 números dados), con solución única y cinco minutos de reloj.
- **Escritura libre:**
  - se puede escribir cualquier número, cambiarlo o borrarlo con el nuevo botón «Borrar» o tocando otra vez el mismo número;
  - no se comprueba nada mientras juegas;
  - el reto se resuelve cuando todo el tablero es correcto: 600 puntos más un bonus por rapidez;
  - si se acaba el tiempo, cada casilla bien rellenada del reto en curso suma 15.
- **Números más grandes:** 20–21 px en el tablero y 26 px en el teclado, con el tablero algo más grande.
- **Repetidos en rojo:** los números que se repiten en su cuadrado, fila o columna se marcan en rojo. Es solo una comprobación de reglas y nunca revela la solución.

## Bowling V2 (`bowling@2.0.0`; V1 intacto)
- **Pista más larga:** 27,4 m, una vez y media la reglamentaria, así que la bola tarda unas 1,5 veces más en llegar a los bolos.
  - El aceite, el gancho (÷2,25) y el ángulo (÷1,5) se reescalan para que un tiro rompa igual que en V1: el mismo bot hace prácticamente las mismas puntuaciones.
- **Plenos y semiplenos «de televisión»**, de 4,5 s y 2,5 s, que se pueden saltar:
  1. **Repetición:**
     - el tiro real, capturado mientras rodaba, a cámara lenta y con cámara baja y cercana sobre los bolos;
     - bandas negras, marca de «REPETICIÓN» con el piloto parpadeando;
     - destellos y chispas en cada impacto.
  2. **Título:**
     - letras metálicas en relieve que entran de golpe, con separación de color y estelas;
     - destello de lente, ondas expansivas, haces de luz y una lluvia de chispas;
     - un rótulo inferior con el marco, la racha y el total (o la marca X o /, si el marco aún no puntúa).
- Tres estilos (oro, neón y cósmico) se eligen con la semilla: parece al azar y el replay lo reproduce igual.
- No ha hecho falta ningún conector externo: todo está dibujado en el propio canvas, sin archivos ni licencias de terceros.

## Tests
- Nuevos `verify-pinball-v8`, `verify-corner-sudoku-v4` y `verify-bowling-v2`, con fixtures dorados:
  - **Pinball:** reloj de 100 s; rebote lateral idéntico con varias posiciones y semillas; salidas de raíl que nunca dejan la bola atascada; ningún bucle sin jugador; la bola acunada no se empuja.
  - **Galoku:** escribir, sobrescribir y borrar; tablero lleno pero con errores no resuelve; puntos parciales al acabar el tiempo.
  - **Bowling:** la bola tarda entre 1,4 y 1,7 veces más en llegar.
- Pasan el determinismo completo, el typecheck, i18n (10 × 605), el build y el smoke de los 14 juegos.
