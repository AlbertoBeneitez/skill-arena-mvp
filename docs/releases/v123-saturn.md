# v123-saturn — Saturno realista, transiciones limpias, Roulette 13, Billar 7, Dardos en escenario y caída real en Tower Drop (30-oct-2026)

Base: v122-saturn (b552699).

## Imagen inicial
- **Saturno nuevo.** El planeta y los anillos en SVG se sustituyen por un render procedimental propio (`scripts/render-saturn-hero.py`, numpy) guardado en `public/art/saturn-hero.webp` (1260 × 906, ~104 KB). Incluye:
  - bandas de latitud, remolinos y un óvalo de tormenta;
  - luz lateral con oscurecimiento del borde y sombra de los anillos sobre el planeta;
  - anillos con cientos de anillos finos, una división tipo Cassini y la sombra del planeta sobre ellos;
  - una luna helada pequeña.
- **Fondo nuevo:** una nebulosa propia (`public/art/stage-nebula.webp`, 390 × 1700, ~10 KB) con polvo oscuro y el brillo del sol.
- Las dos imágenes se precargan y la escena común (bienvenida, avatar y catálogo) usa el mismo render.
- Es arte original generado por código; no hace falta añadir nada a THIRD_PARTY_NOTICES.

## Transiciones
- **Sin destello azul entre el avatar y los juegos.** Lo causaba un degradado azul claro antiguo de `main.appShell` que asomaba durante el fundido de entrada. Ahora el fondo es siempre azul noche y el catálogo aparece sin fundido.
- **El cálculo de la partida ya no se ve.** La capa «verificando» solo aparece si la verificación tarda más de 1,6 s. En ese caso es un anillo discreto, sin velo ni desenfoque. Las verificaciones normales tardan menos y no muestran nada.

## Roulette 13 (`galactic-roulette@13.0.0`; V1–V12 intactos)
- El juego se llama **Roulette** en todos los idiomas. El identificador sigue siendo `galactic-roulette`.
- **Final de la bola natural, como en una ruleta real.**
  - La bola baja por el cono, choca con la pared interior de los huecos, rebota en los separadores y se frena por rozamiento dentro del hueco.
  - Cuando la velocidad relativa al cilindro es casi nula, se queda pegada y **gira con la rueda**.
  - Ya no hay ningún tramo interpolado ni recolocación de la bola al final: el último dibujo es la propia física.
- **Medido en el núcleo:**
  - tiempo dando vueltas en el cono, percentil 90: de 1,01 s (V12) a 0,10 s;
  - tirada típica de 5,8 s;
  - reparto justo con χ² = 30,4 y 36 grados de libertad;
  - ninguna tirada se queda en la torreta.
- **Pruebas nuevas:**
  - final natural (cero ticks en la torreta);
  - bola pegada al hueco;
  - golden replay;
  - en presentación, la bola pintada gira con su hueco en todo momento.

## Dardos: escenografía
- **Diana dibujada con detalle:** colores clásicos, textura de sisal, araña metálica, números cromados y luz principal. Se pinta una vez a 2× y se reutiliza en cada frame.
- **Escenario completo:**
  - sala con público desenfocado;
  - estructura con tres focos y conos de luz con polvo;
  - luces laterales rosa y turquesa;
  - suelo en perspectiva y línea de lanzamiento luminosa.
- **Diana enmarcada:** sombra y halo LED.
- **Impacto:** destello y onda, más fuertes en diana, triple y doble.
- Solo cambia la presentación; las reglas y el núcleo no varían.

## Billar 7 (`billiards@7.0.0`; V1–V6 intactos)
- **Mesa más grande:** ocupa todo el ancho del móvil (escala 1,09 frente a 0,78, un 40 % más) y se centra en el alto disponible. La barra de fuerza y la tira de niveles van justo debajo.
- **Más fuerza:** con fuerza máxima, la blanca sale a 4.500 frente a 3.300 en V6 (+36 %). Las mesas y la gymkana de 5 niveles no cambian.
- **Tirar desde el otro lado solo cerca de la banda:** se puede tirar desde cualquier punto únicamente cuando la blanca está en el tercio exterior de la mesa, a lo ancho o a lo largo. En el tercio central hay que coger la blanca, y un anillo discontinuo marca dónde.

## Tower Drop: caída realista
- Un bloque que se sale del borde ya no desaparece.
  - Al volcar, continúa con la rotación y la velocidad que tenía.
  - Roza la cara exterior de la torre sin atravesarla.
  - Cae por fuera de la plataforma girando con gravedad real.
  - Levanta polvo en la arista por donde se cae.
- Solo cambia la presentación (no cambia el resultado).

## Vista de los juegos
- La barra de pestañas va pegada abajo, ocupando todo el ancho y con las esquinas superiores redondeadas.
- La lista de juegos baja hasta 18 px de la barra.
- Las partidas ya usan el alto completo del móvil.

## Validación
- Determinismo completo: incluye Roulette V13 y Billar V7 con fixtures nuevas y todos los adaptadores antiguos.
- Lint, `tsc`, i18n (10 idiomas × 653 claves), `git diff --check` y build.
- Smoke test de los 14 juegos.
- Capturas a 390 × 844: bienvenida, catálogo, final del catálogo, billar, dardos, ruleta y caída de Tower Drop con un renderizador sin conexión.
