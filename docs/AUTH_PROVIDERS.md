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

## Bandeja de juegos enviados (v135, paquetes desde v142)

La bandeja de «Enviar juego» solo la ve el propietario. Para activarla:

1. Inicia sesión en la app con tu cuenta (por ejemplo, Google).
2. Abre `{AUTH_URL}/api/auth/session` en el mismo navegador y copia el valor `account`. Tiene la forma `google:1234567890`.
3. En Vercel, crea `STUDIO_OWNER_ACCOUNTS` con ese valor. Para varias cuentas, sepáralas con comas.
4. Las propuestas se guardan en PostgreSQL. Necesitas `DATABASE_URL` y las migraciones `db/migrations/004-studio-proposals.sql` y `005-studio-packages.sql` aplicadas a mano, en ese orden.
5. Mientras falte la base de datos, el formulario avisa de que la recepción aún no está abierta y no guarda nada en el servidor.

Después, vuelve a desplegar. En Juegos → ENVIAR JUEGO aparecerá la pestaña «Bandeja», con Probar, Descargar, Aprobar, Rechazar y Borrar (proceso completo en `docs/STUDIO_SUBMISSIONS.md`).

## Cuentas de jugador en el servidor (v191)

Con inicio de sesión **y** base de datos (`AUTH_SECRET` + `DATABASE_URL`), el alta funciona como funcionará con
jugadores reales:

1. El jugador entra con su proveedor (Google, …). La primera vez la app le pide nombre y avatar.
2. `POST /api/account` crea la cuenta: nombre único sin distinguir mayúsculas ni acentos (y sin nombres reservados),
   uno de los avatares de la app (las fotos propias se quedan en el móvil) y 25 ₡ ficticios de bienvenida.
3. El saldo vive en el servidor (`/api/wallet`): ingresar y retirar son ficticios, con la comisión del 5 %, y un mismo
   toque repetido no se cobra dos veces. Al recargar o cambiar de móvil, el saldo es el mismo.
4. `DELETE /api/account` borra la cuenta y todos sus movimientos (derecho de supresión).

La identidad del proveedor no se guarda tal cual: se guarda `HMAC(AUTH_SECRET, proveedor:id)`. Si cambia
`AUTH_SECRET`, las cuentas existentes dejan de encontrarse: no cambiarlo sin migrar.

Para activarlo en mobile-test (las tablas de la migración 007 se crean solas al arrancar desde v192): poner en Vercel (Preview)
`AUTH_SECRET`, `AUTH_URL` = dirección de mobile-test y las credenciales de Google; registrar en Google la URL de
retorno `{AUTH_URL}/api/auth/google/callback`.
