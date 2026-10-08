# v35-mobile · Billar orbital

Parte de v34-mobile. Nuevo Billar VERIFIED, loader lazy y adapter append-only del replay común. Cinco mesas progresivas, siete tiros por mesa, potencia, colisiones, bandas, fricción, embocadas, blanca/recolocación y obstáculos orbitales. Arte original, guía de trayectoria con la misma física y controles táctiles que no tapan la mesa en horizontal.

- Golden: 21730 puntos, tick 5224; mismo estado/replay a 60/120/144 Hz.
- 64 aperturas guiadas superables y ocho partidas completas de cinco mesas.
- Inputs inválidos/orden/límites, forecast inmutable, colisiones/bandas/blanca/timeout/doble tiro; históricos intactos.
- QA Chromium táctil: victoria vertical (14 tiros, 21830 puntos), victoria horizontal (14 tiros, 21830 puntos), derrota por agotar siete tiros, cancelación, verificación única y reinicio con nuevo ticket. Cero errores de página.
- Typecheck/lint, determinismo, repositorios PostgreSQL local y build pasan.

Competición real, identidad, dinero y emparejamiento durable permanecen desactivados. QA humana en dispositivos físicos recomendable. Pendientes Dardos, integración pública de Mine Grid, Shot Gallery, evolución Alien Dash y el resto del pulido auditado. Véase docs/BILLIARDS_V1.md.
