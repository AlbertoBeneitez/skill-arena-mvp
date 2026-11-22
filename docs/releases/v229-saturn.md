# v229-saturn · Átomo con el ratón, «Enviar juego» centrado y Eliminatoria entre grupos (app 2.29)

Base: v228-saturn (sin subir todavía: el propietario decide cuándo, porque cada subida cuesta).

- **Átomo de la bienvenida con ratón:** botón izquierdo sube de órbita y botón derecho baja, se haga clic donde se
  haga; sobre el fondo no aparece el menú del botón derecho. En pantallas táctiles sigue igual (mitad derecha sube,
  izquierda baja).
- **«Enviar juego» centrado y más fino:** píldora de su propio ancho, cuerpo lacado oscuro, un solo filo champán más
  brillante en el centro, letra marfil con algo de espaciado y la moneda en oro apagado. Sin brillo ni destello animado.
- **Eliminatoria entre dos grupos (reglas v2, propietario 21-nov):** 5 jornadas; cada jornada juegan todos los que
  siguen de los dos grupos, suman puntos por puesto (el 1.º N, cada puesto uno menos) y queda fuera el peor; gana el
  grupo con más puntos (empate: el que conserva más jugadores; si no, empate y se devuelven las entradas). Termina antes
  si un grupo se queda sin jugadores. `lib/groupVersus.ts` (`rules: "v2"`, `versusPoints`), `stopAfterRounds` en
  `lib/groupCompetition.ts`. Las eliminatorias ya guardadas conservan sus reglas de v192.
- **Formulario «Nueva competición» (con conexión):** primero **Liga** o **Eliminatoria**. Liga muestra sus tres
  modalidades (Todos vs todos, 1 vs 1, Relevos); Eliminatoria no tiene submodos y lanza el reto contra otro grupo. En
  la clasificación de una eliminatoria se ven los puntos de cada grupo.
