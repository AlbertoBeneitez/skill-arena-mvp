# v146-saturn — Ruleta V17 con física realista de la bola y Slot más vistoso (5-nov-2026)

Base: v145-saturn (d37432c).

- **Roulette V17 (núcleo nuevo `galacticRouletteCore.v17`, 17.0.0).** Petición del propietario: simular de forma realista cómo se mueve la bola; en versiones anteriores era más precisa. Diagnóstico de V16: dejaba entrar toda la velocidad del gesto, así que la mayoría de los lanzamientos (hacia el centro) cruzaban la pista en dos ticks y una bola rápida que chocaba de frente con un rombo podía rebotar hacia atrás. Resultado: tiradas de unos 3 s en 27 de 36 combinaciones de dirección y fuerza. En V17:
  - **vuelo balístico real:** la bola sale de la cuna 13 mm por encima de la pista (la cuna está en el borde), con el impulso justo para salvar el borde, bajo la gravedad de la rueda, y entra en ella todavía en el aire;
  - **cae en el canal de la pista como en un lanzamiento de crupier:** la parte del gesto a lo largo de la pista da la velocidad y el sentido (el rango de V15: de 1,2 a 2,7 vueltas por segundo, al menos el 45 % de la fuerza a lo largo de la pista) y solo sobrevive un octavo de la parte hacia dentro;
  - **en el aire la altura sigue la forma real del cuenco** (integral de las pendientes del núcleo): si debajo el suelo baja, la bola va más alta; si sube (el cono), aterriza antes;
  - **un rombo frena la bola y la hace saltar, pero nunca la devuelve hacia atrás** por la pista;
  - el resto de la física de la rueda (pared con rozamiento, rotor en contra, trastes, suelo de las casillas, reposo) y las apuestas son las de V15. V1–V16 quedan congeladas; el verificador conserva V16 y añade V17.
  - **Resultado:** tiradas de 11,9 s de media (de 10 a 16 s para casi todos los gestos; un gesto débil hacia el centro cae antes, como en una rueda real).
- **Dibujo de la bola (cenital):** se dibuja solo lo que hace la física. Su altura es la del núcleo, sin botes añadidos ni multiplicadores, y solo separa la sombra (0,7 px por mm) y la agranda un poco (0,8 % por mm). Sin estela.
- **Slot (presentación):**
  - paleta más viva en los símbolos y BAR en placa violeta con borde dorado;
  - bombillas de colores (oro, rosa, cian y verde);
  - interior de la máquina en violeta degradado y marco dorado más intenso;
  - tablas de rodillos con un carril de color por rodillo;
  - fichas de premio teñidas del color de cada símbolo.

## Validación
- `verify-roulette-v17`: repetición dorada; superficie del cuenco; el vuelo salva el borde y llega en el aire; la bola cae en la pista; ningún rombo la devuelve; duración media de más de 9 s con el 75 % de los gestos por encima de 8 s; determinismo.
- `verify-roulette-presentation` con V17: la bola se dibuja en la posición del núcleo y su altura es el `ballZ` del núcleo.
- Resto del determinismo, `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
