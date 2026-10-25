# v116-saturn — Solo móvil con la composición del ordenador, música de concentración, Pinball 7, Stack Shift 4 y lona blanca (25-oct-2026)

Base: v115-saturn (e647bdc).

## Solo móvil y una única composición
- **Mismo aspecto que en el ordenador:** todos los móviles dibujan la app con un ancho fijo de 540 px (la composición del ordenador, con el catálogo en tres columnas) y el navegador la escala al ancho de la pantalla. La meta viewport es `width=540` (sin `initial-scale`; Next lo añadía por defecto y recortaba la página).
- **Solo se puede jugar desde el móvil:** los dispositivos sin pantalla táctil como puntero principal (ordenadores con ratón o trackpad) ven un aviso a pantalla completa con un código QR y la dirección para abrirla en el móvil (`components/MobileOnlyGate.tsx`). Los iPad se reconocen por la pantalla táctil.
- **Limitación:** la detección es del navegador (agente de usuario, puntero táctil). Alguien que simule un móvil (emulación de dispositivo o agente de usuario falso) puede saltársela. La integridad competitiva no depende de esto: el servidor sigue repitiendo cada partida.
- QR con `qrcode-generator` 1.4.4 (MIT), anotado en THIRD_PARTY_NOTICES.

## Catálogo
- Quitado el triángulo blanco que había a la izquierda del nombre de cada juego.

## Música de concentración
- Seis pistas nuevas, generadas en el propio dispositivo (sin archivos):
  - lo-fi;
  - ambiente;
  - piano;
  - profunda;
  - sintetizador;
  - lluvia.
- En Ajustes → «Música» se elige entre:
  - «Mezcla» (por defecto), que en cada partida elige al azar entre el tema del juego y las seis pistas;
  - «Tema del juego»;
  - cualquiera de las seis pistas.
- El selector queda desactivado si la música está apagada.

## Pinball 7 (`pinball@7.0.0`; V1–V6 intactos)
- La entrada en los pasadizos ya no se nota:
  - **Sin parada ni salto:** la bola no se detiene ni salta al centro. El recorrido empieza donde está la bola y se funde con el trazado en los primeros 36 px.
  - **Velocidad continua:** la velocidad dentro del pasadizo empieza siendo la de la bola (entre unos límites) y se suaviza hasta la de salida.
  - **Salida continua:** la bola sale en la dirección del último tramo del tubo, sin un último paso corto.
  - **Agujero de gusano:** ya no centra la bola de golpe. La bola se encoge al entrar en el vórtice y vuelve a crecer al salir por el nuevo portal de salida.
  - **Raíles:** la bola se dibuja dentro del tubo de acrílico, y cada tubo tiene una boca cromada en la entrada.
- Sigue siendo determinista: todo es aritmética entera sobre el estado, así que el mismo tiro recorre el pasadizo siempre igual.

## Stack Shift 4 (`stack-shift@4.0.0`; V1–V3 intactos)
- La partida empieza con el tablero limpio: se quitan los 3–5 bloques sueltos que V3 ponía en la fila de abajo.
- Se mantienen la secuencia de piezas y el resto de reglas.

## Shot Gallery (presentación; núcleo V11 sin cambios)
- **Lona blanca:** el escenario es una sola lona blanca que ocupa todo el espacio, sin ventanas.
- **Descubrimiento:** al empezar cada orden se levanta una sábana blanca delantera, con su varilla de peso y su sombra, y descubre los objetivos sobre la lona completa. Al acabar la ronda vuelve a bajar.
- **Sin círculos:** se quitan las dianas redondas de madera. Los objetivos son figuras de color grandes, sobre la lona.
- **Impactos:** al acertar, la figura se abate con el agujero y las chispas.
- **Portada** actualizada con la misma lona blanca.

## Tests
- Nuevos `verify-pinball-v7` y `verify-stack-shift-v4`, con fixtures dorados:
  - **Pinball:** en cada pasadizo, la bola nunca se para ni salta, y sale por el extremo del tubo con la velocidad fija.
  - **Stack Shift:** el tablero empieza vacío.
- El smoke móvil comprueba el ancho de diseño real (540) y que la página está escalada a la pantalla.
- Pasan el determinismo completo, el typecheck, el lint, i18n (10 × 596), el build y el smoke de los 14 juegos.
