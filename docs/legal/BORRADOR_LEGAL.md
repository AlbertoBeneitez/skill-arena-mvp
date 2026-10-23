# Borrador de textos legales — GALACTIC GAMES

> **Borrador técnico, no es asesoramiento jurídico.** Describe con exactitud lo que
> hace la aplicación hoy (23-oct-2026, entrenamiento con saldo ficticio, sin cuentas).
> Debe revisarlo un profesional antes de publicarlo. Rellena los campos `[ENTRE CORCHETES]`.

## 1. Datos del titular
- Titular / responsable del tratamiento: [NOMBRE O RAZÓN SOCIAL]
- NIF/CIF: [NIF]
- Domicilio: [DIRECCIÓN]
- Contacto (privacidad y soporte): [CORREO]

## 2. Términos de uso
1. **Qué es.** GALACTIC GAMES es una aplicación web de minijuegos de habilidad y entretenimiento. Todos los saldos, apuestas, entradas y beneficios son **ficticios**: no tienen valor económico, no se pueden retirar ni canjear y no se realizan pagos.
2. **Edad.** Galactic Slot simula un juego de azar con saldo ficticio y se ofrece solo a mayores de 18 años (confirmación al abrirlo). Galactic Roulette también simula apuestas con saldo ficticio y no lleva confirmación de edad por decisión del titular: conviene que el asesor valore si debe llevarla.
3. **Resultados.** En los juegos verificados el servidor repite la partida a partir de los datos enviados y calcula el resultado; si la verificación falla no se confirma victoria. El ranking mostrado es de ejemplo mientras no exista un servicio de datos configurado.
4. **Uso adecuado.** Prohibido manipular el cliente, enviar partidas falsificadas, automatizar el servicio de forma abusiva o intentar acceder a sistemas o datos ajenos.
5. **Disponibilidad.** Servicio ofrecido «tal cual», en fase de pruebas; puede cambiar o interrumpirse. Las versiones de juego ya publicadas conservan sus reglas.
6. **Propiedad intelectual.** El código, diseño y contenido original son del titular. Terceros y licencias: `THIRD_PARTY_NOTICES.md`.
7. **Cambios y ley aplicable.** [Fórmula de modificación de términos]. Legislación española; [juzgados competentes].

## 3. Política de privacidad
- **Responsable:** ver §1.
- **Datos que se tratan**
  - En tu navegador (no salen de él): nombre de jugador, avatar, preferencias, saldo ficticio, historial y estadísticas locales.
  - En el servidor, al jugar partidas verificadas: un identificador anónimo de sesión (derivado de una cookie aleatoria), el juego, la versión, la semilla/escenario, los inputs ordenados de la partida, el resultado y marcas de tiempo. **No se envían el nombre ni el avatar.**
  - El proveedor de alojamiento ([Vercel Inc.]) puede tratar datos técnicos de conexión (dirección IP, agente de usuario) en sus registros para operar y proteger el servicio.
  - No se piden datos de identidad, pago ni ubicación. Cámara, micrófono y geolocalización están bloqueados por la política de permisos.
- **Finalidades y base jurídica:** prestar el servicio y verificar partidas (ejecución del servicio / interés legítimo); seguridad y prevención de abuso (interés legítimo). No hay publicidad ni elaboración de perfiles.
- **Conservación:** [definir; con la configuración actual sin base de datos las partidas no se almacenan, y las cookies caducan a las 24 h]. Si se activa PostgreSQL: [plazo].
- **Destinatarios y transferencias:** proveedor de alojamiento y, en su caso, de base de datos ([Vercel / proveedor de BD]); posibles transferencias internacionales amparadas en [cláusulas contractuales tipo / Marco de Privacidad de Datos UE-EEUU].
- **Derechos:** acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [CORREO]; reclamación ante la Agencia Española de Protección de Datos (aepd.es). «Cerrar sesión local» borra los datos del navegador; no equivale a una solicitud de borrado en servidor, que se atiende por correo.
- **Menores:** servicio no dirigido a menores de 14 años; los juegos de azar simulado, solo a mayores de 18.

## 4. Política de cookies
No se usan cookies de analítica, publicidad ni terceros. Solo:

| Nombre | Tipo | Finalidad | Duración |
| --- | --- | --- | --- |
| `arena_match_training` | Técnica, propia, HttpOnly, SameSite=Strict | Identificar de forma anónima tu sesión de partidas verificadas | 24 horas |
| cookie de sesión de Mine Grid | Técnica, propia, HttpOnly, SameSite=Strict | Mantener el tablero privado de una partida | 30 minutos |

Almacenamiento local del navegador (no es una cookie): perfil, preferencias, saldo ficticio, confirmación de edad. Al ser estrictamente necesarias para el servicio solicitado, no requieren consentimiento (art. 22.2 LSSI); si más adelante se añade analítica, habrá que incorporar un aviso y gestor de consentimiento.

## 5. Reglas de competición
Ver pantalla «Reglas»: entrenamiento gratis sin saldo; otras modalidades con saldo ficticio y rivales simulados; verificación por replay en servidor; ranking de ejemplo separado del real.

## 6. Pendiente de decisión jurídica
- Si el «juego simulado» de Slot/Roulette exige algún aviso o clasificación adicional (tiendas de apps, normativa autonómica/estatal de juego).
- Texto definitivo cuando existan cuentas, base de datos, ranking real o cualquier premio.
- Registro de actividades de tratamiento y, si procede, contrato de encargado con el proveedor.
