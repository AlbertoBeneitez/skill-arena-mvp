# v211-saturn · Juego grupal con Stack (app 2.11)

Decisiones del propietario (17-nov-2026): relevo sobre la misma partida, resultado común con puntos por jugador,
turno para el primero que llegue, empezar por Stack.

- **Grupos online → «Juego grupal».** Se elige 3, 5 o 10 bloques por turno y se empieza la torre. Cada turno
  continúa la torre del anterior; termina solo al aparecer el bloque siguiente al último del turno, o si la torre cae.
- **Un jugador a la vez.** Bloqueo con plazo (60 s + 15 s por bloque). Quien empieza después ve al momento «X empezó
  su turno antes que tú (hora)». Un turno no cuenta si el plazo acabó, si otro tenía el turno o si se jugó más rápido
  que el tiempo real (comparación del tiempo de juego con el de envío); el jugador ve el motivo.
- **Resultado.** Altura de la torre del grupo y bloques de cada uno. El último turno propio no enciende el círculo.
- **Catálogo.** Stack se pone morado cuando la torre de tu grupo espera turno y el último no fue tuyo.
- **Servidor.** `lib/verified/stackRelay.v1.ts` (reglas y comprobación pura), `lib/server/groupRelays.ts`,
  `/api/groups/relay`, migración 015 (relevos, turnos aceptados, turnos rechazados). ADR 008.
- **Pruebas.** `verify-stack-relay` (traspaso exacto, rechazos, fin por inactividad, tiempo real) y
  `verify-group-relays` en PostgreSQL (bloqueo, continuación, rechazos, auditoría, resumen, baja y borrado).
  Prueba local de punta a punta con dos cuentas: crear, coger turno, rechazo del segundo, turno aceptado, círculo morado.
- Textos en 10 idiomas.
