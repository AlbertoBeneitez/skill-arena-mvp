# v143-saturn — Acabado visual de conjunto, ruleta en 3D y Slot sin solapes (4-nov-2026)

Base: v142-saturn (439d411). Solo presentación: ningún núcleo ni regla competitiva cambia (Roulette 16.0.0,
Slot 3.0.0, Stack 4.0.0 y Shot Gallery 12.0.0 siguen igual; replays y verificación intactos).

- **Catálogo, un solo acabado:**
  - cada fila lleva en su título una marca y una línea fina que se desvanece, del color de su tipo de juego (cian Populares, rosa Nuevos, y el de cada estantería);
  - las tarjetas son paneles de cristal oscuro con el borde iluminado desde arriba en ese color, y la portada se funde con el panel;
  - **botones de jugar con color sutil:** borde mecanizado teñido del color del juego, un resplandor tenue que sube desde el borde inferior y el barrido de luz teñido; el texto sigue casi blanco;
  - cabecera con la marca en plata cepillada y una línea iluminada (cian a violeta) en lugar del borde plano; la barra inferior lleva la misma línea.
- **Roulette en 3D:** la rueda se ve desde una cámara inclinada 49° y cada superficie a la altura que le da el núcleo (pista peraltada, estátor, rotor inclinado, casillas, trastes, rombos y cúpula). La bola se dibuja en su posición real (r, θ, z) con su sombra: sale de la cuna en un arco sobre el borde, cae a la pista, rueda contra la pared, baja, rebota en rombos y trastes y se queda en la casilla. Al apuntar se ve el arco de vuelo, el punto de entrada en la pista, el sentido y el recorrido según la fuerza, y un anillo de potencia en la cuna. Los toques se proyectan al plano de la mesa. El arco del vuelo corto desde la cuna es de dibujo (el núcleo lo vuela en línea recta, con la misma velocidad y tiempo).
- **Slot:**
  - la composición sigue la altura real de la pantalla (antes suponía 620 y en móviles pequeños los contadores de pasos, el borde de la máquina y la línea de «Pareja / 7 sin pareja» quedaban debajo de los botones o del marco);
  - «Pareja 10» y «7 sin pareja 5» son ahora fichas de la tabla de premios, como las demás;
  - el letrero de premio se apoya en el marco superior y no tapa ninguna ficha;
  - botones de abajo en tonos más oscuros (ámbar, verde y rojo profundos, bisel en gris metálico).
- **Stack:** módulos con textura en el juego y en la portada: laterales en metal cepillado con ranura y remaches, placa superior con trama fina, panel grabado, biseles y un cambio suave de tono (metal anodizado).
- **Shot Gallery:** cada criatura tiene una capa de detalle (brillo y poros del kraken con párpado y branquias; juntas, remaches y franja de peligro del dron; guadañas dentadas, abdomen anillado y antenas encendidas de la mantis; burbujas, núcleo y goteo del limo; pliegues, anillo de runas y brasas del espectro; aristas, musgo y grieta incandescente del gólem; reflejo, arnés y parche del astronauta). Portada nueva en el hangar 7: la mantis recibe el láser en la guadaña, con el kraken, el espectro, el dron, el gólem y el limo tras las coberturas.
- **Solitaire Sprint:** portada nueva con una escalera de cartas que alterna rojo y negro (K♠ Q♥ J♣ 10♦ 9♠ 8♥ 7♣) encuadrada en diagonal, y el 6♦ llegando en vuelo.
- `scripts/rasterize-covers.cjs` acepta nombres para rasterizar solo algunas portadas.

## Validación
- `tsc`, `pnpm lint`, determinismo completo (con `verify-roulette-presentation` actualizado a la proyección 3D: la bola se dibuja donde la pone el núcleo, a su altura), build, prueba básica de los 14 juegos y `qa-overlap`.
- Slot revisado a 360 × 640, 375 × 667, 390 × 844 y 412 × 915; ruleta: apuntado, vuelo, rodadura y reposo.
