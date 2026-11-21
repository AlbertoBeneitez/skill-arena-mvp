# v227-saturn · Seguridad fase 0, simulador automático y propuesta de logo (app 2.27)

Base: v226-saturn. Sin cambios en ningún juego ni en su puntuación (no hay versión competitiva nueva).

- **Sin tope global de partidas (revisión C2).** Desaparece el límite de 2000 partidas para todo el servicio, que unos
  pocos scripts agotaban en segundos. Ahora: 200 partidas al día por cuenta con sesión y 20 por cookie sin cuenta
  (`trainingLimits()` en `lib/server/postgresPublicAttemptRepository.ts`). Si la base de datos llega a 870 MB, no se
  abren partidas nuevas (`STORAGE_FULL`), para que el plan gratuito de Neon no se llene.
- **Límites por cuenta (A1).** Con sesión, pedir otra cookie ya no reinicia el límite.
- **Grupos: solo la primera partida (A2).** El resultado de una jornada es la primera partida terminada de ese juego
  desde que empezó la competición (`FIRST_ATTEMPT_REQUIRED`). Abandonar también la consume.
- **Nombres (B1).** No se aceptan nombres que mezclen letras latinas con cirílicas o griegas («Аdmin»).
- **Simulador automático.** `.github/workflows/sim-bots.yml`: los bots corren en GitHub Actions con cada subida a
  `mobile-test` y cada noche (cuando llegue a `main`). Gratis; no toca Vercel ni Neon. Ver
  [SIMULADOR_BOTS.md](../SIMULADOR_BOTS.md).
- **Servicios a contratar:** el documento vivo está en Claude (enlace en `STATE.md` y en
  [SERVICIOS_A_CONTRATAR.md](../SERVICIOS_A_CONTRATAR.md)).
- **Propuesta de logo y estética retro** en [design/logo](../design/logo/): icono de la app, marca de ordenador, icono
  de avisos y una pantalla retro de ejemplo. Pendiente de aprobación; nada de esto está aún en la app.

Pruebas: repositorio (cuota por cookie sin tope global, freno de almacenamiento, primera partida en grupos, nombres
con alfabetos mezclados) y simulador local (`trampas`, `mejor`, `cuota`).
