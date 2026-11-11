# v175-saturn — Aleatorio como juego, premios claros, Enviar juego con texto nuevo, Mine Grid y Perfil (11-nov-2026)

Base: v174-saturn. Se publica en `mobile-test`, con la v174, por decisión del propietario.

## Cartera
- Se quita «Sin movimientos»: si no hay movimientos, el panel solo muestra el saldo, la cantidad y los botones.
- El saldo del panel se anuncia al cambiar (`aria-live`).

## Enviar juego
- **Pantalla inicial:** «Crea un juego atractivo y gana el 50 % de los beneficios generados».
- **Página de envío:** es la última pantalla y lleva las instrucciones, con la «i» en cada paso. El texto de arriba es
  ahora «Sube tu juego en un archivo .zip» y, en otra línea, «Al finalizar el test se te enviará una notificación».
- **Notas «i»:** dejan de decir que se comprueba al momento o que «lo probamos y te respondemos».

## Grupo
- **Formatos:**
  - sin los subtítulos «Varias jornadas» y «Rondas con eliminados»;
  - «Eliminatorias» pasa a «Rondas eliminatorias».
- **Aleatorio es un juego más:** se puede elegir, repetir y ordenar como los demás (por ejemplo SLOT, SLOT, ALEATORIO,
  DARDOS, SLOT).
  - Su juego se sortea **al empezar esa jornada o ronda**, así que nadie lo sabe antes.
  - El sorteo usa una semilla de la competición y de la ronda, así que es reproducible.
  - Implementación: `RANDOM_GAME`, `randomPool` y `roundGame` en `lib/groupCompetition.ts`.
  - Sin elegir nada, todas las rondas son aleatorias y se sortean del mismo modo (antes se sorteaban todas al crear la
    competición).
- **Sin el cuadro «Orden de juego»:** cada juego elegido lleva una × discreta en la esquina inferior de su portada, que
  quita su última elección. Los números de orden siguen arriba.
- **Premios:**
  - solo el premio y la comisión, en letra grande;
  - sin el bote y sin el difuminado;
  - igual en la competición en curso.
- **Paneles:** sin las marcas azules de las esquinas.

## Juegos
- **Portada de Mine Grid:** el tablero llega hasta arriba, con el horizonte más bajo (`mine_v165(HZ=-1835)` en
  `generate-covers.py`). Ya no queda una banda vacía en la tarjeta del catálogo.

## Perfil
- La gráfica de beneficio neto va justo debajo de la ficha del jugador.
- Sin las esquinas de dos segmentos (marcas azules y barrita cítrica de las cifras).

## Validación
- `pnpm lint` (tsc y oxlint), `pnpm test:determinism` (con pruebas nuevas de las rondas aleatorias), `pnpm build`,
  `scripts/qa-smoke-all.cjs` (13 juegos), `scripts/qa-overlap.cjs` y `git diff --check`.
- Capturas a 390 px de catálogo, Enviar juego, cartera, Perfil y Grupo (con Aleatorio, repeticiones, × y premios).
