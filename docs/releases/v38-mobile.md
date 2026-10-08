# v38-mobile · Resultados claros y ranking con avatares

Parte de v37-mobile. El resumen muestra puntuación y duración del intento, origen demo/replay o resultado local y feedback según finalización. Se elimina el percentil heurístico sin dataset. Se conserva el resultado original del core separado del estado de liquidación demo: práctica gratuita ahora cuenta un reto superado como éxito; partidas demo creadas que esperan rival muestran Marca registrada. No se modifican reglas, scoring, ledger real o contratos históricos.

Ranking: top tres del mismo snapshot/página, avatar local aprobado opcional y monograma de respaldo, posición propia explícitamente pendiente de identidad. Sin usuarios/beneficios inventados en producción. Puerto PostgreSQL acepta metadata opcional sin romper la vista original; URLs externas y keys fuera de whitelist se rechazan. Demo aislada y paginación exacta preservadas. Fondo exterior oscuro y resultados legibles.

Validación: suite determinista/históricos, typecheck/lint, PostgreSQL real local (vista anterior, avatar válido, corrupción/URL inválida, bigint/cursor/personal position), build. QA táctil de ranking en ambas orientaciones, tres páginas, fuente aislada y ausencia de overflow; resultado real Orb con score de servidor, victoria de práctica y reinicio; partida completa de Dardos y onboarding. Cero errores de página. QA física humana recomendable.

Identidad/ledger/dinero/competición reales siguen desactivados. Posición propia y ranking real requieren integraciones externas. Continúan pendientes los juegos enumerados en PRODUCT_BACKLOG_STATUS.md; no se declara completo el backlog.
