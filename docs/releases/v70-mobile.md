# v70-mobile · Orb Burst: un campo continuo y lanzamiento táctil

`orb-burst@2.0.0` conserva protocolo1 y el integrador entero de trayectoria V1;
V1/core/adapters/goldens siguen archivados. Un campo continuo de108 orbes
originales, doce filas seedadas, sin reset/sector/pausa. Cuatro filas iniciales,
tres colores al aprender y cuatro después. Suministro de una fila cuando la
ocupación baja; conserva IDs y X/vecindad mediante paridad explícita. Avance por
originales retirados una sola vez: disparos/presión no dan avance ni farming.
Ammo actual/siguiente estable; como máximo un color consecutivo ausente.

Presión tras cuatro fallos inicialmente, tres después de54 originales, o45s de
inactividad; suministro y presión nunca se acumulan ni descienden durante un
proyectil. Una inserción bloquea18ticks; descenso visual12ticks solo dentro de
ese bloqueo. Límite técnico6min/4000inputs, objetivo108 interno, incluso si el
cliente intenta manipular target. La derrota dibuja posiciones reales, sin
congelar un descenso anterior.

Sin botón LANZAR ni proyección de caída. Apuntar y soltar dispara; guía corta
solo de dirección. HUD de avance/indicadores, colores más símbolos, orígenes
visuales discretos, bursts acotados y fondo/audio comunes. Cámara de campo
completo, rotación horizontal con inversa táctil. Extracción de cámara puramente
visual compartida con Billar: equivalencia numérica/calls exacta de sus4320
roundtrips,540 combinaciones y viewport/DPR; su física/UI quedan intactas.
El terminal sube el registro inmediatamente antes del impacto visual300ms.

Tests:1000 disposiciones realmente distintas, 34 victorias completas, presión y
continuidad, último objetivo con basura residual, IDs/vecinos/paridad,89 ángulos
comparados contra V1, no farming, overflow/cooldown/idle/límites. Dos goldens,
replay repetido, render60/120/144, inputs inválidos y rechazo de reloj/RNG.
Golden principal108/t13047/hash
sha256:16318210df5e5145b81064e2ed4440e4464a91906c6a24bf21dd270711c70f1f.
Renderer1602 casos/6viewports/3DPR, puro, sin forecast. Contrato V2/históricos,
38 versiones de registros/prefijos, resultado cliente ignorado y lifecycle
compartido pasan. Typecheck/lint y build de producción pasan.

QA Chromium de producción con touch nativo, escenarios realmente emitidos y
sin modificar seed/target/clock/estado: victoria vertical108/22tiros/63.542s;
horizontal108/30tiros/93.283s con una fila de presión; derrotas por overflow
vertical25.725s y horizontal25.317s, diez tiros cada una. Cada proyectil visible
y en movimiento; cancel/blur/dobletap durante vuelo/rotación/320px, reinicios con
campos nuevos, envío terminal único y receipt de abandono con input real pasan.
Capturas revisadas, consola limpia. La prueba inicial observaba el instante de
salida aún en boca de lanzador; se corrigió el observador para esperar movimiento,
sin alterar el juego. Tickets/registros emitidos se conservan fuera del repo.

Implementación/arte propios, linaje MIT de Orb preservado en THIRD_PARTY_NOTICES.
No se activa competición/dinero/auth reales. Rotación1000 sin repetición, comparación
común avance/tiempo, Brick/Phalanx continuos y privados Mine/Solitaire permanecen
pendientes. Las nuevas solicitudes del10 de octubre están en backlog/ledger;
siguiente unidad: Memoria sin preview fotografiable y límite público/privado.
QA física posterior del propietario no bloquea la siguiente iteración.
