# Revisión de seguridad — v98

15 de octubre de2026. Revisión incremental de la auditoría v97, con pruebas
locales y PostgreSQL17 desechable; sin atacar endpoints/carteras de producción.

## Brechas corregidas en el circuito durable

| Riesgo | Corrección y evidencia |
| --- | --- |
| Resultado stateless sin consumo durable | Registro/recepción/replay/resultado persistidos, payload inmutable, claim recuperable y CAS; ocho envíos simultáneos conservan un solo verification_id/hash. |
| Manipular seed, identidad, score o ticket con la firma pública de entrenamiento | La ruta durable sólo acepta attempt_id e inputs. Identidad por capacidad HttpOnly; pertenencia y manifiesto se recuperan de PostgreSQL. Seed/score/ticket añadidos son rechazados. No autentica usuarios financieros. |
| Exponer actor como bearer de sesión | Cookie de32bytes aleatorios; actor es hash con dominio. Conocer el actor público de un ticket no permite construir la cookie válida. TestHTTP404 ante esa sustitución. |
| Ganar tras abandonar o volver a conectar tarde | Política nueva: salida/offline/ocultación→forfeit; ausencia de señal→lease20s, deadline absoluto y cierre irreversible. Un heartbeat tardío no revive. Consultar historial no renueva la lease. |
| Reescribir un registro, resultado, rival o resolución | Triggers PG y operaciones atómicas; asignaciónB únicamente NULL→id una vez. Históricos con dos participantes siguen inmutables. |
| Dos jugadores reclaman el mismo rival | Selección y asignación transaccionales; uno obtiene B y el otro crea su propio reto. No hay elección de seeds en body. |
| Crash después de recibir el registro | Registro y recepción guardados antes de simular. Reclamación temporal/CAS; recuperación usa la hora de recepción de DB incluso tras expirar el ticket durante la espera. |
| CSRF/lectura ilimitada del body | Origen/Host y Sec-Fetch-Site; cookie Strict; límite de streaming4096bytes al inicio y512KB al registro. Aplicado también a V2 legacy. Test local con Host real de Next, puerto interno diferente/proxyHTTPS/cookieSecure y origen atacante403. |
| Dar una oportunidad nueva automáticamente tras restaurar página | El transporte durable no reabre el intento en BFCache. Se conserva la derrota, y el usuario inicia explícitamente otro intento. |

No se encontraron cadenas de configuración/SQL del servidor en los chunks
estáticos inspeccionados (`DATABASE_URL`, `MATCH_SIGNING_SECRET`, advisory locks
ni constante de firma legacy). No se registraron cookies/tickets ni secretos.

## Dependencias

`pnpm audit --prod --json` detectó7avisos:2altos,4moderados,1bajo. Se actualizaron
Next16.3.6→16.3.8 y source-map-js1.2.1→1.2.2. El resolver también actualizó
React/ReactDOM a19.3.1 y tipos Node a26.6.5; se fijan todas las dependencias
actuales a versiones exactas, sin tags latest. Lockfile e integridad verificados.

Avisos corregidos: GHSA-68fv-2mgg-jv7q (source-map-js), GHSA-cjq9-62q9-8jv4
(SSRF Image Optimization), GHSA-3w37-wq28-93x7, GHSA-4jqv-mc3x-m676,
GHSA-39w2-rjm5-chcv, GHSA-f87g-xv8r-7p7x y GHSA-mcj8-r9mp-w47p (Next).
La aplicabilidad de cada ruta no implica que existiera explotación; se aplicó
la corrección de parche. Auditoría posterior:0avisos conocidos. Esto no es una
certificación de ausencia de vulnerabilidades futuras o de la infraestructura externa.

## Límites que impiden producción financiera

- La sesión es anónima y de entrenamiento, no OAuth ni KYC. Renovar una cookie
  evade la cuota por actor. Cuotas provisionales de almacenamiento no son WAF,
  detección de bots ni controles financieros por persona.
- Sin PG/configuración explícita, el frontend conserva entrenamiento legacy V2;
  no es durable. Con opt-in, un fallo PG es503, nunca fallback a memoria/stateless.
  No se configuró PG remoto ni se aplicaron migraciones fuera de localhost.
- Faltan roles/retención/backup, scheduler para barridos sin tráfico y pruebas de
  carga. La lease vencida no puede revivir, aunque el estado se materialice después
  en una consulta/barrido. No se afirma recepción de inputs nunca enviados por un
  teléfono que desapareció. No existe una garantía absoluta de entrega del navegador.
- Faltan identidad de producción, política operativa de claves, ledger, pagos,
  notificaciones/outbox y ranking financiero alimentado por liquidaciones.
- Los cores públicos siguen siendo automatizables; replay legal no prueba que
  haya jugado un humano. Mine/Solitaire necesitan su protección de secretos y
  migración específica. No se habilitan duelos de esos legacy ni grupos simulados.

La cartera del navegador sigue siendo ficticia. Ningún callback, importe o
resultado del cliente se convierte por esta entrega en una orden de dinero real.
Pruebas y semántica: [ADR007](adr/007-durable-public-attempts.md) y
[partidas durables](PERSISTED_PUBLIC_MATCHES.md).

El inicio idempotente se recupera antes de consultar la versión actual del catálogo:
un despliegue o retirada posterior no cambia el manifiesto emitido para esa clave.
Prueba PG explícita con cambio/retirada temporal de metadata y recuperación original.
El proxy de despliegue debe normalizar/sobrescribir los encabezados forwarded;
no se usan como identidad. El body de registro permite512KB para cubrir los
protocolos admitidos; hay test que impide declarar inputs válidos mayores que
el transporte y rechazo por streaming de un body excesivo.
