# v99-mobile — correcciones visuales y límites de la iteración

Base: v98-mobile / mobile-test, HEAD inicial 37e35e4e97a9f1d263c8501c5ad4715b77a5e106.

## Implementado
- Tower Drop: mordazas animadas por estado (cerradas en swing; abiertas tras soltar) sin modificar el núcleo V3.
- Dardos: diana ampliada al 109%; transformación inversa de coordenadas de apuntado, manteniendo el núcleo V3 y sus puntuaciones.
- Galactic Birds: arrastre del elástico limitado a 48 unidades y extremos dentro del lienzo, respetando gesto de lanzamiento y motor V5.

## No completado
- Birds: selección de proyectil con acciones autoritativas, estabilidad física ante apoyo marginal y escenarios más complejos. Requiere V6, protocolo, verificador, golden y replay; no editar V5.
- Roulette: rebotes del perímetro y disipación más natural. Requiere V4 y pruebas comparativas; mantener V3 para históricos.
- Roulette: interacción de ficha directamente en tapete y prueba táctil completa; el control actual permite seleccionar una apuesta al tocar la casilla del panel, pero su despliegue previo sigue siendo necesario.
- Mine Grid: el modo privado ya contiene escenarios variados, pero la exposición pública está condicionada a transporte durable PostgreSQL; el fallback legacy sigue fijo.
- Tower Drop: el bloque cae bajo V3; el descenso progresivo entre bloques no se ha rediseñado.

## Validación
Se confirmó Vercel success para da06cb0. No se ha ejecutado localmente lint, suite determinista, build ni QA en dispositivos. **No promover a mobile-test sin esas pruebas.** No activar juego con dinero real.
