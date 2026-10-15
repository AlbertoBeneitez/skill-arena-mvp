# ADR007 — Intentos durables, escenarios compartidos y abandono

Aceptado para implementación por el propietario el15 de octubre de2026:
conectar asignación/registro/idempotencia y dar por perdida una partida iniciada
si el jugador sale o pierde conexión. No autoriza dinero real ni auth de producción.

Se amplían los repositorios y el lifecycle existentes. No hay otro motor de
replay ni nuevas reglas históricas: los cores/hashes V2/V3 se conservan. La
política de aplicación nueva se fija como `forfeit-on-disconnect-v1` en cada
partida durable, separada del estado final de su core.

- PostgreSQL almacena manifiesto V3, intento, registro, auditoría de replay,
  resultado y resolución. Los IDs/inputs del cliente no seleccionan seed,
  reglas, resultado ni participante. El servidor recupera esos datos guardados.
- `arena_matches.player_b` puede estar vacío sólo antes de la primera asignación.
  La migración003 permite exclusivamente NULL→participante una vez. Manifiesto,
  A, B ya asignado y registros/resultados históricos siguen inmutables. Es la
  ampliación necesaria del repositorio de dos participantes conocidos, no una
  lista paralela de identidad/membresía. El contrato de creación privada A/B
  conocidos no cambia.
- A completa y entrega su registro antes de hacer disponible su reto a B. Un
  segundo jugador reclama la plaza atómicamente y recupera el mismo manifiesto.
  Dos reclamantes no obtienen la misma plaza. A no responde a su propio reto.
- Rotación por juego/versión de1000identificadores del generador común: offset
  inicial de servidor y cursor transaccional. Se repiten sólo al iniciar otro
  ciclo. Un duelo consume un escenario, no uno por jugador. No hay archivos
  manuales por seed. Los primeros elementos de un juego pueden ser comunes por
  diseño; distintas seeds no certifican por sí solas1000layouts jugables únicos.
- Inicio idempotente por actor+clave de petición; payload distinto con la misma
  clave entra en conflicto. Sólo un intento jugando por actor. Una partida
  terminada o perdida no se reabre por reintento, heartbeat o BFCache.
- Un intento comienza al guardarse y emitirse. Heartbeat cada5s y lease20s en
  reloj PostgreSQL, con límite absoluto según el juego. Salir, ocultar la pestaña
  o señal offline cierra desde el cliente; cierre duro/red caída sin aviso pierde
  al vencer la lease. No se promete detección instantánea de una red cortada.
- El vencimiento es autoritativo aunque no haya peticiones. Se materializa al
  consultar/recibir/pulsar ese intento o en el barrido acotado de disponibilidad.
  Un scheduler operativo podrá ejecutar el mismo barrido; no hay cron externo
  configurado. Una petición tardía nunca revive ni renueva una lease vencida.
- Guardar primero el registro y su hora de recepción; después reclamar el trabajo,
  ejecutar el replay compartido y guardar el resultado mediante CAS. Un trabajo
  interrumpido se recupera tras expirar su reclamación. La validez temporal usa
  la recepción PostgreSQL; una espera del worker no invalida la entrega a tiempo.
- Un registro completo ya recibido tiene prioridad sobre un abandono posterior.
  Reintentar la misma carga recupera el mismo verification_id/replay_hash. Cambiar
  la carga es conflicto. El cuerpo recibido y su resultado no se reescriben.
- El abandono conserva registro y auditoría, pero pierde por política. Si el
  navegador desaparece antes de entregar inputs, se conserva el intento perdido;
  no se inventa un log completo ni se afirma haber reconstruido inputs desconocidos.
  Un acuse HTTP nunca es una orden de pago. ADR006 se mantiene para sobres V2 legacy.
- La resolución considera primero forfeits/rechazos y después avance (height o
  score cuando no existe height) y tiempo autoritativo; empate exacto conserva
  devolución. No usa rivalScore local ni da por ganador del duelo al core.won.

La integración se habilita explícitamente con ALLOW_PERSISTED_MATCH_TRAINING y
PostgreSQL. Su identidad es una capacidad anónima de entrenamiento HttpOnly,
SameSite Strict; se almacena/expone su hash, no el bearer de la cookie. No es
OAuth ni una identidad financiera. Auth real, ledger, liquidación, notificaciones,
retención y conexión de proveedores permanecen desactivados/pendientes.

Sin opt-in, el HTTP V2 de entrenamiento y su archivo siguen disponibles. Con
opt-in no hay fallback a memoria o verificación stateless cuando falla PG.
Antes de habilitarlo en un despliegue se drenan los intentos legacy en vuelo;
los sobres nuevos sólo identifican el intento y sus inputs. Mine/Solitaire
legacy no se habilitan como duelos por esta migración; Mine privado conserva
su autoridad y configuración separadas, y grupos simulados no entran al pool público.
