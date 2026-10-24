# v107-saturn — desplegable de avatares, entrada al juego y nuevas mesas de Pinball y Shot Gallery (24-oct-2026)

Base: v106-saturn (21a1b62). Solo presentación: ningún núcleo, versión competitiva, puntuación ni regla cambia.

## Identidad
- La tira horizontal de avatares se sustituye por un desplegable: al tocar el retrato (chevrón dorado) se abre una rejilla 5×3 con las 15 alternativas sobre la propia tarjeta. Cabe sin desplazamiento vertical en 360×640, 375×667 y 390×844; se cierra al elegir, al tocar fuera o con Escape.

## Antes de jugar
- Carga: órbita animada con "Preparando juego".
- Cuenta atrás convertida en tarjeta de presentación: portada del juego con brillo, lema del catálogo, etiquetas de categoría/habilidad y anillo que se vacía en cada número; "¡YA!" con estallido dorado. Mismos tiempos que antes (3 × 650 ms).

## Pinball (núcleo 3.0.0 intacto)
- Mesa de pinball clásico espacial: raíles cromados, suelo impreso con nebulosas y planeta, pop bumpers con faldón, anillo de luces y capuchón con estrella, dianas con lámparas, bancada de caídas numerada, plato con luces en persecución, flechas de rampa/órbita, lámparas de multiplicador ×1–×5, carril de lanzamiento con muelle visible y lámparas de potencia, delantal inferior y palas blancas con goma roja.
- Marcador tipo DMD (matriz de puntos ámbar) con puntuación, segundos y multiplicador; los grandes momentos (skill shot, jackpot, bonus, bola perdida) iluminan toda la mesa.
- Botones de cabina: palas rojas y muelle dorado. Arte estático cacheado una vez por disposición.

## Shot Gallery (núcleo 6.0.0 intacto)
- Caseta de feria espacial: toldo, marquesina con bombillas (las 12 de arriba muestran el resultado de cada ronda), semáforo rojo/verde, pared de fondo con estantes y cortinas.
- Dianas sobre placas metálicas que se levantan al ponerse en verde y caen al acertar, dejando una mancha de pintura en la pared; cañón inferior que apunta y dispara con fogonazo, trazador, chispas, "+puntos", valoración de reacción (¡RAYO!, ¡RÁPIDO!), racha de rondas y temblor al disparar.
- Se elimina el texto "ESPERA AL VERDE": la espera la indica el semáforo.

## Tests
- Determinismo completo, presentación de Shot Gallery (renderer puro, 432 fotogramas) y smoke móvil de los 12 juegos: OK.
