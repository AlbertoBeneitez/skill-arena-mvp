# v162-saturn — Marcador común, Dardos realistas, Pinball V14, celebraciones de Bowling y portadas (9-nov-2026)

Base: v161-saturn (abcca1b).

Encargo del propietario (siete puntos): avatares con parte del cuerpo, portada de Mine Grid con más sentido, Orb Burst sin las bolas de la derecha, Pinball más alto y con un Saturno más bonito, portadas de Solitaire Sprint, Orb Burst y Dardos más trabajadas, marcador con el número a la derecha y más grande igual en todos los juegos, Dardos más realista, portada de Bowling a todo el ancho y celebraciones de pleno y semipleno más entretenidas.

## Marcador común (todos los juegos)
- Cada casilla lleva la etiqueta a la izquierda y el número a la derecha, más grande (19 px; el principal, 22 px).
- Misma posición y tamaño en los 13 juegos: Solitaire Sprint quedaba 8 px más estrecho y más bajo por el margen de su tablero.
- Valores cortos para que nada se corte:
  - Mine Grid muestra solo el número de campo;
  - el multiplicador de Pinball se llama «Mult.»;
  - el tiempo de Slot va en segundos enteros.
- Si el valor es una palabra (blanca embocada, 000 no permitido), va en letra pequeña y puede ocupar dos líneas.

## Dardos (solo presentación)
- **Diana de torneo:**
  - anillo de goma negra con bisel de acero;
  - sisal prensado con fibras, tono moteado y agujeros de uso;
  - dobles y triples lacados;
  - araña plateada en relieve, con su sombra y su borde iluminado;
  - anillo de alambre con números blancos en relieve.
- **Dardo de acero:** punta pulida, barril de tungsteno moleteado con anillo de color, caña de aluminio con anillos y dos aletas en perspectiva con una franja impresa.
- Los dardos clavados se ven algo más grandes.

## Pinball V14 (`lib/verified/pinballCore.v14.ts`; V1–V13 se conservan)
- **Mesa más alta:** todo lo que está por encima de las bocas de las rampas sube y se separa en proporción, con y' = 300 − (300 − y) · 288/258.
  - El arco superior pasa de y 42 a y 12.
  - Carriles, postes, platillo, spinners, bumpers y curvas de los recorridos se reparten en el espacio nuevo.
  - Radios, tamaños y física no cambian; la mitad inferior es idéntica.
- **Más cerca del marcador:** la mesa empieza justo debajo de él (reserva superior de 54 a 30).
- **Lanzamiento:** un tiro fuerte llega a la nueva franja superior (y 21; antes y 51).
- **Simulación de 80 partidas:** ninguna bola atascada.
- **Saturno nuevo:**
  - ojo de buey cromado con tornillos y una ventana al espacio con nebulosa y estrellas;
  - planeta con bandas de nubes, terminador y luz de borde;
  - anillos de varias bandas con su división, por detrás y por delante del planeta, y la sombra de los anillos sobre él;
  - en directo, una luna que orbita y un brillo que recorre el cromado.
- **Portada** regenerada desde el juego, centrada en el Saturno.

## Bowling
- **Portada:** ocupa todo el ancho de su recuadro; la escena baja sin reducirse.
- **Pleno y semipleno, más entretenidos:**
  - al empezar, la marca de la hoja (X o /) cae enorme con onda expansiva, rayos y sacudida;
  - la historia (cohete, disco o platillo) va 1,7 veces más rápida: el título llega a los 5 s en vez de a los 8 s;
  - el tiempo que sobra es un final con fuegos artificiales, confeti y una fila de bolos que saltan y hacen la ola.
  - La duración y el botón Saltar no cambian (los decide el núcleo).
- **«Se acaba la partida nada más empezar, sin tocar nada»:** no se ha reproducido.
  - 30 tiradas automáticas en tres tamaños de pantalla, con la CPU cuatro y seis veces más lenta y entrando desde otro juego: la partida no terminó sola.
  - En la vista previa de Vercel las partidas de entrenamiento no son persistentes, así que no hay pérdida por salir de la app.
  - Queda pendiente con el propietario: captura de la pantalla que aparece y navegador del móvil.

## Portadas
- **Mine Grid:** una posición real de buscaminas.
  - Se acaba de tocar la casilla dorada y el campo se abre.
  - Cada número cuenta las minas de alrededor y las banderas están justo sobre las minas que esos números delatan.
  - Baldosas grafito y números de neón, como en el juego, bajo Saturno.
- **Orb Burst:** sin las dos bolas que caían a la derecha ni la bola siguiente, que parecían cruzar la línea. El estallido suelta esquirlas de cristal dorado.
- **Solitaire Sprint:**
  - pips reales en las cartas numeradas (los de abajo, del revés, como en una baraja);
  - retratos enmarcados en K, Q y J;
  - tapete con trama;
  - dorsos azules a rayas, como en el juego.
- **Dardos:** el mismo cartel con dardos de acero de verdad, sisal y araña con relieve.

## Avatares
- El círculo grande y el pequeño enseñan cabeza y hombros (parte del cuerpo).
- Las 16 tiras horizontales del selector siguen centradas en la cara.
- `AVATAR_VERSION` pasa a 162 para que los móviles no usen las imágenes antiguas guardadas.

## Validación
- `verify-pinball-v14`:
  - lo de V13;
  - el arco a y 12;
  - las guías inferiores sin cambios;
  - un tiro fuerte llega a la franja nueva;
  - una repetición de referencia.
- Determinismo completo, lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Medición del marcador en los 13 juegos: misma caja (12, 66, 366 × 42) y ningún texto cortado.
- **Partidas reales:**
  - Pinball de 100 s con botones táctiles, verificada por repetición en el servidor;
  - cuatro tiros de Dardos;
  - diez tiradas de Bowling;
  - selector de avatar.
- Ajustes muestra la versión 1.62.
