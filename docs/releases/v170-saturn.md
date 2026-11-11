# v170-saturn — Avatares en 9:16, botones sin destellos y cabecera de grupo sin repetir (11-nov-2026)

Base: v169-saturn.

- **Selector de avatar:** las 16 fichas pasan a formato vertical 9:16 (cuatro por fila, cuatro filas), recortadas de los retratos cuadrados con la cara centrada. Dos retratos con la cara desplazada se ajustan a mano (`AVATAR_TILE_FOCUS`).
- **Grupo, sin destellos amarillos en los botones:**
  - formato, modalidad, final y crear o unirse, cuando están elegidos, conservan solo el filo dorado, sin la luz por arriba ni el halo por debajo;
  - el ticket del código y las portadas elegidas también pierden el halo.
- **Grupo, cabecera:** se quita la etiqueta «Grupo» encima del nombre, que ya dice «Grupo de …».

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px del selector de avatar, del grupo y del selector de juegos.
