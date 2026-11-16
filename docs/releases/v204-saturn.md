# v204-saturn — Online igual que Offline (16-nov-2026)

Base: v203-saturn. App 2.04.

- `components/ServerGroups.tsx` ya no tiene diseño propio: monta la misma pantalla de grupo (`GroupHub`) con datos de
  `/api/groups` (grupo actual con sus miembros, competición en curso con su clasificación). Sin foto de grupo online
  (la foto solo vive en el dispositivo).
- `GroupHub` admite paneles extra (`top`, `bottom`) con sus mismas clases: competición abierta (Entrar, Empezar,
  Cancelar), retar a otro grupo, retos abiertos y ranking de grupos.
- Servidor: `GET /api/groups` devuelve `current` (grupo y miembros) y el estado de cada competición; acción `rename`
  (solo el dueño).
- Probado con servidor local, base de datos y dos cuentas firmadas: crear grupo, unirse con el código, crear
  competición (entrada 5 ₡, saldo 25 → 20). Sin partidas jugadas.
- Validación: i18n, lint, determinismo, `test:repository`, build, `git diff --check`.
