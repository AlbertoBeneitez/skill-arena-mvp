# v203-saturn — Offline también en 1 contra 1 (16-nov-2026)

Base: v202-saturn. App 2.03.

- **Offline en duelos:** con el globo en Offline, cada juego del catálogo se juega contra un rival inventado (la liga
  local de siempre) cuyo objetivo es una partida verificada real de otro jugador del mismo juego y plataforma
  (`/api/rival-samples`); si no hay, el objetivo simulado. Nunca con entrada. Los círculos del catálogo quedan blancos.
- **Partidas «solo»** (migración 012, `arena_public_matches.solo`): las partidas Offline y las de grupo local se
  verifican en el servidor igual que las demás, pero nunca se emparejan con nadie ni aparecen como partida esperando.
  `POST /api/verified-match/start` acepta `solo: true` solo con entrada 0. Sin la migración, se rechazan
  (`SOLO_UNAVAILABLE`).
- **Arreglo (fallo de v199):** en la vista previa con base de datos, una partida de grupo Offline se creaba como partida
  pública y la app podía quedarse en «esperando rival» sin anotar el resultado en el grupo.
- **Pruebas:** `verify-public-attempts` (solo: sin migración, con entrada, valor inválido, no se une ni se deja unir).
- **Validación:** lint, determinismo, `test:repository`, build, `git diff --check`. Sin partidas jugadas por Claude.
