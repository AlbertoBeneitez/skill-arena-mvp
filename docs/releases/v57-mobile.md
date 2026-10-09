# v57-mobile · Registro terminal y lenguaje de producto

Parte de v56-mobile. El registro de los 18 VERIFIED se compromete al primer
terminal, antes de render/feedback terminal y de la animación. Snapshot JSON
inmutable: manifest/ticket, inputs seq/tick/action y final_tick. Navegar fuera o
reiniciar desacopla el transporte sin abortarlo; generación vieja no publica
resultado. El server sigue calculando score/tiempo desde replay, sin datos finales
confiados al cliente. Gate conserva un vuelo por intento; reset ordinario sigue
cancelando trabajo no comprometido. La animación sigue durante el request sin
overlay ni dependencia del status que detenga RAF.

Frontend sin etiqueta demo: sesión local, saldo ficticio, rivales simulados y
ranking de ejemplo. Producción y ejemplo siguen aislados; proveedores de auth
siguen sin conectar. Movimientos antiguos se adaptan al mostrarse, sin renombrar
IDs, tablas, rutas o versiones. Sin textos de nivel en los recorridos que ya eran
continuos: Jet/Alien/Metro/Orbit/Sky/Stack Shift. Esto no pretende resolver cambios
de tablero o pausas de otros juegos; se versionan por unidades posteriores.

Typecheck/lint, suite histórica/determinista/lifecycle y build pasan. Regresión
Gate cubre detach antes/después de microtask, dedupe, transporte tardío y reset.
QA táctil Chromium: entrada/Avatar/perfil/legal y reload, grupos/configuración/
portapapeles, ranking paginado y fuentes aisladas, catálogo/loading/error;
vertical/horizontal sin copy demo ni errores importantes. Jet derrota real con
explosión: registro inmediato, finalTick790/6583ms, un único request; salir durante
animación y retrasar respuesta real1800ms conserva recepción y no crea resultado
sobre catálogo. Reinicio con manifest nuevo. La animación mantiene al menos650ms;
no se alteran targets ni seeds en esa regresión.

Límites explícitos: HTTP verify sigue stateless y no hay ACK durable/retry/outbox;
no garantiza cierre duro/offline. Abandono antes de terminal y los dos INTEGRATED
(Mine/Solitaire) aún no tienen registro común. Su migración reutilizará autoridad
privada existente. No se activa dinero/auth/competición real ni se promocionan
legacy por telemetría. CI/Vercel se comprueban al publicar.
