# v156-saturn — Progreso en el avatar, Slot más legible, Billar simétrico y fotogramas más ligeros (9-nov-2026)

Base: v155-saturn (a706156).

- **Revisión de código (rendimiento):**
  - el código de juego apenas gasta CPU (menos del 2 %): el coste está en pintar píxeles;
  - las portadas, los retratos y los idiomas ya se cargan ligeros o bajo demanda, y el lienzo ya limita la densidad a 2×;
  - los tres juegos más pesados volvían a pintar cada fotograma elementos que no cambian. Ahora se pintan una vez en un sprite y se copian:
    - **Dardos:** el pabellón (fondo, focos, lavados de color y suelo); solo el centelleo, los conos y el polvo se dibujan en vivo;
    - **Slot:** cada símbolo y cada bombilla encendida con su halo;
    - **Billar:** la mesa estática (marco, paño, rejilla, troneras).
  - Medido en Chromium con la CPU frenada 4× (como un móvil modesto):
    - Dardos, de 8,8 a 13,1 fps;
    - Slot, de 13,6 a 16,6 fps;
    - Billar, de 15,2 a 22,5 fps (el tiempo bloqueado baja de 11,1 s a 1,7 s).
  - Si no hay DOM (pruebas de presentación), cada caché pinta directamente como antes.
- **Alta:** vuelve el avatar aleatorio por defecto en la pantalla de elegirlo (se quita el retrato vacío de v154).
- **Sin «ficticio» en los botones:**
  - el saldo de la cabecera muestra solo el importe;
  - «Añadir 10 €» y «Retirar 10 €» en los 10 idiomas.
  - Siguen indicando el alcance ficticio: la etiqueta accesible del saldo, «Identidad local · saldo y premios ficticios», «SALDO FICTICIO», el beneficio neto y los textos legales.
- **Portadas:** Bowling y Pinball, un poco más abajo. Slot, generada con el propio renderizador del juego: los mismos 7 que se ven al jugar, en la línea de premio.
- **«Enviar juego»:** botón más grande (42 px de alto, texto de 14 px).
- **Progreso por juego en el avatar:**
  - una fila por juego con su portada;
  - la liga y la serie en curso;
  - una barra con las cinco ligas, de bronce a diamante; la actual se llena con las victorias de la serie;
  - la mejor marca;
  - tocar la fila abre el juego.
- **Marcador:** sin la línea naranja bajo la puntuación.
- **Slot** (solo presentación; el núcleo V4 no cambia):
  - los premios de la tabla son más grandes (15 px; antes 11 px);
  - los números de pasos sobre + y − van en degradado, de azul en −3 a violeta en +3.
- **Billar** (solo presentación; la mesa no cambia de tamaño):
  - bajo la mesa, la barra de fuerza centrada;
  - debajo, tres paneles simétricos: Nivel (cinco casillas numeradas), Bolas (más grandes) y Tiros (puntos que reflejan las casillas de nivel);
  - etiquetas y números más grandes;
  - el taco se ve a través de los paneles.
- Ajustes muestra la versión 1.56.

## Validación
- Determinismo completo. La prueba de presentación del Billar cuenta ahora los números de las casillas de nivel.
- `pnpm lint`, build y `git diff --check`.
- Prueba básica de los 13 juegos y `qa-overlap` (sin solapes).
- Medición de fotogramas antes y después.
- Navegador:
  - pantalla de avatar, cabecera y perfil con el progreso;
  - un tiro de Billar;
  - Dardos;
  - Slot con los pasos en −3, 0 y +3, y una tirada.
