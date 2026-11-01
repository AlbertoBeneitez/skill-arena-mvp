# v128-saturn — Grupos: partida única, liga (jornadas o duelos) y torneo con una sola inscripción (1-nov-2026)

Base: v127-saturn (063b08d). Decisiones del propietario del 1 de noviembre:
- formato de liga a elegir al crear (jornadas individuales o duelos 1 contra 1), más el torneo;
- una sola cuota de entrada;
- final por N jornadas o por votación de la mayoría;
- comisión del 5 % y liga puntuada por victorias;
- reglas puras con guardado local ahora y servidor después.

## Reglas (`lib/groupCompetition.ts`, puro: sin React, DOM, reloj ni azar; cantidades en céntimos)
- **Formatos:**
  - `single`: una partida;
  - `league-rounds`: cada jornada todos juegan el mismo juego y semilla, y la mejor puntuación es una victoria;
  - `league-duels`: calendario de duelos todos contra todos (método del círculo); con un número impar de jugadores, uno descansa en cada jornada;
  - `tournament`: en cada ronda queda eliminada la peor puntuación hasta que queda uno.
- **Final:**
  - liga: tras N jornadas o por mayoría de votos; las partidas abiertas no cuentan;
  - partida única: tras su partida;
  - torneo: cuando queda un jugador.
- **Bote:** inscripción × jugadores, menos el 5 % de comisión (`GROUP_COMMISSION_BPS`). Se reparte el 100 % al ganador o 70/30; los empatados comparten el premio de los puestos que ocupan.
- **Clasificación:** liga por victorias y después por rivales superados; torneo por orden de eliminación. En los juegos de tiempo gana la cifra más baja.
- **Prueba:** `scripts/verify-group-competition.ts`, dentro de `pnpm test:determinism`. Cubre:
  - comisión, reparto y empates;
  - jornadas, duelos (las 6 parejas de 4 jugadores) y jugadores impares;
  - eliminaciones del torneo;
  - votación (no basta con 2 de 4; se descarta la jornada abierta);
  - determinismo con rivales simulados;
  - que la competición sobrevive a guardarla y volver a cargarla.

## Rivales simulados (`lib/demo/groupRivals.ts`, datos de ejemplo)
- Puntuaciones y votos deterministas a partir de la semilla de la partida y del jugador.
- Juegan en cuanto se programa una jornada, así que el objetivo de tu partida es la mejor puntuación simulada.
- En la votación, cada rival acepta terminar desde la tercera jornada con un 70 % de probabilidad, fija para cada rival.

## Pantalla de grupo (`components/GroupHub.tsx`, de 1050 a ~400 líneas)
- **Entrar:** crear o unirse con código o enlace, como antes.
- **Un solo formulario:**
  - formato y, en liga, modalidad y final (N jornadas con un selector, o votación);
  - juego o «aleatorio», inscripción y reparto (solo con 3 o más jugadores);
  - bote, comisión y premio calculados en vivo, y el botón «Pagar X y empezar».
- **En curso:**
  - clasificación con victorias o «fuera»;
  - «Jugar · juego · contra rival»;
  - propuesta de terminar, con el recuento de votos;
  - al acabar, el premio de cada uno y «Nueva competición».

## Integración (`components/DemoApp.tsx`)
- La competición se guarda con el resto del estado local y se restaura al abrir la app (`isGroupCompetition`).
- La inscripción se cobra una sola vez al empezar y el premio se abona cuando la competición termina.
- Se retiran las etapas, la colocación aproximada y el reparto que calculaba la interfaz.
- Salir de una partida empezada registra la peor puntuación posible (derrota), igual que una partida sin verificar.
- Las semillas de las partidas de grupo son locales mientras no haya servidor. Cuando lo haya, el servidor emitirá `match.seed`.

## Validación
- Determinismo completo, `tsc`, i18n (10 × 692), `git diff --check` y build.
- Prueba básica de los 14 juegos.
- QA a 390 × 844: crear grupo, formulario, pagar y empezar, salir de la partida, clasificación y recarga con la liga intacta.
