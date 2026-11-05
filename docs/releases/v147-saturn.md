# v147-saturn — Juegos de estudios publicados en el catálogo (entrenamiento) (5-nov-2026)

Base: v146-saturn (fd955d1). Fase 2 del envío de juegos (`docs/STUDIO_SUBMISSIONS.md`).

- **Aprobar publica:** en la bandeja, «Aprobar y publicar» pone el juego en el catálogo; el estado pasa a «Publicado (entrenamiento)». «Rechazar» lo retira.
- **Catálogo:** los juegos publicados aparecen en la fila de su categoría y en «Nuevos» durante 30 días, con su portada y una placa «Estudio». Las tarjetas tienen el mismo acabado que las demás.
- **Jugar un juego de estudio** (`components/ExternalGamePlayer.tsx`):
  - a pantalla completa, con la cabecera de los juegos;
  - el paquete se comprueba contra el SHA-256 guardado al recibirlo antes de ejecutarlo;
  - la interfaz corre aislada (sin red ni acceso a la app) y la puntuación es la que da el núcleo del paquete al repetir las entradas, con el aviso de si la interfaz coincidía;
  - el alcance se indica en pantalla: entrenamiento, sin cambios en el saldo ni en el ranking.
- **Código compartido:** `components/StudioGameFrame.tsx` (descarga, marco aislado, protocolo `gg:*` y repetición del núcleo) lo usan la prueba del propietario y el jugador.
- **API pública** `GET /api/studio/games`: la lista de aprobados (sin correo ni informe), y la portada y el paquete de cada uno, solo si está aprobado.
- **Textos nuevos en los 10 idiomas** (775 claves).
- **Sin PostgreSQL** la lista está vacía y el catálogo no cambia.

## Validación
- `verify-studio-published` (validación de la lista, URL de archivos y la regla de 30 días de «Nuevos») y el resto del determinismo.
- Prueba completa con PostgreSQL local:
  - un juego aprobado aparece en «Nuevos» y en «Alternativos», se abre, se juega y su puntuación queda verificada por el núcleo;
  - la prueba del propietario sigue coincidiendo (129 = 129);
  - el paquete de uno no aprobado devuelve 404;
  - al rechazarlo desaparece de la lista y su paquete pasa a 404.
- `tsc`, `pnpm lint`, build, prueba básica de los 14 juegos y `qa-overlap`.
