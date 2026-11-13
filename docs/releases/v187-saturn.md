# v187-saturn — Recuento de partidas para pagar a estudios y aviso solo automático (13-nov-2026)

Base: v186-saturn. Decisiones del propietario del 13-nov.

- **Juegos de estudios:** una vez revisados línea a línea, se integran en la app como un juego más (sin aislarlos).
  Queda anotado que la revisión humana es entonces la única barrera (hallazgo 4 de la revisión de seguridad).
- **Pago a estudios** (`lib/studioPayout.ts`): no hay pagos por entrar a las partidas; el único ingreso es el 5 % del
  cambio € ↔ ₡. Cada mes el 50 % de esa comisión neta se reparte entre todos los juegos según sus partidas contadas;
  la parte de los juegos de cada estudio va a ese estudio y la de los juegos propios se queda en la casa. Céntimos
  exactos (resto mayor). Prueba `scripts/verify-studio-payout.ts`.
- **Recuento de partidas** (`lib/server/playCounts.ts`): solo partidas verificadas por el servidor (cada intento
  verificado de un jugador es una partida), por mes en UTC, como mucho 20 por jugador, juego y día para que nadie
  multiplique su parte jugando solo. Las rechazadas y abandonadas no cuentan. Prueba contra PostgreSQL
  `scripts/verify-play-counts.ts`. Consulta del propietario: `GET /api/studio/plays?month=2026-11` (404 para los demás).
  Grupos y torneos se sumarán cuando funcionen en el servidor.
- **Condiciones para estudios** nueva versión `studio-terms-2026-11-13` en 10 idiomas: el punto 3 describe el reparto
  anterior y el 6 la entrega en TypeScript con revisión línea a línea. Conviene que las revise el abogado.
- **Aviso de mantenimiento solo automático:** sale con cualquier 5xx del servidor (no solo la base) o si el servidor no
  contesta dos veces seguidas, 5 s aparte, con el dispositivo conectado. Se quitan la regla manual del cortafuegos
  (configuración versión 4) y `public/mantenimiento.html`.
- **PDF del propietario** regenerado sin la tarea manual de mantenimiento y con el reparto decidido.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`; `/api/studio/plays` responde 404 sin sesión de propietario.
