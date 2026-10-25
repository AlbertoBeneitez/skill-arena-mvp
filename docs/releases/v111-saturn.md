# v111-saturn — Bolos, Orb Burst 6, Shot Gallery 8, Tower Drop y portadas nuevas (25-oct-2026)

Base: v110-saturn (7c712f1).

## Nuevo juego: Galactic Bowling (`bowling@1.0.0`, verificado por replay)
- Bolos de diez con 10 marcos y puntuación reglamentaria. La pista está en perspectiva y la cámara sigue a la bola. Los bolos chocan y se dispersan con física determinista. Detalle en `docs/BOWLING_V1.md`.
- Para lanzar: arrastra la bola para colocarla y desliza hacia arriba. La dirección, la velocidad y la curva del gesto marcan el ángulo, la potencia y el efecto.
- Animación de pleno: destello, rayos giratorios, confeti y chispas, bolos volando hacia la cámara y un "¡PLENO!" con relieve, degradado y brillo. Con plenos seguidos sale DOBLE o "N PLENOS SEGUIDOS". El botón "Saltar ⏭" (o un toque en cualquier sitio) la termina. El semipleno tiene una celebración más corta.

## Orb Burst 6.0.0 (dinámica Bubble Shooter; V1–V5 intactos)
- Seis colores y siete filas iniciales con colores agrupados.
- Los grupos de 3 o más explotan, y los orbes que quedan colgando caen con un bonus que se duplica por cada uno.
- Cada tiro que no explota nada es un fallo. Tras 5 fallos baja una fila nueva, y el margen se reduce a 4, 3 y 2 según llegan filas.
- La partida acaba si un orbe cruza la línea. Limpiar el tablero da 2000 puntos y lo rellena.
- Solo se cargan colores que siguen en el tablero, y se puede intercambiar el orbe cargado con el siguiente.
- Ya no hay poderes, hielo ni asteroides.

## Shot Gallery 8.0.0 (galería de tiro alienígena; V1–V7 intactos)
- Cada orden combina un color y una figura: en el panel se ve una mancha de color más una figura gris (solo ahí las figuras son grises).
- Todas las dianas tienen color y forma, y van en soportes alienígenas con antenas que se deslizan por tres raíles en direcciones alternas.
- Las dianas que se parecen a la buena comparten solo el color o solo la figura. Cada orden pide de 2 a 4 disparos.
- La mancha es un único borrón sin gotas. La cabina tiene marco de neón y un mural de un mundo alienígena.

## Tower Drop (presentación)
- El juego ocupa toda la altura de la pantalla. La base empieza abajo del todo y, cuando la torre alcanza la altura de trabajo, baja con ella (antes se quedaba fija mientras los bloques pasaban por delante).
- Los bloques son contenedores espaciales: paredes corrugadas, esquineros, banda de peligro, placa GX-nn y luz de estado. Se apoyan sobre una plataforma con luces de pista.

## Pinball (presentación)
- El marcador va siempre en una franja propia encima de la mesa, así que nunca tapa el juego.

## Portadas
- Las 14 portadas del catálogo (incluida la de bolos) están redibujadas como escenas con profundidad: luz, sombras, brillo y nebulosa del color de su categoría.

## Tests
- Nuevos `verify-bowling-v1`, `verify-orb-v6` y `verify-gallery-v8` con fixtures dorados. Se han actualizado las pruebas de presentación de Tower, Orb y Gallery. Pasan el determinismo completo, el typecheck, i18n (10 × 571), el build y el smoke móvil de los 14 juegos.
