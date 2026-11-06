# v148-saturn — Ruleta V18: lanzamiento en parábola con rebotes (6-nov-2026)

Base: v147-saturn (714b1bb).

- **Roulette V18 (núcleo nuevo `galacticRouletteCore.v18`, 18.0.0).** Petición del propietario: nada de la vuelta circular de una rueda real; simular lo que pasaría si el jugador lanza la bola, con una trayectoria parabólica también en altura.
  - **Lanzamiento:** desde la cuna, la bola vuela una parábola en 3D real (x, y y altura con la gravedad de la rueda). La dirección del gesto es la línea del tiro; la fuerza decide dónde cae a lo largo de esa línea (del 8 % al 92 % del tramo que cruza la rueda), y cuánto tiempo y qué tan alto vuela (de 0,31 a 0,5 s; hasta unos 10 cm sobre el borde).
  - **Rebotes:** la bola bota en el cuenco real (pista, estátor, rotor, suelo de las casillas y cono, con la altura y la pendiente de siempre), contra la normal de cada superficie. Pierde energía en cada bote (restitución 0,56 en la madera, 0,52 en el rotor, 0,42 en las casillas) y, si cae sobre el rotor, toma su giro. La pared exterior la devuelve hacia dentro y los rombos la desvían. Unos 4 botes por tirada.
  - **Final:** cuando los botes se apagan (menos de medio milímetro), rueda con la física de V17 hasta una casilla, salta entre los trastes y se queda. Sin vueltas a lo largo de la pista. Unos 3,3 s por tirada.
  - **Reparto:** χ² = 27,2 con 740 tiradas en 37 casillas (uniforme).
  - V1–V17 quedan congeladas; el verificador conserva V17 y añade V18.
- **Apuntado:** la guía va de la cuna al punto exacto donde caerá la bola, con una diana.
- **Dibujo (cenital):** la bola se dibuja en la posición y la altura del núcleo. La sombra se separa 0,5 px por mm de altura y la bola crece un 0,6 % por mm; nada inventado.

## Validación
- `verify-roulette-v18`:
  - repetición dorada;
  - la bola cae dentro de la rueda, y más lejos cuanta más fuerza;
  - la parábola sube por encima del borde y baja a su hora;
  - hay botes y luego un reposo en una casilla, sin correr por la pista;
  - duración media entre 2 y 6 s, al menos 3 botes de media, reparto entre casillas y determinismo.
- `verify-roulette-presentation` con V18. Resto del determinismo, `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
