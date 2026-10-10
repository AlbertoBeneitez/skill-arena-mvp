# v72-mobile · Dardos: presencia, vuelo e impacto

Mejora exclusivamente visual de `darts@2.0.0`. Sin cambio de física, objetivos,
inputs, gesture, tolerancias, scoring, deadlines ni manifiestos. V1/V2/core/
adapters/hashes permanecen exactos. Dardo propio visible en(195,550) desde apuntado,
orientado al retículo actual; no proyección de destino. Shaft metálico, grip,
fins orbitales y sombra. Al soltar, el sprite se desplaza desde esa misma posición,
reduce tamaño por perspectiva y deja una estela acotada. Interpolación solo visual
hasta el impacto ya decidido por el core en24ticks; marca fija y pulso/partículas
en ese punto. Máximo tres impactos previos y un proyectil, sin imágenes externas.

La flecha procedural inferior se sustituye por el objeto preparado. Se retiran
puntos del HUD/toast; quedan objetivos/tiempo, contador de dardos y éxito/error.
No cambia el scoring técnico autoritativo. La presentación está separada en un
helper readonly; renderer, clock, lifecycle, música, canvas/input y subida de
registro siguen comunes. No se crea una pila competitiva nueva.

Tests específicos: V1/V2 golden y64 secuencias completas históricas; replay,
render60/120/144, inputs inválidos y límites del swipe. Renderer real transpilado:
100 semillas/2500frames de vuelo, sprite inicial, tamaño/posición progresivos,
impacto exacto en24ticks, cero ghost/duplicado, timeout sin dardo ficticio,
contexto balanceado y estado no mutado. Typecheck/lint/build y diff-check pasan.
Se inicializa SWC explícitamente en la prueba para funcionar también aislada.

QA Chromium producción con escenarios emitidos y15swipes nativos por partida:
victoria vertical13 objetivos/10311/t1607, horizontal15/11317/t1596;
derrotas0/t1572 y0/t1552. Dardo visible desde apertura, múltiples frames de vuelo
real, reducción de tamaño y punto de impacto igual al replay enviado. Matrices
canvas nativas float32 se comparan con tolerancia0.001 unidad lógica, tras detectar
que una tolerancia1e-6 rechazaba redondeos de0.00001; core/hash siguen exactos.
Cancel/blur no suman tiros; sin botón separado ni puntos HUD. Reinicio, nuevo seed,
receipt de abandono, envío terminal único y consola limpia pasan. Capturas
vertical/horizontal revisadas; tickets/registros fuera del repo.

Interpretación de «lanzamiento del dado»: el dardo del juego existente, sin crear
un juego de dados ni introducir RNG de aterrizaje. Arte/código propios, sin assets
comerciales ni audio protegido. QA física posterior no bloquea. Resto de tareas
sigue en ledger; siguiente corrección acotada: cuerpos de Jet hasta los extremos
visuales, conservando exactamente huecos y colisiones V4.
