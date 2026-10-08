# Maze Rush 1.0

## Unidad y procedencia

Versión 0.1 archivada: conserva el código de nodos, giros y perseguidores para
referencia, sin modificar otros cores/verificadores. Tenía START=(8,17) dentro
de un muro del mapa fijo; movimiento, colisiones y score dependían de React y
setInterval reiniciado por direcciones/callbacks. No había replay de servidor.

1.0 es implementación original de esas mecánicas sobre coreRuntime.v1,
CoreCanvasGame, RNG/scenarios, registry lazy y adapter comunes. No se importan
assets, código ajeno ni dependencias. No crea otra arquitectura competitiva.

## Reglas reproducibles

120 ticks/s; coordenadas de celda enteras, independiente de render/pantalla.
Tres sectores: 9×11, 11×13 y 13×15. Postes y corredores generados por seed
versionada; cada barrera adicional solo se admite si todos los pasillos siguen
conectados. Inicio transitable, nodos alcanzables y tres pulsos por sector.

UP/LEFT/DOWN/RIGHT cambian el giro deseado; se ejecuta en el siguiente cruce
válido, manteniendo dirección hasta un muro o STOP. STOP detiene movimiento,
no el reloj. Cooldown de seis ticks, objetivo repetido rechazado, un input por
tick y máximo 3000 inputs. Movimiento cada 20/18/16 ticks según sector.

Inicio quieto y dos segundos para orientarse. Primer perseguidor visible pero
inactivo durante ocho segundos y hasta recoger doce nodos. Sectores posteriores:
cuatro segundos y cuatro nodos de aprendizaje. Uno/dos/tres perseguidores,
movimiento cada 64/56/48 ticks; BFS y desempates estables, alternan persecución
(dos fases de cuatro segundos) y patrulla (cuatro segundos). Contacto en la
misma celda o intercambio simultáneo de arista cuenta como choque.

Cada nodo puntúa 100 una vez; pulso verde +200 y ocho segundos de protección.
Durante pulso, contacto retorna perseguidor a origen y lo duerme cuatro
segundos, sin puntos repetibles. Tres escudos; choque −400 (mínimo cero),
retorno a inicio conservando nodos, un segundo para orientar y dos de protección.
Perseguidores descansan tres segundos tras el daño. Último escudo: derrota
PURSUER_COLLISION. Sector completo: bonus sector×500 + escudos×100,
recupera un escudo (máximo tres), dos segundos de transición. Tres sectores o
target emitido: victoria. Límite 180 segundos: derrota TIME_LIMIT.

## Validación

Golden: 27300, tick 6228, won; hash y inputs en scripts/fixtures/maze-v1.json.
El servidor deriva estado/score/finalización con manifest e inputs, ignorando
el score cliente. El HTTP actual sigue siendo demo; no activa emparejamientos,
identidad, ledger ni dinero real. Las futuras parejas usan la autoridad común.

Tests de conectividad/inicio/pulsos sobre 384 mapas; recorridos completos,
consumo único, turn buffering, stop/cooldown, protección, choque/edge-swap,
replay, invalid inputs, golden y render 60/120/144 Hz. La UI solo traduce input
y dibuja fondo compartido, relieve, nodos/pulsos y enemigos anticipados. Los
controles permanecen fuera del tablero en vertical/horizontal.

La QA automatizada observa dibujos públicos y pulsa controles reales. Su
planificador de rutas no entra en el producto ni altera reglas, seed o score.
La evaluación en móviles físicos la realiza el propietario como seguimiento,
sin bloquear las siguientes unidades de desarrollo.
