# Registro de actividades de tratamiento — Galactic Games

> Borrador técnico (15-nov-2026, v189), **no es asesoramiento jurídico**. Describe lo que hace la app hoy. Debe
> revisarlo un profesional. Base: art. 30 RGPD. Mantener al día en cada versión que cambie qué datos se tratan.

**Responsable:** [NOMBRE O RAZÓN SOCIAL] · [NIF] · [DIRECCIÓN] · [CORREO DE PRIVACIDAD, pendiente del dominio].
Sin estos datos la política de privacidad incumple el art. 13 RGPD: **hay que completarlos antes de que juegue
nadie fuera del propietario** (ver tarea 6 del PDF, dominio y correo).

| # | Tratamiento | Datos | Interesados | Finalidad y base | Dónde | Conservación |
|---|---|---|---|---|---|---|
| 1 | Perfil local | Nombre de jugador, avatar, idioma, ajustes, saldo ficticio, historial | Jugadores | Prestar el servicio (contrato). No sale del navegador | Navegador del jugador | Hasta que el jugador lo borre (Ajustes › Borrar todos mis datos locales) |
| 2 | Partidas verificadas | Id. anónimo de sesión (hash), juego, versión, escenario, entradas ordenadas, resultado, horas | Jugadores | Verificar resultados, rankings, recuento para estudios, antifraude (contrato e interés legítimo) | Neon (Frankfurt) | Mientras hagan falta para resultados, rankings y reparto. **[Fijar plazo concreto con el asesor]** |
| 3 | Cookies técnicas | `arena_match_training` (24 h), sesión de Mine Grid (30 min), `ga_session` (30 días), `ga_oauth` (10 min) | Jugadores | Necesarias para el servicio (art. 22.2 LSSI, sin consentimiento) | Navegador | Lo indicado |
| 4 | Inicio de sesión (cuando se active) | Proveedor, id. de cuenta, nombre visible; sin correo | Jugadores | Identificar la cuenta (contrato) | Cookie firmada en el dispositivo | 30 días o al cerrar sesión |
| 5 | Propuestas de estudios | Nombre del estudio, correo de contacto, paquete del juego, informe | Estudios | Revisar, responder y pagar su parte (consentimiento `studio-proposal-2026-11-15`; luego contrato) | Neon (Frankfurt) | Rechazada: 30 días tras decidir. Sin revisar: 180 días. Aceptada: mientras el juego esté en la app. Borrado automático en `purgeExpiredProposals` |
| 6 | Seguridad y límites | IP, agente de usuario, rutas pedidas | Visitantes | Proteger el servicio (interés legítimo) | Vercel (registros y cortafuegos) | Según Vercel (registros ~1 día en Pro) |
| 7 | Copias de seguridad | Copia de la base (incluye 2 y 5) | Jugadores y estudios | Recuperar el servicio (interés legítimo) | GitHub Actions, cifradas con `age`; solo el titular puede abrirlas | 30 días |

**Encargados del tratamiento y transferencias**

| Proveedor | Para qué | Ubicación del dato | Transferencia internacional | Acción del titular |
|---|---|---|---|---|
| Vercel Inc. | Alojamiento, funciones (región `fra1`), cortafuegos | UE (Frankfurt) para funciones; registros según Vercel | EE. UU. — Vercel declara certificación en el Marco de Privacidad de Datos UE-EE. UU. | Aceptar/guardar el DPA de Vercel (cuenta › legal) |
| Neon (Databricks) | Base de datos PostgreSQL | UE (Frankfurt, `aws-eu-central-1`) | Empresa de EE. UU. | Aceptar/guardar el DPA de Neon |
| GitHub Inc. | Código y copias de seguridad cifradas | Según GitHub | EE. UU. — copias ilegibles sin la clave del titular | Aceptar/guardar el DPA de GitHub |

**Medidas de seguridad (art. 32):** conexiones cifradas (HTTPS/HSTS, TLS a la base); secretos solo como variables
sensibles; copias cifradas con clave pública; límites de peticiones; cookies HttpOnly/SameSite; borrado local completo;
plazos de borrado automáticos de propuestas; revisión de seguridad independiente (13-nov-2026,
`docs/releases/v186-saturn.md`); verificación en dos pasos de las cuentas del titular (tarea 2 del PDF).

**Pendiente antes de dinero real:** evaluación de impacto (EIPD) si hay verificación de identidad (KYC) o perfiles
antifraude a gran escala; contrato con el proveedor de KYC; plazos legales de conservación de datos de pago y de
prevención de blanqueo; delegado de protección de datos si el volumen lo exige.
