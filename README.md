# GALACTIC GAMES

Plataforma web móvil (PWA) de minijuegos de habilidad 1 contra 1, pensada para competir en partidas cortas con resultados verificables.

**Estado: entrenamiento con saldo ficticio.** No hay autenticación real, ni cartera, ni pagos, ni KYC, ni dinero real. Google y Apple se muestran como «próximamente» sin simular el acceso. Antes de activar cualquier competición con dinero hacen falta identidad de producción, PostgreSQL alojado, liquidación en servidor y revisión jurídica (ver `docs/PRODUCTION_ARCHITECTURE_REVIEW.md` y `docs/SECURITY_REVIEW_V98.md`).

## Catálogo

23 juegos activos en `lib/games.ts`:

- **21 verificados por replay en servidor** (`server-replay`): el navegador envía solo los inputs ordenados y el servidor repite la partida con un núcleo determinista y versionado.
- **2 integrados con resultado en el cliente** (`client-result`): Solitaire Sprint y Mine Grid. Son solo entrenamiento; su tablero de partida es fijo hasta configurar la base de datos (ver abajo) y no deben usarse en competición.

Memory Match está retirado del catálogo; sus núcleos se conservan para reproducir registros históricos.

## Arquitectura

- Registro tipado único: `lib/games.ts`. Carga bajo demanda: `components/GameLoader.tsx`.
- Núcleos puros y versionados: `lib/verified/*Core.v*.ts`. Una vez publicada, una versión competitiva es inmutable; cualquier cambio de física, puntuación o generación crea una versión nueva.
- Contrato competitivo: `gameId + gameVersion + scenarioId + seed` → inputs ordenados → núcleo determinista → replay → verificación en servidor → resultado autoritativo.
- Verificación en servidor: `lib/server/verifiedMatch.ts` y `lib/server/gameVerifiers.ts`. Persistencia PostgreSQL por interfaces en `lib/server/`, con migraciones explícitas en `db/migrations/`.

Especificación: `docs/GAME_ARCHITECTURE.md`. Ciclo de calidad por juego: `docs/GAME_PROFESSIONALIZATION_CYCLE.md`. Decisiones: `docs/adr/`. Reglas para agentes de código: `AGENTS.md`.

## Desarrollo

Requisitos: Node ≥ 22.13 y pnpm 12.7.0.

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## Comprobaciones

| Comando | Qué hace |
| --- | --- |
| `pnpm lint` | Comprobación de tipos (`tsc --noEmit`). No es un linter de reglas. |
| `pnpm test:determinism` | Núcleos, replays, ficheros de referencia, entradas inválidas y puertas de producción. Unos 5–6 minutos. |
| `pnpm test:repository` | Adaptadores PostgreSQL. Requiere `TEST_DATABASE_URL` apuntando a una base de pruebas. |
| `pnpm build` | Compilación de producción. |
| `node scripts/qa-smoke-all.cjs` | Abre los 23 juegos en móvil (390×844) contra un servidor de producción en marcha (`BASE_URL`, Playwright en `NODE_PATH`) y falla ante errores de consola, violaciones de CSP, desbordes o almacenamiento bloqueado. La CI lo ejecuta en el trabajo `mobile-smoke`. |
| `pnpm check` | `lint` + `test:determinism`. |

La CI (`.github/workflows/build-v4.yml`) ejecuta todo lo anterior sobre PostgreSQL 17, en cada `push` a las ramas de trabajo y en pull requests. `codeql.yml` añade análisis estático de seguridad y `dependabot.yml` propone actualizaciones.

## Configuración y despliegue

Las variables se definen en el proveedor de alojamiento (en Vercel: Project → Settings → Environment Variables, para los entornos *Production* y *Preview*). Nunca se escriben en el repositorio ni en el chat. `.env.example` lista sus nombres.

| Variable | Para qué sirve |
| --- | --- |
| `MATCH_SIGNING_SECRET` | **Obligatoria en producción.** Clave con la que se firman los tickets de partida; al menos 32 caracteres aleatorios (por ejemplo `openssl rand -hex 32`). Sin ella, o si es demasiado corta, los endpoints responden 503 en lugar de usar la clave pública de entrenamiento. |
| `NEXT_PUBLIC_SITE_URL` | Opcional. URL pública para la imagen al compartir, `robots.txt` y `sitemap.xml`. |
| `ALLOW_LEGACY_STATELESS_TRAINING` | `1` mantiene en producción el entrenamiento sin base de datos, que no guarda las partidas y acepta repetir un mismo registro. Sin esta variable ni PostgreSQL, las partidas verificadas no pueden empezar en producción. |
| `DATABASE_URL` | PostgreSQL. Fuera de localhost exige `?sslmode=verify-full`. |
| `ALLOW_PERSISTED_MATCH_TRAINING` | `1` activa las partidas duraderas con PostgreSQL (migraciones `001` y `003`). |
| `ALLOW_PERSISTED_HIDDEN_TRAINING` | `1` activa la autoridad privada de Mine Grid con tableros distintos en cada intento (migraciones `001` y `002`). |
| `RANKING_READ_MODEL_READY`, `COMMAND_AUTHORITY_READY` | Interruptores de puertos preparados; no se activan solo con `DATABASE_URL`. |
| `ALLOW_LOCAL_HIDDEN_GAMES` | Solo QA local de juegos de información oculta; se ignora en Vercel. |
| `ALLOW_DEMO_SIGNING_KEY` | Solo para probar una build de producción en un equipo propio con la clave pública; nunca en Vercel. |

Las migraciones SQL se aplican **a mano** (por ejemplo con `psql`) y nunca durante el arranque o la compilación.

## Enlaces de prueba

- `?fresh=1`: fuerza el flujo de bienvenida y avatar aunque ya exista una cuenta local. Conserva saldo, historial y grupo.
- `?reset=1`: elimina los datos locales de GALACTIC GAMES en ese navegador y simula una instalación nueva.

La consulta se conserva al cambiar de pantalla, así que al recargar el mismo enlace el modo de prueba se vuelve a aplicar.

## Licencias y terceros

Ver `THIRD_PARTY_NOTICES.md` (por ejemplo, la mecánica de Tower Drop se inspira en `iamkun/tower_game`, MIT; no se reutilizan sus recursos). El repositorio aún no declara una licencia propia; mientras el propietario no elija una, rige el copyright por defecto del autor.

Notas históricas de versiones antiguas: `docs/releases/early-readme-notes-v12-v14.md`.
