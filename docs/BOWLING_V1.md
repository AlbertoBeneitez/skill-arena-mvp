# Galactic Bowling V1 (`bowling@1.0.0`)

Diseño y código originales (sin recursos de terceros).

- Reglas: bolos de diez, 10 marcos, plenos y semiplenos con sus bonus, y bolas extra en el décimo marco (`bowlingScore`).
- Física determinista en enteros (µm, 120 Hz, 4 subpasos) sobre una pista reglamentaria: 1054 mm de ancho, 18,29 m hasta el bolo 1 y bolos a 305 mm. La bola resbala recta sobre el aceite hasta los 11 m y luego engancha según su efecto. Bola y bolos chocan como discos con impulso (un bolo que cae barre un radio mayor), y las bolas al canal no tocan los bolos. Un bolo cuenta como derribado si recibe un impulso fuerte o se desplaza más de 32 mm. Tras el tiro se retiran los caídos y los que siguen en pie se quedan donde están.
- Entrada: `AIM_xx` (posición, 21 pasos), `ANGLE_xx` (25), `SPIN_x` (9) y `POWER_x` (9), seguidos de `ROLL`. `SKIP` termina antes la celebración. En pantalla se arrastra la bola para colocarla y se desliza hacia arriba: la dirección marca el ángulo, la velocidad la potencia y la curva del gesto el efecto.
- Celebración: un pleno dura 360 ticks y un semipleno 150. Un toque las salta y queda grabado como `SKIP`, que nunca cambia la puntuación.
- Tests: `scripts/verify-bowling-v1.ts` cubre la puntuación, el canal, el gancho solo en la zona seca, partidas completas, replay, que saltar no cambia la puntuación y 3 fixtures dorados.
