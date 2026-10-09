# v56-mobile · Recuperación de Sky Hop

Parte de v55-mobile. V1 conservaba balizas destruidas tras una caída y volver
al checkpoint: romper la 13 y caer al 10 podía impedir continuar hasta TIME_LIMIT.
Reproducido con inputs legales y replay en ocho escenarios. V2 compone la misma
simulación y restaura brokenAt solo por delante del checkpoint tras perder una
vida sin finalizar. No resetea highest/score ni collected, evitando repetir vidas
u obtener puntos por alturas ya recorridas. Controles, física y generación base
se preservan; V1/verificador siguen intactos y reproducibles. Registry/loader/
manifest usan 2.0; adapter y hash de contenido nuevos, sin arquitectura paralela.

Typecheck/lint, tests completos deterministas/históricos/autoridad privada y build
pasan. Regresión V1 conserva el bloqueo, V2 completa los ocho recorridos tras
la caída; estado y score idénticos al replay. Fixture sin caídas de V1 se mantiene
idéntica en V2: score 43560, tick 6527, hash
sha256:84671cc0ef5cc442b3b54131097f1712b22f2383cda35e165e6db5fe3a86d0ee.
Incluye tests comunes de inputs inválidos y equivalencia de render.

QA táctil real Chromium con manifest emitido, sin inyectar seed/target/estado:
portrait fuerza una caída después de la baliza 13, observa pérdida de vida,
recupera y gana a altura 75 (score 43280, tick 6842). Landscape pierde FALLEN
(score 0, tick 438). Ambos replay verificados, submit único, cancel y blur liberan
inputs, resultados y reinicio con manifest nuevo, sin overflow ni errores de
consola. El helper de QA espera controles habilitados antes de probar Enter en
resultado: respeta la protección compartida introducida en v53.

La reparación es original sobre la adaptación con atribución MIT existente;
no importa código/assets de terceros adicionales. No activa auth/dinero/partidas
reales. El enemigo Sky sigue pendiente. CI/Vercel se comprueban al publicar.
