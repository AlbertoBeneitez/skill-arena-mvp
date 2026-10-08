# v47-mobile · Brick Relay

Parte de v46-mobile validada. Brick Relay 0.1 permanece archivado; 1.0
VERIFIED incorpora física, scoring e inputs al core/runtime/replay/registry
lazy comunes, sin modificar contratos históricos ni infraestructura de producción.

Cuatro sectores de 10/15/20/24 bloques. Lanzamiento vertical y pala amplia para
aprender; después blindaje, explosivos, bloques móviles, pala menor y velocidad
limitada. Rebotes dirigidos, tres vidas, recuperación y pausa entre sectores.
Fondo espacial común, relieve, trazas, impactos y feedback de caída. Código
original; sin nuevas dependencias ni assets/licencias externas.

Golden 31235/tick 22776. 16 recorridos completos y 128 aperturas seguras;
contacto círculo/caja, separación, blindaje, explosión, recuperación, aim
bounds/cooldown, tamaño de inputs, invalid inputs, replay y 60/120/144 Hz.
Typecheck/lint, suite determinista histórica, build y diff check pasan.

QA Chromium con touch nativo sobre build de producción: vertical 31493/tick
20410 y horizontal 31620/tick 19627, 69 bloques, cuatro sectores, tres vidas
finales; derrota 390/tick 1722/BALL_LOST. Cancel, blur, sonido activado mediante
toque sin reset, envío único, replay real del servidor, resultado y reinicio
pasan sin errores de consola/página ni overflow. El controlador de derrota
retira la pala después de cada saque; mantenerla debajo de la trayectoria
vertical inicial es seguro por diseño. Ninguna seed/regla/score se modifica
para estas partidas. QA física/comercial humana sigue recomendable.

Estado persistente actualizado: 20 juegos, 16 VERIFIED y cuatro INTEGRATED.
Pendientes: Maze Rush, Orbit Shift, Solitaire, integración pública privada de
Mine, calidad Piano, perfil/grupos/legal y límites externos auth/PG/ledger.
No se activa competición/dinero real ni se declara backlog completo.
