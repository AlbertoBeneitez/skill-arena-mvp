# v36-mobile · Dardos de habilidad

Parte de v35-mobile. Nuevo Dardos VERIFIED con quince lanzamientos y cinco fases: centro, sectores, dobles, triples y secuencia final. Impacto determinado por puntería/tick, nunca RNG de caída. Diana orbital original, retícula visible, objetivos destacados, feedback de impacto y controles fuera del tablero en horizontal.

El adaptador táctil común permite emitir los dos ejes cuantizados como inputs separados; engine y verificadores históricos intactos. No hay nuevo sistema de seeds/replay.

- Golden: 11801 puntos, tick 1720, replay/render 60/120/144 Hz.
- 64 secuencias completas; scoring, timeout, inválidos y doble tiro.
- QA táctil vertical: 8568 puntos/13 objetivos; horizontal: 10157/13 objetivos. Derrota voluntaria 0 puntos. Quince inputs THROW, cancelación/doble toque sin extras, resultado autoritativo y nuevo ticket al reiniciar. Cero errores de página.
- Regresiones táctiles reales de Orb Burst y River Dash pasan.
- Typecheck/lint, determinismo, build y repositorios PostgreSQL local validados.

Competición y dinero real desactivados. QA física humana recomendable. Pendientes pulido de los restantes juegos, Shot Gallery, Alien Dash, integración pública Mine y mejoras globales de resultados/ranking/UI.
