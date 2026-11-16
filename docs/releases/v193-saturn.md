# v193-saturn — Cimientos de la base de datos y regla de pagos (16-nov-2026)

Base: v192-saturn. App 1.93 (solo servidor; la interfaz no cambia).

- **Pagos:** el propietario pide desconectar Vercel de momento y que se le avise de cualquier pago. Lo que se cobra
  es la suscripción Pro del equipo «Skill Arena» (20 $ al mes más IVA); cancelarla lo hace el propietario en Vercel ›
  Settings › Billing › Downgrade Plan. Nueva regla en `CLAUDE.md`: nada con coste sin permiso, importe y periodicidad
  por delante, y revisión de cargos al empezar cada sesión.
- **Revisión:** `docs/BASE_DE_DATOS.md` (mapa, 12 problemas, modelo de destino, fases).
- **Cimiento 1 · persona única** (`008-identity.sql`): `arena_public_attempts.account_id`; columnas generadas
  `game_id`/`game_version` en `arena_matches` con índices; `deleted_at` en cuentas.
- **Cimiento 2 · libro de partida doble** (`010-ledger.sql`, `lib/server/ledger.ts`): movimientos firmados que suman
  cero por moneda, inmutables, sin saldo negativo en jugadores ni botes (comprobado al confirmar). Bienvenida, cambio
  ficticio, entradas, premios y devoluciones pasan por él; el saldo se lee del libro. Los saldos existentes se pasan
  con un ajuste de la casa.
- **Cimiento 3 · borrar = anonimizar** (`008`): una cuenta nunca se borra de la base (lo impide un disparador); al
  pedir el borrado se anonimiza y se sale de los grupos. Se conserva el libro.
- **Cimiento 4 · grupos en el servidor** (`009-groups.sql`, `lib/server/groups.ts`): grupos por plataforma,
  competiciones (grupo, liga, torneo), desafío abierto y aceptación, entradas contra el bote, resultados solo de
  partidas verificadas por el servidor, liquidación automática, ranking por dinero ganado. Sin comisión en grupos.
- **Copia de seguridad:** `docs/GUIA_COPIA_DE_SEGURIDAD.pdf` (clave pública `age`, secreto `BACKUP_DATABASE_URL`,
  `HEALTH_URL`, prueba y descifrado). La copia lee su script de `mobile-test`.
- **Pruebas:** nuevas `verify-groups` y `verify-group-versus`; `verify-accounts` y `verify-migrations` ampliadas.
- **Pendiente:** rutas y pantalla de grupos, `account_id` desde la sesión en el inicio de partida pública, ranking por
  periodo, usuarios separados en la base, plazo de conservación de partidas (propuesta 12 meses).
- **Validación:** i18n, lint, determinismo, repositorio, build, humo (13 juegos), solapes, `git diff --check`.
