# Inicio de sesión con otras cuentas (estado v122)

**Activado por el propietario el 29-oct-2026.** El flujo OAuth 2.0 / OpenID Connect está en el servidor:

| Ruta | Qué hace |
|---|---|
| `GET /api/auth/{proveedor}/start` | Crea `state` y PKCE, los guarda 10 min en la cookie `ga_oauth` y redirige al proveedor. |
| `GET\|POST /api/auth/{proveedor}/callback` | Comprueba el `state`, canjea el código y lee el perfil mínimo. Guarda la sesión en `ga_session` (firmada HMAC-SHA256, 30 días) y vuelve a `/?auth=ok`. Apple vuelve por POST. |
| `GET /api/auth/session` | Devuelve qué proveedores están configurados y quién ha entrado: proveedor y nombre. |
| `DELETE /api/auth/session` | Cierra la sesión. También lo hacen «Cerrar sesión» y «Borrar mis datos». |

**Datos (RGPD):**
- Solo el identificador de la cuenta en el proveedor y el nombre visible. No se pide el correo.
- Nada se guarda en el servidor: la cookie firmada vive en el dispositivo del jugador.
- La política de privacidad y la de cookies de la app ya lo explican.

**Alcance:** identifica al jugador en este dispositivo. No activa dinero real, liquidación ni rankings reales.

## Cada botón se enciende solo cuando sus credenciales están en Vercel

Mientras falten, el botón muestra el aviso «aún no está activo» y la entrada sigue siendo la sesión local.
Las variables se configuran en Vercel → Project → Settings → Environment Variables (Production y Preview), **nunca en el repositorio**:

| Variable | Para qué |
|---|---|
| `AUTH_SECRET` | Obligatoria para todos. Cadena aleatoria de 32 caracteres o más, por ejemplo `openssl rand -base64 48`. |
| `AUTH_URL` | Recomendada. Dominio fijo de la app, por ejemplo `https://skill-arena-mvp-git-mobile-test-skill-arena2.vercel.app`. Las URL de retorno y las cookies se quedan siempre en él. |

URL de retorno que hay que registrar en cada proveedor: `{AUTH_URL}/api/auth/{proveedor}/callback`.

| Proveedor | Dónde se crea | Variables | Notas |
|---|---|---|---|
| Google | Google Cloud Console → APIs y servicios → Credenciales → ID de cliente OAuth (aplicación web) | `AUTH_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_SECRET` | Alcances `openid profile`. Pantalla de consentimiento en modo «Producción». |
| Apple | Apple Developer → Identifiers → Services ID (Sign in with Apple) + Keys (clave .p8) | `AUTH_APPLE_SERVICES_ID`, `AUTH_APPLE_TEAM_ID`, `AUTH_APPLE_KEY_ID`, `AUTH_APPLE_PRIVATE_KEY` (contenido PEM del .p8) | Requiere la cuenta de pago de Apple Developer. Apple solo envía el nombre la primera vez. |
| X | developer.x.com → proyecto → app → User authentication settings (OAuth 2.0, tipo «Web App») | `AUTH_X_CLIENT_ID`, `AUTH_X_CLIENT_SECRET` | Alcances `users.read tweet.read`. |
| Discord | discord.com/developers → Applications → OAuth2 | `AUTH_DISCORD_CLIENT_ID`, `AUTH_DISCORD_CLIENT_SECRET` | Alcance `identify`. |
| Microsoft | portal.azure.com → Microsoft Entra ID → Registros de aplicaciones (cuentas personales y de cualquier organización) | `AUTH_MICROSOFT_CLIENT_ID`, `AUTH_MICROSOFT_CLIENT_SECRET` | Tenant `common`, alcances `openid profile`. |

Después de guardar las variables, hay que volver a desplegar (Redeploy) para que entren en vigor.

## Bandeja de propuestas de juegos (v135)

La bandeja de «Proponer un juego» solo la ve el propietario. Para activarla:

1. Inicia sesión en la app con tu cuenta (por ejemplo, Google).
2. Abre `{AUTH_URL}/api/auth/session` en el mismo navegador y copia el valor `account`. Tiene la forma `google:1234567890`.
3. En Vercel, crea `STUDIO_OWNER_ACCOUNTS` con ese valor. Para varias cuentas, sepáralas con comas.
4. Las propuestas se guardan en PostgreSQL. Necesitas `DATABASE_URL` y la migración `db/migrations/004-studio-proposals.sql` aplicada a mano.
5. Mientras falte la base de datos, el formulario avisa de que la recepción aún no está abierta y no guarda nada en el servidor.

Después, vuelve a desplegar. En Juegos → «¿Tienes un juego?» → PROPONER UN JUEGO aparecerá la pestaña «Bandeja».
