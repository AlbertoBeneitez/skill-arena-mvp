# Medición de jugadores (v196)

Objetivo del propietario (16-nov-2026): medir casi todo, que sea **auditable, recuperable y claro**.

## Qué se mide y dónde vive

| Qué | Dónde | Quién lo escribe |
|---|---|---|
| Partidas: juego, versión, plataforma, estado, puntuación, abandono | **Partidas verificadas** (`arena_public_attempts`), vista `arena_player_matches` | El servidor (repetición determinista). No se copia a otra tabla. |
| Alrededor de las partidas: pantallas, juegos abiertos, tiempo en un juego, ajustes | `arena_events` (`source = 'client'`) | El navegador informa; el servidor valida contra el catálogo. **No es autoritativo.** |
| Acciones de grupo: crear, unirse, competición creada/entrada/terminada | `arena_events` (`source = 'server'`) | Solo el servidor |
| Dinero ficticio | Libro de partida doble (`arena_ledger_*`) | Servidor |
| Decisiones de consentimiento | `arena_consents` | Servidor, una fila por decisión |
| Totales por día, plataforma, juego y tipo | `arena_event_daily` | Se recalcula siempre desde `arena_events` |

## Reglas

- **Consentimiento primero.** Sin una decisión «sí» vigente (versión `analytics-v1`) no se guarda ningún evento. Por
  defecto está desactivado. Retirarlo detiene el registro al instante; el historial de decisiones se conserva.
- **Solo catálogo.** `lib/events.ts` es el único sitio que dice qué se puede registrar; sin texto libre, sin campos
  extra, con rangos. El servidor rechaza lo demás.
- **Plataforma desde la cuenta**, nunca del navegador. Móvil y ordenador no se mezclan.
- **Auditable.** `arena_events` y `arena_consents` solo se añaden: un disparador impide UPDATE y DELETE. Cada evento
  lleva la versión de consentimiento con la que se guardó y la versión del esquema.
- **Recuperable.** Entran en la copia diaria cifrada. Los totales diarios se pueden rehacer (`rebuildDaily`).
- **Retención.** Eventos detallados 12 meses (`EVENT_RETENTION_MONTHS`, **pendiente de confirmar por el
  propietario**). `purgeEvents` recalcula antes los totales diarios y borra solo con `arena.retention = 'on'`.
  Aún no hay tarea programada que la ejecute.
- **Borrar cuenta = anonimizar.** El identificador deja de poder vincularse a una persona; los eventos quedan sin
  identidad real.

## Catálogo (versión 1)

`screen_view{screen}`, `game_opened`, `game_left{ms}`, `setting_changed{setting}` (cliente) ·
`group_created`, `group_joined`, `competition_created{mode,games}`, `competition_entered{mode}`,
`competition_finished{mode,players,won}` (servidor; los escribirán las rutas de grupos).

## Preguntas que ya se pueden contestar

Partidas por juego y día; abandono en el primer minuto (`abandoned`); distribución de puntuaciones por versión;
jugadores activos por día y plataforma; juegos más abiertos y tiempo en cada uno.
