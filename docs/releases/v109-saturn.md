# v109-saturn — Pinball 4, Shot Gallery 7, avatares 4×4 y botón de jugar (25-oct-2026)

Base: v108-saturn (0214636).

## Pinball 4.0.0 (nuevo núcleo; V1–V3 intactos y verificables)
- Palas de 69 px en lugar de 66 px: el hueco libre entre las puntas en reposo baja de ~30 px a ~24 px para una bola de 18 px. La bola sigue pudiendo caer (es el único vaciado), pero se cuela bastante menos: en 30 partidas del bot de pruebas, 3 vaciados en V3 frente a 0 en V4. Mismas reglas, puntuación y duración (1 minuto).
- Marcador: en pantallas altas sube al espacio libre sobre la mesa y se hace más grande (cifras de 30 px); en pantallas bajas sigue sobre la mesa.
- Sin recuadro azul al pulsar: se quita el resaltado de toque del navegador y el contorno de foco por puntero en la superficie y los botones de todos los juegos (el foco por teclado sigue visible).

## Shot Gallery 7.0.0 (nuevo núcleo; V1–V6 intactos y verificables)
- Más disparos por pantalla: cada orden pide al menos 2 aciertos. Color y figura: 2 en las tres primeras rondas y de 2 a 4 después; suma (figura de color con ambos rasgos): 2, y de 2 a 3 desde la ronda 8. Hasta 12 dianas por pantalla.
- Puntuación mínima para completar la partida: 5000 (antes 3000), acorde con los disparos extra.
- Sin cañón: el impacto se marca con un destello en la propia diana, el anillo de onda, las chispas y la mancha de pintura.

## Interfaz
- Avatares: rejilla de 4×4 con los 16 retratos (el actual, marcado en dorado) y círculos más grandes (≈68 px a 390 px de ancho). Cabe sin desplazamiento vertical en 360×640 y 390×844.
- Botón de jugar del catálogo: degradado dorado-naranja-magenta, relieve, icono ▶, brillo que recorre el botón y halo que late (sin animación con "reducir animaciones").

## Tests
- Nuevos `verify-pinball-v4` y `verify-gallery-v7` con fixtures dorados; los verificadores V3 y V6 siguen pasando. Determinismo completo, presentación de Shot Gallery V7, typecheck, build y smoke móvil de los 12 juegos: OK.
