# v114-saturn — Catálogo rápido, Galakdoku, Pinball 5, Shot Gallery 10 por tiempo de reacción (25-oct-2026)

Base: v113-saturn (5264f88).

## Rendimiento
- **Catálogo:** las portadas eran SVG con muchos filtros de desenfoque, muy caros de pintar en el móvil. Ahora el catálogo usa portadas WebP de 800×500 (unos 22 KB cada una). Con la CPU ralentizada ×4 en un móvil simulado, recorrer el catálogo bloqueaba la pantalla 5,7 s (fotogramas de hasta 3,6 s) y ahora unos 1,2 s, que es el coste base de la página: con las portadas ocultas sale lo mismo.
- Las portadas se cargan todas al entrar (las cuatro primeras con prioridad alta), así que al deslizar ya están.
- El código de cada juego se descarga en segundo plano mientras miras el catálogo, y al tocar el botón de un juego se adelanta el suyo.
- Portadas y avatares se guardan en caché un día (`Cache-Control`), y la barra inferior y la ficha de perfil usan el retrato pequeño (192 px).
- Para regenerar las portadas: `python3 scripts/generate-covers.py && node scripts/rasterize-covers.cjs`.

## Galakdoku (`corner-sudoku@2.0.0`; V1 intacto)
- Nuevo nombre en los 10 idiomas.
- Solo tres cuadrados: el de la esquina, el de su derecha y el de debajo, girados 45° y más grandes.
- Cada cuadrado lleva del 1 al 9, y ningún número se repite en las tres filas de arriba ni en las tres columnas de la izquierda.
- Cada partida tiene cinco retos con 12, 11, 10, 9 y 8 números dados. Con tan pocas reglas hay varias soluciones válidas, así que cualquier número que no rompa ninguna regla y deje el tablero resoluble cuenta como correcto; lo comprueba el solver determinista.
- El teclado es una cuadrícula de 3×3 y los números ya no se apagan ni desaparecen.

## Pinball 5 (`pinball@5.0.0`; V1–V4 intactos)
- **Mesa fija:** la disposición de bumpers es la misma en todas las partidas y el skill shot rota A→B→C con cada lanzamiento. La misma potencia del muelle produce exactamente el mismo tiro en cualquier partida (probado con 12 semillas y tres potencias).
- **Misiones:** carriles A-B-C + dianas laterales + bloque de abatibles dan 10 000 × multiplicador y +10 s de tiempo extra. Se pueden ganar hasta tres veces, así que una partida dura de 60 a 90 s.
- **Hurry-up:** al tumbar las abatibles se enciende un jackpot que baja de 12 000 a 3 000; la rampa o la órbita lo cobran.
- **Bola salvada:** si la bola cae en los 5 s siguientes al lanzamiento, se conservan el multiplicador y el combo.
- **Frenesí:** en los últimos 10 s todo puntúa doble.
- **Gráficos:** luces de misión, contador del hurry-up con flechas doradas, lámpara SAVE, borde rosa pulsante durante el frenesí, fichas de tiempo extra en el marcador y la barra de tiempo con el tiempo extra.

## Shot Gallery 10 (`reaction-test@10.0.0`; V1–V9 intactos)
- La puntuación es el **tiempo de reacción acumulado, en ms; menos es mejor**.
  - Cada acierto suma el tiempo desde la luz verde o desde el acierto anterior.
  - Una placa equivocada suma 400 ms, anticiparse 600 ms y cada placa que quede en pie 1500 ms.
  - Las 12 rondas se juegan siempre completas.
- La orden muestra el color como una mancha de pintura uniforme (un solo color, sin brillo ni gotas).
- Se ha quitado la racha.
- El HUD muestra el tiempo acumulado, cada acierto muestra «+ms» y cada ronda lo que ha sumado.
- **Plataforma:** nueva métrica `reaction-time-ms` con las funciones `scoreBeats`, `isBetterScore` y `compareScores`.
  - Ligas: en las ligas altas el tiempo objetivo es menor.
  - Rankings: se ordenan de menor a mayor.
  - Mejor marca, grupos, resumen y liga muestran «ms».
  - El core publica `height = 1 000 000 − ms`, así que los duelos del servidor, que comparan alcance, dan como ganador al más rápido.

## Tests
- Nuevos `verify-gallery-v10`, `verify-corner-sudoku-v2` y `verify-pinball-v5`, con fixtures dorados.
- `verify-leagues` acepta las ligas por tiempo.
- Pasan el determinismo completo, el typecheck, i18n (10 × 581), el build y el smoke móvil de los 14 juegos.
