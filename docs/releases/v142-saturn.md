# v142-saturn — Envío de juegos por archivo y admisión automática (3-nov-2026)

Base: v141-saturn (a4c83b6). Ningún núcleo de juego propio cambia. Proceso completo: `docs/STUDIO_SUBMISSIONS.md`.

## Para el estudio
- **«ENVIAR JUEGO»** pide:
  - estudio o nombre y correo;
  - el archivo .zip (máx. 4 MB);
  - dos aceptaciones: las condiciones (desplegables) y la privacidad.
- **Kit descargable** `public/studio/galactic-games-kit.zip`, generado con `scripts/build-studio-kit.py`:
  - formato completo en `studio-kit/README.md`;
  - un juego de ejemplo, «Pulse», con su núcleo en AssemblyScript.
  - El kit es en sí un paquete válido.
- **Paquete:**
  - `galactic.json`: id, nombre, versión, categoría, descripción, acciones, ticks por segundo, duración máxima y material de terceros;
  - `game.html`, en un solo archivo;
  - `core.wasm`: ABI 1 (`gg_init`, `gg_input`, `gg_step`, `gg_status`, `gg_score`, `gg_hash`), sin importaciones;
  - portada 16:11.
- **Informe al momento.** Al subir el paquete se ejecutan ocho comprobaciones y se ve cada una con ✓ o ✕ y el motivo. Si alguna falla, no se guarda nada.

## Para el propietario
- **Bandeja:** cada envío muestra juego, categoría, versión, tamaño, estudio, correo, fecha, descripción, informe, material de terceros y estado.
- **Probar:**
  - el `game.html` del paquete se ejecuta en un marco `sandbox="allow-scripts"` con política sin red;
  - la app inicia la partida con una semilla nueva y registra cada entrada;
  - al terminar, repite las entradas en el `core.wasm` del paquete e indica si la puntuación de la interfaz y la del núcleo coinciden.
  - Comprobado con un paquete hostil: no accede al documento padre, ni a las cookies, ni al almacenamiento, ni a la red, ni a imágenes externas.
- **Descargar** (paquete original), **Aprobar**, **Rechazar** y **Borrar**.

## Servidor
- **`POST /api/studio/proposals`:** recibe el formulario con el archivo. Valida los campos, comprueba el paquete y devuelve el informe:
  - 201 si se guarda;
  - 422 si no pasa las comprobaciones;
  - 503 si no hay base de datos.
- **`GET ?id=`:** descarga el paquete.
- **`PATCH ?id=&status=`:** cambia el estado de revisión.
- Todo lo del propietario sigue siendo invisible para los demás (404).
- **Comprobación:** `lib/studio/package.ts`, código puro que comparten servidor y navegador, y `lib/server/studioPackageCheck.ts`, un hilo `worker_threads` con 6 s de límite total.
- **Migración `db/migrations/005-studio-packages.sql`:** añade paquete, SHA-256, manifiesto, informe, versión de las condiciones, estado de revisión y fecha. Es aditiva.
- **CSP:** se añade `'wasm-unsafe-eval'`, que permite compilar WebAssembly sin permitir `eval` de texto.
- **Dependencia nueva:** `fflate` 0.8.3 (MIT), para leer los .zip.

## Condiciones y privacidad
- **Condiciones `studio-terms-2026-11-03`**, en 8 puntos y en los 10 idiomas:
  - propiedad del estudio;
  - licencia no exclusiva y revocable;
  - 50 % de la comisión neta, cada mes, sin ingresos mientras el saldo sea ficticio;
  - garantías;
  - contenido y responsabilidad;
  - formato técnico;
  - revisión;
  - retirada con 30 días de aviso.
  - Texto y puntos para el abogado en `docs/legal/CONDICIONES_ESTUDIOS.md`.
- **Privacidad:** el consentimiento pasa a la versión `studio-proposal-2026-11-03` e incluye el archivo del juego.

## Validación
- **Pruebas `verify-studio-package`:**
  - el kit pasa las ocho comprobaciones;
  - fallan manifiesto ausente o con categoría «Populares», HTML con recurso externo, portada ausente, núcleo ausente, inválido o con importaciones;
  - fallan los núcleos que ignoran la semilla, que no se reinician, que no terminan o que se cuelgan (se cortan a los 6 s);
  - se rechazan las rutas que escapan del zip y se acepta un paquete metido en una carpeta;
  - mismas entradas dan el mismo resultado.
- **`verify-studio-proposal`:** campos y versiones de condiciones y consentimiento.
- **API con PostgreSQL local:** 201 con informe, 422, 400 con condiciones antiguas, 404 para quien no es propietario, descarga idéntica byte a byte, PATCH 204 y fila con versiones y SHA.
- **Navegador a 390 × 844:**
  - envío completo como estudio;
  - bandeja y prueba como propietario, donde la interfaz y el núcleo coinciden;
  - sondeo de seguridad del marco.
- `tsc`, determinismo, i18n (10 × 764), build, prueba básica de los 14 juegos y `qa-overlap`.
