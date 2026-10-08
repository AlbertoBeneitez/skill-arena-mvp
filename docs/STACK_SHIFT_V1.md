# GALACTIC GAMES · Stack Shift V1

## Auditoría y reparación

La versión integrada 0.1 dibujaba 16 filas de 40 px (640 px) sobre un canvas de 576 px: las dos últimas filas y el suelo quedaban recortados. Su colisión por celdas ya apoyaba correctamente las piezas; se conserva esa mecánica, las seis formas y el giro normalizado con kicks. No se inventa una física continua innecesaria para una rejilla. El componente histórico queda archivado sin carga en el catálogo.

La versión 1.0.0 separa reglas y UI. El campo visual mide 8×16 celdas de 30 px, desde y=98 hasta y=578, dentro de 620 px lógicos. El canvas reserva 104 px físicos para controles en vertical y 100 px laterales en horizontal. El suelo y las 16 filas se ven completos; el ghost usa el mismo cálculo de apoyo que el core. La metadata dinámica de filas/nivel reutiliza el HUD común a tamaño físico legible, sin otro lifecycle.

## Reglas y progresión

Primeras cuatro piezas cuadradas para enseñar a llenar filas sin rotar. Después, bags deterministas con una de cada una de las seis formas, generadas desde el PRNG compartido, seed y namespace versionado. No hay archivos manuales de niveles ni elección de seed competitiva en cliente. Se muestra la siguiente pieza para planificar.

Core a 120 Hz, board entero. Caída cada 84 ticks inicialmente; disminuye dos ticks por fila y dos por cada cinco piezas, mínimo 28. Al tocar un apoyo, 36 ticks permiten reajustar; máximo ocho reinicios de lock por pieza. HARD_DROP asienta inmediatamente sobre la última posición legal. Pausa de 24 ticks después del lock impide que un doble toque coloque la siguiente pieza accidentalmente. Giro horario normalizado, kicks 0/-1/+1/-2/+2. TOP_OUT si la nueva pieza no puede entrar.

Scoring: 120 por pieza, bonus de filas 900/2200/3900/6200 para una/dos/tres/cuatro, combo consecutivo +100 por aumento hasta 400; hard drop +6 por fila y soft drop +1. Todos calculados en core. Dieciocho filas, supervivencia de tres minutos o target del manifiesto superan el reto. El target orientativo del catálogo es 16000; la práctica creada puede usar un límite distinto emitido por servidor. Los puntos no son dinero.

## Competición y controles

Acciones LEFT, RIGHT, ROTATE, SOFT_DROP, HARD_DROP; cooldown de seis ticks, máximo 6000 inputs y un input por tick mediante el runtime común. Estado final, score y hash se reconstruyen en servidor. Registry VERIFIED, loader lazy y adapter append-only. Históricos de otros juegos/V2 se preservan. No se activa competición real ni identidad/dinero reales.

Touch: cuatro botones amplios para mover/girar/asentar; teclado flechas y espacio. Cancelación y doble toque no generan un segundo drop. Espacio visual común, bloques/ghost/suelo originales; sin assets ni código de terceros nuevo. Inspiración en mecánicas consolidadas de bloques, conservando formas del proyecto.

## Validación

Golden 27714 puntos, tick 1536; replay repetido/render 60/120/144 Hz, inputs inválidos. Apoyo exacto en suelo y sobre piezas, ausencia de sinking, giro en pared, pausa contra doble drop, lock natural de 36 ticks, dos filas de enseñanza por 3016 puntos. Treinta y dos partidas con reconstrucción exacta: 29 victorias y tres derrotas de un controlador de prueba con lookahead de la siguiente pieza. No se presenta ese controlador como solución universal. 128 aperturas suaves y bags equilibrados. QA táctil final: victorias de 18 filas en vertical (26890 puntos) y horizontal (26288), derrota TOP_OUT (1278), controles físicos ≥44 px sin tapar el suelo, HUD legible, doble toque/cancelación, resultado único y reinicio; cero errores de página/consola. Regresiones táctiles Orb Burst y River Dash pasan tras ampliar el HUD. Typecheck/lint, suite determinista/históricos y build pasan. QA física humana recomendable.
