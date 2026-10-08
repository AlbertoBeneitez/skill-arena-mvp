# v42-mobile · Star Phalanx

Parte de v41-mobile. Star Phalanx pasa de INTEGRATED 0.1 a core 1.0 VERIFIED con registry, lazy loader, lifecycle, protocolo y verificación comunes. Cinco oleadas/16 capas/100 enemigos; la siguiente capa espera a la anterior y se anuncia durante una pausa. Inicio de tres enemigos y ocho segundos sin fuego enemigo, tres escudos recuperables, geometrías en V/alternadas/escalonadas, blindaje y pares de rayos anunciados. Interrumpir una carga añade bonus autoritativo. Histórico integrado archivado; otros cores/adapters permanecen intactos.

Un dedo mantiene y arrastra para mover/disparar. La opción compartida pointerReleaseAction suelta el fuego por cancelación/blur mediante el lifecycle actual; no hay otro motor de inputs. Arte espacial original y fondo común, rayos/impactos/HUD físico, sonido inicial y feedback de impacto incluso a cero puntos. Consejo de escudos genérico correcto para Alien/Phalanx. Ninguna competición, identidad o dinero real activados.

Golden 43475 puntos/tick 13529, replay y render 60/120/144 Hz. Treinta y dos replays (31 victorias completas y una derrota del controlador), 128 aperturas seguras, capas/telegraphs/pares/interrupción/blindaje/shields, release/anti-toggle, inputs inválidos y cap compatible con body limit. Typecheck/lint, históricos, PostgreSQL local y build pasan.

QA táctil contra dibujo real: vertical 42875 puntos/tick 14486 y horizontal 42575/tick 16890, ambas con 100 enemigos/16 capas y tres escudos. Derrota, cancelación de gesto, pérdida de foco, resultado único, replay de servidor y reinicio; audio activado por toque emite SFX. Cero errores de página/consola. Regresiones Orb Burst/River Dash pasan. La prueba de jugador se corrigió para observar la formación real y conservar rutas seguras, sin modificar estado/seed/score ni incluir ese observador en producto. QA física humana recomendable.

Quedan siete INTEGRATED, Piano y pulido global; Mine privado candidato requiere integración pública segura. Posición autenticada/ranking real/pairing/ledger reales dependen de servicios todavía no elegidos. PRODUCT_BACKLOG_STATUS.md mantiene el backlog abierto.
