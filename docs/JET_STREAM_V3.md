# GALACTIC GAMES · Jet Stream V3

La versión 3.0.0 conserva el ID jet-stream, el registry, el loader lazy, lifecycle y verificación por replay comunes. Los cores/verificadores 1.0.0 y 2.0.0 no se modifican. La implementación nueva compone el integrador entero, las colisiones, los recogibles y el scoring de V2; no hay otro sistema de seeds, replay o física.

## Aprendizaje y progresión

El primer toque inicia inmediatamente el vuelo. Antes de ese toque hay hasta 480 ticks (cuatro segundos) de asistencia de despegue sin desplazamiento ni puntuación. Si no se toca, la asistencia acaba al tick 480; no se puede mantener indefinidamente. Las tres vidas permiten aprender y recuperarse de un error.

Los dos primeros huecos tienen 250 px y los dos siguientes 230 px, centrados en 305 px. Gravedad inicial 680 px/s², aumentando 80 por portal hasta los 1000 de V2. Impulso inicial -290 px/s, creciendo 15 por portal hasta -350. Cooldown inicial 16 ticks, después 12. Las cantidades y remainders permanecen enteros a 120 Hz.

Después de cuatro portales varían altura y anchura reproduciblemente: ancho base 220 px, reducción 1,7 por índice, jitter ±18 y mínimo 110. Variación del centro comienza en ±28 px y aumenta hasta ±65. Desde el portal 8 aparecen ocasionalmente dos pasos en la misma vertical. Un paso secundario de 126 px permite elegir otra ruta. Las recargas de vida de V2 se conservan; ambas personas reciben la misma disposición al compartir manifiesto. La velocidad horizontal de V2 también se conserva.

Las ventanas se preparan una sola vez al generarse; nunca cambian durante la aproximación ni según el dispositivo. El namespace jet3 versiona esta transformación del generador compartido. Sobrevivir tres minutos o alcanzar el target autoritativo supera el reto. El target por defecto del catálogo es 45000 puntos; no representa dinero. Puntuación y penalización por portal dañado siguen siendo de V2.

## Presentación y procedencia

Controles: toque sobre la superficie, espacio o flecha arriba. Instrucción breve de despegue, estado de práctica, sector y escudos; sin nombre lateral distractor. Se conservan el fondo espacial, los recogibles y la explosión de 720 ms. El tick terminal permanece congelado durante la animación. Cancelar/desmontar impide un submit tardío; resultado se verifica una sola vez.

Se conserva la atribución a la inspiración MIT de digitsensitive/phaser3-typescript descrita en Jet V1/presentation; no se importan assets ni un runtime externo. La extensión es original.

## Pruebas y límites

Golden de tres minutos: 101830 puntos, tick 21600. Treinta y dos partidas completas, replay repetido y render 60/120/144 Hz; 128 aperturas de cuatro segundos sin daño ni puntos; ambas ventanas, recogibles, cooldown, inputs inválidos y derrota sin controles. Históricos permanecen congelados. QA táctil real completa de tres minutos en vertical/horizontal: 236 portales, 101296/106070 puntos, 57/58 recargas, replay de servidor, reinicio y ausencia de overflow/errores de página. La explosión dura aproximadamente 727 ms con tick congelado; salir durante ella cancela el submit. Cancelación seguida de doble toque registra exactamente un FLAP y respeta el cooldown; derrota posterior se verifica y reinicia sin errores de consola. Typecheck/lint, históricos, tests deterministas y build pasan.

Competición, identidad y dinero reales siguen desactivados; pairing autoritativo/persistencia/identidad requieren los proveedores aún no elegidos. QA física humana recomendable.
