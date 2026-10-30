# v124-saturn — Shot Gallery 12 "Hangar 7", marcadores LED nuevos, Mine Grid digital, pantalla de carga y avatares encuadrados (30-oct-2026)

Base: v123-saturn (23ec7bb).

## Integración de la revisión y limpieza (`chore/fase-0-orden`, aprobada el 30 de octubre)
- Se fusiona la rama de otra sesión del 29 de octubre:
  - revisión de código (`docs/reviews/2026-10-29/`);
  - `CLAUDE.md` y `docs/STATE.md` como memoria del proyecto;
  - la CI en la misma versión de Node que Vercel, cubriendo también las ramas `vNN-saturn`;
  - se retiran 16 módulos de interfaz que no importaba nadie.
- Se comprobó que ningún fichero actual importaba los módulos retirados: `tsc` y el determinismo siguen en verde.
- `docs/STATE.md` se pone al día: catálogo con Roulette 13, Billar 7 y Shot Gallery 12, identidad y decisiones.

## Ramas antiguas
- Las diez ramas de trabajo antiguas se pueden borrar: todo su trabajo está superado o pertenece a juegos que ya no están en el catálogo. Son:
  - `archive/pre-saturn` y `audit/production-readiness-v97`;
  - `feature/dino-dash-professional`, `feature/precision-stack-pro` y `feature/precision-stack-professional`;
  - `improve/alien-sky-river`;
  - `qa/gameplay-polish-v99` y `qa/precision-stack-professional-pass`;
  - `refactor/game-architecture` y `skillarena2`.
- **No se han podido borrar desde la sesión.** La política de git de la sesión rechaza (403) tanto subir etiquetas como borrar ramas.
- Se guardó una copia completa de las diez ramas en un git bundle (`ramas-antiguas-archivo.bundle`, con las etiquetas `archive/…`), entregado al propietario.
- El borrado se hace desde GitHub, en Branches → papelera.
- `chore/fase-0-orden` puede borrarse cuando `mobile-test` contenga esta versión.

## Shot Gallery 12 — «Hangar 7» (`reaction-test@12.0.0`; V1–V11 intactos)
- **Escena de película:** un hangar de una estación minera abandonada, pintado con código (`scripts/render-gallery-scene.py`):
  - un ventanal a un gigante gaseoso y una luna;
  - una galería alta con tres escotillas y un parapeto con luces de emergencia;
  - una pasarela con barandilla, cajas de carga y una barricada blindada;
  - cables, niebla baja, haces de luz y etalonaje de cine.
- **Cuatro líneas de cobertura con profundidad.** Las criaturas asoman de golpe al empezar cada orden y se esconden al terminar.
- **Blancos: seis especies espaciales originales.** Kraken, Dron, Mantis, Gelatina, Espectro y Gólem, con luz de contorno y bruma según la distancia.
  - La orden muestra el retrato y el nombre de la especie que hay que abatir.
  - Desde la séptima orden hay dos especies.
- **Señuelos que engañan:**
  - otras especies;
  - camuflados (otra especie con los colores del blanco), desde la cuarta orden;
  - hologramas del blanco, translúcidos y con parpadeo, que solo delata el haz del proyector; desde la sexta orden;
  - civiles con traje blanco y las manos en alto.
- **Dos objetivos a la vez:** cada dedo que toca dispara. El segundo disparo entra un tick después (1/120 s), así que abatir dos a la vez cuesta casi lo mismo que uno.
- **Los disparos se quedan donde caen,** durante toda la partida:
  - quemaduras con borde incandescente que se enfría en el metal;
  - grietas en estrella en el cristal del ventanal;
  - marcas encima de la cobertura cuando el disparo da en ella.
  - Cada disparo sale de una de las dos pistolas, la del lado del dedo, con trazador, fogonazo y retroceso.
- **Reglas (núcleo nuevo):**
  - doce órdenes; asoman de 8 a 12 figuras, de las que 2 a 4 son blancos reales;
  - la puntuación es el tiempo de reacción acumulado (menos es mejor), como en V10 y V11;
  - un señuelo suma 400 ms y un civil 800 ms (nuevo); disparar antes de tiempo suma 600 ms y cada blanco que quede en pie, 1500 ms;
  - el generador descarta las primeras salidas del RNG, porque con semillas vecinas estaban correladas (salía siempre la misma segunda especie);
  - la prueba nueva comprueba que las especies se reparten.
- **Portada e imagen previa:** se renderizan con el propio motor del juego desde un momento de partida real: dos trazadores abatiendo un Kraken y una Mantis entre un holograma, un camuflado y un civil (`scripts/render-gallery-cover.mjs`). La portada ya no sale de `generate-covers.py`.
- **Pruebas:**
  - 200 escenarios;
  - las respuestas son exactamente las especies reales pedidas;
  - aparecen todas las familias de señuelo, y el camuflaje viste los colores del blanco;
  - disparar a dos a la vez es más rápido;
  - penalización de civil;
  - un solo input por tick;
  - replay y golden;
  - en presentación: 432 fotogramas puros, el toque elige la criatura bajo el dedo, nunca una escondida, y el panel de la orden no es diana.

## Marcadores digitales rediseñados
- **Dígitos de siete segmentos redibujados:**
  - segmentos hexagonales con separación real;
  - los segmentos apagados se ven tenues;
  - los encendidos tienen el núcleo blanco y un brillo de dos capas (filtro SVG que escala con el texto).
- Se añade el carácter «:» para relojes.
- **Paneles:** ventana de cristal LED con bisel metálico, rejilla de escaneo y reflejo.
- Se aplican al tablero del rival antes de la partida, al marcador y a la tira de la partida, y a Mine Grid.

## Mine Grid digital (presentación)
- **Consola LED arriba:** campo y dificultad, tiempo `MM:SS` en ámbar y minas por marcar en rojo (24 − marcadas).
- **Casillas:**
  - los números van en dígitos de siete segmentos, con un color por número y un único filtro de brillo compartido;
  - las casillas cerradas son de metal biselado y las abiertas, cristal hundido;
  - la bandera y la mina son iconos que brillan.
- **Controles:**
  - el texto de ayuda es un panel LED de matriz de puntos;
  - el contador OK va en segmentos verdes;
  - ABRIR y MARCAR son interruptores con LED.

## Pantalla de carga e intro
- **Pantalla de carga** (`components/GameLoading.tsx`):
  - el Saturno renderizado con un cometa en su órbita, que pasa por delante y por detrás del planeta;
  - el logotipo GALACTIC GAMES y una línea de progreso;
  - el texto, ahora traducido.
- Mine Grid usa la misma pantalla mientras prepara el campo; antes mostraba «PREPARANDO JUEGO…» sin traducir.
- **Intro antes de jugar:** la imagen del juego pasa a ser la protagonista (hasta 340 px de ancho), con marco de cine, viñeta y un acercamiento lento.

## Avatares
- Al elegir avatar, cada tarjeta encuadra la cara del personaje: hay una posición por retrato y se amplía alrededor de la cara. El seleccionado se acerca un poco más.

## Validación
- Determinismo completo con Shot Gallery V12 y todos los adaptadores anteriores.
- Lint, `tsc`, i18n (10 idiomas × 668 claves), `git diff --check` y build.
- Smoke test de los 14 juegos.
- Capturas a 390 × 844: avatares, Mine Grid en juego, intro con el tablero LED, pantalla de carga y Shot Gallery en la app con un toque de dos dedos, además del renderizado sin conexión de órdenes con hologramas, camuflados y civiles.
