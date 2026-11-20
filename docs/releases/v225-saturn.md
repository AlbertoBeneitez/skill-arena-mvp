# v225-saturn · Simulador de bots y revisión de seguridad (sin cambios en la app; sigue 2.24)

- **Simulador de jugadores bot** (`scripts/sim`, [guía](../SIMULADOR_BOTS.md)), autorizado por el propietario como
  excepción a «Claude no juega partidas»: solo en local, 0 €, todos los bots con «Bot» en el nombre. Familias: personas
  (API), partidas completas en tiempo real (novato, medio y experto), competición en grupo, tramposos, cupo global e
  interfaz con navegadores reales (móvil y ordenador). Comandos `pnpm sim`, `pnpm sim:ui` y `pnpm sim:offline`.
- **Revisión estratégica de seguridad y anti-bots** ([REVISION_2026-11](../security/REVISION_2026-11.md)): estado real
  en Vercel, hallazgos con evidencia de los bots y plan por fases. Críticos: bots con anticipación perfecta (la semilla
  llega al móvil) y tope global de 2000 partidas (bloqueado en 38 s). Altos: límites por cookie y no por cuenta, «mejor
  de N» en grupos, reparto a estudios inflable, progreso en el navegador y ninguna capa anti-bot activa.
- Bots de **Mine Grid** (protocolo oculto del servidor, con pruebas de protocolo) y **Solitaire** (navegador real).
  Nuevos hallazgos: A6 (Mine Grid y Solitaire dan el resultado desde el móvil en Vercel) y Solitaire sin final cuando
  te quedas sin jugadas.
- Traspaso para la siguiente sesión: [TRASPASO.md](../TRASPASO.md).
- Sin cambios en el código de la app ni en Vercel.
