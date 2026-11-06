# v151-saturn — Ruleta V21: rebote aún más lento (6-nov-2026)

Base: v150-saturn (b3bf796).

- **Roulette V21 (núcleo nuevo `galacticRouletteCore.v21`, 21.0.0).** Petición del propietario: el rebote todavía más lento. V21 es V20 a cámara lenta otra vez, con k = 1,5 (1,94 veces más lento que V19):
  - la gravedad y las demás aceleraciones × 0,444;
  - todas las velocidades y sus umbrales × 0,667, rotor incluido;
  - los ritmos por subpaso × 0,667 y los tiempos × 1,5.

  El resultado:
  - el lanzamiento pasa de 0,85 a 1,32 s en el aire;
  - cada bote, igual de alto, dura 1,5 veces más;
  - unos 8 botes y unos 9,9 s por tirada (V20: 6,4);
  - reparto uniforme (χ² = 40 con 1480 tiradas).

  V1–V20 quedan congeladas; el verificador conserva V20 y añade V21.

## Validación
- `verify-roulette-v21` (las comprobaciones de V20, con duración media de 8 a 15 s, máximo por debajo del tope de 30 s y la relación exacta con las escalas de V20) y `verify-roulette-presentation` con V21.
- Resto del determinismo, `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
