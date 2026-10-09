# v59-mobile · Registro de partida al salir

Parte de v58. Los 18 VERIFIED activos registran el último tick/estado realmente
simulado, ligado al attempt_id. Terminal detectado por input o simulación se
compromete antes del feedback; RAF reutiliza el mismo vuelo. Salir compromete
un prefijo abandonado si sigue vivo. No se añaden inputs pendientes ni releases
inventados, ni se simula después de abandonar. Snapshot inmutable y gate único;
respuesta anterior no contamina otro intento.

Endpoint común acepta explícitamente `record_kind: abandoned` solo para un
prefijo válido sin resolver. Reutiliza firmas, límites, orden/semántica de inputs,
replay del adapter y control de reloj. Recibo de seis campos: recibido/procesado,
verified:false, durable:false, attempt_id y final_tick. No score/winner/settlement.
La ruta delega su procesamiento a verifiedMatch; límites de bytes/JSON conservados.
Terminal normal, hashes históricos y rechazo de privados V3 intactos. ADR 006.

Pagehide compromete y separa transporte; fetch keepalive para cuerpos≤60000bytes.
BFCache solicita intento nuevo al volver, no reanuda un registro cerrado.
Blur/rotación no abandonan. Cancelar un start pendiente no fabrica partida.

Typecheck/lint, suite histórica/determinista y build pasan. Tests nuevos cubren
29 versiones, prefijos con/sin inputs, receipt exacto, terminal/hash, acciones
imposibles, ticks/orden/límites, firmas/seed/privados/reloj y campos cliente
ignorados. QA Chromium nativa vertical/horizontal: ocho recibos reales por
recorrido, UP/STOP reconstruidos, salida sin inputs, respuesta retrasada4500ms
con reemplazo previo, guardia history/back, recarga real, keepalive observado,
dos ciclos de handlers BFCache (no restauración real afirmada), start pendiente
cancelado. Submit único y cero errores importantes. Jet derrota/salida durante
explosión y Dardos partida completa mantienen replay/resultados y reinicio.

Recepción no implica persistencia durable, consumo idempotente, retry ni garantía
offline/cierre duro. Mine/Solitaire legacy aún requieren migración segura a la
autoridad común privada. No nueva capa de RNG/replay, proveedor, endpoint ni
activación de usuarios/dinero/competición real. Siguientes mejoras en el ledger.
Comprobar CI/Vercel ready antes del fast-forward mobile-test.
