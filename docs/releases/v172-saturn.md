# v172-saturn — «Telemetría» trabajada como sistema de color, en tres acentos (11-nov-2026)

Base: v171-saturn.

## Decisión del propietario
- De las propuestas de v171, prefiere **Telemetría**, pero sin el naranja.
- Se retiran Pista y Marfil. Telemetría se rehace como sistema de color y se presenta con tres acentos para elegir.

## Sistema
- **Carbono:**
  - negros neutros, algo cálidos y sin tono azulado;
  - cuadrícula de ingeniería de 24 px;
  - marcas de registro en hielo en dos esquinas de cada panel;
  - esquinas de 8 a 10 px.
- **Hielo** (`#9fe6ff`), para datos y selección:
  - cifras y premio, con lectura sobre fondo hundido y regla izquierda;
  - contornos de lo elegido, con una barra corta encima;
  - foco y anillo del jugador;
  - control segmentado de Perfil y Ranking en blanco hielo.
- **Acento, solo para acción:**
  - botón principal macizo;
  - fichas cuadradas de los pasos;
  - contorno de «Compartir invitación»;
  - contador de juegos elegidos;
  - insignia de la foto.
- **Metales** para 1.º, 2.º y 3.º, y **verde y rojo** para ganancias y pérdidas.

## Variantes para elegir (vista previa)
- `?tema=3`: **Rojo carrera** `#e3242b` (recomendada).
- `?tema=4`: **Ámbar de cabina** `#f5a524`.
- `?tema=5`: **Magenta señal** `#f2307c`.
- `?tema=0`: el negro y oro, que sigue por defecto hasta que el propietario elija.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px de Grupo (cabecera, juegos y reparto) y de Avatar con cada acento.
