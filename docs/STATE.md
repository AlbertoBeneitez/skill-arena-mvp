# Estado actual — Galactic Games

Fuente única del estado del producto. Prevalece sobre `PRODUCT_BACKLOG_STATUS.md`
(congelado en v98) y sobre las notas de versión antiguas. Cada pull request que
cambie algo de lo que aparece aquí lo actualiza.

Actualizado: 3 de noviembre de 2026 · base `mobile-test` en v139-saturn.

## Catálogo

14 juegos activos: 12 verificados por replay en servidor y 2 integrados con
resultado aún no verificado de extremo a extremo.

| id interno | Nombre visible | Versión | Estado |
| --- | --- | --- | --- |
| galactic-roulette | Roulette | 16.0.0 | VERIFIED |
| galactic-slot | Slot | 3.0.0 | VERIFIED |
| darts | Dardos | 3.0.0 | VERIFIED |
| billiards | Billar | 7.0.0 | VERIFIED |
| tower-drop | Tower Drop | 5.0.0 | VERIFIED |
| stack-shift | Stack Shift | 4.0.0 | VERIFIED |
| orb-burst | Orb Burst | 7.0.0 | VERIFIED |
| precision-stack | Stack | 4.0.0 | VERIFIED |
| reaction-test | Shot Gallery | 12.0.0 | VERIFIED |
| pinball | Pinball | 9.0.0 | VERIFIED |
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
| PostgreSQL alojado | No existe. Migraciones `db/migrations/001`–`004` listas, se aplican a mano (004: propuestas de juegos) |
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
- [x] **Grupos (1 de noviembre):**
  - al crear un grupo se elige el formato: liga de partidas individuales (cada uno juega cuando quiere y suma sus resultados) o liga de enfrentamientos 1 contra 1 (misma semilla para los dos); además, el torneo;
  - una sola cuota de entrada da derecho a todas las partidas hasta el final; va al bote menos la comisión;
  - antes de empezar se fija el final: N partidas por jugador, o cuando la mayoría vote cerrarlo;
  - mientras no termine se pueden seguir jugando partidas aunque se cierre la app (el estado vive en el servidor).
  - Comisión del 5 % (1 de noviembre). Liga puntuada por victorias.
  - Hecho en v128 con reglas puras (`lib/groupCompetition.ts`), rivales simulados (`lib/demo/groupRivals.ts`) y guardado en el dispositivo; con saldo ficticio hasta la fase 4. Cuando haya servidor e identidad, el mismo módulo corre allí y el servidor emite las semillas.
- [x] **Ruleta (1 de noviembre):** el salto actual no es realista porque la bola se asienta demasiado rápido; debe dar más botes y tardar más en quedarse en el número (núcleo nuevo).
- [x] **Especificación de la plataforma de juegos externos (1 de noviembre):** documento editable en https://claude.ai/artifact/UVovKYHAQV3f4C722uNzsh (paquete, funciones del núcleo, SDK, admisión, producción, versiones, datos, reparto, contrato, fases y decisiones abiertas).
- [x] **Catálogo por filas (1 de noviembre):**
  - orden: Populares (los 8 con más partidas), Casino, Bar, Míticos, Dinámicos y Alternativos;
  - cada fila se desliza y muestra 2 tarjetas y media, ordenadas por popularidad;
  - la popularidad es un orden fijo editable (`CATALOG_ORDER` en `lib/games.ts`) hasta que el servidor dé partidas reales;
  - los juegos externos eligen categoría, salvo Populares.
  - Botón de jugar: cristal oscuro con borde cian.
- [x] **Sistema de diseño (1 de noviembre):** `DESIGN.md` en la raíz recoge los tokens reales; tipografías Unbounded / Chakra Petch / JetBrains Mono. «DESPEGAR» se descartó: el botón del alta vuelve a «CONTINUAR».
- [x] **Imágenes iniciales (1 de noviembre, v134):** Saturno en primer plano dramático, retroiluminado en creciente sobre negro, sin órbita ni lunas de juego; icono a juego con la G grande.
- [x] **Ruleta realista (1 de noviembre, v133):** física de la bola nueva desde cero (`galacticRouletteCore.v15`): pared con rozamiento, se suelta sola, baja en espiral, rombos, rotor en contra y trastes, reposo en la casilla; 12–16 s por tirada.
- [x] **Estética y orden (1 de noviembre, v132):**
  - fondo negro en lugar del azul marino;
  - fila «Nuevos» tras Populares, con los juegos de los últimos 30 días;
  - ninguna imagen entre pulsar un juego y verlo;
  - nada puede solaparse en ningún momento: los botones van fuera del tablero y `scripts/qa-overlap.cjs` lo comprueba.
- [x] **Ruleta V16 y bordes (1 de noviembre, v136):** la bola se lanza de verdad desde el lanzador y entra con su velocidad (sin círculo forzado ni velocidad mínima); bordes de tarjeta con un color por categoría.
- [x] **Pinball V9 (1 de noviembre, v137):** bloqueo y multibola de tres bolas, jackpots crecientes, súper jackpot y modos de 20 s.
- [x] **Grupo y envío de juegos (3 de noviembre, v139):** botón «ENVIAR JUEGO»; pestaña Grupo con una sola línea de indicaciones y tarjeta grafito con Saturno y avatares.
- [ ] **Portadas con más impacto (3 de noviembre):** Shot Gallery, Bowling, Tower Drop, Solitaire Sprint, Pinball y Mine Grid; Galoku con el cuadrado del vértice grande y centrado; Roulette con fondo oscuro; Slot más realista; Dardos más inmersivo.
- [x] **Portadas (1 de noviembre, v138):** sin destello horizontal, fondos en negro, Pinball con multibola y Roulette con la bola en la pista.
- [x] **Proponer un juego (1 de noviembre, v135):** botón en Juegos, formulario con condiciones y consentimiento, bandeja solo para el propietario (`STUDIO_OWNER_ACCOUNTS`).
  - Para recibir propuestas faltan PostgreSQL (`DATABASE_URL`) y la migración 004; hasta entonces el formulario avisa de que la recepción no está abierta.
- [x] **Arte (1 de noviembre, v131):** se desarrollan Saturno y sus anillos (bienvenida) y el icono de la app; se retira la G plana `app/icon.svg`.
- [ ] **Pagos y obligaciones de información:** investigación en `docs/PAYMENTS_AND_LEGAL.md`. Newly y RevenueCat no sirven para cuotas con premio (Apple y Stripe lo prohíben); en la fase 4, una pasarela especializada en juego con licencia DGOJ. Pendiente de revisión por un abogado.
- [x] **Formato de juegos externos (1 de noviembre):** núcleo en WebAssembly sin importaciones + interfaz web en marco aislado. Confirmado por el propietario.
- [x] **Plataforma para desarrolladores externos (1 de noviembre):**
  - el creador recibe el 50 % de la comisión neta (comisión de las partidas de su juego menos costes de pago e impuestos) y conserva sus derechos;
  - mercado: España primero (licencia DGOJ) y después expansión;
  - formato recomendado: núcleo en WebAssembly sin importaciones y una interfaz web en un marco aislado; admisión automática en una máquina virtual desechable y aprobación final del propietario;
  - el juego nunca recibe datos personales ni accede a bases de datos;

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
| 5 · Juegos externos | SDK y formato WASM, admisión automática en VM, panel del desarrollador, reparto del 50 % de la comisión neta | En diseño |

## Cómo comprobar este documento

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test:determinism && pnpm build
```
