# GALACTIC GAMES · Billar 1.0.0

Implementación original, sin código ni assets de juegos comerciales. Variante arcade: cinco mesas, siete tiros por mesa, bolas objetivo numeradas y blanca. La apertura guía una embocada sencilla; después llegan combinaciones, más bolas y dos obstáculos orbitales fijos. Control: tocar/arrastrar para apuntar, seleccionar potencia y TIRAR; soltar el apuntado no dispara. En horizontal los controles se sitúan fuera de la mesa.

## Autoridad y reglas

Reutiliza registry, lazy loader, escenarios versionados, CoreCanvasGame, lifecycle, protocolo de inputs, replay común y adapter de servidor. El catálogo lo marca VERIFIED por replay, dentro de la demo actual; no activa competición o dinero real. Las partidas reales compartidas siguen pendientes del servicio de identidad/emparejamiento/persistencia documentado para la plataforma.

`billiards + 1.0.0 + scenarioId + seed` determina las mesas. Solo AIM_000..179, POWER_LOW/MEDIUM/HIGH y SHOOT son válidos; 180 direcciones cuantizadas, tres potencias, ninguna coordenada/score del cliente como autoridad. Los inputs llevan ticks y secuencias comunes. Durante movimiento/transición no se aceptan acciones; doble tiro imposible.

Física entera en milésimas, 120 ticks/s y dos substeps fijos. Bolas de igual masa, impulso normal con restitución 0.985, tangente conservada, bandas, bumpers y fricción 0.994 por tick. Orden de colisiones fijo, resolución de penetración determinista y velocidades mínimas detenidas. Los productos intermedios se mantienen dentro del rango entero seguro. No hay Math.random, reloj, pantalla, DOM o audio en el core. La predicción visual usa una copia y el mismo step físico.

Embocada: 1000 + 100 × índiceDeMesa. Tiro con embocada y sin blanca: bonus de racha de 100, 200 o 300. Blanca: −250, suelo cero, fin de racha y recolocación segura. Mesa despejada: 300 + 30 × tirosRestantes. Agotar tiros con objetivos pendientes: derrota. Cinco mesas despejadas: victoria. Timeout de apuntado de 90 segundos, máximo ocho minutos de simulación. La presión viene de precisión, potencia, combinaciones y presupuesto de tiros, no de acelerar arbitrariamente bolas.

## Validación

Apertura guiada superable en 64 escenarios; ocho partidas completas de cinco mesas; colisión frontal, bandas, fricción, blanca/recolocación, timeout, forecast inmutable y rechazo de doble tiro. Golden congelado en scripts/fixtures/billiards-v1.json, replay repetido y equivalencia 60/120/144 Hz; inválidos/orden/límites vía suite común. Verificador de servidor integrado sin alterar históricos.

QA táctil Chromium: partidas completas, derrota por siete tiros, resultado de servidor comparado con replay de inputs reales, doble tap, cancelación de apuntado, finalización única y reinicio con nuevo ticket. Revisar en teléfonos físicos antes de considerar el juego comercialmente congelado. No es pool profesional completo; no se presentan sus reglas como tales.
