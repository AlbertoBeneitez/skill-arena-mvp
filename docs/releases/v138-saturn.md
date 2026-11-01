# v138-saturn — Portadas mejoradas (1-nov-2026)

Base: v137-saturn (0531378). Petición del propietario: «haz una mejora de cada imagen de presentación de cada juego». Solo arte: ningún núcleo cambia.

## En todas las portadas generadas (`scripts/generate-covers.py`)
- **Sin la línea horizontal de destello** (anamórfica) que cruzaba Dardos, Pinball, Solitaire, Mine Grid, Galoku y Tower Drop: en la tarjeta parecía un corte.
- **Fondos y sombras en el negro de la app** en lugar del azul marino: la misma luminosidad, sin tinte azul. Se conservan los violetas, los colores cálidos y los de cada juego.
- **Rasterizado de nuevo a WebP 800 × 550** (`scripts/rasterize-covers.cjs`), con caché `?v=138`.

## Además, por juego
- **Pinball:** muestra una multibola (V9), con dos bolas más en el centro de la mesa.
- **Roulette:** la bola rueda por la pista contra el borde, con su estela (el lanzamiento real de V16), en lugar de estar ya en una casilla.
- **Stack y Tower Drop:** su cielo azul pasa a negro.
- **Shot Gallery:** vuelve a renderizarse con el motor del juego y el fondo negro de v132.
- **Bowling:** se mantiene la portada renderizada con el motor en v125. La rasterización ya no la sobrescribe con la versión SVG antigua.

## Validación
- `tsc`, build y prueba básica de los 14 juegos.
- Comparación antes/después de las 13 portadas y catálogo revisado a 390 × 844.
