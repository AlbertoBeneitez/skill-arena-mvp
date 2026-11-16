# v194-saturn — Círculo de partida y buscador de grupos (16-nov-2026)

Base: v193-saturn. App 1.94 (solo interfaz).

- **Catálogo:** la estrella de los juegos por dinero se sustituye por un círculo discreto arriba a la izquierda de cada
  tarjeta: verde (con pulso suave) si hay una partida esperando, blanco si no la hay. Etiqueta accesible nueva
  `catalog.noRivalWaiting`.
- **Grupos:** botón X a la derecha de «Buscar juego» (se desactiva si el campo está vacío) y fila de categorías
  (Todos, Bar, Míticos, Dinámicos, Alternativos) encima del buscador.
- **Arreglo:** el campo de búsqueda desbordaba el borde derecho en pantallas estrechas (390 y 320 px); ahora cabe.
- **Validación:** i18n (10 idiomas × 942 claves), lint, build, humo (13 juegos), solapes y capturas a 320 y 390 px.
