# v136-saturn — Ruleta V16 (lanzamiento real) y bordes por categoría (1-nov-2026)

Base: v135-saturn (95fe179).

## Ruleta V16 (`galactic-roulette@16.0.0`)
Petición del propietario: «la trayectoria que seguiría una bola tirada como en la realidad, no empezando en círculo; un movimiento que interactúa con las partes físicas de la ruleta, perdiendo energía por rozamiento hasta quedarse en una casilla».

- **Lanzamiento:**
  - la bola sale del lanzador en línea recta, con la dirección y la velocidad del gesto;
  - cruza el borde y entra en la rueda con exactamente esa velocidad, repartida entre su parte radial y su parte tangencial en el punto de entrada;
  - ya no hay velocidad mínima ni se coloca en la pista girando: es la pared la que curva su trayectoria (choque, rebote y pérdida), y después actúa la física de V15 (rozamiento, bajada, rombos, rotor y trastes) hasta el reposo.
- **Puntería:**
  - solo cuentan los gestos que llegan a la rueda: 9 de las 32 direcciones desde el lanzador; la guía de puntería se pinta en rojo cuando la dirección no llega;
  - apuntado a lo largo de la pista y con fuerza, rueda pegado a la pared 8–10 s;
  - flojo o hacia el centro, cae enseguida y repiquetea unos 3 s, como una bola mal lanzada de verdad.
- **Rombos más pequeños, solo en el estátor bajo** (alcance 7,6 mm, restitución 0,45): la bola que rueda por la pista pasa por fuera y los encuentra al bajar.
- **La física de V15 recibe sus parámetros como argumento.** Con los valores por defecto es idéntica byte a byte (la partida dorada de V15 se sigue verificando); V16 la reutiliza con sus propios rombos.
- **Pruebas `scripts/verify-roulette-v16.ts`:**
  - qué direcciones llegan y la geometría de entrada (punto en la pared, ángulo y dirección);
  - vuelo recto a la velocidad del gesto y entrada a esa misma velocidad;
  - 324 lanzamientos que reposan solos en el fondo de una casilla, con el número de la casilla bajo la bola: 72 ruedan por la pared y 252 caen pronto;
  - salen los 37 números;
  - con la misma puntería, la potencia mantiene la bola en la pared;
  - partida dorada `roulette-v16.json`.

## Bordes de las tarjetas
- **Un color de borde por categoría del catálogo:** Casino rojo, Bar ámbar, Míticos violeta, Dinámicos celeste y Alternativos menta. El mismo juego lleva su color también en Populares y en Nuevos, y en la cuenta atrás.
- Sustituye a la clasificación antigua (Precisión, Timing…), que daba colores distintos a juegos del mismo tipo.

## Validación
- `tsc`, determinismo completo, i18n, `git diff --check` y build.
- Prueba básica de los 14 juegos y `qa-overlap`.
- Una tirada real en el navegador a lo largo de la pista con potencia máxima: entra desde el lanzador, rueda por la pared y reposa en el 20.
