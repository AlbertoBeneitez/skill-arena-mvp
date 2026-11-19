# v219-saturn · Arranque sin parpadeos, Tu selección por partidas, megáfono simple (app 2.19)

- **Arranque:** hasta conocer el estado guardado y la sesión (y su cuenta) se muestra solo la marca sobre fondo oscuro;
  ya no asoman durante un instante la bienvenida u otras pantallas. Si la red tarda más de 4 s, la app sigue.
- **Tu selección:** solo los juegos que el jugador ha jugado, del más jugado al menos (sin rellenar con populares); sin
  partidas, la fila no aparece. Tarjetas algo más pequeñas (2,4 por pantalla); **Populares** con el tamaño del resto.
  El conteo se guarda en el dispositivo y, con cuenta, en el servidor (`arena_play_counts`, migración 016,
  `/api/account/plays`): vuelve al entrar de nuevo, tras cerrar sesión o en otro dispositivo; nunca baja. Borrar la
  cuenta borra sus conteos.
- **Grupos › Juegos:** la X quita el último juego elegido, no todos.
- **Megáfono:** un toque activa o silencia el sonido; sin panel «Elige la música» (el tipo de música sigue en Ajustes).
  Fuera los pitidos agudos sueltos de las músicas «ambient» (campanas) y «deep» (880 Hz cada 16 tiempos).
- **Retar a otro grupo (con conexión):** el juego se elige con el mismo buscador que la nueva competición (categorías,
  búsqueda y portadas) en lugar de un desplegable (`components/GamePicker.tsx`, compartido).
