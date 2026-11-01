# v137-saturn — Pinball V9: multibola, jackpots y modos (1-nov-2026)

Base: v136-saturn (ef32261). Petición del propietario: «desarrollar más el Pinball; buscar modelos más entretenidos y adictivos; más interacciones, más posibilidades».

## Investigación
- Las mesas modernas enganchan con reglas por capas: cada tiro vale según el estado de la mesa.
  - Las más citadas son la multibola (bloquear bolas y jugar varias a la vez, con jackpots), los modos con objetivos y tiempo, los objetivos «especiales cuando se encienden», los multiplicadores y la progresión hacia metas cada vez mayores.
  - Fuente principal: Flippers.be, «What are deep rules in pinball machines?».
- V8 ya tenía casi todos los elementos físicos: bumpers, slings, dianas, bloque abatible, carriles con skill shot, spinner, raíles, agujero de gusano, plato, combos, multiplicador, misiones, hurry-up, bola salvada y frenesí.
- Faltaban la multibola y los modos.

## `pinballCore.v9` (`pinball@9.0.0`)
La misma mesa y la misma física que V8: sin las novedades, una partida de V9 es idéntica a la de V8. Mismas entradas. V1–V8 no cambian.

- **Bloqueo y multibola:**
  - las tres dianas de la derecha encienden el bloqueo (fuera de la multibola);
  - cada tiro al plato encendido bloquea una bola: BLOQUEO 1 y BLOQUEO 2, con dos lámparas junto al plato;
  - el tercero lanza la MULTIBOLA: 5000 puntos, dos bolas más desde el plato y 8 s de bola salvada para las bolas extra.
- **Las bolas extra** juegan toda la mesa: palas, bumpers, slings, dianas, bloque, carriles, spinner y tiros de rampa y órbita. No entran en los raíles ni en el plato.
- **Al perderse bolas:**
  - si cae la bola principal, otra toma el relevo sin perder nada;
  - con una sola bola en juego acaba la multibola y se anuncia FIN DE MULTIBOLA.
- **Jackpots:**
  - en multibola, la rampa y la órbita pagan un jackpot que empieza en 10 000 y sube 5000 con cada uno; las flechas se encienden en magenta;
  - cada tres jackpots se enciende el SÚPER JACKPOT en el agujero de gusano, que parpadea: vale el jackpot actual × 3.
- **Modos de 20 s:** cada misión completada arranca el siguiente modo, por turno, con su panel y la cuenta atrás en la mesa:
  - TORMENTA: bumpers a 1000;
  - FIEBRE GIRO: spinner a 1000 por vuelta;
  - RAMPA RUSH: +5000 por rampa u órbita.
- **Avisos nuevos en el marcador**, en los 10 idiomas: bloqueo encendido, bola bloqueada, multibola, súper encendido, súper jackpot, fin de multibola, rush, los tres modos y fin del modo.

## Pruebas
- `scripts/verify-pinball-v9.ts`:
  - partidas doradas;
  - V9 juega igual que V8 sin las novedades;
  - dianas → bloqueo, dos bloqueos → multibola con dos bolas que se mueven, salvada durante la protección;
  - jackpots crecientes y súper en el agujero de gusano;
  - relevo al perder la bola principal y fin de la multibola;
  - modo Tormenta con bumpers a 1000 que acaba a los 20 s;
  - determinismo.
- Robot de prueba `pinball-v9-play-fixture.ts`, que vigila todas las bolas.
- Captura de una multibola con tres bolas y el modo RAMPA RUSH, desde el arnés de render.

## Validación
- `tsc`, determinismo completo, i18n (10 × 739), `git diff --check` y build.
- Prueba básica de los 14 juegos y `qa-overlap`.
