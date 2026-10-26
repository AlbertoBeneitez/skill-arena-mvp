# v117-saturn — Vuelve la vista de móvil con dos juegos por fila (26-oct-2026)

Base: v116-saturn (8b48484).

- **Vuelve la vista de móvil de v115:** el móvil vuelve a usar su propio ancho (`width=device-width, initial-scale=1`), con dos tarjetas de juego por fila y a tamaño completo. El catálogo en tres columnas vuelve a aparecer solo a partir de 680 px.
- **Motivo:** con la composición del ordenador escalada (v116) las tarjetas se veían demasiado pequeñas en el móvil.
- **Se mantiene el resto de v116:**
  - el acceso solo desde móvil, con QR en el ordenador;
  - la música de concentración;
  - el catálogo sin triángulo;
  - Pinball 7 y Stack Shift 4;
  - la lona blanca de Shot Gallery.
- El smoke compara el lienzo con el ancho real de la página, sea cual sea.
