# Cuentas de inicio de sesión (estado v121)

La pantalla de inicio muestra «Continuar con Google», «Continuar con Apple» y, en «Otras cuentas», X, Discord y Microsoft.
**Ninguna está activada.** Al tocarlas aparece un aviso y la entrada que funciona sigue siendo la sesión local.
La configuración está en `lib/authProviders.ts`; `providerAvailability()` devuelve siempre `not-configured`.

## Qué falta para activarlas (requiere aprobación del propietario: AGENTS.md, «production auth activation»)
1. Un ADR de identidad que decida:
   - la librería o el backend de OAuth/OIDC;
   - cómo se guardan las sesiones;
   - cómo se vinculan con la identidad local, el consentimiento RGPD y el borrado.
2. Credenciales de cada proveedor, solo como variables de entorno de Vercel y nunca en el repositorio:

| Proveedor | Protocolo | Variables | Correo |
|---|---|---|---|
| Google | OpenID Connect | `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | verificado |
| Apple | OpenID Connect | `AUTH_APPLE_SERVICES_ID`, `AUTH_APPLE_TEAM_ID`, `AUTH_APPLE_KEY_ID`, `AUTH_APPLE_PRIVATE_KEY` | puede ser un relé privado u ocultarse |
| X | OAuth 2.0 | `AUTH_X_CLIENT_ID`, `AUTH_X_CLIENT_SECRET` | no garantizado |
| Discord | OAuth 2.0 | `AUTH_DISCORD_CLIENT_ID`, `AUTH_DISCORD_CLIENT_SECRET` | verificado |
| Microsoft | OpenID Connect | `AUTH_MICROSOFT_CLIENT_ID`, `AUTH_MICROSOFT_CLIENT_SECRET` | verificado |

3. URLs de retorno en el dominio de producción, rutas de servidor para iniciar y terminar el flujo, y pruebas con cuentas reales.

## Recomendación
- **Google y Apple como principales.** Apple exige «Iniciar sesión con Apple» en apps de iOS que ofrezcan otros inicios sociales.
- **Discord encaja con el público de juegos.** Microsoft cubre cuentas de Xbox y de trabajo.
- **X es posible pero menos práctico:**
  - no siempre da correo para recuperar la cuenta;
  - su API tiene niveles de acceso que pueden cambiar.
- **Un acceso por correo con enlace mágico** sería la alternativa sin red social.
