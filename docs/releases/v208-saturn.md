# v208-saturn · Regla online V2 (app 2.08)

- Partidas públicas nuevas con `forfeit-on-disconnect-v2` (migración 014): mejor puntuación del juego en su dirección,
  luego el más rápido, luego empate exacto. `decidePublicMatch` en `lib/publicMatch.ts`.
- Stack: más bloques gana; a igual altura, más superficie (como su reglamento). Antes desempataba el tiempo.
- Shot Gallery: menos milisegundos gana. Corrección del informe de v207: V1 ya lo hacía bien a través de `height`
  (base − tiempo); no había ganador equivocado.
- Las partidas guardadas con V1 se resuelven con V1; solo se empareja con partidas de la política vigente.
- Pruebas en `verify-public-attempts` (dirección por juego espejo del catálogo, V1 archivada, restricción de valores).
