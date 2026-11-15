# v189-saturn — Juegos de azar y por dinero, periodos en los rankings (13–15 nov 2026)

Base: v188-saturn. Decisiones del propietario del 13-nov.

- **Dos tipos de juego.** «De azar» = los que no se pueden jugar por dinero (no hay licencia): Slot y Ruleta (oculta),
  marcados `playKind: "chance"` en `lib/games.ts`. Todos los demás son de habilidad y se pueden jugar por dinero.
  - Regla en el servidor: `/api/verified-match/start` y `PublicMatchService.start` rechazan apuesta > 0 en un juego de
    azar (`CHANCE_GAME_NOT_FOR_MONEY`); prueba en `scripts/verify-public-attempts.ts`. El cliente tampoco lo intenta.
  - Grupos: con entrada > 0 los juegos de azar no aparecen ni entran en «Aleatorio», con un aviso.
  - Aspecto: los juegos por dinero llevan marco y botón dorados con un brillo cálido y una medalla con estrella; los de
    azar, una etiqueta «Sin dinero». El nombre accesible de cada tarjeta dice el tipo. 10 idiomas.
  - Un juego de azar no genera ingresos: queda fuera del Ranking Juegos y del reparto a estudios
    (`countsForPayout: false` en `/api/studio/plays`).
- **Periodos en los rankings:** 1S, 1M, 6M, 1A y Todo (`lib/rankingPeriod.ts`) para Jugadores y Juegos.
  - Ranking Juegos: días para 1S y 1M, meses para 6M, 1A y Todo; total del periodo, gráfica con la fecha del punto
    elegido y como mucho seis etiquetas en el eje. Datos de ejemplo coherentes entre periodos.
  - Ranking Jugadores: cada juego tiene su muestra por periodo; el ranking real (instantáneas de liquidación) solo
    existe para «Todo», así que los demás periodos dicen que aún no está disponible.
- Grupo contra grupo y su ranking: pendientes de la descripción del propietario.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`; capturas del catálogo y de cada periodo.
