# v127-saturn — Ruleta 14, historial separado del marcador y botones físicos del Slot (1-nov-2026)

Base: v126-saturn (889a80a).

## Ruleta 14 (`galactic-roulette@14.0.0`; V1–V13, sus adaptadores y fixtures intactos)
- **Petición del propietario:** el salto no era realista porque la bola se asentaba demasiado rápido.
- **Medido en V13** (80 lanzamientos), desde que la bola cae de la pista al rotor:
  - se asentaba en una media de 2,2 s (p10 0,9 s) y cruzaba unas 4 casillas;
  - se quedaba quieta de golpe: la fricción estática la sujetaba a 140 µm/tick (≈ 17 px/s) y el fondo de casilla la frenaba un 4,5 % por tick.
- **Cambios en V14** (misma geometría, diamantes y rueda):
  - el freno en la casilla pasa a 1,2 % por tick (`pocketBrakeMilli` 955 → 988);
  - la bola se sujeta a menos velocidad: 40 µm/tick, ≈ 5 px/s (`pocketStickSpeed` 140 → 40);
  - fondo y trastes más vivos: `pocketRestitutionMilli` 450 → 540, `fretRestitutionMilli` 470 → 560, `fretHopMilli` 650 → 720; el tope del salto no cambia.
- **Resultado:** la bola se asienta en 3,2 s de media (p10 1,8 s), cruza unas 5 casillas y se detiene con suavidad. El reparto sigue siendo justo (χ² 40,4, 36 g.l.) y la bola nunca sale de su casilla.
- **Pruebas** (`scripts/verify-roulette-v14.ts`): las de V13 adaptadas, más la comparación de asentado con V13 y una fixture golden nueva.

## Historial de la ruleta
- Los 6 últimos números van arriba a la derecha y el más reciente queda junto al borde.
- Ya no pasan por debajo de la pastilla de fichas y tiradas, que ocupa la esquina superior izquierda.

## Slot
- Pulsadores físicos:
  - metacrilato iluminado por dentro, con bisel cromado y sombra de base;
  - recorrido de 4 px y brillo al pulsar;
  - ámbar para quitar pasos, verde para añadir y uno rojo ancho para girar, con brillo pulsante (sin animación si el sistema pide reducir movimiento).
- Solo CSS; el panel deja sitio a los rodillos.

## Validación
- Determinismo completo, `tsc`, i18n, `git diff --check` y build.
- Capturas a 390 × 844 del Slot (en reposo y al pulsar) y de la ruleta.
