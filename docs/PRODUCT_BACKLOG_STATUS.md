# GALACTIC GAMES · Seguimiento de v66-mobile

Este documento distingue validación técnica/jugable automatizada de aceptación comercial humana. No declara el backlog completo. Las pruebas físicas son seguimiento del propietario y no bloquean las siguientes iteraciones. La auditoría inicial está en V32_PRODUCT_AUDIT.md; checkpoints anteriores permanecen intactos.

| Juego / área | Trabajo preservado y validado | Pendiente |
| --- | --- | --- |
| Stack | Core 3D X/Z, recorte, replay; cámara/sombra/altura y partidas táctiles | v65: texto de ejes retirado, orientación visual conservada; seguimiento físico |
| Tower Drop | Péndulo reproducible, composición móvil, retirada de texto/score distractor | v65: base y capas inferiores visibles con cámara/perspectiva compacta; QA táctil/reinicio verificados; seguimiento físico |
| Jet Stream | v63: V4 VERIFIED, dos pasos de aprendizaje y desplazamientos de altura crecientes/reflejados, ventanas/vidas/dobles pasos inmutables, avance por portales, replay y QA táctil de180s. V1/V2/V3 archivados | Seguimiento físico; rotación1000 sin repetición entre partidas y comparación común pendientes |
| Alien Dash | v39: V2, plataformas, centinelas anticipados, recogibles, escudos, dos minutos, replay y QA táctil | Más ritmo/variedad/profundidad en nueva versión; retirar instrucción residual AGACHAR; seguimiento físico |
| Orb Burst | Launch reparado, touch/cancel, core/replay V1, etapas y feedback | V2 para eliminar cambios de etapa y conservar progresión continua; QA física |
| Shot Gallery | v37: colores/formas/números/combinaciones, suma autoritativa, 12 pruebas y replay | QA humana física |
| River Dash | v62: V3 VERIFIED, campo único de65filas, descansos intercalados, carry/fases permanentes, avance válido sin farming, cámara continua y QA táctil completa. V1/V2 archivados | Seguimiento físico; comparación común por avance/tiempo pendiente |
| Serpent | Wrap cuatro bordes, nueva estética, core/replay y QA | QA humana física |
| Billar | Cinco mesas V1, física/potencia, escenario, replay, partidas móviles | V2 sin reinicios de mesa/niveles; conservar profundidad/precisión; QA física |
| Dardos | v36: quince lanzamientos, objetivos progresivos, skill/timing, replay y QA | QA humana física |
| Mine Grid | Candidato privado V1 resoluble, autoridad común/PG y QA local | V2 continuo y datasets versionados; integración pública segura y registro; catálogo todavía 0.1 |
| Solitaire Sprint | Fondo espacial preservado; auditoría incremental v52 | Cierre prematuro al revelar tablero, victoria de 52 bases marcada como derrota y score repetible en traslados; nuevo core versionado y autoridad privada común antes de promoción |
| Sky Hop | V2: recuperación tras baliza rota sin farming; 75 apoyos continuos, balizas/móviles/impulsos/crumble y replay/touch | Añadir enemigo marciano determinista; QA física |
| Metro Shift | v46: core 1.0 VERIFIED, 60 grupos/tres sectores, ocho segundos de aprendizaje, saltos/vallas/muros, recargas/escudos y replay | QA humana física |
| Brick Relay | V1 VERIFIED, 69 bloques, rebotes dirigidos, blindajes/explosivos/móviles, recuperación y replay/touch | V2 sin cambios de tablero ni pausas de sector; QA física |
| Stack Shift | v41: base recortada reparada, apoyo/ghost, core 1.0 VERIFIED, bags/progresión, filas y QA táctil | QA humana física |
| Maze Rush | v64: V3 VERIFIED, 70 nodos continuos, más margen para girar/perseguidores, avance por nodos, confirmación de input/pulso y tablero horizontal ampliado; victorias/derrotas/reinicio táctiles y replay. V1/V2 archivadas | Seguimiento físico y pulido según uso real |
| Star Phalanx | V1: 16 capas, geometrías, blindaje, cargas/pares, core/replay y QA táctil | V2 con capas continuas sin cortes/limpieza intermedia; QA física |
| Orbit Shift | v50: apertura reparada; core 1.0 VERIFIED, 60 pasos/3 sectores, arcos combinados, recargas/escudos, transición radial y replay; QA táctil completa | Seguimiento en móviles físicos |
| Piano Rush | v61: V3 VERIFIED, 48 notas continuas, ocho de aprendizaje, precisión/ritmo graduales, escudos/combo; V1/V2 archivados y QA táctil completa | Seguimiento físico; métrica autoritativa de avance común pendiente |
| Memoria | v66: V1 VERIFIED, tablero único6×4/12parejas, preview legal8s, dos errores protegidos/ocho vidas, touch al soltar, replay/avance autoritativo; win/error/timeout/reinicio/rotación QA | Seguimiento físico; replay público no prueba memoria humana ni evita automatización |
| Fondo/música comunes | v65: imagen original optimizada y alineada a viewport, cubre extremos/letterbox; fallback, una caché/blit; mute síncrono cancela voces/resume pendiente, QA audio nativo | Seguimiento físico de FPS/Safari y dirección artística según uso real |
| 2048 / Pulse Runner | Retirados del catálogo y loaders | No reintroducir |
| Rebranding | v33 identidad visible GALACTIC GAMES, metadata/manifest/icono original | Revisión global final de restos visibles |
| Login/onboarding | Entrada demo honesta, avatar/nombre, corto y sin tutorial obligatorio | QA humana; OAuth/auth real requiere proveedor, sin simularlo |
| UI global | v38 resultados fieles; v45 catálogo/navegación; v48 perfil y secciones demo legibles, saldos/acciones explícitos, eje de beneficio corregido, preferencias/reset/logout QA | v52 grupos demo explícitos, formularios/feedback/portapapeles y QA vertical/horizontal; quedan restantes layouts y grupos reales con identidad/persistencia; revisión jurídica de producción al configurar servicio; QA humana |
| Ranking | Beneficio neto exacto, paginación/snapshot/PG, demo aislada y sección visible | v38 avatar/top UX validados; quedan posición propia autenticada y activar read model solo con datos reales |
| Escenarios / autoridad | Seeds/versiones públicas V3, históricos V2, privado V3/command CAS/PG desacoplado | Pairing real, identidad, consumo durable de resultados e integración HTTP producción |
| RGPD | Ideas compatibles, borrado idempotente de intentos, ningún ZIP sin licencia importado | Consentimiento versionado y política completa identidad/ledger/retención al integrar proveedores |

Los 21 juegos activos incluyen 19 VERIFIED por replay y dos INTEGRATED. Mine 1.0 es candidato adicional, no se cuenta como activo. PostgreSQL/identidad/ledger reales no están configurados; no se inventan usuarios, beneficios ni autenticación. Los datos demo no entran en el ranking de producción.

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
