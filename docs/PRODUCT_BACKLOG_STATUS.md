# GALACTIC GAMES · Seguimiento de v57-mobile

Este documento distingue validación técnica/jugable automatizada de aceptación comercial humana. No declara el backlog completo. Las pruebas físicas son seguimiento del propietario y no bloquean las siguientes iteraciones. La auditoría inicial está en V32_PRODUCT_AUDIT.md; checkpoints anteriores permanecen intactos.

| Juego / área | Trabajo preservado y validado | Pendiente |
| --- | --- | --- |
| Stack | Core 3D X/Z, recorte, replay; cámara/sombra/altura y partidas táctiles | QA humana y pulido según prueba real |
| Tower Drop | Péndulo reproducible, composición móvil, retirada de texto/score distractor | QA humana |
| Jet Stream | v40: V3, despegue asistido, apertura amplia, vuelo suave y progresión; V1/V2/replay/explosión preservados | QA humana física |
| Alien Dash | v39: V2, plataformas, centinelas anticipados, recogibles, escudos, dos minutos, replay y QA táctil | QA humana física y pulido según prueba real |
| Orb Burst | Launch reparado, touch/cancel, core/replay V1, etapas y feedback | QA humana física |
| Shot Gallery | v37: colores/formas/números/combinaciones, suma autoritativa, 12 pruebas y replay | QA humana física |
| River Dash | V2: primera línea superable, carry/colisiones, sectores progresivos y QA | QA humana física |
| Serpent | Wrap cuatro bordes, nueva estética, core/replay y QA | QA humana física |
| Billar | v35: cinco mesas, física/potencia, escenario, replay, partidas móviles | QA humana física |
| Dardos | v36: quince lanzamientos, objetivos progresivos, skill/timing, replay y QA | QA humana física |
| Mine Grid | v34: candidato privado 1.0, cinco sectores resolubles, autoridad común/PG y QA local | Integración pública segura; catálogo todavía 0.1 |
| Solitaire Sprint | Fondo espacial preservado; auditoría incremental v52 | Cierre prematuro al revelar tablero, victoria de 52 bases marcada como derrota y score repetible en traslados; nuevo core versionado y autoridad privada común antes de promoción |
| Sky Hop | v44: score farming reparado; core 1.0, 75 apoyos, tres sectores, balizas/móviles/impulsos/crumble, replay y touch QA | QA humana física |
| Metro Shift | v46: core 1.0 VERIFIED, 60 grupos/tres sectores, ocho segundos de aprendizaje, saltos/vallas/muros, recargas/escudos y replay | QA humana física |
| Brick Relay | v47: core 1.0 VERIFIED, cuatro sectores/69 bloques, rebotes dirigidos, blindajes/explosivos/móviles, recuperación y replay; QA táctil completa | QA humana física |
| Stack Shift | v41: base recortada reparada, apoyo/ghost, core 1.0 VERIFIED, bags/progresión, filas y QA táctil | QA humana física |
| Maze Rush | v49: inicio en muro reparado; core 1.0 VERIFIED, tres sectores conectados, nodos/pulsos, perseguidores BFS, escudos, turn buffering/STOP y replay; partidas táctiles completas | Seguimiento en móviles físicos |
| Star Phalanx | v42: 16 capas en cinco oleadas, geometrías, blindaje, cargas/pares, core/replay y QA táctil | QA humana física |
| Orbit Shift | v50: apertura reparada; core 1.0 VERIFIED, 60 pasos/3 sectores, arcos combinados, recargas/escudos, transición radial y replay; QA táctil completa | Seguimiento en móviles físicos |
| Piano Rush | v51: V2 VERIFIED, 48 notas/tres sectores, ocho notas de aprendizaje, ventanas progresivas, escudos/combo/precisión, reloj común y replay; partidas táctiles completas | Seguimiento en móviles físicos |
| 2048 / Pulse Runner | Retirados del catálogo y loaders | No reintroducir |
| Rebranding | v33 identidad visible GALACTIC GAMES, metadata/manifest/icono original | Revisión global final de restos visibles |
| Login/onboarding | Entrada demo honesta, avatar/nombre, corto y sin tutorial obligatorio | QA humana; OAuth/auth real requiere proveedor, sin simularlo |
| UI global | v38 resultados fieles; v45 catálogo/navegación; v48 perfil y secciones demo legibles, saldos/acciones explícitos, eje de beneficio corregido, preferencias/reset/logout QA | v52 grupos demo explícitos, formularios/feedback/portapapeles y QA vertical/horizontal; quedan restantes layouts y grupos reales con identidad/persistencia; revisión jurídica de producción al configurar servicio; QA humana |
| Ranking | Beneficio neto exacto, paginación/snapshot/PG, demo aislada y sección visible | v38 avatar/top UX validados; quedan posición propia autenticada y activar read model solo con datos reales |
| Escenarios / autoridad | Seeds/versiones públicas V3, históricos V2, privado V3/command CAS/PG desacoplado | Pairing real, identidad, consumo durable de resultados e integración HTTP producción |
| RGPD | Ideas compatibles, borrado idempotente de intentos, ningún ZIP sin licencia importado | Consentimiento versionado y política completa identidad/ledger/retención al integrar proveedores |

Los 20 juegos activos incluyen 18 VERIFIED por replay y dos INTEGRATED. Mine 1.0 es candidato adicional, no se cuenta como activo. PostgreSQL/identidad/ledger reales no están configurados; no se inventan usuarios, beneficios ni autenticación. Los datos demo no entran en el ranking de producción.

## Iteración v53

Entrada/logo/avatar y acceso a ranking simplificados; catálogo sin nombres
repetidos, Saturno común mejorado, proyecciones Stack/Tower retiradas, nodos Maze
más grandes. Dardos 2.0 usa swipe ascendente; V1 permanece verificable. Resultado
protegido contra toques que llegan durante la transición. Evidencia incremental:
[release v53](releases/v53-mobile.md).

Esta revisión no cierra las nuevas solicitudes de gameplay: Jet menos alineado,
River más fluido, añadir enemigo Sky (baliza reparada en v56), datasets Mine/Solitaire, Maze más fácil/continuo (arena Stack Shift ampliada en v54).
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
