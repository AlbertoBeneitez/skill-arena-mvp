# v106-saturn — identidad sin scroll, grupos 70/30 · 100 %, ruleta con fichas reales y nueva piel visual (24-oct-2026)

Base: v105-saturn (8686110).

## Inicio de sesión
- Pantalla de identidad sin "Elige tu identidad", sin botón "ELEGIR OTRO AVATAR" y sin etiqueta "Nombre de jugador"/"Nombre de avatar" (campo con texto de ayuda "Tu nombre").
- Los avatares se muestran siempre en una tira horizontal; toda la pantalla cabe en el alto del móvil sin desplazamiento vertical (comprobado a 360×640, 375×667 y 390×844).

## Capa de experiencia
- Retirados niveles/XP, decisión de RIESGO, misiones ligadas a riesgo y cofre de cartas (v105). La progresión vive dentro de cada juego. `lib/progression.ts` y su test se conservan sin uso en la interfaz.

## Grupos
- Sin paso "Ponle nombre a tu grupo" ni sugerencias (Los de siempre, Familia…): el grupo se crea como "Grupo de <jugador>".
- Reparto del bote: solo **70 % · 30 %** o **100 % ganador** (se retira 60/30/10 para nuevas competiciones; el tipo se mantiene por compatibilidad).

## Galactic Roulette (solo presentación; núcleo 8.0.0 sin cambios)
- Cada número de la rueda tiene dos partes: banda numerada exterior y su casilla cuadrada interior, separadas por trastes metálicos; la bola reposa en la casilla (radio 93,5) y la casilla ganadora se ilumina.
- Fichas 1/5/25 con aspecto de ficha de casino (canto con franjas, anillo interior, valor central): **1 naranja, 5 roja, 25 violeta**; las fichas sobre el tapete usan el mismo diseño y color.
- `scripts/verify-roulette-presentation.cjs` actualizado al nuevo radio de reposo.

## Pinball (solo presentación)
- Retirados los marcadores de posición de la mesa: triángulos de las calles exteriores (ya no existen pérdidas laterales desde 3.0.0) y recuadros discontinuos de rampa/órbita.

## Interfaz
- Piel "premium" v106: tipografía Unbounded autoalojada (OFL, ver THIRD_PARTY_NOTICES), paneles de cristal oscuro, cabecera translúcida, barra inferior flotante, tarjetas de catálogo con viñeta, lobby de grupos en superficie oscura (antes crema), panel de resultado coherente, anillo orbital animado en el retrato del avatar (respeta `prefers-reduced-motion`).
