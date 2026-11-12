# v177-saturn — Grupo: × arriba a la derecha, medallas en el reparto; cartera con INGRESAR pistacho (12-nov-2026)

Base: v176-saturn.

- **Grupo · juegos:** en cada juego elegido, la × para quitarlo pasa a la esquina superior derecha de la portada y los
  números de orden a la superior izquierda.
  - Si un juego se repite mucho, la etiqueta de números se recorta antes de llegar a la ×.
- **Grupo · reparto del bote:**
  - el resumen muestra una medalla de oro, plata y bronce junto a cada porcentaje (70 %, 20 % y 10 % por defecto),
    con la misma letra que el saldo de la cabecera (blanca y gruesa);
  - por anchura, las medallas ocupan una segunda línea bajo «Reparto del bote»;
  - al desplegarlo, los tres primeros puestos llevan también su medalla;
  - las medallas son SVG decorativas (`aria-hidden`), porque el puesto ya está escrito al lado.
- **Cartera:** «INGRESAR» usa el mismo verde pistacho que «EMPEZAR» de Grupo.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs`,
  `scripts/qa-overlap.cjs`, `git diff --check` y capturas a 390 px.
