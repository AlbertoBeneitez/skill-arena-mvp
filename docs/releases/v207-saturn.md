# v207-saturn · QA online (app 2.07)

Base: v206-saturn. QA local con modo duradero (dos jugadores, PostgreSQL), mismo código que la vista previa.

## Arreglado
- **Nadie podía unirse a una partida pública** (503 `MATCH_STORAGE_UNAVAILABLE`). El disparador `arena_prevent_match_rewrite`
  comparaba la fila entera y, desde 008, las columnas generadas `game_id`/`game_version` aún no están calculadas en un
  `BEFORE UPDATE`, así que rechazaba también el único cambio permitido (poner `player_b`). Migración 013: las ignora
  (salen del manifiesto, que sí se compara). Prueba de regresión en `verify-groups`.
- **Duelo offline perdido siempre**: la partida «solo» se guarda para verificar, pero su emparejamiento (nunca hay rival)
  decidía el resultado y mostraba «Rival pendiente». Ahora decide el rival de liga y la tarjeta lo muestra.
- **Rival con tu propia puntuación**: la cookie del jugador solo viaja a `/api/verified-match/*`; las muestras pasan a
  `/api/verified-match/rival-samples` y por fin excluyen tus partidas. Prueba de ruta en `verify-groups`.

## Detectado, sin cambiar (regla competitiva: decide el propietario)
- `forfeit-on-disconnect-v1` decide por `height ?? score` (más alto gana) y luego por tiempo. En Shot Gallery la puntuación
  son milisegundos (menos es mejor): gana el más lento. En Stack, a igual altura desempata el tiempo, pero el reglamento del
  juego dice superficie. Propuesta: política v2 para partidas nuevas que use la métrica de cada juego; v1 intacta.
- Vista previa sin `ALLOW_PERSISTED_MATCH_TRAINING=1`: «online» no empareja jugadores reales allí.
