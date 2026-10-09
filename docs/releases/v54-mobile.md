# v54-mobile · Tablero Stack Shift

Parte de v53-mobile. Tablero de 256×512 frente a 240×480 píxeles lógicos;
piezas y feedback escalan coherentemente. Cabecera recolocada para conservar
suelo, siguiente pieza y controles separados. Fondo compartido preservado.
No cambian física, inputs, scoring, generación, core ni verificador V1.

Typecheck/lint, suite determinista/histórica/autoridad privada y build pasan.
QA Chromium táctil: victoria portrait de 18 filas/45 piezas (score 27048,
tick 3659), derrota landscape TOP_OUT (score 1164, tick 292), replay exacto,
submit único, doble tap sin piezas adicionales, reinicio con manifest nuevo.
Capturas inspeccionadas en ambas orientaciones, controles ≥44 px y sin cubrir
suelo/tablero, sin overflow ni errores de consola. QA usa manifest emitido sin
sustituir seed, target o resultado. Core histórico y golden intactos.

Pendientes nuevos de gameplay/métricas/datasets siguen en PRODUCT_BACKLOG;
esta unidad no los cierra. CI/Vercel se comprueban al publicar la rama.
