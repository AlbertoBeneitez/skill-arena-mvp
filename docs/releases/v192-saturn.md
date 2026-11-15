# v192-saturn — Slot por dinero, migraciones automáticas, grupo contra grupo (15-nov-2026)

Base: v191-saturn. Pedidos del propietario (15-nov).

- **Slot es juego por dinero** («EL SLOT DE ESTE JUEGO NO ES DE AZAR»): vuelve a tener entradas 1 y 5 ₡, tarjeta
  dorada, cuenta en el ranking de ingresos y se puede elegir en grupos con entrada. Solo Ruleta (apagada) sigue siendo
  de azar. La nota «los juegos de azar no están» solo aparece si hay alguno en la lista.
- **Sin rejilla por defecto:** fuera las ocho texturas de cuadrícula de fondo (app, cartera, grupos, gráficas); líneas
  de las gráficas a 1,25 px, sin rejilla ni línea base en Ranking › Juegos, con un relleno suave bajo la línea; barras
  de 3 px.
- **Grupos:** «Crear un grupo» crea el grupo al pulsarlo (sin panel ni segundo botón); «Tengo un código» despliega el
  formulario. Botón rojo **BORRAR** en el grupo y en la competición, con confirmación; si la competición no había
  terminado, devuelve la entrada.
- **Migraciones automáticas** («tiene que ser un proceso automático»): `db/migrations` se empaqueta en
  `lib/server/migrationsBundle.ts` (`scripts/build-migrations.mjs`; `pnpm lint` y `pnpm build` fallan si el paquete no
  está al día). Al arrancar, `instrumentation.ts` aplica las que falten en una sola transacción con bloqueo
  (`pg_advisory_xact_lock`, seguro tras el pooler de Neon), las anota con su SHA-256 en `arena_schema_migrations`,
  rechaza una migración ya aplicada cuyo contenido cambió y cualquier SQL que borre. Las 001–006 pegadas a mano se
  anotan sin daño y se crea la 007. `/api/health` muestra `schema`. Ensayado: base vacía → 001–007 al primer arranque,
  nada al segundo.
- **Grupo contra grupo (reglas, `lib/groupVersus.ts`):** dos grupos del mismo tamaño juegan una sola competición con
  todos sus jugadores. Liga: es la liga de los jugadores; al final gana el grupo con menor suma de posiciones (empate:
  el que tenga el mejor clasificado). Torneo: cada ronda quedan fuera los dos peores de todos (con un jugador por
  grupo, solo el peor); gana el grupo que conserve jugadores. Bote: entrada por jugador, se reparte a partes iguales
  entre los miembros del grupo ganador; empate devuelve las entradas (propuesta, pendiente de confirmar).
- **Pendiente:** pestaña para buscar grupo rival por liga o torneo y ranking de grupos por dinero ganado. Necesitan que
  los grupos vivan en el servidor (hoy viven en el móvil): siguiente fase, sin rivales inventados.
- **Validación:** `pnpm lint`, `pnpm test:determinism` (con `verify-group-versus`), `pnpm test:repository` (con
  `verify-migrations`), `pnpm build`, smoke de 13 juegos, solapes, `git diff --check`.
