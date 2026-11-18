# v217-saturn · Modalidades de grupo (app 2.17)

- La sección de competiciones de grupo pasa a «Modalidad» con tres opciones, que sustituyen a partida única, liga y
  eliminatorias (las competiciones ya empezadas terminan con sus reglas):
  - **Todos vs todos:** cada jornada juega todo el grupo; el 1.º suma N puntos, cada puesto uno menos, el último 1.
  - **1 vs 1:** cada jornada, cada uno contra un jugador de otro grupo; ganar 2 puntos, perder 0.
  - **Relevos:** contra otro grupo del mismo tamaño; cada uno juega después del anterior de su grupo, empieza desde
    cero y sus puntos se suman a los del grupo; el grupo ganador suma 2. Marcador de los dos grupos en la jornada y
    tabla de grupos.
- Botón «Buscar grupo rival» en cada jornada contra otros grupos (busca hasta que aparece uno; se puede cancelar).
- Número de jornadas elegible en las tres; una jornada se cierra cuando han jugado todos.
- La clasificación (puntos) va al final de la pestaña Grupos y se actualiza jornada a jornada.
- Sin conexión funcionan las tres con grupos rivales inventados. Con conexión, de momento solo todos vs todos (lo indica
  la pantalla); contra otros grupos online y la notificación en el móvil quedan para la fase 2 (ADR 009).
- Se retira de la interfaz el juego grupal de Stack de v211 (lo sustituye «Relevos»); su API y datos se conservan. La
  app deja de consultar el servidor cada 45 s para ese juego.
- 10 idiomas. Pruebas: `scripts/verify-group-modalities.ts`, ampliado `scripts/verify-groups.ts`.
