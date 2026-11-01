# v134-saturn — Imágenes iniciales nuevas: Saturno en primer plano e icono a juego (1-nov-2026)

Base: v133-saturn (53d107f). Solo arte: ningún núcleo cambia. Petición del propietario: «cambia las dos imágenes iniciales», con la dirección elegida «primer plano dramático» sobre fondo negro.

## Bienvenida
- **El planeta (`scripts/render-saturn-hero.py` → `saturn-hero.webp?v=134`):**
  - 2,3 veces más grande (radio 300 en lugar de 128), con el centro arriba a la derecha (410, 150);
  - ocupa la mitad superior de la pantalla, con el logotipo debajo sin tocarlo;
  - luz desde detrás y a la izquierda: solo brillan una media luna y la atmósfera del borde (halo cálido más intenso hacia la luz), y el lado nocturno se ve tenue con la luz de los anillos;
  - los anillos cruzan la pantalla en diagonal;
  - la sombra del planeta sobre los anillos tiene penumbra, para que su borde no parezca un corte;
  - una luna pequeña, también en creciente, arriba a la izquierda.
- **El escenario (`OrbitalScene`):**
  - nuevo encuadre: imagen de x −20…400 e y 0…520 del mundo;
  - se retiran la órbita discontinua y las tres lunas de juego (bola 8, ficha y dardo), así que el planeta es la única imagen;
  - la cámara de bienvenida, avatar y catálogo no cambia.

## Icono
- **`scripts/render-app-icon.py` → iconos `?v=134`:**
  - fondo negro con un resplandor cálido donde el sol queda detrás del planeta;
  - planeta arena retroiluminado, en creciente como en la bienvenida, y más grande;
  - la G de metal en relieve, más grande y legible a 48 px;
  - el anillo arena sale por los bordes;
  - sin luna ni destello.
- **En móviles con la app ya instalada,** quitarla de la pantalla de inicio y volver a añadirla para que el lanzador recoja el icono nuevo.

## Validación
- `tsc`, determinismo completo, i18n, `git diff --check` y build.
- Prueba básica de los 14 juegos y `qa-overlap` sin solapes.
- Bienvenida y avatar revisados a 390 × 844, con el icono a 48, 72, 96 y 512 px.
