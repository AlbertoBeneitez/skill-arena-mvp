# v60-mobile · Juego visible, menos ruido

Parte de v59. Acciones de catálogo muestran el nombre de cada juego; etiquetas
accesibles conservan su intención. Retirados tutorial y coaching dentro de los
juegos y explicaciones redundantes de catálogo/resultados/avatar/grupos/ranking.
Feedback de acierto/error y estado, controles accesibles, información jurídica
y etiquetas de importes ficticios/datos de ejemplo permanecen. No se oculta el
alcance local ni se presenta autenticación/dinero real.

Saturno compartido incorpora halo, luna y profundidad orbital/nebular discretos;
misma simulación, sin RNG ni partículas adicionales que condicionen reglas.
Stack Shift ocupa 288×576 frente a 256×512; canvas y controles aprovechan espacio
antes dedicado a instrucciones. Suelo y botones no se solapan en vertical ni
horizontal. Portadas originales revisadas con temática orbital y sin textos
incrustados que duplican el nombre. No activos/copias/dependencias externas.

Tiempo de resultado formateado con tres decimales sobre timeMs reconstruido.
Esto no cambia scoring, comparación ni desempate: la métrica autoritativa de
avance requiere su propia unidad versionada. Cores/hashes históricos intactos.

Typecheck/lint, suite determinista/histórica y build pasan. QA Chromium nativa
sobre producción local: Stack victoria vertical (19 filas/44 piezas, score27548,
tick4226) y derrota horizontal TOP_OUT (8 piezas, score1302, tick333), reinicios,
submit/replay, suelo visible y controles>=44px. Integración de los 18 VERIFIED
en ambas orientaciones recibe 36 prefijos abandonados procesados por servidor,
sin instrucciones DOM ni errores de consola. No sustituye partidas completas
específicas de cada juego. Catálogo estrecho, orientación, entrada/avatar,
grupos y ranking mantienen estados, navegación e importes ficticios separados.

Registro legacy Mine/Solitaire, durabilidad/offline, métricas de avance, 1000
escenarios con rotación, River continuo, enemigo Sky y restantes cortes quedan
abiertos en PRODUCT_BACKLOG_STATUS.md. No se declaran todos los juegos pulidos
ni backlog terminado. CI/deployment ready requeridos antes de FF mobile-test.
