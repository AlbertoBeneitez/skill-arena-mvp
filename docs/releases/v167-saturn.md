# v167-saturn — Grupo en negro y oro, juegos con portada para elegir, luz verde de rival y retoques de inicio (10-nov-2026)

Base: v166-saturn.

## Grupo (negro y oro)
- **Diseño nuevo**, elegido por el propietario: negro profundo, un único oro para lo elegido y lo que cuesta dinero, y texto en blanco cálido.
  - Filetes finos en lugar de cristal, sin cian y sin brillos.
  - Todo el estilo vive en `components/GroupHub.module.css`; las reglas antiguas de grupo de `globals.css` ya no le llegan.
- **Textos:** se quitan «Eres quien organiza», «Me invitaron a uno» y «Una partida» (bajo Partida única). Las etiquetas van en minúscula con mayúscula inicial.
- **Juegos con su portada en miniatura:** se elige pulsando; un circulito en la esquina marca el elegido.
  - En liga y torneo se pueden elegir varios. El circulito lleva el orden (1, 2, 3…) y se juegan en ese orden, uno por jornada, volviendo a empezar al terminar.
  - «Aleatorio», si no se elige ninguno, mantiene el sorteo de antes.
  - En partida única se elige un juego; sin él, el botón de pagar no se activa.
- **Código, compartir, pasos numerados y reparto con barras** como en v166, con el nuevo aspecto.

## Catálogo
- **Sin sombra arriba de las portadas:** la viñeta antigua (v121) se pintaba como una franja oscura sobre la mitad superior de cada ficha. Ahora solo queda el degradado suave bajo el botón.
- **Luz verde** en la esquina de la portada cuando hay una partida de un rival esperando en ese juego (modo «existing»). Tiene etiqueta accesible: «Hay un rival esperando».

## Inicio
- **«Enviar juego» algo más llamativo:**
  - filo dorado y texto en blanco cálido;
  - un destello lento de la moneda cada pocos segundos (no se anima si el sistema pide menos movimiento).
- **Ventana de bienvenida de «Enviar juego»:**
  - sin degradados: tarjeta negra lisa con filete dorado;
  - monedas grandes en oro;
  - botón dorado macizo.

## Avatar
- El recorte apaisado del avatar del chacal (retrato 04, selector de avatar) muestra la cabeza entera con las orejas. `AVATAR_VERSION` pasa a 167.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 y 360 px:
  - inicio con la luz verde;
  - bienvenida de «Enviar juego»;
  - grupo sin crear;
  - unirse;
  - grupo creado;
  - selector de juegos con orden;
  - reparto;
  - hoja de compartir.
- Una liga de Billar, Dardos y Bowling arranca con Billar en la jornada 1.
