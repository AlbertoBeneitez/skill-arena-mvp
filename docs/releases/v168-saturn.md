# v168-saturn — Avatares enteros, «Tu selección», juegos repetibles y buscador en Grupo, silencio en segundo plano y tres propuestas de color (10-nov-2026)

Base: v167-saturn.

## Inicio y avatar
- **Selector de avatar:** los 16 retratos se ven enteros, como cuadrados en una rejilla de 4 × 4 que cabe de una vez en pantalla. Antes eran recortes 2:1 que cortaban la cabeza.

## Juegos
- **«Tu selección»:** primera fila del catálogo, con los juegos que más juega el jugador (hasta 8, del más jugado al menos jugado).
  - Cuenta cada partida empezada, también las de grupo, en `playCounts` del perfil local.
  - Aparece desde la primera partida.
  - «Restablecer estadísticas» la vacía.

## Grupo
- **Elegir juegos:** cada pulsación añade el juego al final del orden, así que un juego puede repetirse (por ejemplo, 1, 2 y 3 en Billar).
  - La marca de la esquina muestra sus números (por ejemplo «1 2 3»).
  - Debajo aparece «Orden de juego»: cada partida con su número, su portada y un botón para quitarla, más «Borrar».
  - Máximo 20 partidas.
- **Buscar juego:** buscador sobre las portadas, sin distinguir mayúsculas ni acentos.
- **Entrada por jugador:**
  - el € va dentro del campo, en gris;
  - a la derecha, flechas para subir o bajar 1 €, entre 0 y el saldo;
  - se quita «Una sola inscripción cubre todas las partidas».

## Sonido
- **En segundo plano:** al bloquear el móvil o cambiar de app o de pestaña, la música se para, se cortan los sonidos y el audio se suspende. Al volver, se recupera la música de esa pantalla si el sonido y la música siguen activados.

## Tres propuestas de color (Grupo y Avatar) para que elija el propietario
- **Vista previa:** `?tema=1`, `?tema=2` o `?tema=3`, que se mantiene durante la sesión; `?tema=0` vuelve al negro y oro actual.
  1. **Brawl:** fondo violeta, botones amarillos en relieve con contorno oscuro, acentos cian, rosa y verde, y estadísticas en bloques de color.
  2. **Candy:** fondo color mora, botones brillantes de rosa a naranja, menta para lo elegido y números como caramelos.
  3. **Tapete:** paño verde, botones rojos como fichas de casino, azul para lo elegido, oro para el dinero y estadísticas como fichas.
- La elegida pasará a ser el aspecto por defecto y se retirarán las otras dos.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px:
  - selector de avatar 4 × 4;
  - «Tu selección» (la primera partida cuenta);
  - Grupo con Billar ×3 y Dardos, orden, buscador y entrada;
  - las tres propuestas en Grupo y Avatar.
