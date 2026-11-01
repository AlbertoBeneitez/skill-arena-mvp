# v126-saturn — Slot a toda altura, avatares sin número y acceso más limpio (1-nov-2026)

Base: v125-saturn (c4ca30c). Solo presentación: ningún núcleo ni versión competitiva cambia.

- **Slot** (antes «Galactic Slot»):
  - nombre visible cambiado en el catálogo, la cabecera, los textos legales de los 10 idiomas y los scripts de QA; el id `galactic-slot` y las rutas se mantienen;
  - el lienzo usa toda la altura (`expandVerticalViewport`);
  - la ventana de rodillos crece hacia abajo hasta los contadores y dibuja tantos símbolos como quepan;
  - se quita el rótulo del lienzo, que quedaba tapado por la pastilla de fichas y tiempo.
- **Avatares:**
  - sin número en las tarjetas del selector;
  - el retrato 01 (hongo) se encuadra por la cara (posición 57 %, 24 %).
- **Bienvenida:** se quita el texto «Otras cuentas»; los iconos de X, Discord y Microsoft siguen debajo de Google y Apple.
- **Validación:**
  - `tsc`, i18n (10 × 668), determinismo completo, `git diff --check` y build;
  - capturas a 390 × 844 de bienvenida, selector de avatares y Slot.
