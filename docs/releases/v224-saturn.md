# v224-saturn · Ranking y perfil más limpios (app 2.24)

- **Ranking › Juegos:** línea discontinua desde el punto elegido hasta la base del gráfico. Las fechas del eje ya no se
  pisan (la penúltima se oculta si queda demasiado cerca de la última).
- **Ranking (textos fuera, decisión del propietario):** «Juega una partida para entrar», «· datos de ejemplo y tu mejor
  marca» (la tabla se titula «Ranking de {juego}»), «Ranking de móvil: solo jugadores de móvil» y «Tu mejor marca se
  guarda en este navegador». Los rankings siguen separados por plataforma; solo deja de decirse en pantalla.
- **Avatar › Perfil:** el lápiz deja de ser un botón amarillo al lado: es un círculo pequeño y gris justo a la derecha del
  nombre y centrado con él, como en la mayoría de juegos móviles (toda la tarjeta sigue siendo el botón). Fuera «Conectado con Google»: la tarjeta queda en
  avatar, nombre y beneficio neto (más grande). Clave `profile.signedInWith` eliminada. Al terminar de editar, «CONTINUAR» vuelve a Avatar › Perfil y no a
  Juegos. En la pantalla de edición, «CONTINUAR» queda justo debajo del nombre.
- **Clasificación de tus grupos:** sin «Ir a Grupos»; queda «Aún no estás en ningún grupo.» como texto (10 idiomas).
- Claves de traducción eliminadas: `ranking.gameCaption`, `ranking.noScore`, `ranking.gameNote`,
  `ranking.platformMobile`, `ranking.platformDesktop`.
