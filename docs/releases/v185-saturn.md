# v185-saturn — Ronda de seguridad mínima (13-nov-2026)

Base: v184-saturn. Pedida por el propietario antes de pensar en producción.

- **Envíos de estudios con límites** (`lib/server/studioProposals.ts`): 20 al día entre todos, 200 MB de paquetes
  guardados como máximo y ningún archivo repetido. Se comprueban e insertan bajo un mismo bloqueo de transacción, así
  que varios envíos a la vez no se cuelan juntos. No se guarda nada del remitente (ni IP) para aplicarlos.
  - La app responde 429 («Hoy ya hemos recibido muchos juegos…») o 409 («Este mismo archivo ya nos llegó…»), en los
    10 idiomas.
  - Prueba nueva `scripts/verify-studio-quotas.ts` en `pnpm test:repository` (repetido, tope diario con 25 envíos en
    paralelo, tope de bytes). Probado también de punta a punta: mismo paquete dos veces → 201 y 409.
- **Cortafuegos de Vercel** (aplicado al momento, sin publicar): `/api/` 300 peticiones por minuto por IP; envíos de
  estudios 10 cada 10 minutos por IP. Copia de las reglas en `docs/security/vercel-firewall.json`.
- **Copia diaria cifrada** (`.github/workflows/db-backup.yml`, `scripts/db-backup.sh`): `pg_dump` de Neon con
  PostgreSQL 18, comprobación de que se puede leer, cifrado AES-256 con la frase del propietario y 30 días en GitHub.
  El repositorio es público, por eso se cifra. Ensayado en local: copia, descifrado y restauración en una base nueva
  con las 6 tablas y sus filas; una frase incorrecta no la abre. Empieza cuando el propietario ponga los dos secretos
  y `main` tenga este archivo.
- **Salud** (`/api/health`): versión y si la base responde (`ok`, `down`, `not-configured`), sin más datos; 503 si la
  base no contesta. `.github/workflows/health.yml` la consulta cada 3 horas y falla (correo de GitHub) si va mal.
- **Revisión de secretos:** todo el historial de git revisado; solo aparecen credenciales de prueba local.
  `pnpm audit --prod`: sin vulnerabilidades conocidas.
- **Manual de operación** para el propietario: `docs/MANUAL_OPERACION.md` (volver atrás, restaurar datos, ataques,
  claves, avisos, configuración pendiente).
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`; `/api/health` probado sin base, con base y con la base caída.
