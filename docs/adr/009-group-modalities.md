# ADR 009 · Modalidades de grupo: todos vs todos, 1 vs 1 y relevos

Fecha: 18-nov-2026 · Decisión del propietario: las competiciones de grupo se crean eligiendo una de tres modalidades,
que sustituyen a los formatos anteriores (partida única, liga por rondas, liga de duelos, eliminatorias). Sustituye al
juego grupal de la ADR 008 como forma de jugar en grupo.

## Decisión

- **Todos vs todos.** Cada jornada juega todo el grupo la misma partida (juego y semilla). Por puesto, el primero suma
  N puntos (N = jugadores), cada puesto uno menos y el último 1. Los empates de puntuación se deshacen por el tiempo
  jugado y, si persisten, por sorteo con semilla (regla `time-v1` de siempre), así que los puntos son siempre N … 1.
- **1 vs 1.** Cada jornada el grupo busca un grupo rival del mismo tamaño; cada miembro juega contra un jugador de ese
  grupo, emparejados al azar (reproducible: hash de la competición, la jornada y el rival). Ganar: 2 puntos; perder: 0.
- **Relevos.** Cada jornada contra un grupo rival del mismo tamaño. Cada grupo juega en orden (el orden rota cada
  jornada): un miembro solo juega cuando ha jugado el anterior de su grupo; cada uno empieza la partida desde cero y su
  puntuación se suma a la de los anteriores. El grupo con mejor total (menor en juegos de tiempo) suma 2 puntos por
  miembro; el otro 0. Con totales iguales gana el grupo más rápido. Hay además una tabla de grupos (2 por jornada
  ganada).
- **Jornadas.** Una jornada solo se cierra cuando han jugado todos (sin plazo). La clasificación se mueve jornada a
  jornada y se muestra al final de la pestaña Grupos; en 1 vs 1 una jornada cuenta cuando se han jugado todos sus
  duelos.
- **Rival.** Botón «Buscar grupo rival» por jornada, que busca hasta que aparece uno. Solo grupos del mismo tamaño.
- **Dinero.** Contra otros grupos no hay entrada ni premios (un bote entre dos grupos no está definido). Todos vs
  todos mantiene la entrada y el reparto de siempre.
- Motor puro en `lib/groupCompetition.ts` (`assignRival`, `relayWaitingFor`, `relayTotals`, `groupTeamStandings`);
  pruebas en `scripts/verify-group-modalities.ts`. Las competiciones empezadas con los formatos anteriores terminan con
  sus reglas.

## Estado (v217)

- Sin conexión: las tres modalidades completas, con grupos rivales inventados que aparecen tras una búsqueda corta.
- Con conexión: todos vs todos se puede crear; 1 vs 1 y relevos aún no (el servidor no tiene todavía búsqueda de
  grupos rivales ni las partidas de grupo se juegan online). El panel del juego grupal de la ADR 008 se retira de la
  interfaz; su API, tablas y pruebas se conservan (datos históricos).

## Pendiente (fase 2)

- Partidas de grupo jugadas online y verificadas en el servidor.
- Cola de búsqueda de grupo rival en el servidor (misma modalidad, plataforma y tamaño).
- Notificación en el móvil cuando aparece el rival: Web Push con claves VAPID que configura el propietario en Vercel
  (nunca pasan por el chat), un service worker y, en iPhone, la app instalada en la pantalla de inicio.
