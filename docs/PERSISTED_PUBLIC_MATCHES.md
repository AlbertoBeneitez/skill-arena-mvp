# Partidas públicas durables — v98

Implementación de [ADR007](adr/007-durable-public-attempts.md), posterior a la
[auditoría de v97](PRODUCTION_ARCHITECTURE_REVIEW.md). Amplía las rutas existentes,
scenarios compartidos, `useVerifiedAttempt` y adapters archivados.

## Estado y configuración

21juegos VERIFIED comparten el circuito. Mine/Solitaire legacy son entrenamiento
local, nunca una fuente de ganadores económicos. Grupos simulados no reclaman
plazas de entrenamiento público. No hay dinero real, OAuth, ledger o proveedor nuevo.

Requiere migraciones001y003 revisadas, aplicadas explícitamente con rol de
migración; nunca en startup/build. La002 sigue siendo necesaria para Mine privado.
La003 permite asignar B una vez a una partida abierta sin cambiar el manifiesto
ni participantes ya asignados, y agrega intentos/resultados/resolución/cursor.

Flags: `ALLOW_PERSISTED_MATCH_TRAINING=1` y `DATABASE_URL`. Se acepta PG local sólo
fuera de Vercel; remoto exige `sslmode=verify-full`. La falta de configuración no
activa memoria ni una ruta alternativa stateless. Falta configurar el servicio
PostgreSQL externo: publicar código no habilita automáticamente esta funcionalidad
para el enlace Vercel. No se han solicitado/añadido secretos de producción.

## HTTP

- GET `/api/verified-match/session`: capacidad de transporte y bootstrap de cookie
  anónima HttpOnly; scope siempre training. Una identidad real requerirá su adapter.
- POST `/api/verified-match/start`: `game_id, stake_minor, start_key`. Juego/importe permitidos;
  versión, target, escenario y seed los fija el servidor. Mismo actor/clave es
  idempotente; otra carga es409. Los importes son condiciones ficticias.
- POST `/api/verified-match/verify`: `attempt_id, inputs, final_tick` y opcional
  `record_kind: abandoned`. No admite manifest/ticket/seed/score del cliente.
  La identidad procede de la cookie, y el manifiesto/ticket de PostgreSQL.
- POST `/api/verified-match/attempt`: `attempt_id, action: heartbeat|abandon`.
  Lease5s/20s, ningún resultado cerrado puede reabrirse. GET permite recuperar
  resultado/trabajo pendiente y la resolución propia, sin información oculta rival.
  Sin attempt_id devuelve los últimos20intentos propios para Avatar/recarga.
  Las consultas no renuevan la conexión del intento.
- GET `/api/verified-match/availability?stake_minor=…`: proyección real del pool,
  por juego/versión actual y condiciones; el catálogo usa esa proyección.

El transporte congela el cuerpo y reintenta temporalmente ante fallos/202 usando
el mismo gate. Que el teléfono cierre totalmente sigue impidiendo entregar inputs
no enviados; la lease resuelve la derrota, no un replay inventado. Salir tras
finalizar y entregar no cambia el resultado. La UI no devuelve entradas ficticias
por abandonar un juego iniciado. No confundir ese saldo local con un ledger real.

## Garantías y límites de seguridad

Corregidos para el circuito durable: firma de entrenamiento conocida no permite
inventar una seed/identidad/score; no se aceptan esos campos, y el servidor exige
capacidad de sesión y pertenencia guardada. Cookies/tickets no se registran en logs.
Mismo intento/carga produce un resultado único; carga alternativa, outsider,
CSRF cross-site y cuerpos excesivos son rechazados. Lectura por streaming acotada
aplicada también a las rutas legacy; Origin se compara con el destino Host real
del adaptador Next. Caché desactivada en el circuito durable.

Recepción y replay se separan para no mantener un lock financiero durante la
simulación. Reclamación de30s y CAS protegen recuperación/concurrencia; el replay
usa sólo la hora de recepción de PostgreSQL, nunca un timestamp aportado por cliente.
Hay límite absoluto de ticks/inputs y descarte temporal previo al replay durable.

Pendientes antes de producción:

- Identidad autenticada, antiabuso por usuario/IP/dispositivo y permisos operativos.
  El entrenamiento limita20inicios por actor/día y2000intentos totales; un actor
  anónimo puede renovar cookie. Es un límite provisional, no identidad ni WAF.
- Cron/worker externo para reconciliación sin tráfico, límites de carga y presupuesto
  CPU del replay medidos; el barrido actual es acotado y bajo demanda. Retención
  y limpieza deben sustituir el tope de almacenamiento antes de un servicio sostenido.
- Rotación de claves y estrategia de verificación histórica al conectar producción;
  no cambiar claves a mitad de intentos sin un proceso de transición revisado.
- Ledger/reservas/asientos, pagos, notificaciones/outbox y ranking alimentado por
  liquidaciones. Ningún resultado, recibo o saldo local actual autoriza dinero real.
- Mine/Solitaire ocultos y grupos con membresía auténtica: integrar sus capacidades
  específicas sin enviar secretos ni simular rivales como si fueran usuarios reales.

## Validación

`verify-public-attempts.ts` ejecuta PostgreSQL real en esquema efímero local:
1000escenarios sin repetición/ciclo, plaza única, mismo manifiesto A/B, inicio y
registro idempotentes, replay, resultado recuperado entre workers, interrupción
prolongada, inmutabilidad, prefijos de21juegos, abandono y expiración irreversible,
outsider/seed/carga alternativa y reloj imposible. No hay skip/fallback a memoria.
Se ejecuta en `pnpm test:repository`, junto a los repositorios anteriores.

`qa-public-matches.cjs`: dos jugadores táctiles vertical/horizontal, veinte dardos
cada uno, comparación real y reenvío, desconexión/salida/reinicio variado, CSRF,
outsider, tamaño de body y score añadido. Incluye rotación, eventos BFCache, historial tras recarga y un modo Stack táctil
para los adapters previos. Sólo acepta localhost; no prueba wallets
ni usa sesiones de jugadores reales. Estado final de validación en release/ledger.
