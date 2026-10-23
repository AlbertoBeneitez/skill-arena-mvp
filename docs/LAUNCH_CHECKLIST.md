# GALACTIC GAMES — lista de lanzamiento público

Estado a 23-oct-2026 sobre `v100-mobile`. Alcance recomendado para un primer
lanzamiento rápido: **entrenamiento y partidas con saldo ficticio, sin cuentas,
sin dinero real y sin base de datos**. Todo lo marcado «Hecho» está verificado en
el repositorio; lo marcado «Propietario» necesita una decisión o un acceso que
solo tú tienes.

## 1. Hecho en código

| Área | Estado |
| --- | --- |
| Juegos | 23 activos; 21 con verificación por replay en servidor. Birds V7, Roulette V4, Mine Grid variado, avatares nuevos y el pulido de Alien/Sky/River integrados. |
| Arranque robusto | La app abre aunque el navegador bloquee `localStorage` (Safari privado, bloqueo de cookies, webviews). Probado y vigilado en CI. |
| Dependencias | Next.js actualizado a 16.4.2: `pnpm audit --prod` sin vulnerabilidades (había 2 críticas y 1 alta en 16.3.8). |
| Seguridad | Firma de tickets fail-closed, cabeceras (HSTS, X-Frame, nosniff, Referrer, Permissions-Policy), **CSP completa aplicada** (0 violaciones en los 23 juegos), mismo origen + cuerpos acotados en las APIs, CodeQL, Dependabot. |
| Instalable / compartir | Manifest con iconos PNG 192/512/maskable, `apple-touch-icon`, imagen Open Graph 1200×630, `robots.txt`, `sitemap.xml`, metadatos sociales. |
| UX de entrada | El catálogo se abre arriba tras el alta (antes quedaba desplazado) y al volver de un juego se conserva la posición. |
| Errores | Páginas 404, de error y de error global en español, con botón de reintento. |
| Accesibilidad | Auditoría axe (WCAG 2 A/AA + buenas prácticas) sin fallos en bienvenida, identidad, catálogo, grupo, avatar y juego; h1 en portada. |
| Rendimiento | Bienvenida interactiva en ~2 s con CPU ×4 más lenta y red 4G lenta; ~250 KB transferidos. Miniaturas de avatar: pantalla de identidad de 1,2 MB a 0,2 MB. |
| QA automática | `scripts/qa-smoke-all.cjs` (23 juegos en móvil + almacenamiento bloqueado + persistencia) en el trabajo `mobile-smoke` de la CI, además de la suite de determinismo y las pruebas de repositorio. |

## 2. Propietario — bloquea o condiciona el lanzamiento

Ordenado por urgencia.

1. **Variables en Vercel** (Project → Settings → Environment Variables, Production y Preview):
   `MATCH_SIGNING_SECRET` (≥ 32 caracteres aleatorios, `openssl rand -hex 32`) y
   `ALLOW_LEGACY_STATELESS_TRAINING=1`. Sin la primera los endpoints responden 503.
   Opcional: `NEXT_PUBLIC_SITE_URL` cuando exista dominio propio.
2. **Instalar la app de Claude en GitHub** (o reconectar) para poder abrir PR y que CI/Vercel lo comprueben en el flujo normal.
3. **Textos legales**: Términos, Privacidad y Cookies de la pantalla «Información de la aplicación» son provisionales y lo dicen. Antes de abrir al público debe revisarlos un profesional (responsable del tratamiento, contacto, conservación, derechos RGPD, aviso de saldo ficticio).
4. **Promoción de ramas**: `v100-mobile` → `mobile-test` (solo fast-forward) → `main`. No lo he tocado; indícame cuándo.
5. **Cortafuegos de Vercel**: activar una regla de límite de peticiones para `/api/*` (por ejemplo 60/min por IP). Es la defensa correcta en serverless; en código solo hay validación y límites de tamaño.
6. **Observabilidad**: activar Vercel Observability/Web Analytics o elegir un proveedor de errores. Hoy un fallo en producción solo se vería en los logs de Vercel.
7. **Dominio** y, si se quiere, correo de contacto visible.
8. **Prueba en móviles físicos** (un iPhone y un Android de gama media): 10 minutos con la lista de la sección 4.

## 3. Propietario — decisiones de producto (no bloquean el lanzamiento suave)

- **Clasificación por edad y avisos**: Galactic Slot y Galactic Roulette simulan juegos de azar con saldo ficticio. Las tiendas y la normativa tratan el «juego simulado» como contenido para mayores; decide si mostrar un aviso +18 / confirmación de edad antes de esos dos juegos y qué clasificación declarar.
- **Base de datos** (Neon/Supabase/Vercel Postgres…): habilita partidas duraderas, ranking real y Mine Grid competitivo. Sin ella el ranking muestra datos de ejemplo claramente etiquetados.
- **Cuentas** (Google/Apple hoy «próximamente»): necesarias antes de cualquier competición con premio.
- **Dinero real**: fuera de alcance hasta tener identidad, liquidación y cumplimiento (regulación del juego en España).
- **Solitaire Sprint**: política de repartos con solución garantizada.
- **Dificultad de Birds V7**: ajustar tras jugar (tiros, dureza, potencia del TNT, viento).
- Archivar ramas antiguas (`v2-mobile`…`v99-mobile`).

## 4. Prueba manual en dispositivo (10 minutos)

1. Abrir la URL, instalar en pantalla de inicio, abrir desde el icono.
2. Elegir avatar, nombre y entrar; recargar y comprobar que se mantiene.
3. Jugar una partida de: Dardos, Birds, Roulette, Tower Drop, Alien Dash.
4. Girar el móvil en cada una; volver atrás a mitad de partida; bloquear y desbloquear la pantalla.
5. Activar y desactivar sonido; modo ahorro de batería.
6. Navegador privado: debe abrir y jugar.

## 5. Cómo volver atrás

Vercel → Deployments → el último despliegue Ready anterior → «Promote to Production». Los resultados de partidas no dependen del despliegue porque cada versión de juego es inmutable.
