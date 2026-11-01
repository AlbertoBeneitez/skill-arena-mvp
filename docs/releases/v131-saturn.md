# v131-saturn — Saturno de la bienvenida e icono de la app desarrollados (1-nov-2026)

Base: v130-saturn (d081278). Solo arte e iconos: ningún núcleo cambia.

## Saturno (bienvenida, alta y pantalla de carga)
- `scripts/render-saturn-hero.py` → `public/art/saturn-hero.webp` (`?v=131`).
- **Bandas:** se acaban las líneas finas como vetas de madera. Las zonas anchas llevan el contraste, los bordes de los cinturones ondulan a lo largo de la longitud y hay remolinos pequeños.
- **Lado nocturno:** luz reflejada por los anillos (ring-shine), sobre todo cerca del ecuador que los mira.
- **Anillos:**
  - segunda capa de anillos más finos, con supermuestreo 2 × 2 para que no haya moiré;
  - un tono por anillo: C gris y translúcido, B el más claro y crema, A arena;
  - los anillos más densos se ven más brillantes;
  - la sombra del planeta sobre los anillos se simplifica: el rayo hacia el sol toca la esfera.

## Icono de la app (pantalla de arranque, pantalla de inicio, pestaña)
- `scripts/render-app-icon.py` → `icon-192/512`, `icon-maskable-512`, `apple-touch-icon` (`?v=131`).
- **La G:** en relieve delante de todo, de metal cian biselado, con contorno oscuro y sombra proyectada. Se lee a 48 px.
- **El planeta** pasa a azul noche y **el anillo** al tono arena del Saturno de la bienvenida.
- **Se retira `app/icon.svg`,** la G plana antigua. Algunos lanzadores la preferían al PNG, así que el móvil seguía mostrando el icono antiguo en el arranque. Ahora solo hay PNG: favicon de 192 y 512.
- **En móviles con la app ya instalada,** quitarla de la pantalla de inicio y volver a añadirla para que el lanzador recoja el icono nuevo.

## Documentación
- `docs/PAYMENTS_AND_LEGAL.md`: investigación de cobros (Newly/RevenueCat, Stripe, PayPal, pasarelas de juego, Bizum) y qué hay que explicar en la app.

## Validación
- `tsc`, determinismo completo, i18n (10 × 698), `git diff --check` y build.
- Prueba básica de los 14 juegos.
- Bienvenida revisada a 390 × 844.
- `/icon.svg` responde 404 y el HTML enlaza solo los PNG `?v=131`.
