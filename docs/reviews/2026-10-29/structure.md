# Revisión de estructura y determinismo — Galactic Games

Checkout revisado: `/home/claude/skill-arena-mvp`, rama `mobile-test`, HEAD `e15e17d` (solo lectura).
Método: grafo de imports construido con un script propio (479 ficheros TS/JS, 0 imports sin resolver), Tarjan SCC para ciclos, cierre transitivo desde `app/`, inspección del build `.next/` existente, grep dirigido en cores y **replay de golden fixtures bajo JavaScriptCore (bun 1.4.4)** sobre copias en el scratchpad. Scripts y datos en `/tmp/claude-0/-home-claude/5b58732f-982f-5ffa-9ef3-721020a88a3c/scratchpad/review-structure/`.

---

## (a) Resumen

Los cores habilitados son sólidos: todo es aritmética entera/punto fijo (`integerMath`, xorshift32 con `Math.imul`, seno racional `sinPhaseMilli`), no hay `Date.now`/`Math.random`/DOM en ningún `*Core*`, y sus 10 golden fixtures (más 20 históricos) dan el mismo score y hash de estado en JavaScriptCore que en V8. El problema estructural principal es que la autoridad de partida (`lib/server`, `app/api`) depende en valor del registro de UI `lib/games.ts`, que a su vez importa los 15 componentes React de juego, y que no hay ninguna barrera automática (CI multi-motor, lint de capas, lint de matemáticas) que impida regresiones de determinismo o de capas. La proliferación de versiones (113 ficheros en `lib/verified`, 70 adaptadores, ~190 scripts/fixtures por versión) y la dispersión por juego (Pinball: ~49 ficheros en 6 carpetas más 7 ficheros compartidos) son el mayor coste de mantenimiento, y se pueden reducir sin cambiar comportamiento competitivo; la poda de versiones antiguas sí requiere decisión del propietario.

---

## (b) Hallazgos

| id | sev | hallazgo | evidencia | fix concreto | esfuerzo | cambia comportamiento competitivo |
|---|---|---|---|---|---|---|
| E1 | P1 | La capa de autoridad (3) importa en valor el registro de UI (1). `lib/games.ts` contiene 15 `import("@/components/games/*")` y el servidor lo usa para decidir versión por defecto, `enabled` y acciones permitidas. | `lib/server/gameVerifiers.ts:63` (`getGameDefinition`, valor), `lib/server/publicMatchService.ts:55-56`, `app/api/verified-match/start/route.ts:3`; `lib/games.ts:105-339` (15 dynamic imports). En el build: 15 chunks de servidor con `registerClientReference` de componentes (`.next/server/chunks/_02oh7ekc4y5qy._.js` → `CornerSudoku.tsx`) en la traza de `api/verified-match/verify`. | Partir `lib/games.ts` en (i) `lib/catalog/gameManifest.ts` sin React ni componentes (id, versión actual, competencia, resultMetric, enabled) y (ii) `components/gameViews.ts` con el mapa `id → loadComponent`. El servidor solo importa (i). | S–M | No |
| E2 | P1 | No hay barrera de determinismo multi-motor. CI solo ejecuta V8 (Node 22; el PR #10 añade Node 24, también V8). Los navegadores iOS usan JavaScriptCore y Firefox SpiderMonkey, y nada prueba los cores en esos motores. La regla "seno entero para cores nuevos" solo existe como comentario. | `.github/workflows/*.yml` (`node-version: 22`); `lib/deterministic/integerMath.ts` (comentario de `sinPhaseMilli`); `docs/GAME_ARCHITECTURE.md:80-83` solo prohíbe `Math.random`. Mi replay en bun (JSC): 10/10 fixtures habilitados y 20/20 históricos OK, así que **hoy no hay divergencia**. | (1) Job de CI con `bun` que reproduzca todos los `scripts/fixtures/*.json` (mi `golden.mjs`/`golden2.mjs` sirve de base, unos 40 líneas). (2) Script `scripts/check-core-purity.mjs` que falle si `lib/verified/*Core*.ts` o `*Physics*.ts` usan `Math.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot)`, `**` con exponente no literal, literales float, `Date`, `performance`, `Math.random`, `window`, `document`, `fetch` o imports de `react`/`next`/`components`/`lib/server`. Opcional: un replay en Playwright WebKit/Firefox. | S | No |
| E3 | P1 | La divergencia cliente/servidor sería silenciosa. El HUD muestra la simulación local durante la partida y al terminal se sustituye por el resultado del servidor; el servidor ignora el score del cliente y no recibe ningún hash de estado. Si un motor divergiera, el jugador vería un resultado (p. ej. la bola en el 17) y se registraría otro, sin telemetría que lo detecte. | `components/games/CoreCanvasGame.tsx:287` (HUD local), `:303-306` (resultado = servidor); `lib/server/verifiedMatch.ts:491` (`client_score_ignored: true`); ningún `client_state_hash` en `lib/`/`app/`. | Campo opcional y no autoritativo `client_terminal_hash = sha256(canonicalJson(state))` en el registro terminal. El servidor lo compara con su replay y emite métrica/alerta `CLIENT_REPLAY_DIVERGENCE` sin alterar el resultado. Añadir un mensaje de UI si difieren. | M | No (protocolo aditivo; el resultado autoritativo no cambia) |
| E4 | P2 | Matemáticas trascendentales en cores **archivados** (no en los habilitados): `Math.hypot` ×7 y `Math.atan2` ×1. En V8 y JSC los valores crudos difieren (verificado), pero las decisiones resultantes coinciden en los dominios probados. | §(d). Hash de `Math.hypot` crudo en una rejilla 331×341: V8 `94a9…` frente a JSC `fe45…`; `atan2` crudo `e700…` frente a `ba0d…`. Decisiones `hypot>=gap`, aim cuantizado y salidas de `galleryTrialsV3..V10` (3000 semillas cada uno) y `buildBilliardsArenaV4` (20 000 semillas) idénticas. | No tocar los cores congelados. Documentar el riesgo y, si se conservan para replay, añadir esos generadores al job JSC de E2. | S | No |
| E5 | P2 | `2 ** n` en el scoring de Orb V6/V7. ECMAScript permite aproximar `**` según implementación; con resultados enteros pequeños todos los motores dan exacto (verificado en V8 y JSC). | `lib/verified/orbBurstCore.v6.ts:207`, `orbBurstCore.v7.ts:212` | En versiones nuevas usar tabla o `1 << n` (n ≤ 30). No tocar V6/V7. | S | Solo en una versión nueva |
| E6 | P2 | Hay código cliente dentro de la capa 4 (`lib/verified`): hooks React, `window`, `document`, `fetch`, `Date.now`, `setTimeout`, `crypto.randomUUID`. También gestos de entrada en float, que son solo cliente pero tienen nombre de core versionado. | `lib/verified/useVerifiedAttempt.ts:4,75,229,344-361`; `useHiddenAttempt.ts:2,49,90`; `attemptTransport.ts:6,23,26,46`; `dartsGesture.v2/v3/v4.ts` (float; el servidor recibe acciones `AIM_*` cuantizadas). | Mover a `lib/client/attempt/` y `games/darts/input/`, dejando un re-export temporal en la ruta antigua. Ningún core importa estos ficheros (verificado). | S | No |
| E7 | P2 | Ciclos de imports: **ninguno en valor**. En tipos hay tres SCC: 48 ficheros vía `GameId` (cores → `lib/games.ts` → componentes → cores), i18n `index` ↔ 9 locales, y `gameVerifiers` ↔ `coreAdapter`. | `lib/verified/coreRuntime.v1.ts:2` y `contracts.ts:1` (`import type { GameId } from "../games"`); `lib/i18n/messages/*.ts:1`; `lib/server/coreAdapter.ts:2`. | `lib/gameIds.ts` hoja (union literal de ids) importada por cores y registro; tipo `VerifiedGameAdapter` en `lib/server/adapterTypes.ts`; tipo `Messages` en `lib/i18n/types.ts`. | S | No |
| E8 | P2 | Proliferación de versiones: 113 ficheros y 24 199 líneas en `lib/verified`; 70 adaptadores; 89 `verify-*`, 39 `gen-*`, 43 `*-play-fixture`, 62 fixtures. CI tarda unos 5,5 min solo en determinismo. | §(e); comentario en el workflow ("~5.5 min"). | Corte pre-lanzamiento: conservar solo la versión habilitada y sus dependencias, y archivar el resto en un tag/rama (como ya se hizo con `archive/pre-saturn`). Requiere aprobación del propietario: AGENTS.md lista la "replay incompatibility" como motivo de parada. | M | **Sí, solo para replays históricos** (los manifiestos de versiones retiradas dejan de verificarse); la versión actual no cambia |
| E9 | P2 | Un juego está repartido en muchas carpetas y tiene nombres inconsistentes. Shot Gallery usa id `reaction-test`, nombre "Shot Gallery", ficheros `shotGallery*` y `gallery-*`, y portadas `reaction-test.svg` (sin uso) y `shot-gallery.*`. | §(f.1) | "Un juego = una carpeta" con migración por shims (§f). Conservar el id persistido `reaction-test` y renombrar solo carpetas. | M–L | No |
| E10 | P2 | `gameVerifiers.ts` se mantiene a mano: 63 imports y 70 entradas `adapterKey(...)`, una línea por versión. Es el punto de fricción de cada versión nueva. | `lib/server/gameVerifiers.ts:1-89, 261-335`. Por juego: ruleta 11, shot gallery 11, pinball 8, orb 7, billar 5, sudoku 4, stack-shift 4, dardos 3, slot 3, tower 3+1 manual, stack 2+2 manuales, memoria 2, mina 2, bowling 2. | Cada juego exporta `CORES: readonly GameCore[]` (`games/<id>/core/index.ts`). El registro hace `for (const c of ALL_CORES) map[key(c)] = coreAdapter(c)` y conserva los 3 adaptadores manuales (`tower-drop@2.1.0`, `precision-stack@1/2`). El mapa resultante es idéntico; un test debe comprobar las mismas 70 claves. | S | No |
| E11 | P2 | Andamiaje de tests copiado por versión: los `gen-*` miden 14 líneas de media con los mismos 3-4 imports (39/39 `writeFileSync`, 38/39 `sha256(canonicalJson)`); hay 3 formatos de fixture distintos (`{seed,inputs,…}`, `{gameVersion,runs[]}`, `{win,lose}`); cada versión nueva exige tocar a mano `tsconfig.determinism.json` (~200 entradas) y `run-determinism.mjs`. | `scripts/gen-*.ts`; `scripts/fixtures/*.json`; `tsconfig.determinism.json`; `scripts/run-determinism.mjs`. Hoy todos los `verify-*.ts` se compilan y se ejecutan (verificado, ninguno huérfano). `verifyCoreFixture` ya existe y lo usan 62 de los 89 `verify-*`. | Un único `scripts/gen-fixture.ts <game> <version>` que lea `games/<id>/tests/play.ts`. Formato `runs[]` para versiones nuevas, sin reescribir los fixtures existentes. Un glob en tsconfig (`games/*/tests/*.ts`) y descubrimiento automático en `run-determinism`. | M | No |
| E12 | P2 | El registro mezcla dominios: técnico, carga de UI, copy de catálogo en español (duplicado en i18n), economía, rivales simulados y semillas legacy. `scoring`, `instruction` y `difficulty` no los lee nadie. | `lib/games.ts:53-78, 105-354`. Ningún consumidor de `game.scoring`, `game.instruction` ni `game.difficulty` (los componentes pasan `instruction` desde i18n o como literal). `name`, `tagline` y `skillLabel` se duplican como `gameMeta.<id>.*` en 10 locales (`lib/i18n/messages/es.ts:427-464`). `STAKES`, `modeForStake` y `prizeForStake` con float `toFixed` están en `lib/games.ts:16,402-420`. | Manifest tipado por juego (§E12-propuesta más abajo). El copy pasa a i18n y la economía/rivales a la capa de plataforma. | S–M | No |
| E13 | P2 | La versión y el contrato están duplicados entre registro y core, con comprobación de deriva en tiempo de import: si no cuadran, el módulo lanza y todas las rutas que lo importan caen. Además hay un import muerto y alias engañosos. | `lib/server/gameVerifiers.ts:337-372` (`throw` al cargar); `lib/games.ts:2` (`ROULETTE_ACTIONS` importado y no usado), `:1` (`ROULETTE_ACTIONS_V8 as ROULETTE_ACTIONS_V3`), `:6` (`SHOT_GALLERY_ACTIONS_V3 as SHOT_GALLERY_ACTIONS`), `:8` (acciones de billar importadas del core, no del protocolo). | El manifest toma `version`, `inputVersion` y `actions` del objeto core actual (una sola fuente). La comprobación pasa a un test, no al import. | S | No (los valores actuales son iguales) |
| E14 | P2 | Hay código y activos sin uso fuera del alcance del PR #10. El PR #10 elimina 16 módulos de UI; coincide en número con los 16 que detecté sin referencias desde `app/` (`RunnerGame.tsx`, 14 `components/games/*`, `precision-stack/presentation.ts`), aunque no revisé el contenido del PR. | `lib/verified/towerDropCore.v1.ts` (293 líneas, ninguna referencia ni en `gameVerifiers` ni en tests). `lib/dartsPresentation.v3.ts` y `lib/galleryPresentation.ts` solo aparecen en `tsconfig.determinism.json` y `qa-gallery-touch.cjs`. 25 `.svg` de `public/covers` sin referencias en runtime: son fuente de `rasterize-covers.cjs` y 11 pertenecen a juegos retirados. | Borrar `towerDropCore.v1.ts`. Mover los `.svg` fuente a `games/<id>/assets/` o `design/covers/` (no se sirven). | S | No |
| E15 | P2 | La UI de economía usa dinero en float. El servidor ya usa enteros (`stake_minor`), así que no afecta a la autoridad, pero el patrón no debe pasar al ledger. | `lib/games.ts:419`, `lib/groupPlay.ts:159` (`Number((x).toFixed(2))`); `lib/server/publicMatchService.ts:36-43` (entero). | Unidades menores enteras en la capa de plataforma (wallet/ledger). | S | No |
| E16 | P2 | El core de Mina depende de `node:crypto` (`privateHashRng.server.ts`). Es correcto para información oculta y solo lo importa el servidor, pero el sufijo `.server` es una convención sin guardia. | `lib/deterministic/privateHashRng.server.ts:1`; `lib/verified/mineGridCore.v1.ts` → importado solo por `lib/server/*` y `scripts/*` (verificado). | `import "server-only"` en `privateHashRng.server.ts` y `mineGridCore.v1.ts`, o la regla del check de E2. | S | No |

Notas de determinismo que **no** son hallazgos (verificadas):
- `sort`: todos los comparadores de cores son numéricos y totales (desempate fila/col en `orbBurstCore.v1.ts:191-197`; `billiardsCore.v5.ts:104` por id único). Además `Array.prototype.sort` es estable desde ES2019.
- No hay `for…in`, `Object.keys/entries/values` ni `toFixed`/`toPrecision`/`localeCompare`/`Intl` en ningún core. `Map`/`Set` iteran en orden de inserción por especificación. `canonical.ts:9` ordena claves con `sort()` por defecto (orden de unidades UTF-16, determinista).
- Las divisiones `/` de los cores siempre van envueltas en `Math.floor`/`Math.trunc`/`roundDiv` sobre enteros seguros. IEEE754 redondea `+ - * /` correctamente, así que es igual en todos los motores. `replayCore` usa `Math.round(tick*1000/tickRate)` (`coreRuntime.v1.ts:103`), que también es seguro.
- `createRng().nextInt(max)` hace `floor((u32/2^32)*max)`: es exacto mientras `max < 2^21`, y todos los usos observados son pequeños.
- Ranking SQL: `ORDER BY net_profit_minor::bigint DESC, player_id COLLATE "C"` (`postgresRankingRepository.ts:120`), un orden total y determinista.

---

## (c) Violaciones de capas (lista completa del grafo)

Capas usadas: 1 = `app/` (no api) y `components/`; 3 = `lib/server/`, `app/api/`, `db/`; 4 = `lib/verified/`, `lib/deterministic/`. `lib/games.ts` y `lib/publicMatch.ts` no tienen capa (ahí está el problema).

**Capa 4 → framework, navegador o I/O** (ningún `*Core*` afectado):
- `lib/verified/useVerifiedAttempt.ts:4` `react`; `:75` `crypto.randomUUID`; `:207-229` `setTimeout`/`fetch`; `:260` `fetch`; `:344-361` `document`/`window`.
- `lib/verified/useHiddenAttempt.ts:2` `react`; `:49,95,106,124` `fetch`; `:90` `crypto.randomUUID`.
- `lib/verified/attemptTransport.ts:6,26` `fetch`; `:23,36,39` `Date.now`; `:46` `setTimeout`.
- `lib/deterministic/privateHashRng.server.ts:1` `node:crypto` (intencionado, solo servidor).

**Capa 4 → fuera de la capa 4:**
- `lib/verified/coreRuntime.v1.ts:2` → `lib/games.ts` (type).
- `lib/verified/contracts.ts:1` → `lib/games.ts` (type); `:96` → `lib/publicMatch.ts` (type inline).
- `lib/verified/useVerifiedAttempt.ts:3` → `lib/publicMatch.ts` (valor); `:5` → `lib/games.ts` (type).

**Capa 3 → capa 1 (transitivo vía `lib/games.ts`):**
- `lib/server/gameVerifiers.ts:63` → `lib/games.ts` (valor) → 15 `components/games/*.tsx`.
- `lib/server/publicMatchService.ts` → `lib/games.ts` (valor).
- `app/api/verified-match/start/route.ts:3` → `lib/games.ts` (valor).
- `lib/server/verifiedMatch.ts:6` y `privateMatchIssuer.ts` → `lib/games.ts` (type, inocuo).
- Capa 3 → capa 4 inversa vía registro: `lib/games.ts:1-12` importa 12 ficheros de protocolo y core solo para obtener `allowedActions`.

**Capa 1 → capa 3:** ninguna (`components/` y `app/` no-api no importan `lib/server`).

**Patrones prohibidos dentro de `lib/verified/*Core*.ts`, `*Physics*.ts`, `lib/deterministic/*`:** 0 `Date.now`, 0 `performance.now`, 0 `Math.random`, 0 `window`/`document`, 0 `fetch`, 0 imports de `react`/`next`/`components`/`lib/server`. La coincidencia de `window` en `dartsGesture.v3/v4.ts` es una clave de objeto, no el global.

**Ciclos:** 0 en valor. En tipos: SCC de 48 ficheros (`lib/games.ts` ↔ componentes ↔ cores vía `GameId`), SCC i18n (10 ficheros), `gameVerifiers.ts` ↔ `coreAdapter.ts`.

**Scripts:** `verify-attempt-records.ts`, `verify-leagues.ts`, `verify-memory-v2.ts` y `verify-public-attempts.ts` importan `lib/games.ts` en valor, y por tanto el árbol de componentes se compila en `.det-test/components/` (19 ficheros). Esto se resuelve igual que E1.

---

## (d) Inventario de matemáticas trascendentales por core

Recuento de `Math.*` en `lib/verified` + `lib/deterministic`: max 189, floor 160, min 136, abs 70, trunc 42, round 28, sign 18, **hypot 7**, ceil 3, **PI 3**, imul 1, **atan2 1**. No hay ningún sin, cos, tan, exp, log, pow, sqrt ni cbrt.

| core | habilitado | llamadas | sitio | uso | impacto V8 vs JSC |
|---|---|---|---|---|---|
| shotGalleryCore.v3 | no | hypot ×1 | `:77` | separación mínima entre dianas (generación) | crudo distinto; decisión `>=64/50` idéntica; 3000 semillas idénticas |
| shotGalleryCore.v4 | no | hypot ×1 | `:80` | igual | idéntica |
| shotGalleryCore.v5 | no | hypot ×1 | `:80` | igual | idéntica |
| shotGalleryCore.v6 | no | hypot ×1 | `:80` | igual | idéntica |
| shotGalleryCore.v7 | no | hypot ×1 | `:81` | igual | idéntica |
| shotGalleryCore.v9 | no | hypot ×1 | `:70` | igual | idéntica |
| shotGalleryCore.v10 | no | hypot ×1 | `:77` | igual (gap 70/58) | idéntica |
| billiardsCore.v4 | no | atan2 ×1, PI ×3 | `:54,57` | aim inicial `Math.round(angle*180/2π)` | crudo distinto; aim cuantizado idéntico en 20 000 semillas. Riesgo residual: un ángulo justo en un borde `.5` |
| orbBurstCore.v6 / v7 | **v7 sí** | `2 **` ×1 cada uno | `:207` / `:212` | bonus de caída | exacto (potencia de 2 entera); verificado en ambos motores |
| shotGalleryCore.v11, pinball v8, ruleta v11, billar v5, bowling v2, dardos v3, orb v7, stack-shift v4, sudoku v4, memoria v2, slot v3, tower v5, stack v4 | sí | 0 trascendentales | — | punto fijo entero, `integerSqrt`, `roundDiv`, `sinPhaseMilli` (27 cores lo usan) | — |

`**2` sobre enteros (~25 cores) es exacto mientras el resultado sea < 2^53; las magnitudes vistas son ≤ ~10^11.

Floats en cores: `index * 0.6` / `0.45` en `shotGalleryCore.v3..v7` (`:61-65`) dentro de `Math.floor`, multiplicación IEEE exacta en todos los motores. `dartsGesture.v4.ts` usa float pero es solo entrada cliente: produce acciones enteras `0..60` que el servidor valida.

**Enfoque existente:** `lib/deterministic/integerMath.ts` (`roundDiv`, `integerSqrt` Newton entero con `isSafeInteger`, `sinPhaseMilli` aproximación racional de Bhaskara con fase 0..4095) y `seeded.ts` (FNV-1a + xorshift32). Los cores habilitados se apoyan ahí. Lo que falta es convertirlo en regla verificable (E2).

**Replay multi-motor (JSC, bun 1.4.4):**
- Enabled: `roulette-v11` 1/1, `pinball-v8` 3/3, `gallery-v11` 1/1, `bowling-v2` 3/3, `billiards-v5` 2/2, `orb-v7` 2/2, `stack-shift-v4` 1/1, `corner-sudoku-v4` 3/3, `darts-v3` 1/1, `memory-v2` 2/2. Todos con el mismo score y el mismo `sha256(canonicalJson(state))` que el golden generado en V8.
- Históricos: `billiards-v4`, `gallery-v3..v10`, `roulette-v6..v10`, `pinball-v2..v7`, 20/20 OK.
- No probados: slot v3, tower v5, precision-stack v4 y mine v2 (formatos de fixture distintos), y SpiderMonkey (no disponible).

**Consecuencia de un mismatch:** el servidor es autoritativo y el cliente pinta su propia simulación. Una divergencia mostraría al jugador un desenlace (bola, diana, bolos) distinto del que el servidor registra y liquida. Hoy nadie la detectaría (E3). Para dinero real sería una disputa sin evidencia del lado cliente.

---

## (e) Estimación de archivo de versiones

"Keep" = cierre transitivo desde `app/` (excluyendo la arista de `gameVerifiers.ts`) más la infraestructura compartida. Versión habilitada según `lib/games.ts`, confirmada contra `gameVersion` del core.

| juego (id) | versiones en repo | habilitada | se quedan (deps) | archivables (core/protocolo) | líneas archivables | adaptadores en `gameVerifiers` |
|---|---|---|---|---|---|---|
| galactic-roulette | core v1–v11, proto v1,v2,v3,v6,v7,v8 | 11.0.0 | core v1 (constantes), v11; proto v1,v2,v3,v6,v8 | core v2–v10; proto v7 | 3 411 | 11 |
| reaction-test (Shot Gallery) | core v1–v11, proto v1–v3 | 11.0.0 | v11, proto v3 | core v1–v10; proto v1,v2 | 2 289 | 11 |
| pinball | core v1–v8, proto v1–v3 | 8.0.0 | v8, proto v3 | core v1–v7; proto v1,v2 | 3 767 | 8 |
| orb-burst | core v1–v7, proto v1,v3,v4,v5,v6 | 7.0.0 | v1, v7; proto v1,v3,v6 | core v2–v6; proto v4,v5 | 2 704 | 7 |
| billiards | core v1–v5, proto v1 | 5.0.0 | v1,v2,v3,v5 | v4 | 89 | 5 |
| stack-shift | core v1–v4, proto v1 | 4.0.0 | v4 | v1–v3 | 938 | 4 |
| corner-sudoku | core v1–v4, proto v1–v3 | 4.0.0 | v3, v4; proto v1,v3 | v1, v2; proto v2 | 457 | 4 |
| precision-stack | core v1–v4 | 4.0.0 | v2, v4 | v1, v3 | 603 | 2 + 2 manuales |
| tower-drop | core v1–v5 + physics v5 | 5.0.0 | v2, v3, v5, physics | v1 (sin referencias), v4 | 380 | 3 + 1 manual (2.1.0) |
| darts | core v1–v3, gesture v2–v4, proto v1 | 3.0.0 | v1, v3, gesture v4 | core v2, gesture v2, v3 | 60 | 3 |
| galactic-slot | v1–v3 | 3.0.0 | v1, v3 | v2 | 26 | 3 |
| bowling | v1, v2 | 2.0.0 | v2 | v1 | 317 | 2 |
| memory-match | v1, v2 | 2.0.0 (`enabled:false`) | v1, v2 | — | 0 | 2 |
| mine-grid | v1, v2 | registro 0.2.0 client-result; training 2.0.0 | v1, v2 | — | 0 | 2 |
| (solitaire) | `solitaireSetup.v1.server.ts` | — | — | solo lo usan tests | 53 | — |

**Totales `lib/verified`:** 55 de 113 ficheros archivables, **15 094 de 24 199 líneas (62 %)**. `gameVerifiers.ts` pasaría de 70 a unos 16 adaptadores (13 actuales más los auxiliares que siguen como dependencia).

**Scripts y fixtures ligados por nombre a versiones no habilitadas:** 164 ficheros y unas **28 219 líneas**, incluidos JSON. Por juego: shot gallery 35, pinball 28, ruleta 26, orb 21, billar 12, sudoku 12, stack-shift 11, bowling 4, y 3 cada uno memoria, mina, dardos y slot. Quedan 42 ficheros y 3 808 líneas para las versiones actuales.

**Antes de borrar tests antiguos hay que portar:**
- `verify-roulette-v1/v2/v4/v5`, `verify-slot-v1` y `verify-gallery-v2` prueban el pipeline real `lib/server/verifiedMatch.ts`.
- `verify-roulette-v5` prueba `lib/rouletteLaunchGesture.ts`, que `GalacticRoulette.tsx:14-18` usa hoy.
- `verify-roulette-v2` prueba `rouletteTossGesture.ts`, que solo usan tests y también es candidato a archivo.
- `verify-attempt-records.ts:72-78` usa pares `["galactic-roulette","1.0.0"]` y `["reaction-test","1.0.0"]`.

**Qué debe quedarse si existen registros persistidos de entrenamiento:**
- Las tablas `arena_matches.manifest` (jsonb con `game_version`, inmutable por trigger, `db/migrations/001-matches.sql`), las de public attempts (`game_id, game_version`, `003-public-attempts.sql:22`) y las de command attempts (Mina 2.0.0, `persistedHiddenTraining.ts:46`) requieren que exista el adaptador de esa versión.
- Si alguna base PostgreSQL (preview o local con `ALLOW_PERSISTED_HIDDEN_TRAINING=1`) tiene filas, hay que inventariar `SELECT DISTINCT manifest->>'game_id', manifest->>'game_version'` y conservar esas versiones. La alternativa es marcarlas explícitamente como "no reverificables" antes de podar.
- Mina v1/v2 y Memoria v1/v2 se quedan siempre (v2 depende de v1).
- `SCENARIO_CATALOG_V1` no se ve afectado.
- Recomendación: un tag `archive/pre-launch-cores` y una entrada en ADR002 con la fecha de corte.

---

## (f) Árbol objetivo y orden de migración

### f.1 Dispersión actual (3 juegos representativos)

**Pinball:**
- `lib/verified/`: `pinballCore.v1–v8.ts` y `pinballProtocol.v1–v3.ts`, 11 ficheros.
- `components/games/PinballVerified.tsx` (899 líneas).
- `scripts/` (32 ficheros, 1 477 líneas): `verify-pinball-v1..v8.ts`, `gen-pinball-fixture.ts`, `gen-pinball-v2..v8-fixture.ts`, `pinball-play-fixture.ts`, `pinball-v2..v8-play-fixture.ts` y `fixtures/pinball-v1..v8.json`.
- `public/covers/pinball.svg` (fuente) y `pinball.webp`.
- Docs: no hay doc propio; solo aparece en `docs/releases/v103..v119-saturn.md` y `PRODUCT_BACKLOG.md`.
- Entradas en ficheros compartidos:
  - `lib/games.ts:295-314`
  - `lib/server/gameVerifiers.ts` (16 líneas)
  - `lib/leagues.ts:42`
  - `lib/i18n/messages/*.ts` (~30 claves × 10 locales)
  - `app/globals.css` (9 reglas, p. ej. `:6437-6438`)
  - `tsconfig.determinism.json` (24 entradas)
  - `scripts/run-determinism.mjs` (8)
  - `scripts/generate-covers.py`, `rasterize-covers.cjs`, `qa-smoke-all.cjs`

**Galactic Roulette:**
- `lib/verified/`: `galacticRouletteCore.v1–v11.ts` y `galacticRouletteProtocol.v1,v2,v3,v6,v7,v8.ts`, 17 ficheros.
- `lib/rouletteGesture.ts`, `rouletteLaunchGesture.ts` y `rouletteTossGesture.ts` (este último solo en tests).
- `components/games/GalacticRoulette.tsx` (533 líneas).
- `scripts/` (33 ficheros, 4 212 líneas):
  - `verify-roulette-v1,v2,v4..v11.ts`, `verify-roulette-gesture.ts`, `verify-roulette-presentation.cjs`
  - `gen-roulette-v6..v11-fixture.ts`
  - `roulette-play-fixture.ts`, `roulette-v2-play-fixture.ts`
  - `qa-roulette-drag.cjs`, `qa-roulette-touch.cjs`
  - `fixtures/roulette-v1..v11.json`
- `public/covers/galactic-roulette.svg` y `.webp`.
- Docs: `GALACTIC_ROULETTE_V1.md`, `GALACTIC_ROULETTE_V2.md` y menciones en unas 25 release notes.
- Ficheros compartidos:
  - `lib/games.ts:105`
  - `gameVerifiers.ts` (22 líneas)
  - `app/globals.css` (43 reglas, `:6229-6273, :6458`)
  - i18n (~19 claves × 10)
  - `components/DemoApp.tsx:970`
  - `scripts/qa-casino-lifecycle.cjs`, `verify-attempt-records.ts:72`
  - `tsconfig.determinism.json` (21), `run-determinism.mjs` (12)

**Shot Gallery (id `reaction-test`):**
- `lib/verified/`: `shotGalleryCore.v1–v11.ts` y `shotGalleryProtocol.v1–v3.ts`, 14 ficheros.
- `lib/galleryPresentation.ts` (sin uso en la app).
- `components/games/ShotGallery.tsx` (313 líneas).
- `scripts/` (41 ficheros, 3 042 líneas):
  - `verify-gallery-v1..v11.ts`, `verify-gallery-presentation.cjs`
  - `gen-gallery-v4..v11-fixture.ts`
  - `gallery-v3..v11-play-fixture.ts`
  - `qa-gallery-touch.cjs`
  - `fixtures/gallery-v1..v11.json`
- `public/covers/shot-gallery.svg`, `.webp` y `reaction-test.svg` (sin uso).
- Docs: `SHOT_GALLERY_V1.md`, `SHOT_GALLERY_V2.md`.
- Ficheros compartidos:
  - `lib/games.ts:273-293`
  - `lib/leagues.ts:41`
  - `lib/gameFeedback.ts:181`
  - `gameVerifiers.ts` (22 líneas)
  - i18n (~16 claves × 10)
  - `tsconfig.determinism.json` (29), `run-determinism.mjs` (12)

### f.2 Árbol propuesto

```
games/
  _shared/                     # capa 4 común (antes lib/deterministic + runtime)
    deterministic/{seeded,integerMath,privateHashRng.server}.ts
    runtime/{coreRuntime.v1,inputValidation,canonical}.ts
  pinball/
    manifest.ts                # GameManifest tipado (server-safe, sin React)
    core/
      v8.ts  protocol.v3.ts    # versión actual (contenido byte a byte idéntico)
      index.ts                 # export const CORES = [V8] (+archivo si se conserva)
      archive/v1..v7.ts        # solo si el propietario decide conservar replays
    view/
      PinballView.tsx          # antes components/games/PinballVerified.tsx
      pinball.module.css       # extraído de app/globals.css
    tests/
      verify.v8.ts  play.v8.ts  gen.v8.ts  fixtures/v8.json
    assets/cover.svg           # fuente; el .webp sigue en public/covers/
    NOTES.md                   # opcional: lo de docs/<GAME>_Vn.md
  galactic-roulette/ … (core/, input/{gesture,launchGesture}.ts, view/, tests/)
  reaction-test/ …             # carpeta = id persistido; nombre visible en manifest
lib/
  catalog/{gameIds.ts, registry.ts}   # agrega manifests; lo usa el servidor
  client/attempt/{useVerifiedAttempt,useHiddenAttempt,attemptTransport}.ts
  platform/{economy.ts, rivals.ts, leagues.ts, ranking.ts, groups.ts}   # capa 2
  server/ …                           # capa 3; gameVerifiers itera games/*/core/index.ts
components/
  gameViews.ts                        # id → () => import("@/games/<id>/view/…")
```

**Manifest tipado propuesto (E12):**
```ts
// lib/catalog/types.ts  (server-safe)
export type GameManifest<Id extends GameId = GameId> = {
  id: Id;                                   // persistido, inmutable
  current: GameCore<CoreState>;             // fuente única de version/actions/inputVersion
  verification: "server-replay" | "client-result" | "private-authority";
  resultMetric: "points" | "fictitious-balance" | "reaction-time-ms";
  catalog: { cover: string; category: CategoryKey; enabled: boolean; order: number }; // copy → i18n gameMeta.<id>.*
  legacySeed?: string;                      // solo client-result
};
// lib/platform/economy.ts   → STAKES, waitingStakes por id, prizeForStakeMinor (enteros)
// lib/platform/rivals.ts    → rivalScore/rivalName/rivalAvatar por id (datos simulados, separados)
```
Quedan eliminados `scoring`, `instruction` y `difficulty` (sin consumidores) y `name`, `tagline` y `skillLabel` (ya en i18n; el texto español pasa como fallback a `es.ts`).

### f.3 Orden de migración (cada paso compila y pasa tests por sí solo)

1. **Hoja de ids y split del registro (E1, E7, E13).** Crear `lib/catalog/gameIds.ts` y `lib/catalog/registry.ts` sin componentes. Mover `loadComponent` a `components/gameViews.ts`. `lib/games.ts` queda como fachada que re-exporta ambos, para que la UI no cambie. Cambiar solo los 3 consumidores de servidor y los 4 scripts a `lib/catalog`. Comprobar en `.next/server` que desaparecen los 15 stubs `registerClientReference` de la traza de `verify`.
2. **Barreras automáticas (E2).** Añadir `scripts/check-core-purity.mjs` y un `check-layers.mjs` (reutilizable desde mi `layers.mjs`) a `pnpm check` y CI. Añadir el job bun/JSC de golden fixtures. Hacerlo antes de mover nada, para que la red de seguridad cubra la migración.
3. **Cliente fuera de la capa 4 (E6).** `git mv lib/verified/use*Attempt.ts attemptTransport.ts → lib/client/attempt/` dejando un re-export de 1 línea en la ruta vieja.
4. **Juegos uno a uno, empezando por el más pequeño (bowling, 2 versiones) y siguiendo por pinball, shot gallery y ruleta.**
   - `git mv` del core actual a `games/<id>/core/vN.ts` sin tocar el contenido. Ni los hashes ni el `rulesDescriptor` dependen de la ruta: `content` son objetos de reglas.
   - En la ruta vieja `lib/verified/xCore.vN.ts` queda un shim `export * from "@/games/<id>/core/vN"`.
   - El alias `@/*` ya existe en `tsconfig.json` y `scripts/determinism-loader.mjs:4-6` ya resuelve cualquier `@/…`, así que no hace falta alias nuevo.
   - Mover tests, fixtures, vista y CSS, actualizando sus imports relativos y las entradas de `tsconfig.determinism.json` y `run-determinism.mjs`.
   - Ejecutar la suite de determinismo y comparar los hashes impresos antes y después.
5. **Registro de adaptadores por iteración (E10).** Con `games/*/core/index.ts` listos, generar el mapa en `gameVerifiers.ts` con un bucle y un test que fije las 70 claves actuales.
6. **Andamiaje de tests (E11).** Descubrimiento automático en `run-determinism.mjs` con un glob `games/*/tests/verify.*.ts`, conservando el orden estable por nombre, y `gen-fixture.ts` genérico. Los fixtures existentes no se reescriben.
7. **Corte pre-lanzamiento (E8), solo con aprobación del propietario.** Inventario de versiones persistidas en cualquier DB, tag `archive/pre-launch-cores`, borrado de `archive/` y de los tests asociados (portando antes los tests de pipeline y gestos de §e) y actualización de ADR002.
8. **Retirar los shims** cuando `check-layers` confirme que ningún import usa ya rutas `lib/verified/*Core*`.
9. **Capa de plataforma (E12, E15).** Mover economía y rivales a `lib/platform/` con unidades menores enteras. Aquí no se toca la autoridad de partida.
