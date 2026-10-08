# GALACTIC GAMES · Dardos 1.0.0

Variante arcade original de habilidad. Quince dardos, tres por fase: zona central amplia, sectores, dobles, triples y secuencia final. La seed determina objetivos y oscilación visible; nunca sortea la posición de impacto. Apuntar y pulsar LANZAR en el tick deseado define completamente dónde cae el dardo.

## Contrato

`darts + 1.0.0 + scenarioId + seed + inputs` usa registry/loader/lifecycle y replay/verificador comunes. Protocolo: AIM_X_00..60, AIM_Y_00..60 y THROW. Dos ejes cuantizados a pasos de 5 px; el adaptador táctil común acepta una secuencia corta de acciones para un gesto y registra cada acción en un tick diferente. No modifica el engine histórico, la validación ni las acciones de otros juegos. Durante vuelo se rechazan inputs y doble lanzamiento.

Core entero a 120 Hz. Retícula = base cuantizada + oscilación racional entera dependiente del tick, con amplitud creciente de 4 a 16 px. No hay azar posterior al input, APIs del dispositivo o reloj real en el core. La diana usa orden estándar de sectores y zonas de single/double/triple/bull; puntuación arcade: valor del dardo ×10, objetivo +250, precisión hasta +150 y racha hasta +90. El impacto y el feedback se producen a los 24 ticks; el siguiente objetivo llega a los 48.

Cada dardo dispone de 14, 12, 10, 9 u 8 segundos según fase. Agotar tiempo pierde ese dardo, sin matar prematuramente la partida. Quince dardos completados con al menos 2500 puntos: victoria; menor puntuación: LOW_SCORE. Ambos participantes deben recibir el mismo escenario, reglas y condiciones. El catálogo sigue en demo; emisión durable/auth/dinero real permanecen pendientes de integración de la plataforma.

## Validación

64 secuencias completas reproducibles, scoring de sectores y rings/bull, tiempo agotado de los quince dardos, inputs inválidos/orden/duplicados/límites, rechazo de doble tiro, golden congelado y replay común equivalente a 60/120/144 Hz. QA Chromium táctil: drag real, cancelar sin lanzar, quince dardos, victoria/derrota, finalización única, replay de los inputs realmente enviados y reinicio con nuevo ticket; vertical y horizontal sin errores de página. Regresiones jugadas de Orb Burst y River Dash después del cambio de adaptador.

Arte y código originales, sin assets de terceros. QA humana en teléfonos físicos sigue recomendable; la aprobación comercial definitiva exige probar sensación de control y legibilidad en una gama real de dispositivos.
