# v150-saturn — Ruleta V20: el mismo movimiento, más lento (6-nov-2026)

Base: v149-saturn (c9a6e1b).

- **Roulette V20 (núcleo nuevo `galacticRouletteCore.v20`, 20.0.0).** Petición del propietario: le gusta V19 y quiere el movimiento aún más lento. V20 es V19 a cámara lenta, con todas sus escalas de tiempo estiradas por k = 1,29:
  - la gravedad y las demás aceleraciones × 0,6;
  - todas las velocidades y sus umbrales × 0,775, rotor incluido (1,29 veces más lento);
  - los ritmos por subpaso × 0,775 y los tiempos × 1,29.

  Así el lanzamiento, los botes, la rodadura y el traqueteo en las casillas son el mismo movimiento, más despacio:
  - el lanzamiento dura de 0,56 a 0,88 s en el aire;
  - los saltos tienen la misma altura;
  - unos 8 botes por tirada;
  - unos 6,4 s por tirada (V19: 5,1);
  - reparto uniforme (χ² = 40 con 1480 tiradas).

  V1–V19 quedan congeladas; el verificador conserva V19 y añade V20.

## Validación
- `verify-roulette-v20` (las mismas comprobaciones que V19, con duración media de 5,5 a 11 s y la relación exacta con las escalas de V19) y `verify-roulette-presentation` con V20.
- Resto del determinismo, `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
