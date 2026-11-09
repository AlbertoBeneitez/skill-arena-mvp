# v161-saturn — Pinball V13: curvas suaves, divisores en el centro y más contraste (9-nov-2026)

Base: v160-saturn (99441a9).

Encargo del propietario: desarrollar mucho más la mesa (había mucho espacio vacío), más contraste de colores, recorridos con líneas suaves (no conjuntos de rectas) y divisores en el centro como en las máquinas reales.

## Núcleo V13 (`lib/verified/pinballCore.v13.ts`; V1–V12 se conservan)
- **Recorridos suaves:**
  - las rampas, las órbitas y el agujero de gusano siguen una curva Catmull-Rom calculada con enteros, con 6 puntos por tramo;
  - la bola recorre la curva y el dibujo traza la misma;
  - la prueba exige que ningún tramo gire más de 25°.
- **Dos divisores de goma en el centro**, entre el carril central y los de las rampas:
  - son cápsulas (una goma entre dos pernos);
  - lanzan una bola lenta y puntúan 40 y 60;
  - el carril central sigue siendo más ancho que una bola.
- **Tres estrellas** por el carril central: 100 cada una; las tres dan 2000 y cuentan como tiro para los combos.
- **Guías laterales:** se probaron prolongando la boca de cada rampa, pero formaban una V donde la bola se quedaba parada y, a la derecha, el carril quedaba más estrecho que una bola. Se descartaron.
- **Simulación de 80 partidas:** ninguna bola atascada; jugar bien puntúa unas catorce veces más que solo tirar del muelle.

## Presentación
- **Paleta:** neón saturado por recorrido sobre un suelo casi negro. Los bumpers van por valor: 300 cian, 500 magenta, 400 dorado y los dos pequeños violeta.
- **Carriles de tiro curvos**, con bordes y flechas a lo largo de la curva.
- **Arena de bumpers:** un triángulo pintado con borde dorado y rayos.
- **Cometas pintados** bajo las bocas de las rampas.
- **Divisores:** goma negra, pernos cromados y capa de color con destello al golpear.
- **Estrellas** de inserto dorado.
- **Escaleras de progreso** junto al emblema: el bonus a la izquierda; bloqueo, multibola y jackpots a la derecha.
- **Plástico y alambre:** el plástico de las rampas termina en el punto más alto del bucle; la bajada es de alambre.
- **Portada** regenerada con la mesa nueva.
- Ajustes muestra la versión 1.61.

## Validación
- `verify-pinball-v13`: lo de V12, más curvas suaves, divisores, estrellas y holguras de los divisores.
- Determinismo completo, lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Partida real de 100 s con botones táctiles, verificada por repetición en el servidor (46 750 puntos).
