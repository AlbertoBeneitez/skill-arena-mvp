# v80-mobile · Preparación privada de setups

Base v79-mobile5756cd4, CI38061287955success/VercelReady/mobile-test fast-forward.
Dos unidades independientes, sin migrar el catálogo público ni activar servicios.

## Mine Grid

Core privado2.0 continuo7×12/18minas/66casillas seguras; reutiliza el kernel/generador
V1 en su tablero terminal, sin transición a campos nuevos. Archivo V1 intacto.
1000tableros distintos reproducibles, todos resolubles sin adivinación;64partidas
completas y golden8379/tick47/hash0e1895de3ca66b2e042b27e35335db262bbc9ff81f3f86d097bae184b85262b4.
Replay/render60/120/144/invalid inputs/flags/penalizaciones/derrota, autoridad común
con pairing/records independientes/idempotencia/pertenencia y proyección oculta.
UI local elimina sectores, score crudo y tutoriales; muestra alcance y escudos.
QA Chromium táctil sobre producción opt-in local: portrait victoria8343/revisión60,
derrota2740/revisión3; landscape8382/revisión47, derrota1540/revisión5. Apertura,
cancel sin comando, reinicio con nuevo intento, consola/overflow limpios. Solo
pistas públicas usadas; sin acceso a seed/distribución. Replays históricos pasados.

## Solitaire Sprint

Generador privado candidato1.0 con la RNG HMAC común de key completa y dominio
versionado;52cartas/7columnas/24stock. Muestra1000setups completos e iniciales
visibles distintos. Sin templates públicos pequeños inferibles. Proyección oculta
stock y cartas boca abajo, copia sin modificar estado. Permutación/seed/repetición/
RNG/reloj/golden350fb434ddd9422966a56e88888d01919de868fc85147df30bd2330ce0f57f49
verificados. No es core/replay/promoción VERIFIED ni garantía de resolubilidad.

## Límites y validación global

Los dos juegos públicos0.1 siguen INTEGRATED con setups fijos. NO afirmar que la
variedad visible queda cerrada. ParaMine conectar auth/repositorios durables; para
Solitaire además core/cierre/farming, policy de solvabilidad y QA completa. No se
activan proveedores, auth/dinero reales ni persistencia de producción en memoria.
La modalidad local privada permanece prohibida conVERCEL=1 incluso conALLOW=1:
HTTPstart devuelve not-configured sin sesión y la rutaQA devuelve404. Se comprobó
por HTTP y test de guard. El generador/stream privados no aparecen en assets cliente.

Typecheck/lint, tests pertinentes/goldens históricos, producción build y diffcheck
correctos. Logs/partidas reales quedan fuera Git; fixtures usan seeds sintéticas.
CI/Vercel deben comprobarse antes del fast-forward normal de mobile-test.
No terceros/assets protegidos ni secretos introducidos. QA física del propietario
no bloquea avances. StackShift conserva sus seis formas: I3,L3,Z4,O4,X5,L4.
Se preguntó si las doce son pentominós F,I,L,N,P,T,U,V,W,X,Y,Z, sin respuesta todavía.
Brick continuo/boost y Phalanx continuo ya están cerrados en v78/v79. Resto del
backlog y la comparación alcance/tiempo siguen en PRODUCT_BACKLOG_STATUS.md.
