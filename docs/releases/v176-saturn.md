# v176-saturn — Grupo: modalidades de liga sin explicaciones (11-nov-2026)

Base: v175-saturn.

- **Grupo · Liga · Modalidad:** «Todos contra todos» y «Duelos 1 vs 1» sin sus textos explicativos («Misma partida;
  gana la mejor» y «Uno contra uno cada jornada»). Las claves se retiran de los diez idiomas.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs`,
  `scripts/qa-overlap.cjs`, `git diff --check` y captura a 390 px.
