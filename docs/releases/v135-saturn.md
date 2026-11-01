# v135-saturn — «Proponer un juego» y bandeja del propietario (1-nov-2026)

Base: v134-saturn (e5457b6). Petición del propietario: «añade una opción que permita a la gente iniciar un proceso donde incluya su juego». Destino elegido: una bandeja dentro de la app, solo para el propietario.

## Para los estudios
- **Entrada:** al final de la pestaña Juegos, «¿Tienes un juego?» → PROPONER UN JUEGO.
- **La hoja** es un diálogo opaco: el formulario completo carga solo al abrirla.
- **Condiciones** de la especificación de la plataforma, en resumen:
  - núcleo determinista en WebAssembly y una interfaz en marco aislado;
  - revisión automática en máquina virtual y aprobación final;
  - el juego no accede a datos de jugadores;
  - el estudio conserva sus derechos y recibe el 50 % de la comisión neta;
  - responsabilidad del estudio sobre su contenido.
- **Campos:** estudio, correo de contacto, juego, categoría (Casino, Bar, Míticos, Dinámicos o Alternativos; Populares y Nuevos no se eligen, se ganan), descripción breve, y enlace https al paquete o a una demo.
- **Aceptaciones:**
  - las condiciones;
  - el uso de los datos solo para revisar y responder, con consentimiento versionado `studio-proposal-2026-11-01`.
- **Validación:** `lib/studioProposal.ts`, la misma en el formulario y en el servidor. Recorta, quita caracteres de control y solo admite enlaces https.
- **Borrador:** se queda en el dispositivo hasta enviarlo.
- **Mensajes de estado:** campo por revisar, recepción aún no abierta, error o «propuesta recibida (referencia …)».

## Servidor y bandeja
- **`/api/studio/proposals`:**
  - **POST:** mismo origen y como máximo 4 KB. Valida y guarda en PostgreSQL. Sin `DATABASE_URL` responde 503 `PROPOSALS_NOT_OPEN` y no guarda ni registra nada.
  - **GET:** la bandeja; solo para el propietario, y para cualquier otro responde 404.
  - **DELETE:** el propietario borra una propuesta respondida.
- **Propietario:** la cuenta con sesión iniciada indicada en `STUDIO_OWNER_ACCOUNTS`. `/api/auth/session` muestra el valor `account` a su titular para poder copiarlo (pasos en `docs/AUTH_PROVIDERS.md`).
- **Migración `db/migrations/004-studio-proposals.sql`:** tabla `studio_game_proposals` con límites y la categoría restringida. Se aplica a mano, como las demás.
- **Bandeja en la app:** el propietario ve la pestaña «Bandeja (n)» con cada propuesta (juego, categoría, estudio, correo, fecha, descripción y enlace) y el botón Borrar.

## Privacidad
- La política de privacidad añade «Propuestas de juegos»: qué datos se guardan, para qué, con qué base legal, quién los lee y cuándo se borran.

## Validación
- `tsc`, determinismo completo con `verify-studio-proposal`, i18n (10 × 728), `git diff --check` y build.
- Prueba básica de los 14 juegos y `qa-overlap`.
- Pruebas de la API: 404 para quien no es propietario, 400 con el campo, 503 sin base de datos y 403 con otro origen.
- Recorrido en el navegador: validación, envío con aviso de recepción no abierta y borrador conservado al cerrar y volver a abrir.
