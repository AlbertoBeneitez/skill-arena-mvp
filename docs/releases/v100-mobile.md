# v100-mobile — cimientos de seguridad y mejoras de juego

Base: v99-mobile (dc7a5dc). Rama local `v100-mobile`; sin publicar hasta vincular GitHub.

## Cimientos
- Firma de tickets a prueba de fallos: en producción `MATCH_SIGNING_SECRET` (≥ 32 caracteres) es obligatoria; sin ella los endpoints responden 503 `SIGNING_KEY_NOT_CONFIGURED` en lugar de usar la clave pública de pruebas.
- Entrenamiento sin base de datos solo con `ALLOW_LEGACY_STATELESS_TRAINING=1`; sin esa variable ni PostgreSQL responde 503 `LEGACY_TRAINING_DISABLED`. Prueba `verify-production-gates`.
- Cabeceras HTTP de seguridad (CSP obligatoria mínima + CSP completa en modo informe, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- CI: se ejecuta en pull requests y ramas estables, acciones fijadas por SHA, concurrencia, CodeQL y Dependabot.
- README, `.env.example` (solo nombres reales) y `.gitignore` (`.env*`, `.det-test`).

## Juegos
- **Galactic Roulette 4.0.0** (V3 conservada): muro exterior con rebote, restitución más viva, rodadura con menos fricción, la rueda arrastra la bola y los tabiques la llevan a una casilla (sin «pegado»). Ventana de tirada de 960 ticks. Interfaz: tapete siempre visible bajo la rueda, un toque coloca la ficha, una apuesta por tirada; la versión móvil se mantiene.
- **Galactic Birds 6.0.0** (V1–V5 conservadas, protocolo de entrada 2): elección de pájaro con acciones `BIRD_*` repetibles (reserva 12 exploradores, 10 rápidos, 8 pesados); seis estructuras nuevas más altas con materiales mezclados, cerdos tapados y cerdos sellados; resistencia mayor de los materiales; estabilidad por apoyo (si el centro de masas queda fuera de la base, la pieza resbala y cae); goma del tirachinas más corta y siempre dentro del lienzo.
- **Dardos**: diana al 115 % (95 % del ancho); la entrada usa la inversa, la puntuación no cambia.
- **Tower Drop**: garra articulada que se cierra sobre el bloque y se abre al soltar; la torre baja suavemente al añadir pisos. Solo presentación; núcleo V3 intacto.
- **Mine Grid** (entrenamiento): cada intento reparte uno de los tableros validados sin adivinar y muestra su código y dificultad. Mine privado con PostgreSQL sigue siendo la vía de competición.

## Validación
Ver el apartado de validación del resumen final. No promover a `main` ni a `mobile-test` sin confirmación del propietario.

## Pendiente
- Vincular GitHub para publicar la rama; configurar `MATCH_SIGNING_SECRET` y `ALLOW_LEGACY_STATELESS_TRAINING=1` en Vercel (Production y Preview) antes de desplegar.
- Base de datos real, identidad (Google/Apple), revisión jurídica y tableros solucionables de Solitaire.

## Actualización 23-oct-2026

- **Avatares:** los 16 retratos aportados por Alberto (WebP 512 px, ~1,2 MB) son ahora los avatares iniciales (`public/avatars/portrait-01..16.webp`). El ranking acepta claves `portrait-NN`; los SVG `avatar-1..8` se conservan para perfiles ya guardados y rivales.
- **Mine Grid:** el chip de tablero/dificultad ya no se recorta por la izquierda y la barra inferior muestra la pista «Toca la casilla dorada para empezar».
- **QA:** barrido móvil (390 px) de 22 juegos: sin errores de consola ni desbordamiento horizontal; todos los tests de presentación pasan tras fusionar el commit remoto de Tower Drop.
- Rama `v100-mobile` publicada en GitHub.

## Birds V7 (23-oct-2026)

Versión nueva (V1–V6 intactas): niveles más complejos.
- 19 cerdos en 6 niveles (3,3,3,3,3,4) y 12–13 piezas por estructura.
- **Cajas de TNT** (14 PV): al destruirse explotan (radio 40 px), dañan y empujan piezas, matan cerdos a menos de 28 px y encadenan otras cajas.
- **Viento por nivel** (0, 0, ←2, →2, ←3, →3) que desvía a todos los pájaros; indicador «VIENTO» en pantalla.
- Materiales más resistentes (vidrio 24, cerámica 100, aleación 280) y 24 tiros (10 exploradores, 9 rápidos, 5 pesados).
- Balance: un solver voraz que prueba 1.209 tiros por disparo necesita 16 de los 24 tiros; un jugador humano tendrá poco margen.
- Fixture dorada `scripts/fixtures/birds-v7.json`, test `verify-birds-v7.ts` (TNT, viento, estabilidad en 24 semillas), adaptador de servidor registrado. Suite de determinismo completa sin errores.
