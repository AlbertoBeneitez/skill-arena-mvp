# GALACTIC GAMES · Seguimiento tras v44-mobile

Este documento distingue validación técnica/jugable automatizada de aceptación comercial humana. No declara el backlog completo. La auditoría inicial está en V32_PRODUCT_AUDIT.md; checkpoints anteriores permanecen intactos.

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
| Solitaire Sprint | Fondo espacial preservado | Auditoría/pulido de jugabilidad y autoridad si corresponde |
| Sky Hop | v44: score farming reparado; core 1.0, 75 apoyos, tres sectores, balizas/móviles/impulsos/crumble, replay y touch QA | QA humana física |
| Metro Shift | Versión integrada existente preservada | Espacio, gameplay, progresión, core/replay |
| Brick Relay | Versión integrada existente preservada | Ritmo, profundidad, feedback, progresión, core/replay |
| Stack Shift | v41: base recortada reparada, apoyo/ghost, core 1.0 VERIFIED, bags/progresión, filas y QA táctil | QA humana física |
| Maze Rush | Versión integrada existente preservada | Gameplay móvil, progresión, mapas/core/replay |
| Star Phalanx | v42: 16 capas en cinco oleadas, geometrías, blindaje, cargas/pares, core/replay y QA táctil | QA humana física |
| Orbit Shift | Versión integrada existente preservada | Auditoría de calidad general y determinismo |
| Piano Rush | Core/verificador histórico preservado | Auditoría/QA de calidad general, conservar reglas estables |
| 2048 / Pulse Runner | Retirados del catálogo y loaders | No reintroducir |
| Rebranding | v33 identidad visible GALACTIC GAMES, metadata/manifest/icono original | Revisión global final de restos visibles |
| Login/onboarding | Entrada demo honesta, avatar/nombre, corto y sin tutorial obligatorio | QA humana; OAuth/auth real requiere proveedor, sin simularlo |
| UI global | Dirección visual preservada y componentes comunes | v38 resultados fieles al intento validados; quedan navegación/estados/fondos/layouts restantes |
| Ranking | Beneficio neto exacto, paginación/snapshot/PG, demo aislada y sección visible | v38 avatar/top UX validados; quedan posición propia autenticada y activar read model solo con datos reales |
| Escenarios / autoridad | Seeds/versiones públicas V3, históricos V2, privado V3/command CAS/PG desacoplado | Pairing real, identidad, consumo durable de resultados e integración HTTP producción |
| RGPD | Ideas compatibles, borrado idempotente de intentos, ningún ZIP sin licencia importado | Consentimiento versionado y política completa identidad/ledger/retención al integrar proveedores |

Los 20 juegos activos incluyen 14 VERIFIED por replay y seis INTEGRATED. Mine 1.0 es candidato adicional, no se cuenta como activo. PostgreSQL/identidad/ledger reales no están configurados; no se inventan usuarios, beneficios ni autenticación. Los datos demo no entran en el ranking de producción.
