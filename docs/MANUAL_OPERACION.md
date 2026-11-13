# Manual de operación — Galactic Games

Para el propietario. Explica qué hacer si algo va mal, sin depender de Claude ni de nadie más.
Actualizado: 13 de noviembre de 2026 (v185).

## Dónde está cada cosa

| Pieza | Dónde | Quién entra |
|---|---|---|
| Código | GitHub, `AlbertoBeneitez/skill-arena-mvp`. **Público**: cualquiera puede leerlo, nadie puede cambiarlo sin tu permiso | Tú |
| App | Vercel, equipo «Skill Arena», proyecto `skill-arena-mvp`. Servidores en Frankfurt | Tú |
| Base de datos | Neon, proyecto `galactic-games`, Frankfurt. Se abre desde Vercel › Storage › galactic-games › Open in Neon | Tú (a través de Vercel) |
| Copias de la base | GitHub › Actions › «Copia de la base de datos», cada día, cifradas, 30 días | Tú |
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
2. Ábrelo con tu frase de las copias (`BACKUP_PASSPHRASE`) y restáuralo en una base nueva. Las órdenes exactas están
   al principio de `scripts/db-backup.sh`; Claude puede hacerlo contigo sin ver la frase.

Sin la frase de las copias, las copias no se pueden abrir. Guárdala fuera del ordenador (gestor de contraseñas).

## 3. Ataque o avalancha de tráfico

- Ya hay dos límites activos en Vercel › Firewall:
  - `/api/`: 300 peticiones por minuto por conexión.
  - Envíos de juegos de estudios: 10 cada 10 minutos por conexión.
- Si aun así hay un ataque: Vercel › Firewall › **Attack Challenge Mode** (pide verificación a todos los visitantes).
- Una regla se quita o se pausa desde la misma pantalla; los cambios aplican al momento, sin publicar.
- Además, la app limita los envíos de estudios: 20 al día en total, 200 MB guardados como máximo y ningún archivo
  repetido. Así nadie puede llenar la base gratis.

## 4. Claves y secretos

| Secreto | Dónde vive | Para qué |
|---|---|---|
| `DATABASE_URL` y `DATABASE_*` | Vercel › Environment Variables (sensibles: ni tú puedes leerlas) | La app habla con la base |
| `MATCH_SIGNING_SECRET` | Vercel | Firma de las partidas |
| `BACKUP_DATABASE_URL`, `BACKUP_PASSPHRASE` | GitHub › Settings › Secrets › Actions | Copias diarias |
| `VERCEL_BYPASS_TOKEN` (opcional) | GitHub › Secrets | Comprobación de salud mientras la web pida inicio de sesión |

Reglas:
- Nunca pegues un secreto en un chat, un correo ni un documento, tampoco a Claude.
- Si crees que una clave se ha filtrado: Neon › Roles › restablece la contraseña; luego actualiza la variable en
  Vercel y en GitHub y vuelve a publicar. Claude te guía sin ver la clave.
- Activa la verificación en dos pasos en GitHub, Vercel y la cuenta de Google con la que entras. Es la protección más
  importante de todas: quien entre en esas cuentas controla el proyecto entero.

## 5. Avisos

- Si falla la copia diaria o la comprobación de salud (cada 3 horas, `/api/health`), GitHub te envía un correo.
- Si falla una publicación, Vercel te envía un correo.
- Comprobación manual en cualquier momento: abre `/api/health` en la app. Debe decir `"ok":true` y `"database":"ok"`.

## 6. Lo que Claude nunca hace sin ti

Borrar ramas o etiquetas, cambiar la rama de producción, tocar variables de producción, cambiar la visibilidad o los
permisos del repositorio, activar dinero real, aplicar migraciones que borren datos, activar inicios de sesión en
producción y cualquier decisión importante de privacidad, seguridad o juego justo.

## 7. Configuración pendiente (una sola vez)

1. **Copias:** en GitHub › Settings › Secrets and variables › Actions › New repository secret:
   - `BACKUP_DATABASE_URL`: la cadena de Neon › Connect (con la contraseña).
   - `BACKUP_PASSPHRASE`: una frase larga que solo tú conozcas.
2. **Salud:** en la misma pantalla, pestaña Variables › `HEALTH_URL` con la dirección de producción terminada en
   `/api/health`.
3. Las copias y la comprobación de salud empiezan solas cuando `main` reciba la versión que las trae (al lanzar).
