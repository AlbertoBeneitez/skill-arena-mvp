# Logo de Galactic Games (aprobado por el propietario el 21-nov-2026, v228)

El átomo pixelado de la bienvenida: núcleo dorado y turquesa, una órbita con los cuatro colores de los saltos
(violeta, azul, verde, rojo) y el electrón blanco. Propuesta original: `logo-propuesta.png`.

| Uso | Archivo en `public/` |
|---|---|
| Icono de la app (Android, escritorio) | `icon-192.png`, `icon-512.png` (esquinas redondeadas) |
| Android adaptativo | `icon-maskable-512.png` (fondo completo, dibujo al 80 %) |
| iPhone | `apple-touch-icon.png` (fondo completo; iOS redondea) |
| Pestaña del navegador (ordenador) | `favicon-48.png` (más `icon-192.png`) |
| Imagen al compartir un enlace | `og-image.png` (icono + GALACTIC / GAMES) |
| Barra de estado de los avisos (cuando haya avisos al móvil) | `notify-badge-96.png` (silueta blanca) |

En el ordenador no se escribe nada junto al marco del móvil (decisión del propietario en v213), así que la marca de
ordenador vive en la pestaña y en la imagen al compartir.

Regenerar: `python3 docs/design/logo/gen.py` (escribe los SVG en `/tmp/logo/`), copiar `icon.svg`, `square.svg`,
`mono.svg` y `maskable.svg` ahí si no están, y `NODE_PATH=<playwright>/node_modules node docs/design/logo/raster.cjs`.
Al cambiar los PNG, subir el `?v=` en `app/manifest.ts` y `app/layout.tsx` para que los móviles los recarguen.

La estética retro (`retro-propuesta.png`) fue **rechazada** por el propietario el 21-nov-2026; se guarda solo como historial.
