# v179-saturn — Nuevo símbolo de la moneda y dos plataformas: móvil contra móvil y ordenador contra ordenador (12-nov-2026)

Base: v178-saturn.

## Símbolo de la moneda
- **Signo nuevo:** el cosmicoin se escribe **₡**, dibujado como una C con dos rayas verticales dentro (la opción «C» del
  propietario), en lugar de «CC». Por ejemplo, «25,00 ₡».
- **Fuente:** `public/fonts/gg-coin.woff` (824 bytes, generada por `scripts/build-coin-font.py`) tiene un solo glifo
  en U+20A1.
  - Encabeza las pilas de fuentes de la app y además se declara la última en cada familia propia (Unbounded,
    Chakra Petch y JetBrains Mono), así que gana dentro de ellas.
  - Donde no se aplica, el sistema muestra su ₡ normal, que es casi igual.
- **Código y textos:** `COIN_SYMBOL = "₡"`, `formatMoney`, `formatNetProfit` y los textos con «CC» en los diez idiomas.
  Los registros internos siguen en `EUR`.

## Dos plataformas: móvil y ordenador
- **Plataforma de cada aparato:** el móvil o la tablet juega en la plataforma móvil; el ordenador, en la de
  ordenador (`lib/platform.ts`).
- **La app en ordenador:** la misma app, idéntica, dentro de un marco con forma de móvil en el centro de la pantalla
  (`components/PlatformShell.tsx`, que sustituye a la pantalla «Solo para móvil»).
  - Se juega con ratón y teclado; comprobado con un tiro de Billar arrastrando el ratón.
  - Al lado aparece una nota breve («Ordenador», que se juega solo contra ordenadores) y un QR para abrirla en el móvil.
- **Partidas públicas:** el servidor empareja solo dentro de la misma plataforma.
  - Cada inicio duradero envía `platform`; la clave es opcional y, si falta, cuenta como móvil.
  - El hash de la petición de móvil no cambia, así que los inicios en curso se recuperan.
  - Migración aditiva `db/migrations/006-platform-pools.sql`: añade `arena_public_matches.platform`, con `mobile` por
    defecto para lo existente.
  - **Sin la migración aplicada**, el móvil funciona como siempre y el ordenador recibe
    `PLATFORM_POOL_UNAVAILABLE` (nunca se mezclan).
  - La disponibilidad también filtra por plataforma.
- **Grupos:** el código nuevo empieza por M (móvil) o D (ordenador) y tiene 8 caracteres.
  - Unirse desde la otra plataforma da un aviso y no entra.
  - Los códigos antiguos, de 7 caracteres, se aceptan en cualquier plataforma.
- **Rankings:**
  - el ranking de cada juego tiene datos de ejemplo propios por plataforma, y el selector indica de cuál es;
  - el ranking global real sale de las instantáneas de liquidación, que aún no separan plataformas, así que en
    ordenador muestra «aún no disponible» en vez del del móvil.
  - Las ligas ya eran por dispositivo.
- **Seguridad:**
  - `frame-ancestors 'self'` y `X-Frame-Options: SAMEORIGIN` (antes `none`/`DENY`): solo la propia web puede
    enmarcarse;
  - el inicio de sesión con Google, Apple, X, Discord o Microsoft navega la ventana entera, porque esos proveedores
    no se dejan enmarcar.
- **Límite conocido:** la plataforma se detecta en el navegador (agente de usuario, pantalla táctil, tipo de
  puntero), así que alguien que emule un móvil en un ordenador podría entrar en el grupo de móvil. El servidor repite
  cada partida igualmente; esto solo decide quién juega contra quién.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` (13 juegos),
  `scripts/qa-overlap.cjs` y `git diff --check`.
- `pnpm test:repository` con PostgreSQL 16 local, incluidas pruebas nuevas:
  - sin la migración, el ordenador se rechaza;
  - la migración se puede repetir;
  - un ordenador ve y ocupa la partida abierta de otro ordenador, y un móvil nunca;
  - se guarda la plataforma de cada partida.
- Capturas en ordenador (1440 × 900: entrada, catálogo, cartera, grupo con código D… y Billar con ratón) y en móvil
  (cartera, premios y reparto, perfil y ranking con el signo nuevo).
