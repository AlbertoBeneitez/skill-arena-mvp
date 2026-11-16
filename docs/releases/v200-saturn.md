# v200-saturn — Roulette de vuelta, sin dinero (16-nov-2026)

Base: v199-saturn. App 2.00.

- **Roulette** vuelve al catálogo (al final, fila Alternativos y Nuevos) como juego que nunca se juega por dinero: botón
  negro, etiqueta «Sin dinero», y siempre se juega sin entrada aunque el jugador tenga una seleccionada (antes el toque
  no hacía nada). El servidor ya rechazaba entrada en juegos de azar; los grupos con entrada la siguen excluyendo.
- **Rivales inventados:** cada uno lleva un retrato que nadie del grupo tiene (16 retratos).
- **Sin conexión:** el catálogo de Juegos no cambia (decisión del propietario).
- **Validación:** lint, determinismo, `test:repository`, build, captura del catálogo (sin abrir juegos), `git diff --check`.
