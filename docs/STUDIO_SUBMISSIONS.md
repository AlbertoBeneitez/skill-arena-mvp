# Envío y admisión de juegos de estudios externos

Estado: v147 (5-nov-2026); envío y admisión desde v142, publicación en entrenamiento desde v147. El formato está en `studio-kit/README.md`, que también va en el kit descargable `public/studio/galactic-games-kit.zip`.

## El proceso
1. **El estudio descarga el kit** desde «ENVIAR JUEGO». El kit trae el formato y un juego de ejemplo completo («Pulse»), que ya es un paquete válido.
2. **Envía un único .zip** (máx. 4 MB) con nombre, correo y las dos aceptaciones:
   - las condiciones (`studio-terms-2026-11-03`);
   - la privacidad (`studio-proposal-2026-11-03`).
3. **Comprobación automática al subirlo**, antes de guardar nada (`lib/studio/package.ts`, `lib/server/studioPackageCheck.ts`):
   - el zip: tamaño, número de archivos, tamaño descomprimido y rutas seguras;
   - el manifiesto `galactic.json`;
   - `game.html` en un solo archivo, sin recursos externos;
   - la portada: 16:11 y al menos 800 × 550;
   - `core.wasm`: compila, no importa nada y exporta el ABI;
   - tres partidas con entradas aleatorias, cada una dos veces (en un núcleo nuevo y en uno reiniciado): mismo resultado, terminan antes de `maxTicks` y la puntuación es un entero ≥ 0;
   - la semilla cambia la partida;
   - cada repetición dura menos de 1,5 s, con un límite total de 6 s en un hilo aparte.
4. **El estudio recibe el informe al momento.** Si algo falla, no se guarda nada: corrige y reenvía.
5. **Si pasa**, se guarda en PostgreSQL con el paquete, su SHA-256, el manifiesto, el informe y las versiones aceptadas.
6. **El propietario revisa en la bandeja:**
   - **Probar:** el juego se ejecuta en un marco aislado. Al terminar, la app repite tus entradas en el `core.wasm` del paquete y comprueba que la puntuación de la interfaz y la del núcleo coinciden. Es la misma verificación que tendría una partida publicada.
   - **Descargar:** baja el paquete original.
   - **Aprobar y publicar** o **Rechazar:** queda registrado. Desde v147, aprobar publica el juego en el catálogo en entrenamiento; rechazarlo lo retira.
   - **Borrar:** elimina el envío.

## Por qué así
- **Núcleo WebAssembly sin importaciones.** No puede leer el reloj, ni azar, ni red, ni disco: solo calcular. El determinismo viene dado por el formato y el servidor puede repetir cualquier partida. Sirve cualquier lenguaje (AssemblyScript, Rust, C, Zig).
- **Interfaz en un solo HTML, en un marco `sandbox="allow-scripts"`.** Tiene origen opaco y política `connect-src 'none'`. Comprobado con un paquete hostil: no accede al documento padre, ni a las cookies, ni al almacenamiento, ni a `fetch`, ni a imágenes externas.
- **La interfaz informa y el núcleo decide.** Igual que los juegos propios: semilla, entradas ordenadas, núcleo puro, puntuación autoritativa y repetición.

## Publicación en el catálogo (fase 2, v147)
- **Qué ve el jugador:** cada juego aprobado aparece en su fila (la categoría de su `galactic.json`) y en «Nuevos» durante 30 días, con su portada y una placa «Estudio».
- **Cómo se juega:** a pantalla completa, con la cabecera de los juegos («ENTRENAMIENTO · De {estudio}»):
  - el paquete se descarga y se comprueba contra el SHA-256 guardado al recibirlo, y no se ejecuta si no coincide;
  - la interfaz corre en el mismo marco aislado que la prueba del propietario (`components/StudioGameFrame.tsx`, compartido);
  - al terminar, el resultado es la repetición de las entradas en el `core.wasm` del paquete, y se indica si la interfaz coincide.
- **Alcance:** solo entrenamiento. No toca el saldo, el ranking ni los registros de partidas, y no pasa por el verificador del servidor.
- **API pública** `GET /api/studio/games`:
  - la lista de aprobados, sin correo de contacto ni informe;
  - `?id=&file=cover` y `?id=&file=package`, solo para juegos aprobados;
  - caché de 30 s para la lista y de 5 min para los archivos.
- **Retirar un juego:** «Rechazar» en la bandeja. Deja de listarse y de servirse en cuanto caduca la caché.

## Pendiente
- **Competición con juegos de estudios:**
  - el adaptador de verificación en `lib/server/gameVerifiers.ts`, que repita el núcleo en el servidor en un hilo con límite de tiempo;
  - semillas emitidas por el servidor;
  - la versión del núcleo fijada por su hash.
- **Paquetes de más de 4 MB:** subida directa a un almacén de archivos (Vercel Blob). Requiere configurar el almacén y su variable de entorno.
- **Acuerdo completo de publicación**, revisado por un abogado. Las condiciones del formulario son el resumen que acepta el estudio al enviar.

## Para activarlo en producción
- **Base de datos:** `DATABASE_URL` con las migraciones `004-studio-proposals.sql` y `005-studio-packages.sql` aplicadas.
- **Bandeja del propietario:** `STUDIO_OWNER_ACCOUNTS` (pasos en `docs/AUTH_PROVIDERS.md`).
- **Sin base de datos**, el envío sigue comprobando el paquete y devolviendo el informe, pero responde que la recepción aún no está abierta.
