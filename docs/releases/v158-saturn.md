# v158-saturn — Avatar elegido = avatar final, «Enviar juego» con premio y Shot Gallery con objetivo visual (9-nov-2026)

Base: v157-saturn (d941514).

- **Hoja de avatares:** cada casilla 2:1 muestra centrado el mismo círculo que tendrá el jugador (el recorte cuadrado), sobre el recorte apaisado desenfocado. Lo que se elige es exactamente lo que se ve después. El elegido lleva un anillo cian.
- **Nombre:** ya no aparece «Nombre disponible en este navegador». Un nombre ocupado muestra «Nombre ya elegido»; un formato no válido sigue mostrando la regla (2–18 letras, números o _).
- **«Enviar juego»:**
  - lleva un icono de monedas dorado;
  - la primera vez que se pulsa aparece un recuadro: «Crea tu juego y gana dinero» y «Continuar», que abre el formulario. Las condiciones, ya existentes en el formulario, explican el reparto. Se recuerda en este navegador (`gx-studio-welcome-v1`).
- **«Enviar juego» y «Rankings»:** mismo alto (42 px), texto de 14 px e icono de 18 px.
- **Shot Gallery** (solo presentación; el núcleo V13 no cambia):
  - la orden ya no nombra el aura ni la forma («Aura verde», «por su aura»…): pone «Objetivo» y, al lado, la imagen de lo que hay que destruir;
    - para un color, una nebulosa con rayos de ese color;
    - para una forma, la figura sin color;
  - las doce órdenes pasan a dos filas de seis a la derecha;
  - sin los dos cañones ni los trazos: el disparo queda exactamente donde se pulsa;
  - el ser alcanzado explota desde ese punto: destello blanco, bola de fuego y onda en su color de aura, y el cuerpo se rompe en pedazos que salen despedidos.
- Ajustes muestra la versión 1.58.

## Validación
- `pnpm lint`, determinismo (incluida la prueba de presentación de Shot Gallery), build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Navegador:
  - nombre ocupado y nombre válido;
  - hoja y elección de avatar;
  - inicio con los dos botones;
  - recuadro de primera vez, que no vuelve a salir;
  - partida completa de Shot Gallery con toques, verificada en el servidor: 12 de 12, 10 551 ms;
  - fotogramas de explosión y de las órdenes por color y por forma.
