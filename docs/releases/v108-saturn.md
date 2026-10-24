# v108-saturn — 10 idiomas, ajustes y documentos legales (24-oct-2026)

Base: v107-saturn (a7113f8). Solo presentación: ningún núcleo, versión competitiva, puntuación ni regla cambia.

## Idiomas
- Español (base), inglés, chino simplificado, hindi, árabe, francés, bengalí, portugués (Brasil), ruso y urdu: las 10 lenguas más habladas (Ethnologue), con todos los textos de la app, de los HUD de los juegos y de los documentos.
- Detección automática por el idioma del navegador; selector en la pantalla de bienvenida y en Ajustes, con los nombres en su propia lengua. Se guarda en `ga-locale` (no lo borra el reinicio por visita).
- Árabe y urdu se muestran de derecha a izquierda; las pantallas de juego se mantienen de izquierda a derecha. Números y moneda con `Intl` (cifras latinas). Diccionarios no españoles cargados bajo demanda.
- Los nombres de marca de los juegos (Galactic Roulette, Tower Drop…) se mantienen; los genéricos (Dardos, Billar, Memoria) se traducen.
- Nombre de jugador: ahora admite letras de cualquier alfabeto (2–18 letras, números, _ o espacio).
- `scripts/verify-i18n.cjs` (dentro de `test:repository` y como `pnpm test:i18n`) comprueba que cada idioma tenga las mismas claves y los mismos `{placeholders}` que el español.

## Ajustes (engranaje en la cabecera y desde Avatar)
- Idioma; sonido, música y vibración; reducir animaciones; recordatorio de tiempo de juego (desactivado/15/30/60 min) con aviso de pausa.
- Cuenta: nombre y avatar, reiniciar estadísticas, cerrar sesión local y borrar todos los datos locales (con confirmación).
- Información y legal: Términos y condiciones, Privacidad, Cookies y almacenamiento, Reglas de competición, Juego responsable, Ayuda/FAQ, Contacto y soporte, Licencias de terceros y Acerca de; versión de la app.
- Avatar muestra partidas, victorias, % de victorias y racha.
- Bienvenida: aviso "Al continuar aceptas los Términos y la Política de privacidad" con enlaces.
- Páginas 404 y de error traducidas.
- Cabecera: el logotipo se ajusta al espacio disponible y el saldo apila etiqueta e importe, sin recortes en ningún idioma a 360 px.

## Pendiente del propietario
- Los textos legales son un borrador que describe el funcionamiento actual (saldo ficticio); deben revisarse antes de cualquier lanzamiento comercial, con los datos del titular y un email de soporte (`SUPPORT_EMAIL` en `lib/productIdentity.ts`, ahora vacío).
- Traducciones automáticas: conviene una revisión por hablantes nativos.

## Tests
- Typecheck, i18n (10 × 524 claves), determinismo, build y smoke móvil de los 12 juegos: OK. Capturas revisadas en es, zh, hi, ar, bn y ur (sin desbordamiento horizontal ni errores de consola).
