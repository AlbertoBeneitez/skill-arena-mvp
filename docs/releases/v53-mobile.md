# v53-mobile · Entrada, tacto y presentación

Parte de v52-mobile. Entrada sin texto promocional: logo orbital original más
elaborado, título, Google/Apple todavía no disponibles y sesión demo local
explícita. Avatar sustituye Cuenta en navegación y ofrece acceso al ranking.
Catálogo sin título/descripción duplicados; CAMBIAR en resultados y sin coaching
genérico. Saturno compartido con bandas, volumen y anillos anterior/posterior;
SVG original para superficies CSS. Sin assets o código de terceros importados.

Stack y Tower pierden la proyección del bloque. Sus cores, reglas y replays
históricos permanecen intactos. Maze tiene nodos más legibles; no cambia aún su
dificultad. QA detectó un toque de finalización que podía activar CAMBIAR al
aparecer resultados: fieldset deshabilitado 350 ms y guarda de pointer evitan el
salto, con limpieza del timer. Este reloj es solo UI, nunca simulación/scoring.

Dardos 2.0 adapta el input a swipe ascendente desde la zona inferior sin botón.
V1 y su simulación se reutilizan sin modificación; nuevo hash de contenido y
adapter versionado. El servidor verifica AIM/THROW ordenados y recalcula resultado;
no afirma verificar la anatomía del gesto físico. Quince tiros, objetivos,
puntuación y golden de estado conservados. Cancelación/blur no lanzan, reinicio
limpia el origen del gesto y teclado conserva acceso.

Validación local: typecheck/lint, suite completa determinista/histórica/autoridad
privada, tests de límites del swipe, replay/golden/render/input y build pasan.
QA táctil Chromium en vertical/horizontal: entrada/avatar/persistencia,
catálogo/búsqueda/loading/error, Avatar→ranking y controles; Dardos victoria y
derrota, quince lanzamientos, cancel/blur, submit único, replay y reinicio;
Stack/Tower pérdida, replay/reinicio/rotación; Jet pérdida/replay/reinicio.
Maze victoria completa (216 nodos, tres sectores, score 26800, tick 7318) y
pérdida por perseguidor (score 700, tick 5040), replay, resultado, reinicio y
rotación. Regresión de resultado cubre acción inmediata deshabilitada y acción
posterior deliberada. Sin errores de consola en los flujos comprobados.

No activa OAuth, dinero ni competición real. No convierte puntos en niveles:
usuario pide recorrido continuo y mayor altura; alcance por juegos pendiente de
aclaración. Tampoco cierra las solicitudes nuevas de gameplay/datasets restantes.
CI/despliegue y referencias exactas se comprueban al publicar la rama; esta nota
no sustituye su estado remoto. Pruebas físicas recomendables, nunca bloqueantes.
