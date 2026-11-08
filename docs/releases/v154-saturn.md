# v154-saturn — Un marcador para todos los juegos, Pinball V11 y alta sin retrato (8-nov-2026)

Base: v153-saturn (d4ed672).

- **Alta sin retrato por defecto:** la pantalla de elegir avatar ya no muestra una cara elegida al azar. El círculo queda vacío, con una silueta, hasta que el jugador elige un avatar o sube una foto. Si continúa sin elegir, se le asigna uno como antes. El propietario eligió esta opción frente a quitar el Saturno de fondo.
- **Un solo marcador para todos los juegos** (`components/GameScoreboard.tsx`):
  - es la misma barra de cristal ahumado, en el mismo sitio, con celdas etiquetadas;
  - la puntuación va en dorado y lo demás (tiempo, vidas, nivel…) en blanco;
  - se acabaron los dígitos de siete segmentos y la matriz de puntos;
  - sustituye a la pastilla LED de los juegos verificados, la pantalla de puntos del Pinball, la consola de Mine Grid, el reloj de Solitaire Sprint, los indicadores dibujados de Galoku, los corazones de Tower Drop y el texto de dardos restantes;
  - la tarjeta del rival al empezar usa la misma tipografía;
  - en Bowling, la hoja de juegos baja bajo el marcador.
- **Pinball V11** (núcleo nuevo; V1–V10 se conservan con verificadores y repeticiones):
  - cada círculo puntúa distinto: seis bumpers con su valor en la tapa (100, 200, 250, 300, 400 y 500; en la tormenta de bumpers, cuatro veces más), ocho postes de 15 a 70 con su valor impreso y tirachinas de 35 y 55;
  - un sexto bumper pequeño junto al plato;
  - una pala superior a la derecha, que se mueve con el botón derecho;
  - un segundo spinner a la entrada del raíl izquierdo, de 75 puntos por vuelta;
  - dos pasillos sobre las guías: encender los dos da 2500 puntos y otra bola salvada;
  - tres postes más;
  - flechas que señalan cada tiro (rampa, agujero de gusano, pala superior, órbita y plato) y se encienden cuando ese tiro está activo;
  - un anillo segmentado en el centro;
  - letras A-B-C dentro de sus luces;
  - avisos cortos sobre el delantal.
  - La referencia del propietario se usó solo para la densidad de la mesa: no se copia ningún arte ni marca.
- **Botones del Pinball:** cristal oscuro con borde de ion, como el botón de jugar del catálogo; MUELLE lleva borde dorado.
- Ajustes muestra la versión 1.54.

## Validación
- Determinismo completo, con la prueba nueva de Pinball V11: valores distintos, cada bumper y cada poste puntúan lo suyo, tormenta ×4, la pala superior despide la bola, el spinner izquierdo, los pasillos, distancias de al menos una bola entre elementos y paredes, sin bolas atascadas, y tres repeticiones doradas.
- Simulación con 400 bolas al azar: ninguna atascada, y los seis bumpers reciben golpes.
- `tsc`, `pnpm lint` y build.
- Prueba básica de los 13 juegos y `qa-overlap`.
- Partida real de Pinball en el navegador.
