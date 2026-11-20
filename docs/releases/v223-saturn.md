# v223-saturn · Buscador de juegos y Ranking › Juegos (app 2.23)

- **Buscador de juegos (grupos):** las categorías ocupan todo el ancho de cada fila (todas en mayúsculas); los juegos,
  un poco más separados de la caja de búsqueda; la X que quita el último juego elegido pasa a la derecha de la caja de
  búsqueda, cuadrada y con una sombra ligera (`GamePicker`, `onClearLast`).
- **Ranking › Juegos:** fuera la etiqueta «DATOS DE EJEMPLO» (decisión del propietario: versión de pruebas; luego habrá
  simulaciones o probadores) y el subtítulo del periodo («Último mes»). La etiqueta del gráfico muestra la cantidad
  arriba y la fecha debajo.
- Nota interna: los ingresos por juego siguen siendo una serie de ejemplo (`lib/demo/sampleGameIncome.ts`) hasta que
  exista el registro de comisiones; la pantalla ya no lo indica.
- Diseño: el propietario descarta los 12 ecosistemas propuestos y «Marea Coral»; se queda con el aspecto actual y el
  gusto por lo retro.
