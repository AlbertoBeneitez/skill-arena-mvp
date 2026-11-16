# v197-saturn — Grupos en el servidor: rutas y pantalla «Online» (16-nov-2026)

Base: v196-saturn. App 1.97.

- **Ruta `/api/groups`** (`lib/server/groupHttp.ts`): GET = mis grupos y competiciones, retos abiertos de mi plataforma y
  ranking de grupos por dinero ganado. POST `{action}` = crear, unirse, salir, cerrar, competición, entrar, empezar,
  cancelar, aceptar reto, resultado. La plataforma sale de la cuenta, nunca de la petición; el setup se reconstruye en
  el servidor (comisión 0, desempate por tiempo, juegos de «menor gana» desde el registro; entrada 0–100 ₡);
  el resultado solo lleva el identificador de la partida verificada.
- **Eventos de servidor** (`group_created`, `group_joined`, `competition_created`, `competition_entered`) si el jugador aceptó la medición.
- **Pantalla:** pestañas «Mi grupo / Online» en Grupo (solo con cuenta del servidor). Online: crear/unirse, nueva competición
  (en el grupo o grupo contra grupo), entrar, empezar, cancelar, buscar rival, ranking. Probada de extremo a extremo con
  servidor local, base de datos real y sesión firmada (saldo 25 → 20 al entrar con 5 ₡), sin desbordes a 390 px.
- **Migraciones desde cero:** 001–011 se aplican solas al arrancar (`/api/health` → `schema: "011"`).
- **Textos:** español e inglés; los otros 8 idiomas usan el inglés hasta traducirlos.
- **Pendiente:** jugar las partidas de la competición desde la pantalla (iniciar partida con `competitionId` y enviar
  `result` con el `attemptId` verificado); `competition_finished`; plazo de retención y tarea programada.
- **Validación:** i18n, lint, determinismo, `test:repository` (HTTP de grupos), build, humo, solapes.
