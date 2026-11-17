# v210-saturn · Círculo morado (app 2.10)

- Catálogo: el círculo de arriba a la izquierda tiene tres estados. Morado: tienes una partida de ese juego por jugar
  (gana al verde). Verde: hay un rival esperando. Blanco: nada pendiente. Etiqueta accesible «Tienes una partida por
  jugar» en 10 idiomas.
- Fuente actual: el siguiente partido de tu competición de grupo en curso (`nextGroupMatch`). Se ve también sin
  conexión. Los turnos del juego grupal se sumarán al mismo conjunto (`pendingGames`).
- `GROUP_YOU` pasa a constante de módulo. Con reducción de movimiento, ningún círculo parpadea.
