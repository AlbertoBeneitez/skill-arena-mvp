# v180-saturn — Avatar › Ranking sin «Ver ejemplo» (12-nov-2026)

Base: v179-saturn.

- **Cambio:** la pestaña Ranking del avatar ya no tiene los botones «Ranking real» y «Ver ejemplo». Muestra directamente
  el ranking real, o «aún no disponible» mientras no haya datos de liquidación.
  - Al quitar «Ver ejemplo», el botón que quedaba solo no tenía nada que elegir, así que se quitan los dos.
  - La pantalla de ranking independiente (`embedded = false`, sin uso actual) conserva el selector.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, smoke de 13 juegos, solapes, `git diff --check`
  y captura a 390 px.
