# v115-saturn — Galoku, Bowling, Pinball 6, Shot Gallery 11 y portadas a sangre (25-oct-2026)

Base: v114-saturn (58dc5d1).

## Galoku (`corner-sudoku@3.0.0`; V1 y V2 intactos)
- Nuevo nombre en los 10 idiomas.
- Vuelve el tablero de cinco cuadrados (dos lados de un sudoku que comparten la esquina), con tres retos por partida (31, 28 y unos 25 números dados), solución única y seis minutos de reloj.
- Se mantiene el teclado 3×3 con los nueve números siempre visibles.

## Bowling (presentación)
- Se llama solo «Bowling».
- Los bolos de la pista ya no se mueven ni tienen cara: solo caen cuando los golpea la bola.
- Las animaciones con bolos-personaje quedan solo para plenos y semiplenos, con varias emisiones distintas:
  - **Plenos:** supernova, disco con bolos bailando, fuegos artificiales y cometa con bolos orbitando.
  - **Semiplenos:** explosión, choque de manos y barrido de neón.
- La emisión se elige de forma pseudoaleatoria con la semilla, el marco y la tirada: parece al azar y el replay la reproduce igual.
- Corregido el brillo del título, que pintaba una banda gris sobre toda la escena.

## Pinball 6 (`pinball@6.0.0`; V1–V5 intactos)
- **Pasadizos:**
  - **Raíl izquierdo:** la rampa sube a un raíl que cruza la mesa por arriba y deja la bola en el carril derecho.
  - **Raíl derecho:** la órbita hace lo mismo hacia el carril izquierdo.
  - **Agujero de gusano:** está entre los bumpers y lleva la bola por un túnel hasta arriba a la izquierda, encima del carril A.
  - Cada pasadizo sigue un recorrido fijo a velocidad fija y suelta la bola con una velocidad fija, así que hace siempre lo mismo. Está comprobado con varias semillas.
- **Desatasco determinista:** si la bola se queda parada, por ejemplo en los límites de abajo a izquierda y derecha, recibe siempre el mismo empujón hacia el centro desde su lado. Ya no se usa azar.
- **Gráficos:**
  - Raíles de acrílico con sombra, dos guías cromadas y luces que recorren el raíl al usarlo.
  - Vórtice giratorio con anillo de luces en el agujero de gusano.
  - Pulso de luz que recorre el túnel mientras la bola va bajo la mesa.
  - Nuevos rótulos ¡RAÍL! y ¡AGUJERO DE GUSANO!
- Se mantienen la mesa fija, las misiones con tiempo extra, el hurry-up, la bola salvada y el frenesí.

## Shot Gallery 11 (`reaction-test@11.0.0`; V1–V10 intactos)
- El escenario es una lona de feria (tela caqui con pliegues, costuras, ollaos y cuerdas) con 12 ventanas en una cuadrícula de 3×4.
- Al empezar cada orden, las ventanas se enrollan y descubren las dianas: dianas redondas de madera, mucho más grandes, con la figura de color. Al acabar la ronda, la lona vuelve a bajar.
- **Sin semáforo:** la señal de salida es que se abra la lona, y disparar antes sigue penalizando.
- Se han quitado las balas que había por nivel.
- La orden es una cartulina con la mancha de pintura y la figura en gris.
- La puntuación sigue siendo el tiempo de reacción acumulado.

## Portadas
- Las 14 portadas están rehechas como primeros planos a sangre con exactamente la proporción de la tarjeta (16:11), sin huecos.
- Llevan profundidad de campo, bokeh, iluminación y grano:
  - **Galactic Roulette:** la rueda enorme con la bola en el hueco.
  - **Galactic Slot:** tres rodillos con sietes que llenan la tarjeta.
  - **Dardos:** la diana a pantalla completa.
  - **Billar:** la bola blanca en primer plano y el triángulo al fondo.
  - **Tower Drop:** la torre de contenedores.
  - **Orb Burst:** el techo de orbes.
  - **Shot Gallery:** la lona con sus ventanas.
  - **Pinball:** los bumpers y los raíles.
  - **Bowling:** el impacto en los bolos.
  - **Galoku:** el tablero de cinco cuadrados.
  - El resto también se ha rehecho.
- Pesan 359 KB en total en WebP de 800×550. Para regenerarlas: `python3 scripts/generate-covers.py && node scripts/rasterize-covers.cjs`.

## Tests
- Nuevos `verify-corner-sudoku-v3`, `verify-gallery-v11` y `verify-pinball-v6`, con fixtures dorados:
  - **Pinball:** pasadizos exactos e iguales en distintas semillas, y desatasco igual en distintas semillas.
  - **Gallery:** una diana por ventana.
- Pasan el determinismo completo, el typecheck, i18n (10 × 583), el build y el smoke móvil de los 14 juegos.
