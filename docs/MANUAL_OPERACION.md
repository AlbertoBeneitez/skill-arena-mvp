# Manual de operación — Galactic Games

Para el propietario. Explica qué hacer si algo va mal, sin depender de Claude ni de nadie más.
Actualizado: 13 de noviembre de 2026 (v186). Las tareas que solo puedes hacer tú están, paso a paso, en
`docs/TAREAS_PROPIETARIO.pdf`.

## Dónde está cada cosa

| Pieza | Dónde | Quién entra |
|---|---|---|
| Código | GitHub, `AlbertoBeneitez/skill-arena-mvp`. **Público**: cualquiera puede leerlo, nadie puede cambiarlo sin tu permiso | Tú |
| App | Vercel, equipo «Skill Arena», proyecto `skill-arena-mvp`. Servidores en Frankfurt | Tú |
| Base de datos | Neon, proyecto `galactic-games`, Frankfurt. Se abre desde Vercel › Storage › galactic-games › Open in Neon | Tú (a través de Vercel) |
| Copias de la base | GitHub › Actions › «Copia de la base de datos», cada día, cifradas con tu clave `age`, 30 días | Solo quien tenga tu clave privada |
| Cortafuegos | Vercel › Firewall: dos límites de peticiones (abajo) | Tú |

Ramas: `mobile-test` es tu banco de pruebas; `main` es producción. Cada versión tiene además su rama `vNNN-saturn`,
que nunca se borra ni se reescribe.

## 1. Una versión nueva ha roto algo

1. Vercel › proyecto › **Deployments**.
2. Busca la publicación anterior que funcionaba (cada una muestra su versión en el mensaje, por ejemplo «v184-saturn»).
3. Menú «⋯» › **Instant Rollback** (en producción) o abre esa dirección (en pruebas).

Tarda segundos y no toca la base de datos. Después, avisa a Claude para arreglarlo con calma.

## 2. Se han perdido o estropeado datos

**Si pasó hace menos de 6 horas:** Neon › proyecto › Postgres database › **Backup & Restore**. Restaura a un momento
anterior. El plan gratis guarda solo 6 horas.

**Si es más antiguo:**
1. GitHub › Actions › «Copia de la base de datos» › la ejecución del día que quieras › descarga el archivo
   `galactic-games-db-…`.
2. Ábrelo con tu clave privada de copias (`galactic-backup-key.txt`) y restáuralo en una base nueva. Las órdenes
   exactas están al principio de `scripts/db-backup.sh`; Claude puede guiarte sin ver la clave.

Sin la clave privada, las copias no se pueden abrir. Guárdala fuera del ordenador (gestor de contraseñas y un USB).

## 3. Aviso de mantenimiento (automático)

No tienes que hacer nada. Si el servidor falla (cualquier error 5xx, también si la base de datos no responde) o no
contesta dos veces seguidas mientras el jugador tiene conexión, la app tapa la pantalla con «En mantenimiento ·
volvemos muy pronto» en su idioma, lo comprueba cada minuto y lo quita sola al volver. Si la app se rompe al cargar,
enseña «algo ha fallado» con un botón para reintentar. Si cae Vercel entero no se puede mostrar nada desde Vercel:
consulta https://www.vercel-status.com.

## 4. Ataque o avalancha de tráfico

- Ya hay dos límites activos en Vercel › Firewall:
  - `/api/`: 300 peticiones por minuto por conexión.
  - Envíos de juegos de estudios: 10 cada 10 minutos por conexión.
- Si aun así hay un ataque: Vercel › Firewall › **Attack Challenge Mode** (pide verificación a todos los visitantes).
- Partidas por juego para pagar a los estudios: `/api/studio/plays?month=2026-11` con tu sesión de propietario.
- Una regla se quita o se pausa desde la misma pantalla; los cambios aplican al momento, sin publicar.
- Además, la app limita los envíos de estudios: 20 al día en total, 200 MB guardados como máximo y ningún archivo
  repetido, y los .zip trampa se rechazan antes de abrirlos.
- La recepción de juegos de estudios está **cerrada** hasta que exija iniciar sesión (revisión de seguridad del
  13-nov). Se abriría con la variable `STUDIO_UPLOADS_OPEN=1` en Vercel; no la pongas sin hablarlo antes.

## 5. Claves y secretos

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `DATABASE_URL` y `DATABASE_*` | Vercel › Environment Variables (sensibles: ni tú puedes leerlas) | La app habla con la base |
| `MATCH_SIGNING_SECRET` | Vercel | Firma de las partidas |
| `BACKUP_DATABASE_URL` | GitHub › Settings › Secrets › Actions | Copias diarias |
| Clave privada de copias (`galactic-backup-key.txt`) | Solo en tu gestor de contraseñas y un USB, nunca en internet | Abrir una copia |
| `VERCEL_BYPASS_TOKEN` (opcional) | GitHub › Secrets | Comprobación de salud mientras la web pida inicio de sesión |

Reglas:
- Nunca pegues un secreto en un chat, un correo ni un documento, tampoco a Claude.
- Si crees que una clave se ha filtrado: Neon › Roles › restablece la contraseña; luego actualiza la variable en
  Vercel y en GitHub y vuelve a publicar. Claude te guía sin ver la clave.
- Activa la verificación en dos pasos en GitHub, Vercel y la cuenta de Google con la que entras. Es la protección más
  importante de todas: quien entre en esas cuentas controla el proyecto entero.

## 6. Avisos

- Si falla la copia diaria o la comprobación de salud (cada 3 horas, `/api/health`), GitHub te envía un correo.
- Si falla una publicación, Vercel te envía un correo.
- Comprobación manual en cualquier momento: abre `/api/health` en la app. Debe decir `"ok":true` y `"database":"ok"`.

## 7. Lo que Claude nunca hace sin ti

Borrar ramas o etiquetas, cambiar la rama de producción, tocar variables de producción, cambiar la visibilidad o los
permisos del repositorio, activar dinero real, aplicar migraciones que borren datos, activar inicios de sesión en
producción y cualquier decisión importante de privacidad, seguridad o juego justo.

## 8. Configuración pendiente (una sola vez)

1. **Copias:** crea tu par de claves `age` (pasos en `docs/TAREAS_PROPIETARIO.pdf`), pásale a Claude solo la clave
   pública (`age1…`) para `ops/backup-recipient.txt`, y en GitHub › Settings › Secrets and variables › Actions crea
   `BACKUP_DATABASE_URL` con la cadena de Neon › Connect.
2. **Salud:** en la misma pantalla, pestaña Variables › `HEALTH_URL` con la dirección de producción terminada en
   `/api/health`.
3. Las copias y la comprobación de salud empiezan solas cuando `main` reciba la versión que las trae (al lanzar).
