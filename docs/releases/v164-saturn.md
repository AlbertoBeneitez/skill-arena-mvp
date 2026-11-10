# v164-saturn — Rival a pantalla completa, dardos con el avatar, números iguales, cabecera y portadas (10-nov-2026)

Base: v163-saturn (2239e37).

## Avatar inicial
- El retrato grande de la bienvenida y su aro se muestran solo cuando la imagen ha cargado. Ya no aparece un momento el círculo azul y amarillo vacío.

## Números de los marcadores
- Todos los números de todos los marcadores tienen un único diseño: misma letra, tamaño (20 px), grosor, color dorado y brillo.
- Antes, el principal era mayor y dorado y los demás blancos.
- El aviso en rojo (poco tiempo) se mantiene porque informa de un estado.

## Antes de empezar: el rival en grande
- Durante la cuenta atrás, el rival ocupa la pantalla, de arriba abajo:
  - su retrato en un círculo grande con el aro y el halo del color de su liga;
  - su nombre;
  - los puntos que hay que batir, con el mismo diseño de número que el marcador;
  - «Creado por» y el autor del juego.
- **Autor del juego:**
  - nuevo campo `creator` en el registro, por defecto `GAME_CREATOR_DEFAULT` («GALACTIC GAMES»);
  - los juegos que lleguen por «Enviar juego» llevarán su autor;
  - traducido a los 10 idiomas («Creado por»).

## Dardos
- **Aletas:** el dardo lleva cuatro aletas en X, vistas desde atrás, y el círculo del avatar del jugador se reparte entre ellas, un cuarto en cada una.
- **Color:** los bordes de las aletas, los anillos del barril y el centro toman el color global del avatar (la media de los píxeles del círculo).
- Igual en el dardo de la mano, en el que vuela y en los clavados.
- Solo presentación: `lib/playerLook.ts` guarda el avatar que muestra la app; no se envía ni puntúa.

## Inicio
- **«Enviar juego»:** la moneda va a la izquierda, con fondo dorado translúcido, borde dorado y un brillo suave.
- **Botones de cabecera:** sonido, saldo y ajustes forman un mismo juego de botones:
  - cristal oscuro mecanizado, borde fino, bisel y sombra;
  - el saldo lleva una moneda dorada y el diseño de número del marcador.
- **Fichas del catálogo:** se quita la medalla y los cinco círculos de la liga.

## Portadas
- **Pinball:** vuelve la de v161.
- **Solitaire Sprint:** la cascada de la victoria.
  - Las cuatro fundaciones completas brillan en dorado.
  - Dos reyes saltan de sus montones y rebotan por el tapete dejando la cinta de copias de la solitaria clásica.
- **Mine Grid:** sin Saturno, con la cámara más cerca.
  - Baldosas de cristal con borde cian y rayos de luz que suben de la casilla dorada.
  - Halo turquesa sobre la zona abierta y más números 2.
- **Orb Burst:** hueco limpio entre el racimo y el cañón; se quitan las bolas de la fila baja delante de la boca y la bola suelta.

## Validación
- Determinismo completo (la prueba de presentación de Dardos conoce `playerLook`), lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Marcadores: misma caja y ningún texto cortado en los 13 juegos.
- Pantalla del rival sin textos cortados a 360 px.
- Tiros reales de Dardos con el avatar en las aletas.
- Ajustes muestra la versión 1.64.
