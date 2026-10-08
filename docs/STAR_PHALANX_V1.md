# GALACTIC GAMES · Star Phalanx V1

## Auditoría

0.1 era una integración con reglas dentro de React: cuatro filas simultáneas de ocho enemigos, una colisión letal, disparo manual, PRNG mutable y tiempo de render limitado. Se conservan la formación móvil, los triángulos, el control horizontal y la inspiración arcade. El componente histórico se archiva sin carga activa. El nuevo core entero 1.0.0 se conecta al registry, lazy loader, runtime, lifecycle y adapter/replay comunes; no sustituye ningún verificador histórico.

## Producto y reglas

Cinco oleadas de 2/3/3/4/4 capas. Solo una capa está activa: al limpiarla se anuncia la siguiente durante 150 ticks; cambiar de oleada espera 240. La primera empieza con tres enemigos separados, la segunda capa con cuatro. Hay ocho segundos sin fuego enemigo para aprender. Después las oleadas usan cinco/seis/siete/ocho columnas, geometrías en V, alternadas y escalonadas y algunos enemigos blindados de dos impactos.

Formación, movimiento de nave, balas, carga y colisiones son enteros a 120 Hz. El seed y namespace versionado del PRNG compartido fijan espaciado/dirección/selección de tirador. El disparo enemigo avisa durante 60 ticks y viaja por una línea visible; no persigue al jugador. Desde la oleada cuatro, y para blindados de la tercera, hay pares en carriles ±22 px anunciados antes del tiro. Matar un enemigo durante su carga la interrumpe y premia precisión.

Tres escudos; 150 ticks de protección evitan daño repetido simultáneo. Impacto resta 250 puntos con suelo cero; completar oleada recupera un escudo hasta tres. Una capa invade la zona baja si desciende demasiado: consume un escudo y reinicia su descenso, manteniendo la misma formación. Cinco oleadas o target autoritativo superan el reto; tres minutos sin cumplirlo terminan en TIME_LIMIT.

Puntos: eliminación 180 + 35×capa + 20×oleada, blindaje +80; interrupción de carga +100. Limpiar capa 300 + 70×oleada y limpiar oleada +400. El target del catálogo es 42000; práctica creada puede emitir otro límite. No son beneficios ni dinero.

## Inputs, replay y lifecycle

Un dedo: mantener y arrastrar para apuntar y disparar; levantar/cancelar/pérdida de foco suelta el fuego. AIM_000..035 representa x=20..370 px con quantum de diez y cooldown de seis ticks. FIRE_DOWN/FIRE_UP son cambios de estado explícitos. El cooldown de arma de 24 ticks no se reinicia al alternar: no existe exploit de pulsación rápida. Máximo 4500 inputs y un input por tick; el payload queda dentro del límite común de 256 KB.

La opción pointerReleaseAction amplía el lifecycle común para gestos mantenidos: no crea timers, listeners ni otro registro de inputs. Otros juegos conservan su comportamiento sin esa opción. Scoring y resultado pertenecen al core/servidor. UI dibuja, recoge acciones y usa metadata/HUD comunes. Feedback de presentación incluye escudos perdidos para que un impacto a cero puntos también tenga sonido; no altera score, hash o replay. Tono de primer disparo opcional, sin sonido por cada frame.

## Presentación y licencia

Fondo compartido espacial con profundidad, campo orbital, siluetas originales, rayos de carga, blindaje, impacto/partículas, estados de siguiente capa y HUD físico legible. No se importan código o assets externos ni material del ZIP. Inspiración genérica en shoot-em-ups de formación, con implementación original.

## Pruebas

Golden 43475 puntos, tick 13529. Treinta y dos replays: 31 victorias de cinco oleadas/16 capas/100 enemigos y una derrota del controlador de prueba; no se afirma una solución universal. 128 aperturas seguras, capas diferidas, telegraphs, carriles dobles, interrupción, blindaje, protección simultánea, release, anti-toggle, bounds/payload/invalid inputs y render 60/120/144 Hz. Históricos/typecheck/lint/build pasan.

QA táctil contra la representación real en ambas orientaciones: cinco oleadas, 100 enemigos y 16 capas, cancelación y pérdida de foco, score de servidor, finalización única y reinicio sin errores. El primer controlador de QA que predecía la simulación se desincronizaba; se sustituyó por observación de dibujo únicamente para dirigir el jugador de prueba, sin acceder a refs React o modificar estado/seed/score. Nada de ese observador se incluye en producto. QA de audio final con activación táctil confirma emisión de SFX, derrota, cancelación/blur y reinicio sin errores. Orb Burst/River Dash mantienen sus regresiones táctiles verdes; PostgreSQL local real pasa. QA física humana recomendable.

No se activa competición real, identidad ni dinero. Se conservan puntos de integración de servicios aún pendientes.
