# v141-saturn — Portadas en acción y botones de jugar (3-nov-2026)

Base: v140-saturn (b0fa4f0). Solo presentación: ningún núcleo cambia.

- **Tower Drop:** la escena está un 30 % más cerca. El siguiente contenedor baja sobre la torre, con su sombra en el techo y el marco de encaje iluminado.
- **Pinball, Solitaire Sprint y Mine Grid** recuperan la escena de v138 y la muestran en plena jugada:
  - **Pinball:** el flipper derecho acaba de golpear. La bola sube con estela hacia el bumper amarillo, que ya se enciende, y las luces corren por las rampas.
  - **Solitaire Sprint:** el as sale del mazo hacia la pila vacía, iluminada, con estela y copias a su paso. Las otras tres pilas ya avanzan, sobre un tapete verde.
  - **Mine Grid:** la mina estalla con un hongo de fuego. La onda expansiva recorre el tablero, las casillas cercanas se iluminan, salen baldosas despedidas y la bandera ondea con la explosión.
- **Orb Burst:** las esferas tienen luz de contorno y sombra de contacto. El trío dorado que estalla se agrieta, las esferas sueltas caen con estela y el lanzador lleva luces y la siguiente bola.
- **Stack Shift:** las piezas tienen bisel en los cuatro lados y el pozo, reflejo de cristal. La pieza cae con estela y la línea completa estalla en fragmentos con «+400». La bandeja de la siguiente pieza ya no lleva texto.
- **Botones de jugar del catálogo:**
  - borde mecanizado, más claro arriba y apagado hacia abajo;
  - bisel fino y sombra suave;
  - cada 7,5 s cruza un barrido de luz muy tenue, escalonado de tarjeta en tarjeta.
  - El barrido solo anima la transformación y se desactiva con «reducir movimiento» y en los botones deshabilitados.

## Validación
- `tsc`, build, prueba básica de los 14 juegos y `qa-overlap`.
- Catálogo y barrido revisados a 390 × 844.
