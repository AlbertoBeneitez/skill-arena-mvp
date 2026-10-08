# v45-mobile · Descubrimiento y navegación

Parte de v44-mobile validada. Las tarjetas muestran nombre y reglas táctiles
breves extraídas del registry actual: Billar y Dardos ya no dependen de
interpretar una imagen sin título. Búsqueda local por nombre/categoría/habilidad,
sin distinción de mayúsculas o acentos, contador accesible, limpieza y estado
vacío. Cover lazy con dimensiones reservadas; ninguna lista paralela de juegos,
API, dependencia o asset nuevo.

Cabecera/navegación oscuras, controles de 44 px, foco visible, aria-current y
aria-pressed. Home compacta título/ranking, elimina saldos repetidos y deja
la ayuda como acceso opcional al final. Gratis sigue siendo el modo inicial;
retos/saldo/resultados económicos demo permanecen explícitamente ficticios.
La protección de gesto nuevo en resultados se aplica también a errores de
inicio. No cambia reglas, versiones de core, escenarios, scoring ni replay.

Validación: typecheck/lint, tests deterministas y goldens existentes, build de
producción y diff check. QA táctil a 320 px y horizontal: 20 nombres/instrucciones,
búsqueda por nombre/habilidad/acentos, vacíos, limpieza, sin overflow, botones
44 px, selección/navegación accesible, preparación con transporte retenido,
manifest Sky Hop 1.0, cancelación y error de inicio sin resultado inventado.
Ranking conserva aislamiento real/demo y tres páginas; onboarding conserva
identidad local/provider null. Derrota/reinicio de Sky Hop siguen verificados.
No se repiten tests PostgreSQL locales porque no hay cambios de persistencia;
CI mantiene su integración obligatoria. No se declara QA física ni backlog
completo. Perfil/grupos/legal y seis juegos INTEGRATED siguen pendientes.
