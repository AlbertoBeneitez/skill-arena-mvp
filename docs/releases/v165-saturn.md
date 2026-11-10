# v165-saturn — Botones de inicio a medida, portadas a todo el recuadro, Mine Grid clásico y carga completa (10-nov-2026)

Base: v164-saturn (6b8dd37).

## Botones de inicio y cabecera
- **«Enviar juego» y «Rankings»** miden lo mismo: dos columnas iguales de 46 px de alto.
- **Construcción común** con el sonido, el saldo y los ajustes:
  - cuerpo de cristal ahumado sobre grafito;
  - borde mecanizado, claro arriba y que se funde en el color de acento abajo;
  - chaflán especular en el borde superior, bisel fino y labio oscuro inferior;
  - sombra profunda y luz de acento que sube desde abajo.
- **Iconos** en un engaste propio: un pozo circular con brillo y aro de acento.
- **Al pulsar,** el botón se hunde un píxel y se enciende el acento; el foco de teclado dibuja un anillo claro.
- **Colores:** el oro marca el dinero («Enviar juego» sobre oro translúcido y el saldo con su moneda); el cian marca las herramientas (sonido y ajustes).
- El sonido apagado pasa a gris.

## Portadas a todo su espacio
- Cada portada ocupa su ficha entera: la imagen nítida arriba se funde con la misma imagen, ampliada, desenfocada y oscurecida, que llega por detrás del botón hasta los bordes.
- La imagen no se recorta.

## Mine Grid
- **Portada:** el buscaminas clásico de la referencia del propietario, rehecho a nuestro estilo.
  - Casillas en relieve con bisel y borde cian.
  - Celdas abiertas hundidas.
  - Un 1 azul, un 2 verde y un 3 rojo con brillo.
  - La mina negra sobre rojo, la bandera roja en su peana y la carita dorada como botón del juego, en el espacio.
  - Cada número cuenta las minas de alrededor.
- **En el juego:** se quita el contador verde («OK») bajo el tablero.

## Carga completa antes de jugar
- El juego aparece solo cuando están listos su código y todas sus imágenes:
  - el fondo espacial;
  - el arte propio (pista y foso de Bowling);
  - el retrato del rival;
  - el avatar del jugador (Dardos).
- Mientras tanto, el botón del juego muestra que está cargando.
- Con una red muy lenta, a los 12 s empieza con lo que haya llegado.
- Vale igual para las partidas de grupo (`lib/gameAssets.ts`).

## Bowling
- El propietario confirma que la partida ya no termina sola. Se quita de pendientes.

## Validación
- Determinismo completo, lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- «Enviar juego» y «Rankings» miden 180 × 46 a 390 px y 165 × 46 a 360 px.
- Partida de Mine Grid sin el contador.
- Ajustes muestra la versión 1.65.
