# v44-mobile · Sky Hop

Parte de v43-mobile/c148d65 y conserva AGENTS.md como contrato permanente.
Sky Hop pasa de 0.1 INTEGRATED a 1.0 VERIFIED mediante el runtime, lifecycle,
registry, lazy loader y verificador existentes. El componente histórico queda
archivado; ningún core/adaptador histórico se modifica.

Se corrige el score farming por rebotes repetidos. La puntuación pertenece
al core y premia altura nueva/recogibles únicos. 75 apoyos en tres sectores,
cinco segundos de aprendizaje seguro, plataformas móviles, impulsos, apoyos
que se deshacen, balizas estables y tres recuperaciones. Colisiones por cruce
descendente, wrap horizontal y cámara deterministas. Fondo espacial común,
estructuras discretas, indicadores de apoyo/impacto, HUD y controles fuera
del campo en vertical/horizontal. Sin assets nuevos ni dependencias de app.

QA descubrió un click-through al soltar un control mantenido después de
la derrota: podía activar OTRO JUEGO recién mostrado. El panel compartido
ahora exige un gesto nuevo para clicks de puntero; conserva teclado y
accesibilidad. No altera timing, inputs ni scoring competitivos.

Validación: typecheck/lint, goldens históricos, 32 subidas reproducidas, 128
aperturas, farming, soporte, wrap, balizas/lives, boost/crumble, recogibles,
invalid inputs, render 60/120/144 Hz y build de producción. Golden: 43560/tick
6527. No se repiten pruebas de repositorios: esta unidad no cambia persistencia.

QA de Chromium con toques nativos y observación del dibujo real: vertical
43560/tick 6542, horizontal 43560/tick 6396, 75 apoyos y tres recuperaciones.
Derrota reparada 0/tick 548, cero vidas; cancelación, blur, único submit,
replay de servidor y reinicio. Orb Burst regresa sin errores y mantiene launch,
verificación y reinicio. Cero errores de consola/página. QA física humana sigue
recomendada; no se confunde con aceptación comercial o producción activada.

Quedan seis INTEGRATED, Piano y el pulido general de UI. Mine privado requiere
integración pública segura; identidad/PG/ledger reales no configurados.
Estado detallado en PRODUCT_BACKLOG_STATUS.md; no se declara backlog completo.
