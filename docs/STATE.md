# Estado actual — Galactic Games

Fuente única del estado del producto. Prevalece sobre `PRODUCT_BACKLOG_STATUS.md`
(congelado en v98) y sobre las notas de versión antiguas. Cada pull request que
cambie algo de lo que aparece aquí lo actualiza.

Actualizado: 31 de octubre de 2026 · base `mobile-test` en v125-saturn.

## Catálogo

14 juegos activos: 12 verificados por replay en servidor y 2 integrados con
resultado aún no verificado de extremo a extremo.

| id interno | Nombre visible | Versión | Estado |
| --- | --- | --- | --- |
| galactic-roulette | Roulette | 13.0.0 | VERIFIED |
| galactic-slot | Galactic Slot | 3.0.0 | VERIFIED |
| darts | Dardos | 3.0.0 | VERIFIED |
| billiards | Billar | 7.0.0 | VERIFIED |
| tower-drop | Tower Drop | 5.0.0 | VERIFIED |
| stack-shift | Stack Shift | 4.0.0 | VERIFIED |
| orb-burst | Orb Burst | 7.0.0 | VERIFIED |
| precision-stack | Stack | 4.0.0 | VERIFIED |
| reaction-test | Shot Gallery | 12.0.0 | VERIFIED |
| pinball | Pinball | 8.0.0 | VERIFIED |
| bowling | Bowling | 3.0.0 | VERIFIED |
| corner-sudoku | Galoku | 4.0.0 | VERIFIED |
| solitaire-sprint | Solitaire Sprint | 0.2.0 | INTEGRATED |
| mine-grid | Mine Grid | 0.2.0 | INTEGRATED |

Fuera del catálogo: Memoria (`memory-match` 2.0.0, desactivado; cores conservados
para replay). Fuente de verdad: `lib/games.ts`.

## Infraestructura

| Pieza | Estado |
| --- | --- |
| Producción (`skill-arena-mvp.vercel.app`) | Sirve `main` del 29 de septiembre (demo inicial). Pendiente de decisión del propietario |
| Vistas previas | Cada push a `mobile-test` y `vNN-saturn`; protegidas por inicio de sesión de Vercel |
| Node | 24 (`.nvmrc`, Vercel). La CI repite el determinismo en Node 22 |
| Variables en Vercel | `MATCH_SIGNING_SECRET` y `ALLOW_LEGACY_STATELESS_TRAINING` en producción y preview. Sin `DATABASE_URL` |
| PostgreSQL alojado | No existe. Migraciones `db/migrations/001`–`003` listas, se aplican a mano |
| Identidad | Cookie anónima y perfil local. Inicio de sesión con Google, Apple, X, Discord y Microsoft activado en el código (v122); cada proveedor se enciende al poner sus credenciales en Vercel (`docs/AUTH_PROVIDERS.md`). Hoy no hay ninguna |
| Saldo y premios | Ficticios, calculados en el navegador (`localStorage`) |
| CI | `build-v4.yml` (typecheck, determinismo, PostgreSQL, build, smoke móvil), CodeQL, Dependabot. Dependabot y el CodeQL semanal leen `main`, que aún no tiene `.github/`, así que no se ejecutan. El flujo antiguo «Sync Mobile Test» (forzaba `mobile-test`) se desactivó el 29 de octubre |

## Decisiones del propietario

- [x] Archivar las versiones de núcleo anteriores al lanzamiento (solo la vigente por juego). Aprobado el 29 de octubre.
- [x] Convertir las ramas `vNN-*` en etiquetas y borrar las ramas. Aprobado el 29 de octubre.
- [x] Integrar `chore/fase-0-orden` (revisión y limpieza). Aprobado e integrado el 30 de octubre (v124).
- [ ] Borrar las ramas de trabajo antiguas (`archive/pre-saturn`, `audit/…`, `feature/…`, `improve/…`, `qa/…`, `refactor/…`, `skillarena2`). Aprobado el 30 de octubre y confirmado de nuevo el 31 (también `chore/fase-0-orden`, ya contenida en `mobile-test`). Pendiente de ejecutar por el propietario: la sesión de Claude recibe 403 de la política de git al borrar ramas o subir etiquetas; copia completa en un git bundle entregado al propietario.
  Comando: `git push origin --delete archive/pre-saturn audit/production-readiness-v97 feature/dino-dash-professional feature/precision-stack-pro feature/precision-stack-professional improve/alien-sky-river qa/gameplay-polish-v99 qa/precision-stack-professional-pass refactor/game-architecture skillarena2 chore/fase-0-orden`
- [ ] Publicar en producción lo que se prueba en las vistas previas.
- [ ] Hacer privado el repositorio.
- [ ] Mantener `mobile-test` o probar solo desde la vista previa de cada pull request.
- [ ] Tolerar cortes breves de conexión durante la partida (C3: cambia cuándo se pierde por abandono).
- [ ] Dejar de borrar los datos locales al abrir una pestaña nueva (C6).

## Revisión de código

La del 29 de octubre está en `docs/reviews/2026-10-29/` (servidor, cliente, estructura, calidad), con hallazgos S*, C*, E* y Q*. Al arreglar uno, cita su id en el pull request.

## Hoja de ruta

| Fase | Contenido | Estado |
| --- | --- | --- |
| 0 · Orden | `CLAUDE.md`, este documento, código muerto, Node alineado, CI en ramas `vNN-saturn` | En curso |
| 1 · Flujo | `main` como producción, pull requests con vista previa, protección de `main`, Issues | Pendiente de decisiones |
| 2 · Modularización | Un juego por carpeta, límites de capas en ESLint, partir `DemoApp.tsx` y `globals.css` | Pendiente |
| 3 · Plataforma | PostgreSQL gestionado, identidad, ledger en servidor, límite de peticiones, captura de errores | Pendiente de cuentas |
| 4 · Dinero real | Pagos regulados, KYC/AML, antibot, revisión jurídica | Sin fecha |

## Cómo comprobar este documento

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test:determinism && pnpm build
```
