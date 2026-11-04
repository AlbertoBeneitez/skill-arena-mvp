# v145-saturn — Tablas del Slot más grandes y Pinball V10 con más rebotes (4-nov-2026)

Base: v144-saturn (e068c3f).

- **Slot (presentación, núcleo 3.0.0 sin cambios):** el propietario se refería a las tablas de rodillos de arriba, no a los rodillos de la máquina. Los rodillos vuelven al tamaño de v143 y las tablas crecen: 17,5 px por posición (antes 10,5) y símbolos de 19,5 px (antes 11,5); en pantallas cortas, 14 y 15,5. La posición actual de cada rodillo se marca con una píldora más ancha.
- **Pinball V10 (núcleo nuevo `pinballCore.v10`, 10.0.0):** más rebotes y más elementos con los que choca la bola. Mismas entradas y reglas que V9 (bloqueo, multibola, modos, reloj):
  - un quinto bumper (violeta) a la izquierda, junto a la batería de dianas;
  - tres postes de goma en el campo abierto (centro, derecha e izquierda sobre los tirachinas): devuelven la bola con restitución 0,75 y al menos 300 px/s, y suman 50;
  - dos separadores entre los carriles A, B y C arriba, donde la bola rebota antes de caer (10 cada uno);
  - tirachinas más vivos: despiden a 420 px/s (V9: 360) y suman 50 (V9: 30);
  - cada elemento nuevo deja al menos el diámetro de una bola de hueco con sus vecinos y las paredes (lo comprueba la prueba), así que nada encaja la bola.
  - V1–V9 quedan congeladas; el verificador del servidor tiene el adaptador de V10 y conserva el de V9.
- Dibujo: postes con anillo de goma, aro iluminado y onda al golpear; separadores con destello; quinto bumper en violeta.

## Validación
- `verify-pinball-v10` (repetición dorada, cada poste golpea, puntúa y devuelve la bola hacia arriba, el quinto bumper, la fuerza de los tirachinas, holguras, sin bola atascada, determinismo) y el resto del determinismo.
- Comparación con la V9 en 12 partidas simuladas: más del doble de puntos con el mismo jugador automático y ninguna bola atascada; sin flippers, menos bolas perdidas.
- `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
