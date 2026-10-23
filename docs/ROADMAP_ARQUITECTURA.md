# Hoja de ruta de arquitectura (tras la v103)

Foco actual: **experiencia de usuario** (música, animaciones, recorrido del jugador). Las piezas de abajo no se
implementan aún, pero cada decisión de UX debe respetar sus contratos para no rehacerlo después.

## Contratos que ya existen (no romper)
- `gameId + gameVersion + scenarioId + seed → inputs ordenados → núcleo puro → puntuación → replay → verificación de servidor`.
- Núcleos versionados e inmutables (`lib/verified/*Core.vN.ts`), adaptadores de verificación (`lib/server/gameVerifiers.ts`), golden fixtures.
- Entrenamiento (Lanzadera) sin dinero; Saturno = duelos con fichas (solo interfaz hoy).

## Pendiente, por orden
1. **Decisión del ganador** — regla única por modo (1 vs 1, liga, torneo): mayor puntuación verificada; empate exacto = devolución;
   desempate por tiempo de resolución del servidor. El cliente nunca decide. Registro inmutable del veredicto (hash de inputs + resultado).
2. **Reparto de cantidades** — libro mayor de doble entrada en PostgreSQL (fichas, no dinero real hasta cumplimiento): reserva al entrar,
   liquidación al veredicto, comisión explícita, idempotencia por `matchId`, reembolso por abandono según ADR007. Sin saldos en el navegador.
3. **Anti-bots** — señales de servidor: cadencia y entropía de inputs (replay), tiempos de reacción imposibles, huella de dispositivo
   mínima, límites por cuenta/IP, desafío progresivo (Turnstile) en alta y retiros; modelos de bot propios como prueba de regresión
   (ya existen bots de test por juego).
4. **Orquestación multijugador** — emparejamiento por cola (Redis), la sala emite el mismo `scenarioId/seed` a ambos, ventana de
   conexión y reconexión, abandono = derrota (ADR007), workers de verificación asíncronos con reintento idempotente.
5. **Ciberseguridad** — CSP ya aplicada, secretos solo en servidor (`MATCH_SIGNING_SECRET` en Vercel), firma de tickets de intento,
   rate limiting, validación estricta de payloads, auditoría de dependencias en CI, registro sin datos personales.
6. **Protección de datos (RGPD)** — minimización, consentimiento versionado, borrado idempotente, separación proveedor/repositorio
   (ver `RGPD_PACKAGE_AUDIT.md`).
7. **Salto a estructura real** — identidad de producción, PostgreSQL gestionado, entornos separados (preview/prod), observabilidad,
   backups, y solo entonces activar fichas con valor (requisitos legales en `LAUNCH_CHECKLIST.md`).

## Reglas de UX compatibles
- La música y los sonidos son presentación pura (no afectan a la simulación).
- Animaciones de resultado nunca retrasan el envío del registro de partida (ya se envía al terminal determinista).
- Nada de saldos o resultados autoritativos en el cliente: el sello "verificado" solo lo pone el servidor.
