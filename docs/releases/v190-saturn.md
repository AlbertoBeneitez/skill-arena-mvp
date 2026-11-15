# v190-saturn — Protección de datos al día (15-nov-2026)

Base: v189-saturn. Pedido por el propietario: «revisar, desarrollar y proteger los datos personales mediante la
política de protección de datos legal».

- **Revisión:** la política de la app describía la app anterior a la base de datos y prometía que las propuestas de
  estudios «se borran al responder», cosa que nada hacía.
- **Plazos de borrado reales** (`purgeExpiredProposals` en `lib/server/studioProposals.ts`): propuesta rechazada, 30 días
  tras decidir; sin revisar, 180 días; aceptada, mientras el juego esté en la app (hace falta el contacto para pagar).
  Se aplica antes de cada envío y cada vez que el propietario abre el buzón, sin programador. Probado contra
  PostgreSQL. Consentimiento de estudios nuevo `studio-proposal-2026-11-15`.
- **Política de privacidad de la app** (10 idiomas): límites contra abusos; finalidades nuevas (recuento para estudios,
  bots); conservación de partidas; plazos de las propuestas; sección nueva «Dónde se guardan y quién los trata»
  (Vercel y Neon en Frankfurt, copias cifradas en GitHub 30 días, transferencias a EE. UU. y sus garantías); fecha de
  actualización.
- **Registro de actividades de tratamiento** (`docs/legal/REGISTRO_TRATAMIENTOS.md`, art. 30 RGPD): siete
  tratamientos, encargados, transferencias, medidas de seguridad y pendientes. `docs/legal/BORRADOR_LEGAL.md` al día.
- **Pendiente del propietario y del asesor:** identidad del responsable y correo de privacidad (sin ellos la política
  incumple el art. 13 RGPD; llegan con el dominio), plazo de conservación de las partidas, DPA de Vercel, Neon y
  GitHub, y EIPD antes de KYC.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, `git diff --check`.
