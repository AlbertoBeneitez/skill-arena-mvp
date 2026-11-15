# v191-saturn — Alta de jugadores como será (15-nov-2026)

Base: v190-saturn. Pedido del propietario (13-nov): «aproximar la inclusión de nuevos jugadores a como va a ser en la
realidad; de momento serán solo dos» → alta de jugadores como será.

- **Migración 007** (`db/migrations/007-accounts.sql`, solo añade): `arena_accounts` (una cuenta por identidad,
  guardada como HMAC; nombre único por su forma plegada; avatar por número; plataforma) y `arena_wallet_entries`
  (libro de movimientos que no se edita; saldo = último `balance_after`; comisión en `fee_minor`; ámbito ficticio).
  Para Neon: `db/setup/007-cuentas.sql`, ensayado dos veces sobre una base con 001–006.
- **Servidor:** `lib/server/accounts.ts` (alta con 25 ₡ de bienvenida, cambio de nombre y avatar, borrado, movimientos,
  cambio ficticio € ↔ ₡ con el 5 %, idempotente y sin descubiertos aunque lleguen peticiones a la vez),
  `lib/accountRules.ts` (reglas de nombre compartidas), `/api/account` y `/api/wallet` (sesión firmada, mismo
  origen, cuerpos acotados).
- **App:** al entrar con un proveedor, si hay cuentas en el servidor, la primera vez pide nombre y avatar y el servidor
  decide si el nombre está libre; después nombre, avatar y saldo vienen del servidor; ingresar y retirar pasan por él.
  Sin inicio de sesión todo sigue en el dispositivo, como antes. La cartera local aplica también la comisión.
- **Pruebas:** `scripts/verify-accounts.ts` (PostgreSQL: nombres únicos, una cuenta por identidad, 5 %, idempotencia,
  seis retiradas en paralelo sin descubierto, libro inmutable, supresión). De punta a punta: API con dos sesiones
  (sin sesión 401, sesión falsa 401, nombre ocupado 409, reservado 400, sin saldo 409, otro sitio 403) y navegador
  con dos móviles (cuenta existente entra directa; nueva elige nombre, 25 ₡, ingreso 10 € → 34,50 ₡, recargar
  mantiene el saldo).
- **Para activarlo en mobile-test (propietario):** `007-cuentas.sql` en Neon; `AUTH_SECRET`, `AUTH_URL` y credenciales
  de Google en Vercel (Preview); URL de retorno en Google. Guía en `docs/AUTH_PROVIDERS.md`.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`.
