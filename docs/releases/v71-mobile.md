# v71-mobile · Memoria: descubrir en lugar de fotografiar

`memory-match@2.0.0` comienza con todas las cartas ocultas y acepta flips desde
tick0. Un tablero único6×4/12parejas generado por shuffle común versionado, sin
las dos posiciones emparejadas fijas V1. Sin preview completo ni redistribución.
Cada descubrimiento actualiza un bitmask de cartas vistas reproducible. Un fallo
solo cuenta si la pareja correcta de la primera carta ya se había visto y sigue
sin emparejar. Descubrir a ciegas consume tiempo; no castiga vidas por azar.
Se conservan dos errores protegidos/ocho vidas, cooldown, presentación temporal
del mismatch, scoring/avance por parejas únicas y fin interno12. Duración máxima
180s y192inputs explícitos; no niveles ni farming.

Extensión pequeña del core: compone literalmente create/step/canApply/apply V1,
con un nuevo tablero inicial y restauración únicamente de penalizaciones ciegas.
V1/core/adapter/golden e inputProtocol1 quedan intactos. UI usa el lifecycle,
render/audio/fondo/loader comunes, mismas áreas táctiles y símbolos propios.
Registry/adapters/registro común añadidos; no hay autoridad paralela ni semillas
competitivas elegidas por cliente. Registro terminal inmediato/abandono preservados.

1000 tableros distintos reproducibles y128 partidas completas a42/126ticks por
input con un plan que solo aprende caras realmente descubiertas: todas ganan con
ocho vidas. Golden win12/t1611/32inputs/hash
sha256:d5d23356aab9a2892334136625a2919509216b0c29534a012d583cbcc0a81eb5;
golden derrota por diez errores conocidos0/t1698/22inputs/hash
sha256:bec7bc9af070dbbb8af5976a1f40b7f16508b551c50bae248932724109c81d41.
Replay/render60/120/144, inputs inválidos, reloj/RNG, cero caras iniciales,
máximo dos caras nuevas en mismatch, cooldown/duplicados/parejas ya resueltas,
descubrimiento con una vida sin terminal heredado, mapa inmutable y timeout pasan.
V1 golden sigue exacto. Registros39versiones, spoof de resultados rechazado,
prefijo real/terminal separado, manifiestos V2/V3 y lifecycle pasan. Typecheck/lint
y build pasan. Una invocación local apuntó al nombre incorrecto del test de
manifiestos; se ejecutó correctamente verify-match-contracts, sin cambiar contrato.

QA Chromium producción, escenarios realmente emitidos y touch nativo, sin leer
layout/seed para planificar: victorias12 vertical18.300s/horizontal16.717s,
36flips legales cada una, cero errores conocidos. Derrotas diez errores conocidos
vertical43.833s/horizontal38.408s. Timeout de reloj real180.000s conserva una
pareja. Cancel/drag/duplicado/blur,44px mínimos/320px, rotación, sonido, resultado,
reinicio/seed nueva, envío único y receipt con un flip real pasan; consola limpia.
Capturas revisadas; artefactos emitidos fuera del repo. El actor activa sonido
antes de los gestos CDP cancelados para evitar supresión del click sintético;
no se modifica el audio del producto ni el reloj para conseguir el resultado.

## Límite de información privada

Eliminar el preview corrige la foto inicial; no convierte una seed pública en
secreta. Un cliente modificado puede reconstruir el tablero y una ayuda externa
puede recordar caras vistas. No se promete prevención de bots/fotos ni se activa
competición real. `HiddenCommandAuthority` sigue siendo la integración prevista,
pero hoy asigna tick=índice de comando: no implementa el tiempo120Hz, cooldown y
revelado temporal de esta variante. Conectarla directamente rechazaría flips o
cambiaría el desempate. Hace falta una propuesta compatible de tiempo/receipts
persistidos y proyección privada, además de identidad/PG antes de activación;
esta versión no modifica ese límite de seguridad silenciosamente.

Sin assets/código comerciales añadidos; símbolos propios preservados. Seguimiento
físico del dueño no bloquea trabajo. Las restantes solicitudes del10 de octubre,
comparación común/rotación1000 y privados Mine/Solitaire siguen en el ledger.
Siguiente unidad: dardo visible desde apuntado y vuelo/impacto de Dardos V2.
