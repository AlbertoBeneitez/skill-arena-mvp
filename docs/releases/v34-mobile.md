# v34-mobile · Autoridad privada y candidato Mine Grid

Parte de v33-mobile, conserva todos los checkpoints anteriores y los cores históricos.

- Core Mine Grid 1.0.0: cinco sectores progresivos resolubles por deducción, apertura segura, dos escudos y scoring de eficiencia reproducible.
- Autoridad común de comandos: escenarios privados V3, pertenencia, replay común, idempotencia y CAS. Puerto PostgreSQL y migración aditiva explícita; adapters locales aislados.
- UI móvil de Mine con pistas coloreadas, controles de abrir/marcar, feedback y transición entre sectores. Disponible únicamente en QA local opt-in; el catálogo público conserva la versión existente.
- Tests deterministas, typecheck/lint, repositorios en PostgreSQL local y build pasan. QA táctil completa en ambas orientaciones, victoria/derrota/reinicio/cancelación sin errores. Vercel-mode rechaza QA local y no usa memoria.

No se activa producción, auth, ledger ni dinero real. Mine sigue pendiente de integración pública; Billar, Dardos y el resto del pulido de producto continúan en el backlog. Véase `docs/MINE_GRID_PRIVATE_AUTHORITY.md`.
