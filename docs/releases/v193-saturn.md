# v193-saturn — Revisión de la base de datos y regla de pagos (15-nov-2026)

Base: v192-saturn. Solo documentación; la app no cambia (sigue en 1.92).

- **Pagos:** el propietario pide desconectar Vercel de momento y que se le avise de cualquier pago. Lo que se cobra
  es la suscripción Pro del equipo «Skill Arena» (20 $ al mes más IVA, unos 0,67 $ al día); el uso real es de menos
  de un céntimo al día. Cancelarla es un cambio de facturación: lo hace el propietario en Vercel › Settings › Billing
  › Downgrade Plan. Nueva regla en `CLAUDE.md`: nada con coste sin permiso, importe y periodicidad por delante, y
  revisión de cargos al empezar cada sesión.
- **Base de datos:** `docs/BASE_DE_DATOS.md` con el mapa de las 9 tablas, lo que está bien, 12 problemas por orden
  de importancia, el modelo de destino y un plan en 4 fases. El más urgente: la copia diaria nunca se ha ejecutado
  (las tareas programadas solo corren desde `main`).
- **Validación:** `git diff --check`.
