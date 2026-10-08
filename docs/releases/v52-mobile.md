# v52-mobile · Grupos demo

Parte de v51-mobile validada. Unidad de UX local, sin modificar cores, scoring,
verificadores, autenticación, persistencia ni liquidaciones.

Grupos, rivales, enlaces, preparación y botes identificados como simulados.
Un código abre una demo local, no promete salas sincronizadas. Entrada vacía,
negativa o superior al saldo bloqueada; mensaje accionable para jornadas/juegos
y eliminaciones incompletas. Copia con confirmación accesible, error y selección
manual si el navegador la deniega. Limpieza del timer y guardas tras desmontaje.
Selector compacto con miniaturas/nombres y cuatro columnas en pantallas amplias.
Controles de al menos 44 px, formularios legibles y rotación sin overflow.

Typecheck/lint, suite determinista/histórica y build pasan. QA táctil Chromium:
crear/unirse, normalización de código, copiar código/enlace, denegación de copia,
entrada inválida, liga manual/aleatoria, borrar jornada, límite 50, torneo,
preparación, inicio único de Maze y salida al grupo en vertical/horizontal.
Sin errores de consola. La QA usa simulación del permiso de portapapeles para
comprobar ambos estados; navegación y controles son reales.

Auditoría incremental de Solitaire: termina al revelar el tablero, marca como
derrota completar las 52 bases y permite repetir score de traslados. Su arreglo
necesita nuevas reglas versionadas, conservando 0.1, y proteger cartas futuras
mediante la autoridad privada común. Sigue INTEGRATED. Mine público seguro queda
pendiente de identidad confiable/PG duradero; candidato local preservado.
No se activa dinero, auth ni competición real. Pruebas físicas no bloquean.
