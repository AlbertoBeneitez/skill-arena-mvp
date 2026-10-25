# v113-saturn — Ruleta 10 (huecos reales), lanzamiento de dardos con el dedo y portadas nuevas (25-oct-2026)

Base: v112-saturn (dbec991).

## Galactic Roulette 10.0.0 (V1–V9 intactos)
- La rueda tiene ahora relieve físico: pista estática, banda de números, un escalón que baja a un anillo de huecos hundidos y el cono central. La bola ya no puede quedarse sobre los números.
- Los 37 huecos están separados por trastes sólidos que giran con la rueda. La bola choca contra ellos en el sistema de referencia de la rueda, con rebote y un salto si el golpe es fuerte, así que puede saltar al hueco vecino. Rueda sobre el fondo del hueco, que se mueve con la rueda.
- Solo se para cuando está en el fondo de un hueco y se mueve con la rueda. El resultado es el hueco en el que está físicamente.
- Al entrar en la rueda, el borde guía la bola por la pista, que gira más tiempo antes de caer: de media se para a los 8,3 s.
- Los trastes se ven en relieve (sombra, cuerpo y filo brillante).

## Dardos (presentación e interpretación del gesto; el core V3 no cambia)
- Se mantiene la forma de coger el dardo: basta con tocar la pantalla y el dardo se queda en los dedos y sigue al dedo, con estela.
- El lanzamiento depende ahora de cómo se mueve el dedo (`lib/verified/dartsGesture.v3.ts`). Cuentan la dirección y la velocidad de los últimos ~100 ms del movimiento:
  - En horizontal, cuentan el punto de suelta y la dirección del movimiento.
  - En vertical, cuenta la velocidad: a la velocidad ideal el dardo va a la línea del centro; más lento cae bajo y más rápido sube.
  - Un toque, un arrastre hacia abajo o un empujón lento no lanzan.
- Sigue grabándose como AIM_X / AIM_Y / THROW, así que el replay y el servidor no cambian.

## Portadas
- Las 14 portadas del catálogo están redibujadas con más detalle, sobre un fondo común con planeta anillado, haces de luz, bokeh y destellos:
  - **Galactic Roulette:** tapete con números, rueda con números, rombos y bola en vuelo con estela.
  - **Galactic Slot:** marquesina con bombillas, rodillos con símbolos y lluvia de monedas.
  - **Dardos:** armario abierto con pizarras, diana con alambre y dardos clavados y en vuelo.
  - **Billar:** lámpara y bolas numeradas dispersándose en la salida.
  - **Tower Drop:** elevador planetario y skyline de estación.
  - **Orb Burst:** explosión con onda y orbes que caen.
  - **Shot Gallery:** galería de hormigón con placas de acero, impactos y retícula.
  - **Galactic Bowling:** pleno con bolos-personaje (mareados y asustados) y confeti.
  - El resto lleva detalles nuevos parecidos.
- El generador está en `scripts/generate-covers.py`.

## Tests
- Nuevos `verify-roulette-v10`, con fixture dorado, y `verify-darts-gesture-v3`.
  - Ruleta: 80 tiradas que terminan por física en el fondo de un hueco, número igual al hueco, ningún tiempo agotado, una media de 8,3 s y unos 3 golpes contra trastes. Una bola lenta empujada de lado no pasa al hueco vecino.
  - Dardos: el gesto decide dirección y altura, la preparación lenta no cuenta y los toques o arrastres no lanzan.
- Actualizadas las pruebas de presentación de Ruleta y Dardos.
- Pasan el determinismo completo, el typecheck, i18n (10 × 571), el build y el smoke móvil de los 14 juegos.
