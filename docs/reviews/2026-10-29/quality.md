# Revisión de calidad, CI y herramientas — Galactic Games (skill-arena-mvp)

Checkout revisado: `/home/claude/skill-arena-mvp`, rama `mobile-test`, HEAD `e15e17d` (v120-saturn). Fecha: 29-10-2026.
Revisión de solo lectura. El checkout quedó limpio (`git status --porcelain` = 0 antes y después). Los `tsc` con flags extra y ESLint se ejecutaron con configuraciones y paquetes instalados solo en el scratchpad.

## (a) Resumen

La batería determinista es sólida: 95 verificadores, 62 fixtures golden, entradas inválidas, equivalencia 60/120/144 Hz y PostgreSQL real sin "skip". La CI es rápida (unos 3 min), tiene las acciones fijadas por SHA y un historial reciente en verde. El mayor riesgo actual es de proceso, no de código. Un workflow heredado, todavía activo, hace `git push --force` a `mobile-test` desde 26 ramas antiguas, y ni `main` ni `mobile-test` tienen ninguna protección ni checks obligatorios. Además, Dependabot y el CodeQL semanal no funcionan de verdad porque la rama por defecto (`main`, 736 commits por detrás) no contiene su configuración. Antes de abrir a usuarios faltan cuatro cosas, que es donde hoy se colaría una regresión: tests HTTP de los route handlers en modo persistente, tests de la economía de `DemoApp`/`groupPlay`, una prueba de la cadena completa de migraciones y un linter con reglas de hooks y de capas.

## (b) Hallazgos

| id | sev | Hallazgo | Evidencia | Corrección concreta | Esfuerzo |
|---|---|---|---|---|---|
| Q1 | **P0** | Un workflow heredado **"Sync Mobile Test" sigue activo** y hace `git push origin HEAD:refs/heads/mobile-test --force` en cada push a `v*-mobile`. `mobile-test` no está protegida, así que un push a cualquier rama antigua devolvería `mobile-test` (y su preview de Vercel) al código del 7 de octubre. | `gh api …/actions/workflows`: id 375670437 `mobile-test-sync.yml` `active`, 270 ejecuciones, la última con éxito el 07-10-2026 en `v17-mobile`. El fichero está en 26 ramas: `v7…v17-mobile`, `v14.1–14.3`, `v15.1`, `v16.1–16.6`, `feature/dino-dash-professional`, `feature/precision-stack-pro`, `feature/precision-stack-professional`, `qa/precision-stack-professional-pass` y `refactor/game-architecture`. Lleva `permissions: contents: write`. `branches/mobile-test/protection` devuelve 404 y no hay rulesets (`[]`). | 1) `gh workflow disable 375670437 -R AlbertoBeneitez/skill-arena-mvp` y `gh workflow disable 377206928 …` (el "Build and determinism checks" heredado). 2) Ruleset sobre `main` y `mobile-test` que bloquee force-push y borrado (comando en §e). 3) Convertir esas ramas en tags (§e): así desaparece el disparador. | S |
| Q2 | P1 | **No hay checks obligatorios.** Se publicaron versiones en `mobile-test` con la CI en rojo. | v103, v104 y v105-saturn (e9132ee, 7782239, 8686110) llegaron a `mobile-test` con `mobile-smoke: failure`: 5 fallos seguidos el 24-10, que se arreglaron después con 21a1b62 «test(smoke): catálogo actual de 12 juegos». `branches/main` y `branches/mobile-test` → `protected:false`. | Ruleset con "Require status checks": `build`, `mobile-smoke`, `analyze` y, tras el PR #10, `determinism-previous-node`. El flujo de AGENTS.md encaja: el push a `vNN-saturn` ejecuta la CI y después `mobile-test` avanza por fast-forward al mismo SHA, que ya tiene los checks. | S |
| Q3 | P1 | **Dependabot y el CodeQL programado no funcionan en la práctica.** Ambos leen la configuración de la rama por defecto, `main`, que no tiene `.github/`. Las alertas de Dependabot están desactivadas. `docs/LAUNCH_CHECKLIST.md` afirma "CodeQL, Dependabot". | `contents/.github/dependabot.yml?ref=main` → 404; `contents?ref=main` = solo `.gitignore README.md app components next-env.d.ts next.config.mjs package.json pnpm-lock.yaml tsconfig.json`. Los 10 PRs del repo son todos del propietario: ninguno de Dependabot. `dependabot/alerts` → "Dependabot alerts are disabled for this repository". CodeQL: 21 ejecuciones (20 push + 1 PR) y ninguna `schedule`. | Cambiar la rama por defecto a `mobile-test` o llevar `.github/` a `main`. Activar "Dependabot alerts" y "security updates" en Settings → Code security. | S |
| Q4 | P1 | **Los pushes a `vNN-saturn` no ejecutan la CI.** Los checks que muestran sus SHAs vienen del push a `mobile-test` con el mismo SHA. `v102-saturn` no tiene ninguna ejecución de CI. | `actions/runs?branch=v120-saturn` → `total_count 0`. Ninguna rama `saturn` aparece en las 200 últimas ejecuciones de Build V4. Check-runs de `9a79e9e` (v102-saturn): solo "Vercel Preview Comments". | Fusionar el **PR #10** (`chore/fase-0-orden`): añade `v*-saturn`. Su CI está **verde**: run 40857410043, `build`, `mobile-smoke` y `determinism-previous-node` en success; CodeQL 40857409843 en success; `mergeable_state: clean`. Mejor aún: usar un patrón genérico `v*-*`. | S |
| Q5 | P1 | **Node desalineado y aritmética de coma flotante en núcleos autoritativos.** La CI usa Node 22 y Vercel 24.x. Hay funciones trascendentes de coma flotante en núcleos que decide el servidor, y su resultado bit a bit no está garantizado entre motores. | `build-v4.yml`: `node-version: 22`. `lib/verified/billiardsCore.v4.ts:54` usa `Math.atan2(...)` para calcular `aim`. `Math.hypot` aparece en `shotGalleryCore.v3,v4,v5,v6,v7,v9,v10.ts` (comparación `>= gap`). `@types/node` 26.6.5 con runtime 22/24: el typecheck no detecta APIs que esas versiones no tienen. | El PR #10 (`.nvmrc`=24 y job de determinismo en Node 22) es el control adecuado: mantener ambos jobs. En núcleos nuevos, usar solo `lib/deterministic/integerMath`. Alinear `@types/node` con la versión mayor de `.nvmrc` (24). | S |
| Q6 | P1 | **Los 9 route handlers no tienen tests HTTP en modo persistente.** Los tests cubren la capa de servicio y de helpers, pero no los `route.ts`. El único E2E en CI es el de Tower Drop en modo *legacy stateless*, sin PostgreSQL. | `find app -name route.ts` → 9 (`verified-match/{start,attempt,session,verify,availability}`, `hidden-game/{start,session,command}`, `rankings/global`). Ningún script importa `app/api`. `verify-production-gates.ts` y `verify-public-attempts.ts` importan `publicMatchHttp`/`PublicMatchService`. `qa-smoke-all.cjs` (`checkVerifiedFlow`) corre con `ALLOW_LEGACY_STATELESS_TRAINING=1` y sin BD. `qa-public-matches.cjs`, `qa-hidden-http.cjs` y `qa-mine-persisted.cjs` existen, pero no están en la CI. | Job de CI con el servicio postgres: aplicar las migraciones, `pnpm start` con el modo persistente y ejecutar `qa-public-matches.cjs`, `qa-hidden-http.cjs` y `qa-mine-persisted.cjs`. Alternativa barata: un test Node que importe `POST` de cada `route.ts` y lo llame con `new Request(...)` (origen distinto, cuerpo enorme, JSON inválido, 202/409). | M |
| Q7 | P1 | **La economía no tiene tests.** El saldo, las comisiones, los reembolsos y los premios de grupo viven en `DemoApp.tsx` (1788 líneas) y en `lib/groupPlay.ts` (210 líneas), con aritmética en coma flotante. | 12 sitios con `setBalance(... Number((x ± y).toFixed(2)))`, p. ej. `DemoApp.tsx:709,882,967,1038,1063,1145,1700,1706`. `payoutShare` es local (`:107`). Sin ningún test: `lib/groupPlay.ts`, `lib/safeStorage.ts`, `lib/settings.ts` y `lib/usePublicMatchState.ts`. | Extraer `lib/economy.ts`, puro y en unidades mínimas enteras (céntimos): `charge`, `refund`, `pot`, `payout(placement)`. Añadir `scripts/verify-economy.ts` (conservación del bote, no negativos, reembolso idempotente). Es imprescindible antes de cualquier dinero real. | M |
| Q8 | P2 | **Migraciones solo hacia delante y sin registro; la cadena completa nunca se prueba.** | `db/migrations/001,002,003*.sql`: idempotentes (`IF NOT EXISTS`), sin *down*, sin tabla `schema_migrations`, «Never executed automatically». Los tests aplican 001+002 (`verify-command-repository`, `verify-persisted-hidden-training`) o 001+003(+003) (`verify-public-attempts`). Ninguno aplica 001→002→003 en el mismo esquema, que es el estado real de producción. | Test que aplique las 3 en orden dos veces y luego ejecute las 5 suites de repositorio sobre ese esquema. Añadir un runner mínimo con `schema_migrations(version, sha256, applied_at)` y documentar el rollback de cada migración. | S–M |
| Q9 | P2 | **31 QA de navegador (unas 7.100 líneas) fuera de la CI**, salvo `qa-smoke-all`. Son heterogéneos. | Puertos por defecto distintos en cada script (3000, 3042, 3069…3134). Mezclan `require("playwright")` y `PLAYWRIGHT_MODULE_PATH \|\| "playwright-core"`. `qa-orb-loss.cjs` y `qa-roulette-drag.cjs` no tienen ni `assert` ni código de salida. Algunos llevan nombre de versión (`qa-controls-v96`, `qa-v97-controls`). | Crear `pnpm qa:browser` (un único runner con `BASE_URL` obligatorio) y un workflow nocturno/manual (`workflow_dispatch` + `schedule`). Borrar o archivar los QA de juegos retirados y exigir aserciones. | M |
| Q10 | P2 | La versión de Playwright en CI no tiene lockfile ni la vigila Dependabot. | `npm install playwright@1.49.1` en `$RUNNER_TEMP` (la última es 1.64.1). | `tools/qa/package.json` + lockfile, instalado con `--frozen-lockfile` y añadido a `dependabot.yml` (`directory: /tools/qa`). | S |
| Q11 | P2 | `strict: true` está activo, pero ninguna de las flags estrictas adicionales. | Medido con `tsc -p` en el scratchpad (499 ficheros del proyecto): `noUncheckedIndexedAccess` **1744 errores/191 ficheros** (818 en `lib/verified`, 451 en `scripts`, 349 en `components/games`). `noPropertyAccessFromIndexSignature` 178/34. `noUnusedLocals+Parameters` 34/25. `exactOptionalPropertyTypes` 21/11. `noImplicitReturns+Override+FallthroughCases` 1 (`MineGridAuthority.tsx:30`). Todas juntas: 1800/203. Base: 0. | Activar ya `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch` (1 error) y `exactOptionalPropertyTypes` (21). `noUnused*` (34) solo tras limpiar. `noUncheckedIndexedAccess`: no en los núcleos históricos, que son inmutables. Aplicarla a código nuevo con un `tsconfig.strict.json` que incluya `lib/server`, `app` y los núcleos nuevos. | S (L para nuia) |
| Q12 | P2 | **No hay linter.** `pnpm lint` es `tsc --noEmit`. typescript-eslint **no funciona con TypeScript 7.0.2**. | Ejecución real: «typescript-eslint does not support TS 7.0». Peer de `typescript-eslint@8.72.1`: `typescript >=4.8.4 <6.1.0`. Con TS 6.0.3 aislado, la config de §d funciona (ESLint 10.13.0 y 9.39.5): **128 hallazgos (38 errores, 90 avisos)**. Con las reglas del React Compiler (`react-hooks@7 recommended-latest`): 67, de ellos 24 `set-state-in-effect`, 17 `exhaustive-deps`, 11 `immutability`, 6 `refs` y 5 `purity`. | Herramienta en `tools/lint/` con su propio `package.json` (`typescript@6.0.3`), ejecutada como `pnpm --dir tools/lint exec eslint -c eslint.config.mjs ../..`. Empezar con los avisos sin bloquear y pasar a `error` regla a regla. Nunca usar `--fix` sobre `lib/verified/*Core.v*.ts`. | M |
| Q13 | P2 | **La capa autoritativa tiene código cliente mezclado** y el servidor no tiene guardas `server-only`. | `lib/verified/useVerifiedAttempt.ts` y `useHiddenAttempt.ts` importan `react`. `lib/verified/attemptTransport.ts` es `"use client"`, usa `fetch` y `Date.now()` (detectado por la regla de §d). No hay ningún `import "server-only"` en `lib/server/*` (grep). Ningún componente importa `lib/server` (verificado). | Mover esos 3 ficheros a `lib/client/` y añadir `import "server-only"` a `lib/server/*.ts`: el build fallará si llegan al bundle cliente. | S |
| Q14 | P1 | **Producción sirve un `main` obsoleto y sin endurecer.** | `compare main...mobile-test`: `ahead_by 736`. El `main` desplegado tiene `react/typescript/@types: "latest"`, `next 16.3.6`, `next.config.mjs` sin CSP ni cabeceras de seguridad y `"lint": "next lint"`. | Promover una versión validada a `main` (merge con fast-forward desde `mobile-test`) o retirar el despliegue de producción hasta abrir. | S |
| Q15 | P2 | Hay 142 ramas y 0 tags. 3 ramas tienen commits que no están en `mobile-test`. | 110 `vNN-mobile` (v2…v101, incluidas v14.1–v16.6), 19 `vNN-saturn` (v102…v120) y 13 más. `compare`: `skillarena2` diverge (+30), `qa/gameplay-polish-v99` (+1), `qa/precision-stack-professional-pass` (+1); `chore/fase-0-orden` (+3) es el PR #10. | §e. Revisar las 3 divergentes antes de borrarlas (el tag las conserva igualmente). | S |
| Q16 | P2 | Documentación desfasada en lo que afecta a QA. | README: «23 juegos activos» y «Unos 5–6 minutos». `lib/games.ts`: 15 ids (14 habilitados). `qa-smoke-all.cjs`: 14 nombres. El paso de determinismo en CI tarda 1 min 54 s. AGENTS.md sigue hablando de `vXX-mobile` (el PR #10 lo toca). | Actualizar README/LAUNCH_CHECKLIST junto con el PR #10. | S |
| Q17 | P2 | El repositorio es **público y no tiene LICENSE**. | `gh api repos/…` → `visibility: public`, `license: null`. No hay fichero LICENSE y `package.json` no tiene campo `license`. `THIRD_PARTY_NOTICES.md` tiene 13 secciones (MIT de Tower Building Game, 2048, Phaser, fuente Unbounded, qrcode-generator…). | Decidir: repo privado (protege también los núcleos anti-trampa) o una licencia explícita. Añadir `"license": "UNLICENSED"` mientras tanto. | S |

Nota: Q14 está numerado fuera de orden de severidad para no renumerar. Es P1.

## (c) Inventario de tests

**`scripts/` (277 ficheros):**

| Tipo | Nº | Cómo se ejecuta | ¿En CI? |
|---|---|---|---|
| `verify-*.ts`: núcleos, golden, replay, inválidos, contratos, escenarios, ranking, ligas, puertas de producción, viewport/joystick, "device-equivalence" | 89 | `tsc -p tsconfig.determinism.json` → `.det-test/`, luego `node scripts/run-determinism.mjs` (importación secuencial, loader `determinism-loader.mjs` para `@/` y extensiones) | Sí: `pnpm test:determinism` (90 imports) |
| `verify-*-presentation.cjs`: independencia de render (billiards, darts, gallery, orb, roulette, tower) | 6 | Desde `run-determinism.mjs` | Sí |
| Repositorio PostgreSQL: `verify-public-attempts`, `-match-repository`, `-ranking-repository`, `-command-repository`, `-persisted-hidden-training` | 5 (incluidos en los 89) | `run-determinism.mjs repository` con `TEST_DATABASE_URL` (fallan sin ella, «no skip») | Sí: `pnpm test:repository` con el servicio `postgres:17@sha256` |
| i18n: `verify-i18n.cjs` (paridad de claves y placeholders en 10 idiomas) | 1 | `pnpm test:i18n`, y también al inicio de `test:repository` | Sí (vía `test:repository`) |
| Golden: `fixtures/*.json` | 62 | Los leen los `verify-*` (60 verificadores referencian fixtures) | Sí |
| Generadores `gen-*-fixture.ts` / `*-play-fixture.ts` | 39 / 43 | Manual. Los compilados entran en `.det-test` porque se importan | Solo como dependencia |
| QA de navegador `qa-*.cjs` (Playwright, viewport móvil) | 31 | `BASE_URL=http://127.0.0.1:PORT NODE_PATH=<playwright> node scripts/qa-X.cjs` contra `pnpm build && pnpm start -p PORT` (varios usan `PLAYWRIGHT_MODULE_PATH`→`playwright-core`) | **Solo `qa-smoke-all.cjs`** (job `mobile-smoke`: 14 juegos + flujo verificado de Tower Drop) |
| Otros: `core-test-utils.ts`, `i18n-test-stub.cjs`, `rasterize-covers.cjs`, `generate-covers.py`, runner y loader | 6 | — | — |

Datos de la cobertura determinista:
- Rechazo de entradas inválidas (`assert.throws`/`rejects`/`INVALID`): 28 verificadores.
- Equivalencia de frecuencia de refresco o dispositivo: 13.

**Qué no se prueba y por dónde se colaría una regresión:**
1. **Route handlers en modo persistente (Q6).** Un cambio en `app/api/*/route.ts` puede pasar la CI: orden de `sameOrigin`, límite de bytes, `Cache-Control`, ramas `persistentMatchesRequested()`. Solo el E2E stateless de Tower Drop toca la ruta.
2. **Economía de UI (Q7).** No hay ninguna aserción sobre saldo, reembolso ni reparto de bote.
3. **Componentes UI.** No hay tests unitarios ni de render. Solo el smoke detecta errores de consola o CSP, el desborde horizontal o que no aparezca el canvas; no detecta lógica de controles ni estados (eso queda en QA manual y en los qa-* fuera de CI).
4. **Cadena completa de migraciones (Q8)** y rollback.
5. **Hooks cliente** `useVerifiedAttempt`/`useHiddenAttempt`/`attemptTransport`: el reintento de 35 s y el keepalive no tienen test directo.
6. **Versiones de protocolo** que ningún script importa directamente, entre ellas `galacticRouletteProtocol.v6/v7`, `pinballProtocol.v1–v3`, `shotGalleryProtocol.v1–v3`, `stackShiftProtocol.v1`, `towerDropCore.v1` y `towerDropPhysics.v5`. Probablemente se cubren de forma transitiva desde los núcleos o `gameVerifiers`; no lo he verificado una por una.
7. **Engine drift entre Node 22 y 24 (Q5)**: queda cubierto en cuanto se fusione el PR #10.

**CI (Build V4).**
- Últimas 200 ejecuciones (07-10 → 28-10): 169 success, 21 failure y 10 cancelled, un **10,5 % de fallo**.
- Desde el 24-10: 20 ejecuciones y 5 fallos, todos de `mobile-smoke` por un smoke desfasado, no por inestabilidad.
- Duración típica actual: 2–3 min de reloj. Pasos de la última ejecución: determinismo 1 min 54 s, PG 10 s, build 9 s; `mobile-smoke` 1 min 37 s. Máximo observado: 13,7 min.
- Concurrencia con `cancel-in-progress`, salvo en `main`/`mobile-test`. Timeouts de 25/20/30 min. Caché de pnpm activa (install en 2 s). No se cachea `.next/cache`, pero no hace falta.
- `pnpm audit --prod`: «No known vulnerabilities found».

## (d) `eslint.config.mjs` propuesto

Probado en el scratchpad contra el repo con ESLint 10.13.0, `@eslint/js` 10.0.1, typescript-eslint 8.72.1, **typescript 6.0.3**, eslint-plugin-react-hooks 7.1.1, `@next/eslint-plugin-next` 16.4.3 y globals. Encontró 128 problemas.

Por qué en `tools/lint/`: typescript-eslint rechaza TS 7. Hay que instalarlo en un `tools/lint/package.json` separado con `typescript@6.0.3` y ejecutarlo desde allí. No me funcionó un override de pnpm para el `typescript` transitivo en el mismo `package.json`.

```js
// tools/lint/eslint.config.mjs  — ejecutar:  pnpm --dir tools/lint exec eslint -c eslint.config.mjs ../..
import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

const PURE_PATHS = [
  { name: "react", message: "Los núcleos deterministas no pueden depender de React." },
  { name: "react-dom", message: "Los núcleos deterministas no pueden depender de React." },
];
const PURE_PATTERNS = [
  { group: ["next", "next/*"], message: "Los núcleos deterministas no pueden depender de Next." },
  { group: ["@/lib/server/*", "../server/*", "**/lib/server/*"], message: "lib/verified y lib/deterministic no pueden importar código de servidor." },
  { group: ["@/components/*", "**/components/*"], message: "lib/verified y lib/deterministic no pueden importar UI." },
];

export default defineConfig(
  { ignores: [".next/**", ".det-test/**", "node_modules/**", "public/**", "next-env.d.ts", "scripts/fixtures/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "@next/next": nextPlugin },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  // Capa autoritativa: pura, sin React/Next/servidor/UI, sin reloj ni azar.
  {
    files: ["lib/verified/**/*.ts", "lib/deterministic/**/*.ts"],
    // Código cliente que hoy vive aquí (Q13): moverlo a lib/client/ y borrar esta excepción.
    ignores: ["lib/verified/use*.ts", "lib/verified/attemptTransport.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: PURE_PATHS, patterns: PURE_PATTERNS }],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "performance", "requestAnimationFrame"],
      "no-restricted-properties": ["error",
        { object: "Math", property: "random", message: "Usa el RNG de lib/deterministic." },
        { object: "Date", property: "now", message: "El tiempo autoritativo llega como entrada." }],
    },
  },
  // Núcleos publicados: inmutables. Nada de reglas de estilo con autofix.
  {
    files: ["lib/verified/*Core.v*.ts"],
    rules: { "prefer-const": "off", "no-useless-assignment": "off" },
  },
  // La UI nunca importa servidor.
  {
    files: ["components/**/*.{ts,tsx}", "app/**/page.tsx", "app/**/layout.tsx"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/lib/server/*", "**/lib/server/*", "pg"], message: "La UI no puede importar código de servidor." },
      ] }],
    },
  },
  {
    files: ["scripts/**/*.{ts,cjs,mjs}"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off", "@typescript-eslint/no-explicit-any": "warn" },
  },
  // Los QA de Playwright ejecutan callbacks dentro del navegador (page.evaluate).
  { files: ["scripts/qa-*.cjs"], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
```

`tools/lint/package.json`, con versiones exactas: `eslint 10.13.0`, `@eslint/js 10.0.1`, `typescript-eslint 8.72.1`, `typescript 6.0.3`, `eslint-plugin-react-hooks 7.1.1`, `@next/eslint-plugin-next 16.4.3`, `globals`.

**Resultado medido** (antes de añadir el bloque de núcleos inmutables):

| Regla | Nº | Nivel |
|---|---|---|
| `@typescript-eslint/no-unused-vars` | 31 + 6 | aviso + error |
| `@typescript-eslint/no-explicit-any` | 22 (todos en `scripts/`) | aviso |
| `@next/next/no-img-element` | 19 | aviso |
| `react-hooks/exhaustive-deps` | 17 | aviso |
| `no-useless-assignment` | 10 (5 en núcleos v1–v3) | error |
| `@typescript-eslint/no-unused-expressions` | 9 | error |
| `no-empty` | 4 | error |
| `prefer-const` | 4 | error |
| `react-hooks/rules-of-hooks` | 2 | error |
| `no-control-regex` | 1 | error |
| `@next/next/no-html-link-for-pages` | 1 (`app/error.tsx:23`) | error |
| `@next/next/no-assign-module-variable` | 1 (`GameLoader.tsx:38`) | error |

- Los `exhaustive-deps` se concentran en `CoreCanvasGame.tsx` (6) y en `useHiddenAttempt.ts` (3).
- Los 2 `rules-of-hooks` son **falsos positivos**: `useTotal` en `shotGalleryCore.v2.ts:124,134` no es un hook. Basta un `// eslint-disable-next-line` justificado, porque renombrar dentro de un núcleo publicado es posible pero innecesario.
- Las reglas de capas solo saltaron en `attemptTransport.ts` (`Date.now`), que ahora queda exceptuado.

Con `react-hooks` `recommended-latest` (React Compiler) salen 67, y hay que añadirlas más adelante. Unos 13 de esos hallazgos desaparecen si se fusiona el PR #10, que borra `RunnerGame`, `NeonDash`, `OrbBurst`, `PrecisionStack`, `TowerDrop`…

Script sugerido en la raíz: `"lint:rules": "pnpm --dir tools/lint exec eslint -c eslint.config.mjs ../.."`. Añadirlo a la CI como paso informativo y, cuando llegue a 0 errores, hacerlo bloqueante.

## (e) Ramas → tags (solo comandos, sin ejecutar)

Familias actuales: 110 `vNN-mobile`, 19 `vNN-saturn`, `main`, `mobile-test` y 11 ramas de trabajo: `archive/pre-saturn`, `audit/production-readiness-v97`, `chore/fase-0-orden` (PR #10, no tocar), `feature/dino-dash-professional`, `feature/precision-stack-pro`, `feature/precision-stack-professional`, `improve/alien-sky-river`, `qa/gameplay-polish-v99`\*, `qa/precision-stack-professional-pass`\*, `refactor/game-architecture` y `skillarena2`\*. \* = tiene commits que no están en `mobile-test`.

```bash
# 0) Desactivar el workflow que hace force-push y proteger las ramas estables ANTES de nada (Q1/Q2)
gh workflow disable 375670437 -R AlbertoBeneitez/skill-arena-mvp   # Sync Mobile Test (force-push)
gh workflow disable 377206928 -R AlbertoBeneitez/skill-arena-mvp   # Build and determinism checks (heredado)
gh api -X POST repos/AlbertoBeneitez/skill-arena-mvp/rulesets --input - <<'JSON'
{ "name": "stable-branches", "target": "branch", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main", "refs/heads/mobile-test"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" },
             { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false,
               "required_status_checks": [ {"context": "build"}, {"context": "mobile-smoke"}, {"context": "analyze"} ] } } ] }
JSON

# 1) Clon bare completo y aislado (el checkout compartido es superficial: 72 commits). No usar --mirror:
#    con remote.origin.mirror, git push rechaza refspecs explícitos.
git clone --bare https://github.com/AlbertoBeneitez/skill-arena-mvp.git /tmp/sa-tags.git
cd /tmp/sa-tags.git

# 2) Copia de seguridad completa e inventario
git for-each-ref --format='%(refname:short) %(objectname)' refs/heads > ../branches-before.txt
git bundle create ../skill-arena-all-refs.bundle --all && git bundle verify ../skill-arena-all-refs.bundle

# 3) Selección de ramas de versión (esperado: 129 = 110 mobile + 19 saturn)
git for-each-ref --format='%(refname:short)' refs/heads \
  | grep -E '^v[0-9]+(\.[0-9]+)?-(mobile|saturn)$' | sort -V > ../to-tag.txt
wc -l ../to-tag.txt
#    Ramas de trabajo ya integradas (archivadas bajo archive/…); se excluyen las 3 divergentes y la del PR abierto
printf '%s\n' archive/pre-saturn audit/production-readiness-v97 feature/dino-dash-professional \
  feature/precision-stack-pro feature/precision-stack-professional improve/alien-sky-river \
  refactor/game-architecture > ../to-archive.txt

# 4) Tags anotados en el SHA exacto de cada rama (mismo nombre: AGENTS/docs siguen siendo válidos)
while read b; do git tag -a "$b" -m "Checkpoint $b (convertido desde rama)" "$(git rev-parse "refs/heads/$b")"; done < ../to-tag.txt
while read b; do t="archive/${b#archive/}"; git tag -a "$t" -m "Archivo de la rama $b" "$(git rev-parse "refs/heads/$b")"; done < ../to-archive.txt

# 5) Verificación local (no debe imprimir nada)
while read b; do [ "$(git rev-parse "refs/heads/$b")" = "$(git rev-parse "refs/tags/$b^{commit}")" ] || echo "MISMATCH $b"; done < ../to-tag.txt
while read b; do t="archive/${b#archive/}"; [ "$(git rev-parse "refs/heads/$b")" = "$(git rev-parse "refs/tags/$t^{commit}")" ] || echo "MISMATCH $b"; done < ../to-archive.txt

# 6) Subir solo los tags, con refspecs completos para evitar la ambigüedad rama/tag
sed 's#.*#refs/tags/&:refs/tags/&#' ../to-tag.txt | xargs -n 40 git push origin
sed 's#^archive/##; s#.*#refs/tags/archive/&:refs/tags/archive/&#' ../to-archive.txt | xargs -n 40 git push origin

# 7) Verificación remota (no debe imprimir nada)
git ls-remote origin 'refs/tags/*^{}' | sed 's#\^{}$##; s#refs/tags/##' | awk '{print $2, $1}' | sort > ../remote-tags.txt
while read b; do want=$(git rev-parse "refs/heads/$b"); got=$(awk -v t="$b" '$1==t{print $2}' ../remote-tags.txt); [ "$want" = "$got" ] || echo "FALTA/DIFIERE $b"; done < ../to-tag.txt
while read b; do t="archive/${b#archive/}"; want=$(git rev-parse "refs/heads/$b"); got=$(awk -v t="$t" '$1==t{print $2}' ../remote-tags.txt); [ "$want" = "$got" ] || echo "FALTA/DIFIERE $b"; done < ../to-archive.txt

# 8) Proteger los tags contra borrado y reescritura
gh api -X POST repos/AlbertoBeneitez/skill-arena-mvp/rulesets --input - <<'JSON'
{ "name": "immutable-checkpoints", "target": "tag", "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*", "refs/tags/archive/*"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "update" }, { "type": "non_fast_forward" } ] }
JSON

# 9) Solo si los pasos 5 y 7 no imprimieron nada: borrar las ramas en lotes
sed 's#.*#:refs/heads/&#' ../to-tag.txt     | xargs -n 40 git push origin
sed 's#.*#:refs/heads/&#' ../to-archive.txt | xargs -n 40 git push origin

# 10) Comprobación final (esperado: main, mobile-test, chore/fase-0-orden, skillarena2 y los 2 qa/* divergentes)
git ls-remote --heads origin | awk '{print $2}'
```

Nota: antes del paso 9, confirmar en Vercel que ningún dominio ni variable de entorno está asignado a una rama `vNN-*`; no lo he verificado. Las ramas `skillarena2`, `qa/gameplay-polish-v99` y `qa/precision-stack-professional-pass` necesitan una decisión humana: integrarlas, o ponerles un tag `archive/…` y borrarlas. En adelante, cada checkpoint debería ser un **tag** (`git tag -a v121-saturn && git push origin refs/tags/v121-saturn`) y no una rama. La CI puede dispararse con `on: push: tags: ['v*']`.

## (f) Lo que está bien hecho

- **Contrato determinista con pruebas reales.** 95 verificadores y 62 fixtures golden congelados. Rechazo de entradas inválidas en 28 suites, equivalencia 60/120/144 Hz y versiones históricas conservadas, con sus núcleos, protocolos y fixtures.
- **PostgreSQL real en CI** (imagen fijada por digest). Los tests fallan si falta `TEST_DATABASE_URL` en vez de saltarse. Hay pruebas de idempotencia, CAS, concurrencia, inmutabilidad (triggers) y borrado en cascada.
- **Higiene de la CI.** Todas las acciones fijadas por SHA con comentario de versión, `permissions: contents: read`, `timeout-minutes` en todos los jobs, concurrencia que no cancela las ramas estables, `--frozen-lockfile`, caché de pnpm, auditoría informativa, y Dependabot configurado para npm **y** github-actions (falta que sea efectivo: Q3).
- **CI rápida y estable.** 2–3 min. Las rojas recientes se debieron a un smoke desfasado y no a inestabilidad. El job `mobile-smoke` incluye un E2E real con verificación de servidor.
- **TypeScript.** `strict: true`, **0** `@ts-ignore`/`@ts-expect-error`, **0** `any` reales en `app/components/lib` (las 3 coincidencias son comentarios), solo 3 `as unknown as`, y añadir `exactOptionalPropertyTypes` cuesta apenas 21 errores.
- **Dependencias.** Versiones exactas (sin `^`/`latest` en `mobile-test`), lockfile v9, `packageManager` fijado, `pnpm audit --prod` limpio y versiones al día (solo Next 16.4.2 → 16.4.3 y `@types/node` de parche).
- **Fronteras.** Ningún componente importa `lib/server`. Los núcleos no usan `Math.random` ni `Date.now` (solo el transporte cliente de Q13).
- **Seguridad web.** CSP aplicada y cabeceras (HSTS, X-Frame-Options, nosniff, Referrer y Permissions-Policy) en `next.config.mjs`. CodeQL en verde en cada push a `mobile-test`.
- **Procedencia.** `THIRD_PARTY_NOTICES.md` es detallado, con commit de referencia, módulos consultados y estado de los assets.
- **El PR #10 ya resuelve Q4 y gran parte de Q5,** y su CI está en verde con los 3 jobs.
