# v228-saturn · Logo nuevo, BotID, retención de 90 días y abandono en grupos (app 2.28)

Base: v227-saturn. Sin cambios en ningún juego ni en su puntuación. Decisiones del propietario del 21-nov-2026.

- **Logo aprobado por el propietario (21-nov-2026):** el átomo pixelado de la bienvenida, con la órbita en los cuatro
  colores de los saltos. Sustituye a la G con planeta en el icono de la app (Android, iPhone, Android adaptativo), la
  pestaña del navegador y la imagen que aparece al compartir un enlace.
- **Icono de avisos** listo (`public/notify-badge-96.png`, silueta blanca) para cuando haya avisos al móvil.
- Los iconos llevan `?v=228` para que los móviles los recarguen. Un acceso directo ya instalado puede tardar en
  cambiar; si no cambia, se quita y se vuelve a añadir a la pantalla de inicio.
- Fuentes y cómo regenerarlos: [design/logo/README.md](../design/logo/README.md). La estética retro sigue en propuesta.

- **Vercel BotID Basic (gratis).** Comprobación invisible del navegador antes de empezar una partida, crear la cuenta
  o actuar en un grupo (`lib/botRoutes.ts`, `instrumentation-client.ts`, `lib/server/botProtection.ts`). Los
  programas sin navegador real reciben 403 `BOT_DETECTED`. No se aplica a los envíos de partida ni a los latidos: un
  fallo a mitad de partida nunca debe costarle la partida a un jugador. Si el comprobador falla, se deja pasar. Fuera
  de Vercel (simulador, local) no actúa. Deep Analysis (de pago) no se usa. Licencia MIT en `THIRD_PARTY_NOTICES.md`.
- **Retención de 90 días (migración 018).** Pasados 90 días, una partida terminada conserva el resultado, la
  puntuación, la huella y el manifiesto, pero sus acciones se sustituyen por un resto mínimo
  (`lib/server/attemptRetention.ts`). Rankings, recuentos, grupos y contabilidad no cambian. Corre en tandas de 500, como
  mucho una vez por hora, al empezar partidas (sin tarea programada ni coste).
- **Grupos: abandonar es perder con 0 puntos.** Una primera partida abandonada o rechazada cuenta como 0 puntos (en
  los juegos donde gana el número más bajo, el peor tiempo posible). No da derecho a repetir.
- **Política de privacidad** (10 idiomas, actualizada el 21-nov-2026): menciona BotID y el borrado de las acciones a
  los 90 días.
