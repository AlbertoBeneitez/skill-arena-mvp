# GALACTIC GAMES · Mine Grid y escenarios privados

Estado: core 1.0.0 y autoridad común validados; candidato local, todavía no activado en el catálogo público. La versión 0.1 existente sigue disponible. No hay usuarios, competición ni dinero real activados.

## Compatibilidad

El core nuevo tiene su propio adapter append-only. V2, hashes, firmas, escenarios públicos y verificadores históricos permanecen reproducibles. Los manifiestos privados V3 solo se aceptan con autorización explícita del servidor; el HTTP histórico los rechaza.

El servidor emite una identidad `gameId + gameVersion + scenarioId + seed`, almacena una vez el manifiesto privado y lo vincula a ambos participantes. El cliente recibe únicamente pistas reveladas, vidas, score y una revisión. Nunca recibe la seed, el manifiesto completo o la distribución oculta. La generación privada usa HMAC-SHA256 con la seed completa y dominios versionados, sin reducirla a un estado de 32 bits.

## Reglas Mine Grid 1.0.0

Cinco sectores: 6×7/5 minas, 6×8/7, 7×9/10, 7×10/14 y 7×12/18. Apertura obligatoria segura con vecindario despejado; cada tablero pasa un solucionador de deducciones públicas sin adivinación. Dos escudos, penalización de 250 por mina y derrota al agotarlos. Cada casilla segura revelada vale 120; completar un sector añade `max(200, 600 - 3 × (accionesDelSector - 1))`. Las banderas no dan puntos. Se premia eficiencia, nunca un reloj declarado por el cliente. Límite de 999 acciones aceptadas.

Los ticks representan comandos aceptados consecutivos, no frames ni tiempo de reacción. El replay común reconstruye la partida y verifica la finalización. La UI solo representa la proyección pública y emite OPEN/FLAG.

## Persistencia y concurrencia

`CommandAttemptRepository` se desacopla del proveedor. PostgreSQL usa CAS, pertenencia y hash del manifiesto, comandos idempotentes y prefijos inmutables. La migración aditiva `db/migrations/002-command-attempts.sql` debe aplicarse explícitamente después de 001; nunca se ejecuta en build o al iniciar la aplicación. El borrado repetido del match elimina los intentos asociados sin fallar. No constituye una implementación completa de borrado RGPD de identidades/ledger.

Los adapters en `lib/server/demo` son exclusivamente locales/pruebas. `ALLOW_LOCAL_HIDDEN_GAMES=1` habilita `/qa/mine-grid` y sus endpoints solo fuera de Vercel. La página evalúa la condición por petición. `VERCEL=1` bloquea este modo incluso si la bandera local está presente. No existe fallback de producción a memoria o SQLite.

## Integraciones pendientes

- Seleccionar/configurar identidad autenticada y PostgreSQL, sin acoplar el dominio a un proveedor.
- Conectar las rutas de producción al actor autenticado y a ambos repositorios durables; no basta una bandera para activar las rutas locales.
- Emitir emparejamientos reales con un único manifiesto, autorización de participantes y políticas de expiración/retención.
- Vincular resultados terminales autoritativos al flujo de resultados y ledger, con consumo durable idempotente.
- Consentimiento versionado, política de publicación y borrado de identidad; no se importó código del ZIP sin licencia.
- Activar el nuevo loader del catálogo únicamente cuando este flujo esté disponible y validado.

La prueba local usa una capacidad HttpOnly separada de una futura identidad autenticada. No representa login de producción. No se registran seeds privadas ni layouts en logs/UI.

## Validación

320 tableros reproducibles, 64 partidas completas, fixture golden de cinco sectores, replay a 60/120/144 Hz, apertura segura, inputs inválidos, límites, banderas, penalizaciones y finalización. Autoridad: pertenencia, payload exacto, conflictos, revisiones obsoletas, concurrencia e intentos independientes de dos participantes con el mismo escenario. PostgreSQL real local: migraciones repetibles, binding, CAS, unicidad y borrado idempotente.

QA Chromium táctil real, 390×844 y 844×390: resolución usando solo pistas públicas, cinco sectores, derrota, reinicio, pointer cancel sin comando, proyección sin seed y cero errores de página. No sustituye QA humana en dispositivos físicos.

## Candidato continuo V2 · v80

Mine2.0 reutiliza el kernel V1 de apertura/deducción/flags/penalizaciones y su
generador privado en un solo campo7×12/18minas, con apertura segura y dos escudos.
No transición/reemplazo ni niveles en la proyección/UI. Alcance=66casillas seguras
máximo. Score/inputs/replay siguen autoritativos en el controlador privado común.
El ordinal de comandos no mide segundos reales ni adjudica desempates temporales.

1000seeds de prueba producen1000tableros distintos y resolubles sin adivinar;64
partidas completas y golden8379/tick47/hash0e1895de3ca66b2e042b27e35335db262bbc9ff81f3f86d097bae184b85262b4.
Proyección sin seed/valores ocultos; paired participants y registros independientes,
idempotencia/pertenencia comprobadas. V1 queda reproducible en su archivo.
QA táctil local producción portrait y landscape: victoria/derrota/reinicio/cancel
y consola correctos, sin transferir secretos al navegador. Catalog0.1 INTEGRATED
continúa intacto: esta unidad prepara el candidato, no activa integración pública.
El singleton local pasa aV2; está bloqueado en Vercel incluso con la bandera local.
Auth/PG privados durables siguen como integración pendiente, sin fallback a SQLite.
