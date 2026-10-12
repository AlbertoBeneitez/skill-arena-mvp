# GALACTIC GAMES · Seguimiento de v94-mobile

Este documento distingue validación técnica/jugable automatizada de aceptación comercial humana. No declara el backlog completo. Las pruebas físicas son seguimiento del propietario y no bloquean las siguientes iteraciones. La auditoría inicial está en V32_PRODUCT_AUDIT.md; checkpoints anteriores permanecen intactos.

| Juego / área | Trabajo preservado y validado | Pendiente |
| --- | --- | --- |
| Galactic Slot | v89: V1 VERIFIED conservado; referencia fija alineada visible10s, máquina ampliada después, avance0 visible/inmóvil equivalente al wrap histórico; QA táctil completa53tiradas/180s y insolvencia20tiradas, ambas vistas, reinicio/rotación/abandono y320px | Sin dinero real ni pairing/consumo durable; seguimiento físico |
| Galactic Roulette | v94: V2 VERIFIED, suelta XY/dirección/impulso por ticks, física cartesiana3D de vuelo/gravedad/contacto/rodadura; tapete plegable49apuestas/columnas, objetivos48px, touch fiable;32wins/8losses/golden/servidor/render, QA completa70/68tiradas180s y20tiradas de insolvencia, ambas vistas/reinicio/rotación/recibos. V1 preservada | Aproximación arcade, una apuesta por tiro sin splits/corners/múltiples chips; sin dinero real/pairing durable |
| Galactic Birds | v93: V3 VERIFIED, seis andamios persistentes2–4alturas/58piezas, soportes y plataformas físicos, doce cerdos; restantes por cada tipo de pájaro;1000campos,8clears/32inicios estables/golden/replay/inputs/servidor/render y QA táctil win/loss/reinicio/rotación/recibo ambas vistas. V1/V2 preservados | Física AABB translacional sin rotación; seguimiento físico/comparación común |
| Stack | Core 3D X/Z, recorte, replay; cámara/sombra/altura y partidas táctiles; v65 retira texto de ejes, mantiene orientación visual | Revisar legibilidad de alternancia X/Z sin texto; seguimiento físico |
| Tower Drop | Péndulo reproducible, composición móvil, retirada de texto/score distractor; v65 mantiene base/capas inferiores con perspectiva compacta y QA táctil/reinicio | Nueva versión para bloques de tamaño constante/estabilidad y plataforma de lanzamiento cuidada; conservar base y replay |
| Jet Stream | v63: V4 VERIFIED, dos pasos de aprendizaje y desplazamientos de altura crecientes/reflejados, ventanas/vidas/dobles pasos inmutables, avance por portales, replay y QA táctil de180s. V1/V2/V3 archivados; v73 extiende cuerpos hasta ambos bordes reales del canvas, huecos V4 exactos y QA180s en ambas orientaciones | Rotación1000 y comparación común pendientes |
| Alien Dash | v67: V3 VERIFIED, patrones encadenados de salto/agachado, tejados/puentes, centinelas y recuperaciones, avance por actores pasados y cámara horizontal con FOV igual; replay/QA táctil120s. V1/V2 archivados | Más decisiones opcionales de altura/plataformas en nueva versión progresiva; rotación1000 y comparación común pendientes |
| Orb Burst | v70: V2 VERIFIED, campo continuo de108 originales, suministro sin resets, avance sin farming, presión4→3, disparo al soltar sin botón, cámara horizontal y replay/QA táctil completos. V1 archivada | Rotación1000 sin repetición y comparación común pendientes; seguimiento físico |
| Shot Gallery | v90: V2 VERIFIED, una plantilla revelada/seis figuras directas/impactos y música original de tensión; doce pruebas intercaladas/suma terminal sin cierres por target;1000sets/golden/input/replay/render/servidor, QA táctil win/wrong/early/reinicio y tamaños44px ambas vistas; V1 archivada | Seguimiento físico y producción real siguen fuera del scope |
| River Dash | v87: V4 VERIFIED, filas generadas sin meta65, velocidades/longitudes/huecos variables y dificultad suave; alcance terminal sin farming ni cierre por target;1000courses,384starts,golden/replay y partidas táctiles reach80/derrotas/reinicio/abandono ambas vistas; V1–V3 archivados | Sesión limitada técnicamente a seis minutos; comparación real por avance/tiempo y seguimiento físico pendientes |
| Serpent | v75: V2 VERIFIED, cadencia18→10ticks frente17→9V1, botones72px y campo ampliado, avance por núcleos, 32 recorridos equivalentes al kernelV1 y 8 derrotas; QA táctil victoria/derrota/reinicio en ambas orientaciones, históricoV1 archivado | Seguimiento físico y comparación común pendientes |
| Billar | v68: V2 VERIFIED, una mesa de10bolas/18tiros, posiciones persistentes, colisiones/bandas/fricción V1, avance por embocadas únicas, cámara horizontal y replay/QA táctil completos. V1 archivada | Gesto único de dirección/retroceso/potencia y disparo al soltar; preservar físicaV2 |
| Dardos | v85: V3 VERIFIED,20swipes/suma cruda sin bonus ni objetivos, oscilación1000perfiles, vuelo1s/arco/profundidad sin previsión ni marcas antiguas,64victorias/ocho derrotas/timeout/golden/render y QA táctil completa/rotación/reinicio. V1/V2 preservados | Seguimiento físico; comparación común y consumo durable pendientes |
| Mine Grid | v88: Mine2.0 privado conserva1000campos no-guess/goldens; integración opcional del catálogo con PostgreSQL transaccional/CAS, cookies opacas, cuerpos limitados, registros al salir, recuperación entre workers y partidas táctiles completas ambas vistas | Activación pública pendiente de DATABASE_URL/proveedor y migraciones explícitas; Vercel actual conserva0.1/setup fijo. Sin autenticación/dinero/competición real; reloj ordinal no ofrece desempate por tiempo real |
| Solitaire Sprint | Portadav76/QA preservados; v80 generador privado candidato,1000repartos iniciales distintos reproducibles,52cartas únicas/proyección oculta/golden, sin templates públicos recuperables | Resolver policy de resolubilidad, core privado/cierre52bases/farming, QA completa e integración durable pública; catálogo0.1 conserva setup fijo |
| Sky Hop | v69: V3 VERIFIED conserva75 apoyos/física/recuperaciónV2; marcianos bajo bordes, aviso1s, stomp de rescate y daño con checkpoint sin farming, META75 visible, altura/replay y QA táctil completos. V1/V2 archivados | Nueva versión sin meta75, curso continuo con dificultad gradual; históricos/seguridad de replay intactos |
| Metro Shift | v46: core 1.0 VERIFIED, 60 grupos/tres sectores, ocho segundos de aprendizaje, saltos/vallas/muros, recargas/escudos y replay | Nueva versión más variada/rápida con apertura justa y transiciones superables |
| Brick Relay | v78: V2 VERIFIED, muro continuo69 bloques, aceleración mantenida3/2 registrada, alcance por bloques únicos, arrastre final conservado durante cooldown; victorias/derrota/reinicio táctiles en ambas orientaciones. V1 preservado | Pulido posterior según experiencia en móviles físicos; comparación global alcance/tiempo pendiente |
| Stack Shift | Core1.0 VERIFIED con seis formas propias (I3,L3,Z4,O4,X5,L4), base/apoyo/arena ampliada preservados | Identificar doce piezas: se ha preguntado si son pentominós F,I,L,N,P,T,U,V,W,X,Y,Z; falta respuesta, no se inventan ni cambian reglas |
| Maze Rush | v74: joystick circular116px con zona neutra/histéresis, STOP retenido durante cooldown, captura/cancelación; victorias70nodos y derrotas/reinicio/rotación en ambas orientaciones, mismo coreV3/replay. v64: V3 VERIFIED, 70 nodos continuos, más margen para girar/perseguidores, avance por nodos, confirmación de input/pulso y tablero horizontal ampliado; victorias/derrotas/reinicio táctiles y replay. V1/V2 archivadas | Nueva petición: maze más amplio, estrellas y movimiento expresivo original inspirado en el género; preservar joystick e históricos |
| Star Phalanx | v91: V3 VERIFIED, 24 oleadas continuas/168 enemigos, disparos dirigidos con aviso y abanicos simples/dobles/triples; decisiones de ataque/esquiva/recogida, premios500 y escudos300 con recuperación; partidas completas táctiles ambas vistas, derrota/reinicio/rotación, replay/golden/inputs/servidor. V1/V2 preservados | Seguimiento físico y comparación común alcance/tiempo; no activa competición real |
| Orbit Shift | v50: apertura reparada; core 1.0 VERIFIED, 60 pasos/3 sectores, arcos combinados, recargas/escudos, transición radial y replay; QA táctil completa | Nueva versión con apertura moderadamente más exigente y rampas posteriores más lentas |
| Piano Rush | v61: V3 VERIFIED, 48 notas continuas, ocho de aprendizaje, precisión/ritmo graduales, escudos/combo; V1/V2 archivados y QA táctil completa | Siete teclas directamente bajo lanes, melodías reales de dominio público, protocolo/versionado y replay |
| Memoria (retirada en v84) | v71: V2 VERIFIED sin preview, un tablero6×4/12parejas seedado, exploración sin pérdida de vidas, penaliza errores con pareja previamente conocida;128 victorias de aprendizaje y QA táctil win/loss/timeout/reinicio/blur/rotación. V1 archivada | Fuera del catálogo/loader público y nuevos inicios bloqueados en v84 por petición del propietario; cores/adapters/tests V1/V2 preservados para reproducir registros históricos |
| Fondo/música comunes | v65: imagen original optimizada y alineada a viewport, cubre extremos/letterbox; fallback, una caché/blit; mute síncrono cancela voces/resume pendiente, QA audio nativo | Seguimiento físico de FPS/Safari y dirección artística según uso real |
| 2048 / Pulse Runner | Retirados del catálogo y loaders | No reintroducir |
| Rebranding | v33 identidad visible GALACTIC GAMES, metadata/manifest/icono original | Revisión global final de restos visibles |
| Login/onboarding | Entrada local honesta, avatar/nombre; v84 título Elige tu identidad blanco, QA vertical/horizontal/320px | Las16 imágenes solicitadas no están adjuntas a esta sesión; no se sustituyen por otras. OAuth/auth real requiere proveedor, sin simularlo |
| UI global | v38 resultados fieles; v45 catálogo/navegación; v48 perfil y secciones demo legibles, saldos/acciones explícitos, eje de beneficio corregido, preferencias/reset/logout QA | v52 grupos demo explícitos, formularios/feedback/portapapeles y QA vertical/horizontal; quedan restantes layouts y grupos reales con identidad/persistencia; revisión jurídica de producción al configurar servicio; QA humana |
| Ranking | Beneficio neto exacto, paginación/snapshot/PG, demo aislada y sección visible | v76 pantalla completa dentro de Avatar mediante selector Perfil/Ranking, misma paginación/API y fuentes aisladas, QA vertical/horizontal/320px; quedan posición propia autenticada y activar read model solo con datos reales |
| Escenarios / autoridad | Seeds/versiones públicas V3, históricos V2, privado V3/command CAS/PG desacoplado | Pairing real, identidad, consumo durable de resultados e integración HTTP producción |
| RGPD | Ideas compatibles, borrado idempotente de intentos, ningún ZIP sin licencia importado | Consentimiento versionado y política completa identidad/ledger/retención al integrar proveedores |

Los 23 juegos activos incluyen 21 VERIFIED por replay y dos INTEGRATED. Mine privado V1/V2 es candidato adicional, no se cuenta como activo. PostgreSQL/identidad/ledger reales no están configurados; no se inventan usuarios, beneficios ni autenticación. Los datos demo no entran en el ranking de producción.

## Iteración v53

Entrada/logo/avatar y acceso a ranking simplificados; catálogo sin nombres
repetidos, Saturno común mejorado, proyecciones Stack/Tower retiradas, nodos Maze
más grandes. Dardos 2.0 usa swipe ascendente; V1 permanece verificable. Resultado
protegido contra toques que llegan durante la transición. Evidencia incremental:
[release v53](releases/v53-mobile.md).

Esta revisión no cierra las nuevas solicitudes de gameplay: Jet menos alineado,
River más fluido, añadir enemigo Sky (baliza reparada en v56), datasets Mine/Solitaire (Maze continuo resuelto en v58; arena Stack Shift ampliada en v54).
Portadas congruentes y alcance de métrica altura/avance siguen pendientes. QA
física del propietario es seguimiento y no bloquea desarrollo.

### v54 · Stack Shift

Tablero y piezas ampliados, suelo visible y controles separados; reglas V1 sin
cambios. Victoria de 18 filas y derrota TOP_OUT con inputs táctiles, replay,
submit único, doble tap y reinicio comprobados. Detalles en release v54.

### v55 · Metro Shift

El mínimo de tamaño/profundidad detenía visualmente los obstáculos nuevos en el
horizonte pese al avance del core. Proyección continua desde distancia 1100,
con posición de colisión intacta; regresión específica y QA de 60 grupos,
derrota, replay/reinicio/rotación. Core V1 y scoring permanecen congelados.
Si se observa otro caso de detención, distinguirlo de este caso reproducido.

### v56 · Recuperación Sky Hop

V2 restaura las balizas rotas por delante del checkpoint al caer. Altura alcanzada
y recogibles consumidos persisten; no se pueden repetir premios. Ocho regresiones
completas con replay y partida táctil de caída/recuperación/victoria comprobadas;
derrota y reinicio horizontal pasan. V1 archivada y golden sin caídas idéntico.
Sigue pendiente el enemigo; no se confunde la reparación con esa nueva mecánica.

### v57 · Registro y frontend

Terminal VERIFIED envía inmediatamente el snapshot ordenado antes de animación;
salir de la pantalla conserva el transporte y elimina callbacks antiguos.
Gate mantiene deduplicación; snapshot no cambia al desmontar/reiniciar.
Entrada/avatar/grupos/ranking/resultados ya no usan demo como etiqueta; datos
ficticios siguen identificados y separados. Jet/Alien/Metro/Orbit/Sky/Stack Shift
ya eran continuos: eliminadas etiquetas de niveles, sin tocar cores.

No se afirma universalidad: Mine/Solitaire legacy carecen de registro, abandonos
anteriores al terminal/offline y persistencia durable quedan pendientes. Niveles
reales de Maze/Billar/Orb/Brick/River/Piano/Phalanx y Mine privado requieren nuevas
versiones; no se elimina el histórico. Detalles de validación en release v57.

### v58 · Maze Rush continuo

V2 usa un solo tablero conectado 11×13, sin rebuild, pausas de sector ni
teletransportes por daño. Nodos mayores, llegada suavizada, dificultad gradual
y dos perseguidores condicionados por tiempo/avance con 180 ticks de aviso
antes de movimiento/daño. Regresión de activación junto al jugador corregida.
Golden, 32 recorridos completos, 128 tableros conectados y replay/render/inputs
pasan; QA táctil de victorias, derrotas y reinicios en ambas orientaciones.
Históricos intactos. Evidencia en release v58.

Prioridad siguiente: registro de abandonos anterior al terminal en el endpoint
común, como recepción de un prefijo reproducible sin adjudicación. Después Piano
sin pausas y restantes niveles reales en nuevas versiones. Persistencia durable,
legacy Mine/Solitaire y cierre offline siguen sin garantía universal.

### v59 · Registros de abandono

Los 18 VERIFIED activos envían también prefijos al salir, recargar o pagehide,
usando el último tick/estado realmente simulado y el endpoint común. Receipt
procesado no equivale a resultado ni almacenamiento durable; sin score/winner.
Terminal causado por input se compromete antes del feedback y comparte dedupe
con RAF/cleanup. Checkpoints/inputs ligados al attempt_id; BFCache pide intento
nuevo. Keepalive limitado por bytes; no se abandona por blur/rotación.

29 versiones actuales/históricas y sobres terminales pasan tests. QA táctil en
ambas orientaciones: ocho recibos reales por recorrido, salida con/sin inputs,
respuesta tardía, guardia back, recarga y handlers BFCache (no se afirma cache
real). Start pendiente cancelado no crea registros ficticios. Jet/Dardos
terminales siguen verificados; detalles en release v59.

Siguen pendientes registro legacy Mine/Solitaire, almacenamiento durable,
reintentos/offline y autoridad pública privada con identidad/configuración.
La recepción de prefijos no adjudica abandonos ni activa dinero real.

### Prioridades vigentes de producto

Retirar instrucciones/coaching y explicaciones de las superficies de juego;
nombres como acción de acceso, portadas acordes a la identidad y fondos Saturno
más cuidados. Conservar labels de estado/error/accesibilidad y la identificación
de importes ficticios. Dar más espacio al tablero Stack Shift.

Mejorar dinamismo River y entretenimiento Maze sin volver a niveles. Sustituir
comparación por puntos con avance real y tiempo decimal: requiere métricas
autoritativas/versionadas por juego, sin cambiar históricos ni renombrar score.
Solicitados 1000 escenarios distintos por juego y experiencias que no se repitan;
reutilizar catálogo/generadores comunes, conservar mismo escenario entre rivales
y definir rotación auditable/consumo con la persistencia desacoplada existente.
No declarar unicidad de experiencia por simplemente cambiar un texto o seed.

### v60 · Presentación y espacio útil

Accesos con nombre del juego; retirados tutorial, coaching/instrucciones dentro
de los juegos y explicaciones redundantes del catálogo, resultado, avatar,
grupos y ranking. Estado, accesibilidad, privacidad e identificación de saldo
ficticio/datos de ejemplo permanecen. Tiempo del resultado en segundos con tres
decimales; no se afirma migración a desempate/avance por cambiar la presentación.

Tablero Stack Shift 288×576, frente a 256×512, con suelo y controles separados;
Saturno común con halo, órbita, luna y nebulosa discretos, sin cambiar simulación.
Portadas sin títulos duplicados y revisión orbital de ilustraciones antiguas.
QA táctil de inicio/salida de los 18 VERIFIED en ambas orientaciones devuelve
36 recibos reales; victoria Stack vertical y derrota/reinicio horizontal pasan.
Catálogo 320px/rotación, entrada, avatar, grupos y ranking comprobados.

Persisten métricas autoritativas de avance/desempate, catálogo de1000 escenarios
y rotación sin repetición, enemigos Sky, juegos con cortes restantes y migraciones
privadas Mine/Solitaire. El ledger superior distingue estado actual e histórico.

### v61 · Piano Rush continuo

Eliminadas las pausas de 240ticks y saltos entre sectores mediante schedule V3;
generación de carriles/judgements/scoring V2 reutilizados sin efectos deshechos
ni cambios al histórico. Golden, 64 partidas completas, 128 aperturas/ramps y
bordes/inputs/render pasan. Victorias/derrotas/reinicio táctiles, audio y rotación
vertical/horizontal comprobados. Detalles en release v61. Siguiente: River V3
sin teletransportes, descansos intercalados y recorrido más fluido.

### v62 · River Dash continuo

65 filas generadas una vez, hasta dos peligros consecutivos y apertura central
superable; conservadas geometría/carry V1 con movimiento/límites V3. Avance se
acredita tras colisión válida y no se repite al retroceder. Cámara/llegada suave,
feedback de impacto y HUD de avance sin puntos. Los resultados comunes muestran
height real recibido de servidor cuando existe (River/Stack/Tower/Sky), sin
reinterpretar score ni afirmar que el desempate/comparador está migrado.

384 aperturas/16 recorridos, golden/inputs/render/replay pasan; victorias, swipe,
derrotas deliberadas, reinicio y rotación táctiles en ambas orientaciones, con
registro único/avance exacto. Evidencia y límites en release v62. 1000 experiencias
distintas requieren comprobar configuración además de seed y reserva de rotación;
la auditoría detectó duplicados en algunas configuraciones públicas actuales.


### v63 · Jet Stream variado

V4 conserva integrador, inputs, scoring y terminal V3, pero garantiza cambios de
altura de25–45px mínimos/75–85px máximos tras dos pasos de aprendizaje. Reglas
versionadas, ventanas/recogibles existentes inmutables y height=portales reales.
1000 geometrías iniciales distintas,32 recorridos de180s, apertura/duales/golden/
replay/render/inputs inválidos pasan. QA táctil completa vertical/horizontal,
derrota/doble toque/cancel/reinicio/rotación y envío antes de explosión pasan.
Typecheck/lint, suite histórica y build pasan; evidencia en release v63.

No se confunde esa prueba geométrica con rotación sin repetición: HTTP público
sigue emitiendo V2 con seed aleatoria; catálogo V3 no está conectado a esa ruta.
Rotación/reservas y unicidad1000 de los demás juegos continúan pendientes, junto
con métricas/comparación, Maze, enemigo Sky, cortes reales restantes y privados.


### v64 · Maze Rush: lectura, ritmo y avance

V3 conserva generador, contactos, arming, pulsos/escudos, scoring e inputs V2.
La cadencia versionada pasa a38→30ticks jugador y132→100 perseguidor; no
reconstruye tablero. Height cuenta nodos únicos, incluso tras daño. V1/V2 y sus
goldens permanecen intactos. Vista horizontal opt-in amplía tablero sin modificar
coordenadas competitivas; targets conservan44px durante toque, iconos confirman
giro/cola y anillos muestran protección restante.

Golden nuevo8400/70nodos/t3752; cuatro victorias/cuatro derrotas, replay/render
60/120/144 e inputs inválidos. QA con touch real completa70nodos en ambas
orientaciones, derrota deliberada, reinicio, rotación/320px y consola limpia;
registro único y height autoritativo comprobados. Evidencia y límites en release
v64. Siguiente tanda: Tower/Stack, audio y fondo; después Memoria/Alien.


### v65 · Presentación coherente y audio fiable

Tower mantiene suelo y capas inferiores sin cambiar física/inputs; Stack elimina
texto de ejes conservando flecha/3D. Imagen original90,6KB, compartida y alineada
a viewport con CSS y lienzo, evita duplicar Saturno; fallback procedural y cero
lecturas de layout por frame en el driver común. Jet conserva estelas/raíles y
usa el mismo fondo. Mute inmediato con master gain, voces canceladas/limpias y
unlock dentro del gesto; no pueden reaparecer voces antiguas tras resume pendiente.

Typecheck/lint/build, goldens/replay de Stack/Tower, regresión base1–501capas,
RMS/audio nativo y QA botones/persistencia en ambas orientaciones pasan. Tower:
dos wins de8bloques, pérdida14, dobletap/cancel/reinicio/rotación/registro únicos.
Catálogo320/horizontal,36montajes/registros, Jet explosión/envío inmediato y
fondo/entrada real se revisan; detalles en release v65. Próximo: Memoria, luego
Alien con más patrones/ritmo, conservando versiones e infraestructura común.


### v66 · Memoria

Nuevo juego original de parejas orbitales, tablero6×4 estable en toda orientación,
24tarjetas/12símbolos con forma/color/número. Preview completo legal8s; mismo
mapa toda la sesión, dos errores protegidos, ocho vidas y reveal120→54ticks según
avance, límite120s. Avance por parejas únicas, sin puntos visibles ni niveles.
Registry/lazy loader/driver/RNG/scenario/coreAdapter/registro comunes. No se
introduce autoridad privada: seed/preview públicos permiten guardar el mapa y
automatizar; producción sigue apagada.

1000 disposiciones reales distintas,64 runs, golden/replay/render60/120/144,
inputs inválidos/semánticos, pérdidas/timeout;34versiones en registro común,
contratos/lifecycle/typecheck/lint/build pasan. QA táctil wins de12parejas en
vertical/horizontal, errores conservan2pares, timeout real14400ticks conserva1;
cancel/drag/dobletap/rotación/320px/sonido/reinicio/abandono y consola limpias.
Catálogo crece por registry, tests usan su tamaño. Ver release v66. Próxima
unidad: Alien V3, más patrones y plataformas útiles sin sustituir kernel V2.


### v67 · Alien Dash: decisiones y encuadre

V3 conserva kernel físico/inputs/scoring/terminal120s de V2 y añade generación
versionada de patrones: plataformas amplias, refugios, techo bajo, saltos de
puente y combinaciones con atacantes; descanso/recogibles cada cuatro frases.
Cuatro obstáculos aislados de apertura, sin niveles ni resets. Avance autoritativo
por actores pasados, HUD sin puntos/coaching, pasos/escudo/impacto y controles↑↓.
Cámara horizontal amplía el personaje sin cambiar FOV390 ni ocultar la envolvente
de amenazas/salto; timer legible y controles despejados, DPR/portrait centrados.

32 recorridos sin daño y32 con delay67ms,128 aperturas,1000 geometrías alcanzables
distintas, igualdad física V2 por tick, golden/invalid/render/replay y35versiones
de registro pasan. Servidor reconstruye altura frente a campos cliente falsos.
Typecheck/lint/build y QA táctil de120s vertical/horizontal, muerte/reinicio/
cancel/blur/dobletap/rotación y registro único se validan; release v67 conserva
evidencia y límites. V65/V66 permanecen intactas. Siguiente unidad: Billar V2
continuo; después restantes resets/enemigos, métricas/rotación y privados del ledger.

### v68 · Billar: una mesa, decisiones persistentes

V2 compone literalmente la física entera V1, pero no reconstruye mesa, rellena
tiros ni repone objetivos. Diez bolas visibles desde inicio, dieciocho tiros,
apertura cerca de tronera y posiciones/distancias/bumpers variables; cada contacto
cambia la situación restante. Avance cuenta embocadas únicas, sin premios de
racha/mesa ni reducción por blanca embocada. V1/adapter/golden permanecen intactos.
HUD sin puntos/niveles; guía corta de dirección/contacto sin proyección de caída,
palo/potencia, partículas, bandas y bolas más legibles. Cámara horizontal e
inversa táctil comparten transformación visual, sin cambiar tokens ni física.

1000 geometrías distintas,128 aperturas seguras,16 arenas completas naturales,
golden/replay/render60/120/144/inputs inválidos y paridad física V1 pasan;
4320 conversiones táctiles/cámara y540 combinaciones aim/power sin mutación.
Registro común36versiones reconstruye avance/score/tiempo frente a campos cliente
falsos. Typecheck/lint/build pasan. QA táctil vertical/horizontal gana10bolas,
pierde al consumir18tiros, conserva avance tras scratch y verifica reinicios,
rotación/cancel/dobletap/registro único/abandono/consola. Evidencia y límites en
release v68. Siguiente unidad: enemigo anticipable Sky Hop; siguen pendientes
resets Orb/Brick/Phalanx, métricas/rotación y privados del ledger.

### v69 · Sky Hop: marcianos y recuperación justa

V3 compone literalmente stepV2 y conserva plataformas, gravedad, dirección,
rebotes, pickups y recuperación de crumbles. Marcianos desde apoyo14, fuera/bajo
los extremos, ausentes de balizas/boost/crumble y dos apoyos de recuperación;
patrulla íntegra dentroFOV, aviso120ticks. Despegue/ruta central permanecen libres;
overshoot permite contacto o stomp-rescate. Daño conserva altura/pickups/held,
restaura crumbles y rearma enemigos; derrotados persisten, sin bonus/farming.
V1/V2/protocolo1/adapters/goldens intactos. HUD altura sin puntos, META75 reparada,
impactos/avisos y audio comunes; registro antes de finale300ms.

1000 geometrías reales distintas,7–16enemigos por curso,96 ascensos con controles
históricos (32cada66.7ms), golden de stomp/victoria, contacto/recuperación y tres
contactos/derrota pasan. Apertura5s, bounds/arming/grace, replay/render60/120/144,
invalidinputs, antifarming y37versiones de registro común se validan. Renderer
puro/FOV/goal/audio, typecheck/lint/build y QA táctil vertical/horizontal pasan:
75apoyos tras crumble colapsado/restaurado, stomp real, contacto/caídas, reinicio,
cancel/blur/dobletap/rotación/320px/registro único/abandono y consola limpia.
Evidencia y límites en release v69. Siguiente: Orb continuo y restantes resets,
comparación/rotación comunes e integración privada Mine/Solitaire.

## Iteración v78

Brick Relay continuo y acelerador autoritativo; corregido destino táctil perdido
durante cooldown sin alterar replays históricos. Evidencia: [v78](releases/v78-mobile.md).
Mine/Solitaire siguen pendientes de integración privada pública segura y variedad
visible. Stack Shift: pregunta concreta sobre los doce pentominós pendiente de respuesta.

## Iteración v79

Phalanx V2 continuo, replays V1/V2 y disparos entre capas preservados.
[Validación y QA](releases/v79-mobile.md). Mine/Solitaire privados y doce
piezas permanecen pendientes; sin activar proveedores/dinero reales.

## Iteración v80

Mine privado continuo2.0,1000campos no-guess/replay/golden/proyección/QA local;
Solitaire generador privado candidato1.0,1000repartos distintos y proyección de
caras legales, sin promesa de resolubilidad/core/QA completa. Amboscatálogos0.1
siguen intactos con setup fijo hasta integración privada segura. Evidencia y límites
en [v80](releases/v80-mobile.md). Doce piezas requieren identificar el set del propietario.

### Publicación v80 · incidencia inicial

HEAD inicial f2b575648714f9715a2dfcd6f0dec13e2011e3f5 pasa CI38062225622 completa
(determinismo/históricos/PostgreSQL/typecheck/build), pero Vercel marca failed en
dpl_DVch4XUps9PiSnQggxQGzaWzyFgW. GitHub no devuelve logs y la API/CLI de Vercel
rechazan su lectura por ausencia de credenciales; se solicita solo el error del
build, nunca secretos. Este checkpoint de estado realiza un único nuevo build
automático de Vercel con el mismo código, para comprobar si fue transitorio.
No se cambia configuración ni se desactiva seguridad. No se promueve mobile-test
sin CI y Ready del HEAD que vaya a publicarse; v79 queda recuperable e intacta.

## Iteración v83

Birds original, campo persistente y lanzamiento con dirección/potencia registrados
por la cola común; replay autoritativo y QA completa. Slot/Roulette corrigen
reinicio involuntario al cambiar sonido sin modificar sus cores históricos.
Cabecera y acciones del resultado responden al soltar el dedo, deduplican clics
y conservan bloqueo de gesto retenido; QA de reinicio/teclado/cancelación/blur.
Evidencia y límites en [v83](releases/v83-mobile.md). No activa dinero real,
identidad ni pairing durable. La última solicitud previa sigue pendiente:
Mine público variado, Phalanx más largo/variado, Maze amplio/expresivo, Metro más
profundo, retirar Ranking inferior y las16 imágenes de avatar no adjuntas.

## Iteración v84

Memoria retirada sin borrar verificadores históricos; endpoint de inicio respeta
`enabled`. Identidad con título blanco. Roulette conserva el core1.0 y sus hashes,
pero presenta todas las46apuestas admitidas sin scroll, paleta verde/azul/cero blanco,
potencia explícita y selección de sentido/gesto angular. Correcciones de ancho
cero del contenedor y límite520px detectadas en QA antes de publicar.
Evidencia en [v84](releases/v84-mobile.md).
Siguiente: Dardos20tiradas/suma cruda/vuelo10m; Birds con tipos/cola y objetivos
visibles; River continuo y Mine público variado con secreto protegido/persistencia.
Galactic Shot queda sin cambios por aclaración expresa del propietario.

## Iteración v85

Dardos3.0 sustituye quince pruebas con bonus por veinte lanzamientos de suma
clásica. El core conserva el total y publica score solo al terminal, evitando
cierres por target antes del vigésimo dardo. No hay niveles, puntos por objetivo,
retícula de caída ni marcadores persistentes. Vuelo largo con arco/tangente,
protocolo/lifecycle comunes y históricos intactos. [Reglas](DARTS_V3.md) y
[evidencia](releases/v85-mobile.md).
La publicación de v84 pasó CI38152831748 y Vercel6997918762Ready; mobile-test
avanzó por fast-forward a b24aa0b. Próximo: Birds con tipos/cola/demolición visible;
River continuo; Mine público seguro y variado; las16imágenes siguen sin adjuntar.

## Iteración v86

Birds2.0 añade masa/radio/velocidad por tipo y cola reproducible; la UI muestra
las aves próximas y todo el campo real en radar. Conserva caída/contactos/inputs
comunes y V1 verificable. [Reglas](GALACTIC_BIRDS_V2.md) y [QA](releases/v86-mobile.md).
v85 pasó CI38154047088/Vercel6998129407Ready y mobile-test avanzó por fast-forward
a4b117dd. Pendiente de la solicitud actual: River sin meta de65filas, Mine público
con setups variados y secreto/persistencia protegidos, e imágenes16de identidad
(no recibidas). Galactic Shot queda intacto; Memoria retirada, título blanco y
Roulette/Dardos resueltos en checkpoints anteriores. El ledger superior mantiene
el resto del backlog, sin declararlo terminado.

## Iteración v87

River4.0 elimina la meta de65filas y genera recorrido continuo sin resets ni niveles.
[Reglas y QA](RIVER_DASH_V4.md). Mantiene seis minutos como límite de recursos,
no como meta del recorrido. v86 pasó CI38155661041/Vercel6998411564Ready y
mobile-test avanzó por fast-forward a281b3ef. Próximo: Mine público seguro con
PostgreSQL; no hay DATABASE_URL ni proveedor elegido. Las16imágenes no están
en adjuntos/repositorio, por lo que no se sustituyen por imágenes inventadas.

## Iteración v88

[Mine persistido](MINE_PERSISTED_TRAINING.md): conexión reutiliza repositorios/autoridad
existentes; entrenamiento privado durable opcional, sin activar proveedores ni
auth/money. PostgreSQL local real y QA catálogo completa verifican campos distintos,
terminales/reinicio/abandono/seguridad; sin configuración mantiene legacy público.
v87 pasó CI38165672231/Vercel7000173634Ready; mobile-test fast-forward a8367025.
La tarea Mine pública NO está cerrada: falta configurar PostgreSQL en Vercel;
no hay DATABASE_URL ni servicio elegido. Las16imágenes siguen sin adjuntar.
River no tiene meta de filas, con límite técnico de seis minutos documentado.

## Unidad Slot posterior a v88

Referencia fija alineada con rodillos y oculta tras1200ticks; máquina ampliada y
avance0(alias del wrap8existente) visualmente inmóvil. Core1.0y goldens intactos.
Suite completa/typecheck/build; QA win53tiradas/180s/saldo1043500y loss20tiradas/
t8326–8393, ambas orientaciones, reinicio/cancel/doble input/registro. QA específica
comprueba0, ocultación10s, rotación y prefijo aceptado. Pendientes de solicitud
actual: Roulette desplegable/arrastre, Phalanx decisiones/recompensas, galería y Birds.

## Unidad Roulette / checkpoint v89

Roulette1.0conserva reglas/goldens pero presenta desplegable nativo46opciones y
arrastre de bola desde dock→rueda. Distancia/sentido cuantizados en inputs
históricos; sin slider ni ajustes previos. CoreCanvasGame añade choiceControl
opcional a la cola común; selección autoritativa/bloqueo en vuelo. QA completa
win32/180s y loss22en ambas vistas; 320px/horizontal pequeño, CW/CCW,
keyboard/cancel/blur/doble intento/sonido/rotación/reinicio/prefijo aceptado.
[Alcance y evidencia](releases/v89-mobile.md). Siguiente: Phalanx, galería y Birds.
No se reabren otras unidades validadas; Mine público/avatares siguen con sus
prerrequisitos externos documentados.

## Unidad Birds posterior a v89

Birds conserva core2.0/physics/replay y cambia objetivos a porcinos espaciales
originales; el campo horizontal, soportes y lanzador se elevan80px para despejar
la cola y mejorar lectura. Se mantiene radar con todas las estructuras reales y
tres aves físicas distintas. Regresión seedbirds-demolition-0/aim0 demuestra
derribo y derrota indirecta por caída, sin reemplazar el campo.576frames/render
puro y testsV2/goldens/históricos intactos; QA táctil completa11tiros/12objetivos/
score6920y pérdida30tiros, ambas vistas, reinicio/rotación/sonido/cancel/abandono.
No copia recursos/identidad comercial. Física AABB translacional continúa siendo
un límite documentado, no se presenta como simulador de cuerpos rotatorios.
Siguiente: nueva Shot Gallery y Phalanx con más decisiones/recompensas.

## Unidad Gallery / checkpoint v90

Galería2.0en una superficie descubierta, seis objetivos y señales mínimas; sonido
tenso original con silencio/cleanup. Suma de doce pruebas publica al terminal,
V1preservada. [Evidencia y reglas](SHOT_GALLERY_V2.md). Birds y Gallery se
cierran en commits separados. v89CI38232622397/Vercel7011187789Ready y
mobile-test fast-forward2ae6777. Siguiente solicitud actual: Phalanx con mayor
exigencia/decisiones/recompensas; Mine/configuración y16imágenes previos intactos.

## Checkpoint v91 · Phalanx

V3 añade presión anunciada desde el inicio, decisiones de interrupción/esquiva
y recogibles sin pausas ni resets. [Reglas y evidencia](STAR_PHALANX_V3.md).
Solicitud de cinco juegos cerrada por unidades v89–v91; no declara terminado
el backlog general. v90CI38235738271success/Vercel7011722710Ready,
mobile-test avanzó a bb3ff46 sin force-push. Configuración Mine,16imágenes
ausentes y tareas generales del ledger siguen pendientes.

## Checkpoint v92 · catálogo, Slot y Dardos

Buscador eliminado con su lógica/CSS/QA obsoleta; catálogo completo, navegación,
estados de carga/fallo y reinicio comprobados a320px y en horizontal. Slot
pareja/7sinpareja más discreto; core1.0/goldens/recibos intactos, derrota20tiradas
y cero/10s/rotación/reinicio/abandono en ambas vistas. Dardos proyecta una
trayectoria3D balística de gravedad9.81m/s² y cámara pinhole hasta el impacto
autoritativo, sin retícula/proyección previa. Core3.0/gesto/20tiradas no cambian.
4672frames puros, QA táctil20tiradas:975/t4077 vertical y0/t4129 horizontal,
cancel/blur/reinicio/recibo sin errores.
Pendientes de esta solicitud: andamios complejos/conteos Birds; física de
lanzamiento y tapete plegable Roulette, en nuevas versiones competitivas.

## Checkpoint v93 · andamios Birds

[Reglas y evidencia](GALACTIC_BIRDS_V3.md). v92CI38285896654success;
Vercel aún no ha emitido despliegue para55b9332, acceso a webhooks403.
mobile-test conserva último checkpoint desplegado hasta Ready.
Siguiente: Roulette con trayectoria/cartesianas/gravedad y tapete plegable.

## Checkpoint v94 · cierre de la solicitud de cinco puntos

Buscador retirado, Slot fino, perspectiva Dardos, andamios/conteos Birds y
Roulette físico/tapete plegable, por unidades independientes.
[Reglas y QA Roulette](GALACTIC_ROULETTE_V2.md). Estados/contextos de v92/v93
se conservan; CI38285896654 y38286994753 success. Vercel no ha emitido nuevas
previews; lectura de webhooks403 y sin credenciales de inspección. No se
avanza mobile-test desde v91 sin Ready del mismo HEAD. GitHub/CI/despliegue
final se comprobarán antes de cerrar la publicación; no se afirma despliegue
por compilar.
Fase posterior del propietario: escenarios iniciales/registro durable y
verificación inmediata de ganadores, menús/inicios/ranking dentro de avatar y
pagos, respetando las dependencias existentes. Backlog general sigue abierto.
