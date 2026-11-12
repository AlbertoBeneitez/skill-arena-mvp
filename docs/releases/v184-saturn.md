# v184-saturn — Base de datos en Neon y servidores en Frankfurt (12-nov-2026)

Base: v183-saturn.

- **Base de datos:** PostgreSQL en Neon (decisión 1 del plan estratégico).
  - Proyecto `galactic-games`, AWS Europe Central 1 (Frankfurt), plan gratis, creado por el propietario desde
    Vercel › Storage, sin el inicio de sesión ni el tiempo real de Neon.
  - La integración puso `DATABASE_URL` (y variables `DATABASE_*`) en Production y Preview como sensibles. Sin ramas de
    base por cada vista previa: una sola base para la beta.
  - Tablas creadas por el propietario en el editor SQL de Neon con `db/setup/001-006-nueva-base.sql` (las seis
    migraciones juntas en una transacción; solo crean o añaden y se pueden repetir). Ensayado dos veces seguidas en una
    base vacía de PostgreSQL 16; `pnpm test:repository` pasa.
  - El editor «Query» de Vercel no sirve para esto: ejecuta una sola orden y estaba en solo lectura.
- **Región de la app:** `vercel.json` fija las funciones en `fra1`, junto a la base (antes, la región por defecto).
- **Qué se enciende:** solo la recepción de juegos de estudios, que no tiene interruptor propio. Partidas públicas
  persistentes, ranking real, autoridad de comandos y entrenamiento oculto siguen apagados por sus variables.
- **Pendiente antes de encender partidas públicas:** el código exige `sslmode=verify-full` en `DATABASE_URL` y la de
  Neon trae otro modo; se resolverá en código, sin tocar la variable.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `git diff --check`.
