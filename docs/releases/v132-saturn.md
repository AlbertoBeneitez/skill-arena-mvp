# v132-saturn — Fondo negro, fila Nuevos, sin imágenes al abrir un juego y nada solapado (1-nov-2026)

Base: v131-saturn (a59e3ff). Solo presentación: ningún núcleo cambia.

## Fondo negro
- Se sustituye la gama azul marino por negro y grafito.
- Cada color oscuro con tinte azul o cian del cromo pasa a un negro neutro de la misma luminosidad, un poco más profundo. Afecta a:
  - `app/globals.css` y los módulos CSS;
  - `OrbitalScene`, `lib/spaceBackdrop.ts` y el manifiesto.
  El script de conversión de un solo uso no se ha añadido al repositorio.
- Tokens: `--st-abyss` `#09090b`, `--st-deep` `#131315`, panel `#1c1c1f → #131316`, texto `#eceef2`, secundario `#9c9ea6`.
- El cian (interactivo) y el oro (dinero y rango) no cambian.
- El cielo del escenario (`stage-nebula.webp`) es negro con polvo ahumado casi neutro, en lugar de nubes violetas.
- La pantalla de arranque y la barra del sistema usan el mismo negro (`#09090a`).

## Fila «Nuevos»
- Va justo después de Populares.
- Entran los juegos añadidos en los últimos 30 días según su fecha de alta en `lib/games.ts` (`GAME_ADDED`, `isNewGame`): hoy, Pinball, Bowling y Galoku.
- Con 60 días entrarían los 14 juegos, porque todo el catálogo se publicó el 29 de septiembre, así que la ventana es de 30 días.
- Los juegos externos traerán su propia fecha.

## Sin imagen entre pulsar un juego y verlo
- La pantalla de carga es solo el escenario negro con una línea fina de progreso: sin Saturno, sin órbita y sin logotipo. El texto queda para lectores de pantalla.
- La cuenta atrás ya no muestra la portada del juego. Quedan el anillo con el número y, en liga, el rival.

## Nada solapado
- **Pinball y Orb Burst:** los botones van en una franja bajo el tablero, que se ajusta al espacio de encima. Es una regla general de `CoreCanvasGame` para todo juego con botones.
- **Ruleta:** la ficha seleccionada ya no sube ni crece sobre la fila de apuestas; se marca solo con su aro.
- **`scripts/qa-overlap.cjs`** recorre la bienvenida, el avatar, cada pestaña y los 14 juegos a 390 × 844. Falla si un control tapa el lienzo del juego o si dos controles se cruzan.
- **Excepciones:**
  - diálogos abiertos a propósito;
  - cartas en abanico de una misma pila del solitario;
  - contenido que pasa por debajo de la cabecera o la barra inferior fijas y opacas.
- La regla queda en `DESIGN.md`.

## Validación
- `tsc`, determinismo completo, i18n (10 × 699), `git diff --check` y build.
- Prueba básica de los 14 juegos y `qa-overlap`: «No overlaps on any screen».
- Capturas a 390 × 844 del catálogo, el perfil, Pinball, Orb Burst y Roulette.
