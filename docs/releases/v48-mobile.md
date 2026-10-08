# v48-mobile · Perfil e información demo

Parte de v47-mobile validada. Unidad de presentación/UX sin cambios de reglas,
manifest, core, replay, scoring, proveedor, ledger ni persistencia de producción.

Perfil coherente con el chrome espacial sobrio; nombre largo sin overflow,
jerarquía/contraste, saldo y beneficio neto explícitamente demo. Añadir/retirar
10 € están etiquetados como operaciones ficticias; estado vacío y movimientos
anunciados. Acciones de edición/reset/logout describen su efecto existente.
Preferencia de sonido con estado accesible. La gráfica tenía cero separado de
su eje y normalización engañosa; ahora usa escala simétrica, cero en 50 y
valores positivos/negativos a cada lado. No se cambia ningún importe.

Términos/privacidad/almacenamiento/reglas muestran información distinta y
correcta de la demo, sin lenguaje de implementación ni aparentar condiciones,
consentimiento o privacidad de producción aprobados. Retorno al perfil explícito,
controles ≥44 px, selección accesible y textos legibles. Estilos scoped,
sin refactor de sistemas ni dependencias/assets nuevos.

Suite determinista histórica y typecheck/lint pasan. Build de producción,
diff check y QA táctil Chromium a 320×740/844×390: saldo demo, beneficio
inalterado por movimientos, persistencia de sonido, cuatro secciones, edición
de avatar/nombre, reinicio conservando saldo/movimientos y logout pasan.
Regresión de gráfica cero/negativa/positiva con fixture local aislado; catálogo,
entrada a juego, fallo de inicio y reintento preservados. Sin console/page errors
ni overflow. No se afirma QA física ni aceptación jurídica/comercial humana.

Pendientes centralizados en PRODUCT_BACKLOG_STATUS: cuatro INTEGRATED, calidad
Piano, grupos/restantes layouts y límites externos auth/PG/ledger/Mine privado.
No se activa competición/dinero real ni se declara backlog completo.
