# db/setup — histórico

Estos ficheros se pegaron a mano en el editor SQL de Neon antes de v192 (001–006 el 12 de noviembre de 2026).

Desde v192 no hace falta pegar nada: al arrancar, el servidor aplica las migraciones de `db/migrations` que falten
(`lib/server/migrations.ts`, llamado desde `instrumentation.ts`), las anota en `arena_schema_migrations` y
`/api/health` muestra la última en `schema`. Solo se aplican migraciones que añaden; borrar tablas, columnas o datos
sigue necesitando al propietario.

Para añadir una migración: crear `db/migrations/NNN-nombre.sql` (idempotente, solo añade), ejecutar
`node scripts/build-migrations.mjs` y confirmar el fichero generado `lib/server/migrationsBundle.ts`. Una migración ya
publicada no se cambia nunca: el servidor la rechaza si su contenido no coincide.
