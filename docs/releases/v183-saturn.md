# v183-saturn — Banderas en el selector de idioma (12-nov-2026)

Base: v182-saturn.

- **Selector de idioma:** cada idioma de Ajustes lleva su bandera; en la bienvenida, la bandera del idioma elegido
  sustituye al globo.
  - La bandera sigue la región del formato de números (`intl` en `lib/i18n/locales.ts`): inglés → EE. UU.,
    portugués → Brasil, chino → China, hindi → India, árabe → Arabia Saudí, bengalí → Bangladés, urdu → Pakistán.
  - Son SVG, no emoji, porque Windows no dibuja las banderas emoji y el ordenador ya es una plataforma.
  - Nueve SVG copiados de `flag-icons` 7.6.0 (MIT) y minimizados con svgo; España se dibuja aquí con la bandera
    civil (sin escudo: el de flag-icons pesa 80 KB y a 24 px no se distingue). Registrado en `THIRD_PARTY_NOTICES.md`.
  - En los idiomas de derecha a izquierda la bandera va a la derecha y el ✓ al lado contrario.
- **Decisión 1 del plan estratégico:** PostgreSQL en Neon (gratis para la beta). Anotado en `docs/STATE.md`.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, smoke de 13 juegos, solapes y `git diff --check`.
