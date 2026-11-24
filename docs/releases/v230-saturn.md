# v230-saturn · Avisos dentro de la app (app 2.30)

Base: v229-saturn. Sin cambios en ningún juego ni en sus puntuaciones. Programa lo que el propietario aprobó el
20-nov-2026 sobre `design/avisos/avisos-propuesta.jpg`, con sus cambios: **solo buenas noticias**, «Dónde» con **App** y
**Móvil**, y el **logo de Galactic Games** en el aviso. Subir de liga y nuevo récord quedan fuera (serán una animación en
el momento, tarea aparte).

- **Qué se avisa** (solo a quien juega con cuenta y conexión):
  - **Reto aceptado:** a los miembros del grupo que lanzó el reto, con el nombre del grupo que lo acepta.
  - **Te toca jugar:** al empezar una competición (a todos menos a quien la empieza) y al abrirse cada jornada nueva.
  - **Ganas la jornada N** y **¡Ganas la competición!** / **¡Vuestro grupo gana!**: solo a los ganadores.
- **Dónde se ve:** un aviso arriba durante 6 s con el logo y una acción (Jugar / Ver, que lleva a Grupos), y la sección
  **Avisos** de la pestaña del avatar (junto a Perfil y Ranking), con Hoy / Ayer / Antes. El número de avisos sin leer
  aparece en esa sección y sobre el avatar de la barra inferior. Abrir la sección los marca como leídos. La campana de la
  propuesta no va en la cabecera: con cuatro controles, una quinta pieza encogía el nombre GALACTIC GAMES.
- **Ajustes** (debajo de la lista): qué te avisamos (reto aceptado, te toca jugar, ganas) y Dónde: App / Móvil. «Móvil»
  aparece como no disponible hasta que el propietario ponga las claves de Web Push (VAPID) en Vercel.
- **Servidor:** migración 020 (`arena_notifications`, `arena_notification_settings`), `lib/server/notifications.ts` y
  `GET/POST /api/notifications`. Los avisos los escribe el servidor en la misma transacción que decide el hecho
  (`lib/server/groups.ts`), tras un punto de guardado: un fallo del aviso nunca deshace ni bloquea la partida. Un aviso
  apagado no se guarda. Un mismo hecho no se avisa dos veces. Solo se guarda lo que el texto necesita (competición,
  jornada, juego, nombre del grupo).
- **Coste:** la app no consulta los avisos en bucle: solo al abrirse, al volver a la pantalla y al cambiar de pantalla
  (como mucho una vez cada 30 s).
- **Privacidad:** los avisos se borran a los 30 días y al borrar la cuenta. Política de privacidad actualizada en los
  10 idiomas (24-nov-2026).

Pruebas: `verify-groups` (quién recibe cada aviso, ninguno a los perdedores, uno por hecho, bandeja, marcar como leído,
ajustes apagados, borrado con la cuenta). Revisión visual local del aviso y de la sección con avisos de muestra.

**Coordinación con otra sesión:** la rama `feat/reloj-partidas-ocultas` (y las que salen de ella) ya usa la migración
**019** (`019-command-attempt-clock.sql`). Por eso los avisos son la **020**: las migraciones se identifican por su
número y dos 019 distintas chocarían al juntar las ramas. Cuando se junten, quedarán 019 y 020 en ese orden.
