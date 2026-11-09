# v160-saturn — Pinball V12: mesa nueva con recorridos claros (9-nov-2026)

Base: v159-saturn (dd124fa).

Encargo del propietario: tomar la estructura de la mesa de referencia, que se vea bien la segmentación de los recorridos y luego la decoración; menos cambios de color rápidos y menos huecos.

## Núcleo V12 (`lib/verified/pinballCore.v12.ts`; V1–V11 se conservan con verificadores y repeticiones)
- **Dos rampas con la boca en el centro de la mesa.**
  - Se entra si la bola llega por su eje a más de 120 px/s; una bola lenta vuelve a salir y una que cae por detrás rebota.
  - Cada rampa sube por su lado, da la vuelta arriba y baja por un raíl hasta su propio pasillo.
  - Cada rampa vale 500 más que la anterior (de 1500 a 6000) y vuelve a 1500 al perder la bola; al salir del raíl suma 1000.
- **Dos órbitas por las paredes:** dan la vuelta por el arco superior y sueltan la bola entre los bumpers del otro lado (1500).
- **Agujero de gusano en el centro:**
  - bajo un tejadillo y tras un bloque de tres dianas abatibles en V: hay que tumbar una y apuntar al hueco;
  - el tejadillo evita que la bola se cuele sola desde los bumpers.
- **Bumpers, postes y tirachinas, todos con valores distintos:**
  - un triángulo de tres bumpers grandes (300, 500, 400) bajo los carriles A-B-C y dos pequeños (100, 250);
  - cuatro separadores de carril (10–25) y tres postes (30, 45, 70);
  - tirachinas de 35 y 55.
- **Plato (bloqueo y multibola):** solo atrapa bolas lentas y las expulsa hacia abajo, hacia la pala derecha. Antes las devolvía a los bumpers y se formaba un bucle.
- **Pala superior:** baja junto al tirachinas derecho y alimenta la rampa izquierda.
- **Guías laterales:** terminan justo sobre la pala, no en su eje, para que la bola no se quede apoyada en el pivote.
- Mismas acciones que V11.
- **Prueba de mesa** (simulación con un bot que apunta, 80 partidas):
  - ninguna bola atascada;
  - las cuatro rutas son alcanzables;
  - jugar bien puntúa unas diez veces más que solo tirar del muelle.

## Presentación (`components/games/PinballVerified.tsx`)
- **Cada recorrido con un color fijo:** órbita izquierda cian, órbita derecha verde, rampa izquierda violeta, rampa derecha magenta y agujero central dorado.
  - Las órbitas van pintadas en el suelo.
  - De las palas a cada boca hay un carril de tiro con flechas que se encienden cuando el recorrido tiene premio.
  - Junto a cada boca, una placa con el valor de la próxima rampa.
- **Rampas elevadas:**
  - la subida, de plástico transparente tintado con nervios, flechas, bordes y sombra en el suelo;
  - la bajada, de doble alambre cromado con abrazaderas;
  - la bola se ve dentro del plástico o sobre los alambres.
- **Decoración:**
  - una nebulosa suave y una galaxia en espiral tras los bumpers;
  - un emblema propio de planeta con anillo entre los tirachinas;
  - los multiplicadores ×1–×5 en fila sobre el emblema y las misiones bajo él;
  - bumpers de una sola familia (añil con aro dorado y el valor en el tapón).
- **Luces calmadas:** sin ciclos de color ni luces que corren; pulsos lentos (~1,6 s) y destellos solo al golpear.
- **Rendimiento:** las rampas se pintan una vez en sprites (sombra, apagada, encendida); el rendimiento queda igual que con V11 pese a la decoración nueva.
- **Portada:** la genera el propio renderizador (`scripts/render-pinball-cover.mjs`). `rasterize-covers.cjs` ya no incluye por defecto las portadas que salen del juego (Shot Gallery, Slot, Pinball).
- Ajustes muestra la versión 1.60.

## Validación
- `verify-pinball-v12`:
  - valores distintos;
  - bumpers y tormenta;
  - postes;
  - pala superior;
  - spinner;
  - pasillos;
  - rampas: captura, valor creciente, vuelta a su pasillo, bola lenta y bola que cae por detrás;
  - órbitas;
  - tejadillo y agujero;
  - holguras;
  - sin atascos;
  - repetición dorada.
- Determinismo completo, lint, build, prueba básica de los 13 juegos, `qa-overlap` y `git diff --check`.
- Partida real de 100 s en el navegador con los botones táctiles, verificada por repetición en el servidor.
