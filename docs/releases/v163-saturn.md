# v163-saturn — Celebraciones de Bowling profesionales y marcador del rival igual al del juego (10-nov-2026)

Base: v162-saturn (7a42c98).

Encargo del propietario: profesionalizar las imágenes de las animaciones del bowling y que el marcador de antes de empezar (con el resultado del rival) sea igual que el del juego.

## Bowling: celebraciones de estudio (solo presentación)
- **Sustituyen a los dibujos animados** (cohete, disco y platillo con bolos con cara y brazos).
- **Plató en 3D sencillo:** proyección con profundidad, cámara que se acerca, sacudida en el impacto y bandas de cine.
- **Bolos de arce iluminados:**
  - degradado de laca y reflejo especular;
  - dos franjas rojas con brillo propio;
  - luz de contorno del color del plató.
- **Sombras y reflejos:** cada bolo y la bola dejan sombra de contacto y reflejo en el suelo de espejo.
- **Bola:** resina brillante con remolino, agujeros y reflejo.
- **Tres platós:**
  - **Gala** (pleno, dorado): barras de luz, conos de foco y polvo dorado.
  - **Arena** (pleno, neón): láseres que barren y una rejilla de neón que avanza en el suelo.
  - **Órbita** (semipleno): nebulosa, estrellas y un planeta con anillos que asoma tras el escenario.
- **Coreografía:**
  1. La bola entra rodando.
  2. Los bolos salen despedidos en cámara lenta, con estela, chispas y onda en el suelo.
  3. Cae el título metálico.
  4. Los bolos caen al suelo.
  5. Vuelan uno a uno a formar el triángulo, iluminado como un trofeo con anillos de luz, fuegos artificiales y confeti.
  6. En el semipleno, los bolos que quedaban de pie salen despedidos y el resto del triángulo baja desde arriba.
- **Lo que no cambia:** la duración, el botón Saltar y la repetición previa.

## Marcador del rival antes de empezar
- La barra con el rival durante la cuenta atrás usa la misma pieza que el marcador del juego:
  - el mismo cristal, borde, alto y tipografía;
  - etiqueta a la izquierda y número dorado a la derecha.
- **Rival:** avatar con el aro del color de la liga, la medalla y el nombre. La liga completa queda para el lector de pantalla.
- **Etiquetas:** las del juego (Puntos, Fichas, Burbujas, Reacción en ms).
- Ningún texto se corta en los 13 juegos a 360 px de ancho.

## Validación
- Determinismo completo, lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Hojas de fotogramas de los tres platós.
- Ajustes muestra la versión 1.63.
