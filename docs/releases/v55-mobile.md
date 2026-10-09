# v55-mobile · Movimiento de Metro

Parte de v54-mobile. La proyección imponía profundidad mínima .08: durante unos
88 metros al entrar al horizonte, los obstáculos tenían posición/tamaño constantes
aunque avanzaba distance. Se proyectan desde cero sin ese tramo inmóvil; la línea
de colisión sigue a profundidad 1. El core siempre avanzaba y queda inalterado.
No cambian velocidad, generación, scoring, inputs, V1/verificador ni golden.

Regresión específica: cada distancia entrante de 1100 a -100 produce avance
estricto; conserva línea de colisión y recorte fuera del horizonte. Typecheck/lint,
suite determinista/histórica/autoridad privada y build pasan. QA táctil Chromium:
victoria portrait de 60 grupos (score 41120, tick 11144, tres vidas), derrota
landscape HULL_EXHAUSTED (score 0, tick 1478); replay del input real contra
manifest del servidor, submit único, cambio de carril/salto/cancel/blur, reinicio,
rotación, botones ≥44 px y sin overflow ni errores de consola. Captura del segundo
sector inspeccionada; no se cambian targets o seeds en QA.

CI/Vercel se comprueban al publicar la rama. No activa proveedores, usuarios,
dinero ni competición real. Si reaparece otra pausa, investigar el caso distinto;
esta unidad resuelve el tramo inmóvil reproducido en el horizonte. El resto de
solicitudes recientes permanece en PRODUCT_BACKLOG; no se declara completado.
