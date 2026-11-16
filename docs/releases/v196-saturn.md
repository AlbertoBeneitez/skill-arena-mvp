# v196-saturn — Medición de jugadores con consentimiento (16-nov-2026)

Base: v195-saturn. App 1.96.

- **Migración 011** (`011-events.sql`): `arena_consents` y `arena_events` (solo se añaden; UPDATE/DELETE bloqueados salvo
  la retención), `arena_event_daily` (totales que se recalculan) y la vista `arena_player_matches` sobre partidas verificadas.
- **Catálogo** (`lib/events.ts`) y servidor (`lib/server/events.ts`): consentimiento versionado, eventos solo de catálogo,
  plataforma desde la cuenta, `rebuildDaily` y `purgeEvents` (12 meses, recalcula antes los totales).
- **Rutas:** `GET/POST /api/consent`, `POST /api/events` (lote ≤ 20, 8 KB).
- **App:** interruptor «Ayudar a mejorar los juegos» en Ajustes (desactivado por defecto, solo con cuenta del servidor);
  pantallas y juegos abiertos se envían solo si se aceptó. Texto de privacidad nuevo en 10 idiomas.
- **Documentación:** `docs/EVENTOS.md`.
- **Pendiente del propietario:** confirmar 12 meses de retención; tarea programada para `purgeEvents`.
- **Validación:** i18n, lint, determinismo, `test:repository` (nuevo `verify-events`), build, humo, solapes.
