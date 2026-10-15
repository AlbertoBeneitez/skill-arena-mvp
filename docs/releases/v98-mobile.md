# v98-mobile — escenarios, intentos durables e idempotencia

Conecta el circuito común de21juegos VERIFIED a PostgreSQL, bajo opt-in de
entrenamiento. EscenariosV3 rotados por juego/versión en ciclos de1000, un único
manifiesto compartido A/B, plaza atómica e inicio idempotente. Registro recibido
antes del replay, resultado inmutable y recuperación entre workers; no se usa
el score/seed/ticket aportado por cliente. Cores y hashes históricos conservados.

Nueva política aprobada de derrota al abandonar/desconectar: heartbeat5s/lease20s,
clockDB, vencimiento irreversible y sin reanudación automática en BFCache. Un
registro terminal ya recibido conserva prioridad. La pérdida sin entrega no
inventa inputs. Resultados propios recuperables desde Avatar, incluso tras recarga;
disponibilidad y comparación de participantes proceden del servidor.

Revisión de seguridad: pertenencia/capacidad de sesión, CSRF y bodies acotados,
reintentos/CAS/trigger de inmutabilidad, servidor fuera del bundle cliente.
Next16.3.8/source-map-js1.2.2 corregidos y dependencias fijadas; auditoría posterior
sin avisos conocidos. [Hallazgos y límites](../SECURITY_REVIEW_V98.md).

Validación: tests PostgreSQL reales de1000escenarios, races/idempotencia/abandono,
21prefijos/replay/recuperación; suite determinista histórica, typecheck/lint y build.
QA nativa:20dardos por jugador, vertical/horizontal, mismo escenario/ganador real,
reenvío, desconexión/salida, reinicio y acceso ajeno/CSRF/tamaño/score falso.
Regresión ampliada de rotación, eventos BFCache e historial tras recarga superada;
Stack táctil completo validado en ambas orientaciones. Catálogo/Ranking legacy
se mantienen funcionales sin PG. Reintentos sobreviven cambios de versión/catálogo.

Pendiente externo: PostgreSQL alojado y migraciones explícitas para activar el
circuito en Vercel; sin ello permanece el entrenamiento legacy. No se habilitan
identidad/dinero real, ledger, grupos auténticos ni notificaciones. Mine/Solitaire
legacy siguen fuera de la competición. Detalle en [integración](../PERSISTED_PUBLIC_MATCHES.md).
CI/Vercel del HEAD publicado se comprobarán antes de promover mobile-test.
