# v152-saturn — Roulette oculta, Slot en Alternativos y sin fila Casino (7-nov-2026)

Base: v151-saturn (ce39fcb).

- **Roulette oculta para el jugador** (petición del propietario):
  - sale de `CATALOG_ORDER` y pasa a `enabled: false`;
  - no aparece en ninguna fila, ni en el ranking, ni en los grupos;
  - el servidor no inicia partidas nuevas (`UNSUPPORTED_GAME_VERSION`).

  **Se guarda todo:** su entrada del registro, los núcleos V1–V21, el renderizador, los adaptadores de verificación, las repeticiones doradas y la portada. Las partidas archivadas siguen verificándose y el historial de saldo sigue nombrando el juego. Cómo volver a mostrarla: `docs/STATE.md` (Catálogo).
- **Slot en Alternativos**, junto a Galoku y Shot Gallery. El propietario lo eligió frente a crear una fila «Otros» o renombrar Alternativos.
- **Sin fila Casino:** se quita de las categorías del catálogo y de las que pueden elegir los estudios al enviar un juego. El texto «CASINO» se conserva en los 10 idiomas por si una propuesta antigua lo usa.
- `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs` recorren los 13 juegos visibles.

## Validación
- Determinismo completo (incluidas las 21 versiones de Roulette), `tsc`, `pnpm lint` y build.
- Prueba básica de los 13 juegos y `qa-overlap`.
- Catálogo comprobado: Populares, Nuevos, Bar, Míticos, Dinámicos y Alternativos (Slot, Galoku y Shot Gallery). «Roulette» no aparece en ninguna parte y el servidor rechaza iniciar una partida suya.
