# ADR 008 · Juego grupal (relevo) sobre una misma partida

Fecha: 17-nov-2026 · Decisión del propietario: relevo sobre la misma partida, resultado común del grupo con puntos
por jugador, turno para el primero que llegue, empezar por Stack.

## Decisión

- **Una partida, muchos turnos.** El relevo es una sola partida de Stack 4.0.0 con semilla elegida por el servidor.
  Cada turno continúa exactamente donde acabó el anterior: el navegador reconstruye la torre reproduciendo todos los
  toques guardados y el reloj sigue desde el tick en que se cerró el turno anterior. Las reglas son las de Stack; el
  relevo solo amplía el presupuesto de tiempo (1 h simulada) y de toques (`lib/verified/stackRelay.v1.ts`,
  `stack-relay-v1`).
- **Fin de turno determinista.** Un turno se cierra cuando aparece el bloque siguiente al último de los N del turno
  (3, 5 o 10, a elegir al crear), o cuando la torre cae. El servidor exige exactamente eso.
- **Un jugador a la vez.** Empezar un turno toma un bloqueo con plazo de reloj (60 s + 15 s por bloque). Quien
  empieza después mientras está tomado recibe al momento quién juega y desde cuándo. Un turno solo cuenta si llega del
  titular, para ese turno, dentro del plazo (+10 s), no se jugó más rápido que el tiempo real (tiempo de reloj entre
  el bloqueo y el envío ≥ 0,9 × tiempo simulado − 1 s) y su repetición de toda la partida es válida.
- **Rechazos auditables.** Todo turno rechazado se guarda (`arena_group_relay_rejections`) con el motivo y quién
  tenía el turno, para avisar al que llegó tarde y para auditoría.
- **Resultado.** El del grupo es la torre (altura y puntuación de Stack); los puntos de cada miembro son los bloques
  que colocó. Una modalidad competitiva queda para más adelante.

## Consecuencias

- Solo grupos online (necesita servidor y cuenta). Sin dinero, ni ficticio.
- Un relevo abierto por grupo. Quien lo creó puede cancelarlo.
- El navegador nunca envía el historial: el servidor lo guarda y lo repite en cada turno.
