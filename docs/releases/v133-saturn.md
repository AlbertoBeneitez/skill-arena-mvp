# v133-saturn — Ruleta V15: física de la bola nueva desde cero (1-nov-2026)

Base: v132-saturn (d156e72). Petición del propietario: «borra la dinámica del movimiento de la bola y empieza de cero; tiene que ser realista».

## `galacticRouletteCore.v15` (`galactic-roulette@15.0.0`)
V1–V14 no cambian y se siguen verificando. Las apuestas, fichas, pagos, entradas (protocolo 4) y el lanzador son los de V14; solo cambia la bola.

- **Un solo modelo continuo, sin fases forzadas.**
  - Coordenadas polares alrededor del centro, cuatro subpasos por tick (480 Hz).
  - Solo enteros: nanómetros, nm por subpaso y 1e-7 rad.
  - La gravedad se escala al tamaño de la rueda dibujada, así que los tiempos son los de una rueda de casino (unos 0,38 m de radio de pista).
- **Lanzamiento:**
  - la bola vuela del lanzador a la pared y entra en la pista;
  - la parte del gesto a lo largo de la pista y la potencia fijan su velocidad: de 1,2 a 2,7 vueltas por segundo;
  - un lanzamiento torpe tiene un mínimo, como el de un crupier.
- **En la pista:**
  - la fuerza centrípeta aprieta la bola contra la pared;
  - el rozamiento de la pared es proporcional a esa fuerza, y se suman la resistencia a la rodadura y la del aire;
  - frena mucho al principio y poco al final.
- **Se suelta sola** cuando la velocidad ya no basta para sostenerla en la pista peraltada (5/7 de la gravedad, por rodar).
- **Baja en espiral** por el estátor, que es más inclinado que la pista y por eso no encuentra órbita. Conserva el momento angular, así que acelera al caer.
- **Ocho rombos redondos:** la desvían según la normal del choque y la hacen saltar.
- **En el rotor, que gira al revés:**
  - el rozamiento arrastra la bola hacia la velocidad del rotor;
  - los trastes la golpean y la lanzan hacia arriba, así que repiquetea por varias casillas;
  - bota (restitución distinta en estátor, rotor y casilla);
  - el fondo de la casilla es ligeramente cóncavo, para que no vibre contra el labio;
  - apoyada en un traste, sin golpe, simplemente gira con él.
- **Reposo:**
  - la bola descansa cuando lleva un momento en el fondo de una casilla, en el suelo y girando con el rotor;
  - el número es el de la casilla bajo la bola: la semilla solo fija el ángulo y la velocidad iniciales del rotor;
  - límite de seguridad de 30 s, que en las pruebas nunca se alcanza.
- **Tiempos medidos en 128 lanzamientos (32 direcciones × 4 potencias):**
  - de 8 a 11,7 s en la pista;
  - medio segundo de bajada;
  - de 2,3 a 3,7 s en el rotor;
  - de 11,8 a 15,6 s en total;
  - de 6 a 11 vueltas, 2–4 rombos y 5–10 trastes por tirada.
- **Rotor** más rápido que en V14: de 2,5 a 3,6 s por vuelta.

## Presentación
- `GalacticRoulette.tsx` dibuja la bola en la posición polar exacta del núcleo y el salto con su altura real.
- En reposo, la bola gira con su casilla.
- Se ilumina el rombo golpeado.
- `verify-roulette-presentation.cjs` comprueba 9216 fotogramas.

## Pruebas
- `scripts/verify-roulette-v15.ts`, con 128 lanzamientos en todas las direcciones y potencias. Comprueba que:
  - la bola nunca sale de la rueda;
  - las fases van en orden (pared, suelta, rotor, reposo);
  - se suelta a la velocidad crítica;
  - acelera al bajar si no toca un rombo;
  - el rotor la arrastra;
  - descansa en el fondo de una casilla y el número es el de esa casilla;
  - las duraciones son realistas;
  - más potencia no acorta la pista y, bien apuntada, la alarga;
  - salen los 37 números sin que domine ninguno;
  - rombos y trastes aparecen en la mayoría de las tiradas;
  - es determinista.
- Partida dorada `scripts/fixtures/roulette-v15.json`.
- Verificador `galactic-roulette@15.0.0` en `lib/server/gameVerifiers.ts`; el registro pasa a 15.0.0.

## Validación
- `tsc`, determinismo completo, i18n, `git diff --check` y build.
- Prueba básica de los 14 juegos.
- Una tirada real en el navegador a 390 × 844: pista, bajada, repiqueteo y reposo en el 13, sin errores de consola.
