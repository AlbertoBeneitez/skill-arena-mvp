# v149-saturn — Ruleta V19: más lenta, más rebotes, más difícil de parar (6-nov-2026)

Base: v148-saturn (d6883db).

- **Roulette V19 (núcleo nuevo `galacticRouletteCore.v19`, 19.0.0).** Petición del propietario: la bola debe ir más lenta y rebotar más, de modo que le cueste más acabar en una casilla. Es el lanzamiento en parábola de V18, a cámara lenta y más vivo:
  - **Gravedad a la mitad:** cada arco y cada bote se desarrollan más despacio, y el lanzamiento dura un poco más en el aire (de 0,44 a 0,69 s).
  - **Botes que conservan más energía:** la restitución es de 0,72 en la madera, 0,68 en el rotor y 0,6 en el suelo de las casillas, y se conserva el 88 % de la velocidad a ras de superficie. Los botes solo terminan por debajo de 0,16 mm, así que hay unos 8 por tirada (V18: 4).
  - **Al rodar:**
    - trastes y rombos la despiden más fuerte y más alto (restitución 0,76 y 0,72);
    - el rotor la sujeta menos, así que la bola choca con más trastes;
    - tiene que quedarse quieta casi el doble de tiempo para contar como parada, así que salta de casilla en casilla antes de quedarse.
  - Con la gravedad a la mitad, el rotor y el fondo de las casillas son más inclinados (0,84 y 1,6). Así la bola que gira con el rotor sigue bajando a las casillas y descansa dentro de una, sin quedarse temblando en el borde.
  - **Resultado:** unos 5 s por tirada (V18: 3,3) y reparto uniforme (χ² = 47 con 740 tiradas; 33 con 1480).
  - V1–V18 quedan congeladas; el verificador conserva V18 y añade V19.
- El apuntado y el dibujo son los de v148, sobre el cuenco de V19.

## Validación
- `verify-roulette-v19`:
  - repetición dorada;
  - la bola cae dentro de la rueda y más lejos cuanta más fuerza;
  - la parábola sube por encima del borde y baja a su hora;
  - al menos 6 botes de media y ninguna vuelta por la pista;
  - duración media de 4 a 9 s, la mitad de la gravedad de V18, reparto entre casillas y determinismo.
- `verify-roulette-presentation` con V19. Resto del determinismo, `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
