# v218-saturn · Ligas por victorias, perfil con tus grupos e imágenes de grupo (app 2.18)

- **Ligas por victorias:** el nivel de cada juego (Bronce, Plata, Oro, Platino, Diamante) se gana por número de
  victorias en ese juego: 5 para Plata, 15 Oro, 30 Platino, 50 Diamante; no se pierde. Cuentan todas las partidas
  ganadas del juego (liga, públicas, de grupo). Las fichas guardadas antes conservan su nivel (empiezan en el mínimo
  de ese nivel). Desaparecen las series de 5 partidas con ascensos y descensos. Tras una partida de liga se ven las
  victorias y lo que falta para el siguiente nivel.
- **Pestaña del avatar:** solo los dos juegos con más rango (nivel, luego victorias, luego partidas), con victorias,
  camino de niveles y mejor marca; también con conexión. Al final, la clasificación de cada grupo en el que está el
  jugador (última competición de cada grupo; sin conexión, su grupo local).
- **Grupos:** fuera el botón rojo «BORRAR»; una papelera discreta en la cabecera del grupo pregunta antes, justo
  debajo. El nombre largo del grupo ya no se monta sobre los iconos.
- **Imágenes de grupo por defecto:** seis escenas tipo fotograma de película (astronautas ante un gigante anillado,
  eclipse, portal estelar, lanzamiento nocturno, base lunar con la Tierra, cometas) generadas por código con
  `scripts/render-group-art.py` (obra propia); sustituyen a los dibujos SVG.
- 10 idiomas. Pruebas: `scripts/verify-leagues.ts` reescrito.
