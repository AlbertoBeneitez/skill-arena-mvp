# v221-saturn · Átomo controlable con espectro y «Hola de nuevo» más compacto (app 2.21)

- **«Hola de nuevo»:** el avatar baja un poco y el nombre queda más cerca de «Entrar».
- **Átomo de inicio (`components/AtomScene.tsx`):**
  - Más arriba (centro al 25 % de la altura) y la última órbita más pequeña: ya no llega a los bordes y la separación
    entre órbitas se estrecha hacia fuera.
  - Control: toque en la mitad derecha del fondo → sube de órbita; en la mitad izquierda → baja. Los botones no cuentan.
  - Subir = absorber: la luz de alrededor se mete en el electrón (motas del color del salto), el electrón brilla con
    ese color y la zona se oscurece en 0,3 s y vuelve a su tono en unos 6 s.
  - Bajar = emitir: destello pequeño, chispas, un anillo fino que crece hasta salir de la pantalla y un fotón (onda)
    que sale en línea recta hacia fuera.
  - Espectro por salto, como un átomo real (más cerca del núcleo, más energía): 1↔2 violeta, 2↔3 azul, 3↔4 verde,
    4↔5 rojo. Cada órbita lleva el tono del salto que llega a ella. 5 órbitas (decisión del propietario).
  - Sin tocar unos 8 s, el electrón baja solo una órbita (con su destello); ya no sube por sí solo.
  - Normas de luz (WCAG 2.3.1): como mucho un salto cada 0,7 s; núcleo del destello ≤ 48 px; anillo de una línea;
    zonas oscuras que entran y salen despacio. Con «reducir movimiento», escena quieta y sin efectos.
- Solo presentación: sin cambios de juego, servidor ni datos.
