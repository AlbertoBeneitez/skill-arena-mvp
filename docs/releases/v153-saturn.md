# v153-saturn — Slot V4, Orb Burst V8, portadas y pestaña «Enviar juego» (7-nov-2026)

Base: v152-saturn (18d7d64).

- **Slot V4** (núcleo nuevo; V1–V3 se conservan con sus verificadores y repeticiones doradas):
  - sin naranjas: siete símbolos (limón, cerezas, campana, estrella, BAR, gema y siete), siete posiciones por franja y avances de −3 a +3 (cada valor lleva a una posición distinta);
  - parejas por símbolo, en escalera: 5, 10, 15, 20, 25, 30 y 40 fichas; el trío paga cuatro parejas (20 a 120) y tres sietes, 200;
  - sin premio por «7 sin pareja».
- **Slot, presentación:**
  - tablas superiores sin «Rodillo 1/2/3», con filas más altas y símbolos más grandes;
  - tabla de premios con una carta por símbolo (trío y pareja);
  - símbolos redibujados con contorno, brillos y detalle (limón con hoja, cerezas con tallo, campana con aro y badajo, estrella biselada, placa BAR con remaches, gema tallada y un 7 dibujado);
  - botones −, + y «5 fichas» más vistosos: cúpulas saturadas con brillo, aro de neón del mismo color y símbolo iluminado.
- **Orb Burst V8** (núcleo nuevo; V1–V7 se conservan): mismo tablero y ritmo que V7; la puntuación es el número de burbujas eliminadas (explotadas más caídas). Marcador, resultado, rivales y ranking de ejemplo cuentan burbujas; las mejores marcas en puntos de versiones anteriores se guardan aparte y no se mezclan. Nuevo cañón en el juego (base atornillada, cañón con aletas y boca iluminada con el color cargado), solo presentación.
- **Portadas:**
  - Orb Burst sin la estela en forma de gota detrás de las burbujas que caen, y con un cañón de verdad;
  - Shot Gallery con blancos más trabajados: alas y espinas en la mantis, iris y piel en el kraken, capa raída y amuleto en el espectro, anillo y propulsor en el dron, restos dentro del slime y musgo y cristal en el gólem; la fila de atrás ya no está desenfocada;
  - Stack con el bloque dorado más abajo y sin el bloque que caía por la derecha;
  - Tower Drop con el contenedor más abajo.
- **Catálogo:** «Enviar juego» pasa a una pestaña pequeña arriba a la izquierda de Juegos, frente a Rankings.
- **Sin rastros de versiones anteriores:** Ajustes muestra «Versión 1.53» (antes «1.08 (v108-saturn)») y los textos de reglas dejan de citar versiones (V10, V18–V21).

## Validación
- Determinismo completo, con pruebas nuevas de Slot V4 y Orb Burst V8 (reglas, escalera de premios, avances, repeticiones doradas y que V8 juega igual que V7); `tsc`, `pnpm lint` y build.
- Prueba básica de los 13 juegos y `qa-overlap`.
- Partidas reales: tiradas del Slot cambiando avances, disparos en Orb Burst hasta perder (resultado en burbujas), pestaña «Enviar juego» abre el formulario y Ajustes muestra la versión 1.53.
