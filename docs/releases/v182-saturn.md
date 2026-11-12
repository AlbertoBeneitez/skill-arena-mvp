# v182-saturn — Ordenador: arrastrar con el ratón; portada de Orb Burst con el cañón (12-nov-2026)

Base: v181-saturn.

- **Ordenador:** dentro del marco de ordenador, arrastrar con el ratón desplaza las filas horizontales (catálogo y
  selector de avatares), como el dedo en el móvil (`components/mouseDragScroll.ts`).
  - Un arrastre no abre la tarjeta que hay debajo; un clic normal sí la abre.
  - El ajuste a tarjeta vuelve al soltar.
  - Comprobado a 1440 × 900: la fila pasa de 0 a 292 px y un clic abre Billar.
- **Portada de Orb Burst:** dos filas de bolas arriba, un hueco libre y el cañón entero (base, cañón, bola cargada y
  la siguiente) por encima del nombre de la tarjeta, con la línea de puntería hacia el hueco.
  - Generada con `orb_v182()` en `generate-covers.py`, con `?v=182`.
- **Validación:** `pnpm lint`, `pnpm test:determinism` (incluye Mine Grid 1.0 y 2.0, su autoridad privada y las
  partidas resolubles de Solitaire), `pnpm build`, smoke de 13 juegos, solapes y `git diff --check`.
