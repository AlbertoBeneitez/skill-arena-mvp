# v130-saturn — Catálogo por filas de categoría y botón de jugar en cristal (1-nov-2026)

Base: v129-saturn (92e1845). Solo presentación y registro: ningún núcleo cambia.

## Pestaña Juegos
- **Filas en el orden pedido por el propietario:**

  | Fila | Juegos |
  | --- | --- |
  | Populares | los 8 más jugados |
  | Casino | Roulette, Slot |
  | Bar | Billar, Dardos, Bowling |
  | Míticos | Pinball, Solitaire Sprint, Mine Grid, Orb Burst, Stack Shift |
  | Dinámicos | Stack, Tower Drop |
  | Alternativos | Galoku, Shot Gallery |

- **Cada fila** se desliza en horizontal con encaje por tarjeta (`scroll-snap`). Las columnas miden `(100 % − 2 huecos) / 2,5`, así que se ven 2 tarjetas y media y la página nunca se desplaza en horizontal.
- **Popularidad:** `CATALOG_ORDER` en `lib/games.ts` es ahora el orden por partidas jugadas, de más a menos, fijo y editable. Ordena Populares y cada fila; cuando el servidor dé recuentos reales, lo sustituirán.
- **Categorías:** `GAME_SHELF`/`gameShelf()` en el registro, con `POPULAR_COUNT` = 8. Populares no se asigna, se gana. En la especificación de la plataforma, la ficha técnica incluye la categoría que elige el estudio.
- **Insignia de liga en las tarjetas:** queda en medalla y puntos; el nombre del nivel sigue en `aria-label`.

## Botón de jugar
- Cristal oscuro con borde cian al 55 %. Al tocarlo se ilumina (fondo y halo cian) y baja 1 px; con el ratón hay hover y siempre hay anillo de foco.
- Sustituye al degradado amarillo-naranja-rosa de v109; la portada de cada juego aporta el color.
- Se retiran las reglas antiguas que quedaban tapadas.

## Texto
- El botón del alta vuelve a «CONTINUAR» en los 10 idiomas (se descarta «DESPEGAR»), igual que en los scripts de QA.

## Validación
- `tsc`, i18n (10 × 698), determinismo completo, `git diff --check` y build.
- Prueba básica de los 14 juegos.
- A 390 × 844:
  - 6 filas con 8 / 2 / 3 / 5 / 2 / 2 juegos;
  - tarjeta de 138 px en una pista de 370 px, con 69 px de la tercera visibles;
  - deslizamiento lateral sin desbordar la página.
