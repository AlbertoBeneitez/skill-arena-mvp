# Base de datos: revisión y bases para el futuro

Revisión del 15 de noviembre de 2026 (v193), sobre el código y las migraciones 001–007. Se aplican solas en Neon
desde v192.

## En pocas palabras

Lo que hay está bien hecho para lo que hace hoy: partidas que no se pueden reescribir, cuentas con nombre único y un
libro de movimientos que no se edita. Pero se construyó por piezas, y para lo que viene (grupos en el servidor,
rankings reales, pagos a estudios y, algún día, dinero real) faltan cuatro cimientos:

1. **Una sola persona, un solo identificador.** Hoy las partidas guardan un identificador anónimo del dispositivo y
   las cuentas guardan otro. No hay forma de saber qué partidas son de qué cuenta.
2. **Un libro de dinero de partida doble.** Hoy solo existe la cartera del jugador. No hay sitio para la comisión de
   la casa, el bote de una liga ni la parte de los estudios.
3. **Borrar una cuenta no puede borrar su historial de dinero.** Con dinero real, la ley obliga a conservarlo.
4. **Grupos, ligas y torneos en el servidor.** Hoy viven solo en el móvil de cada jugador.

Nada de esto cuesta dinero: cabe de sobra en el plan gratis de Neon.

## Qué hay hoy

| Tabla | Para qué | Estado |
|---|---|---|
| `arena_matches` | Partida competitiva: manifiesto (juego, versión, escenario, semilla) y los dos jugadores | Lista, apagada (`ALLOW_PERSISTED_MATCH_TRAINING`) |
| `arena_command_attempts` | Entradas de cada jugador en una partida por comandos | Lista, apagada |
| `arena_public_matches` | Partida pública de entrenamiento: plataforma, caducidad, resolución | Lista, apagada |
| `arena_public_attempts` | Intento de cada jugador: billete, registro, verificación, abandono | Lista, apagada |
| `arena_scenario_rotation` | Qué escenario toca para cada juego y versión | Lista, apagada |
| `studio_game_proposals` | Juegos que mandan los estudios (paquete incluido) | En uso |
| `arena_accounts` | Cuenta: identidad (HMAC), nombre, avatar, plataforma | En uso al entrar con Google |
| `arena_wallet_entries` | Movimientos de la cartera ficticia (bienvenida, ingreso, retirada) | En uso |
| `arena_schema_migrations` | Qué migraciones están aplicadas | En uso (v192) |

## Lo que ya está bien

- **Integridad.** Partidas, intentos resueltos y movimientos no se pueden reescribir, porque hay disparadores en la
  propia base. Además, los valores se comprueban en la base y no solo en el código: longitudes, formatos de hash y
  estados permitidos.
- **Concurrencia.** Las operaciones de dinero bloquean la cuenta (`FOR UPDATE`) y llevan una clave de petición
  única, así que un doble toque o un reintento no cobran dos veces. Además, «una partida en curso por jugador» es un
  índice único, no una comprobación en el código.
- **Privacidad.** No se guardan correos, ni el identificador del proveedor (solo un HMAC), ni nombres en las
  partidas.
- **Cambios seguros.** Las migraciones solo añaden, se aplican todas o ninguna, quedan anotadas con su huella y no se
  pueden modificar después de publicadas.
- **Vuelta atrás.** Neon permite volver a cualquier momento de las últimas 6 horas.

## Problemas, de más a menos importante

### 0. La copia diaria nunca se ha ejecutado

La copia cifrada (`.github/workflows/db-backup.yml`, v185) y la comprobación de salud (`health.yml`) están
programadas, pero GitHub solo ejecuta las tareas programadas desde la rama principal del repositorio (`main`), y
esas tareas solo existen en `mobile-test`. No hay ninguna ejecución, y además siguen pendientes sus secretos
(`BACKUP_DATABASE_URL` y la clave pública). Hoy, si se pierde algo de hace más de 6 horas, no hay copia.

**Arreglo (necesita al propietario):** llevar los dos ficheros a `main` y poner los secretos en GitHub. `main` es la
rama de producción, así que no la toco sin tu permiso. Es gratis: el repositorio es público.

### 1. La persona no está unida a sus partidas

Las partidas usan `player_id`, un identificador derivado de la cookie del dispositivo
(`lib/server/publicMatchHttp.ts`), y las cuentas usan `account_id`. Si un jugador borra las cookies o cambia de
móvil, sus partidas dejan de ser suyas. Por eso hoy no se puede:

- hacer un ranking real por persona;
- limitar las partidas que cuentan para pagar a los estudios (20 por jugador, juego y día);
- unir los resultados de un grupo.

**Arreglo:** todo lo nuevo apunta a `account_id`. Las partidas públicas guardan también la cuenta cuando hay sesión
(columna nueva, que se puede dejar vacía para las anónimas antiguas).

### 2. El dinero solo tiene un lado

`arena_wallet_entries` anota cuánto cambia la cartera del jugador, pero el otro lado no queda en ningún sitio:

- la comisión del 5 % aparece en euros dentro de una fila cuyo importe va en ₡;
- la comisión de la casa no tiene saldo propio;
- no hay bote de competición donde quede retenida la entrada hasta el final;
- no hay reparto para estudios.

Además, el tipo de movimiento solo admite `welcome`, `deposit` y `withdraw`: entrar en una liga o cobrar un premio
no se puede anotar.

**Arreglo: libro de partida doble.**

- Cada operación es una transacción con dos o más apuntes que suman cero en cada moneda. Por ejemplo, ingresar 10 €
  se anota así:
  - +10,00 € en la caja;
  - −0,50 € en la comisión;
  - −9,50 € en el cambio;
  - +9,50 ₡ en la cartera del jugador.
- Hay «cuentas de libro» para cada jugador, la casa, cada bote de competición y el fondo de estudios.
- La moneda va siempre escrita (`EUR` o `CC`).
- La base rechaza una transacción que no cuadre.

Es la forma estándar de llevar dinero, y lo que pedirá cualquier auditor.

### 3. Borrar la cuenta borra el historial de dinero

`arena_wallet_entries` tiene `ON DELETE CASCADE`: al ejercer el derecho de supresión desaparecen todos los
movimientos. Con dinero ficticio da igual. Con dinero real, la normativa de prevención del blanqueo y la fiscal
obligan a conservar las operaciones durante años (en España, del orden de 10 años; a confirmar con el abogado). El
RGPD lo permite como excepción por obligación legal.

**Arreglo:** borrar una cuenta significa anonimizarla:

- se borran el nombre, el avatar y la identidad;
- la fila queda como «cuenta eliminada»;
- el libro se conserva el plazo legal y después se purga.

Hay que decidirlo antes de que haya dinero real.

### 4. La plataforma está en la cuenta

`arena_accounts.platform` ata a la persona a móvil u ordenador, pero la regla (v179) es que no se mezclen las
**partidas ni los rankings**, no las personas. Quien juega en los dos tiene que poder usar la misma cuenta.

**Arreglo:** la plataforma va en cada partida y en cada resultado. En la cuenta queda solo como la plataforma de
alta.

### 5. Grupos, ligas, torneos y grupo contra grupo no tienen tablas

Toda la lógica (`lib/groupCompetition.ts`, `lib/groupVersus.ts`) es correcta y está probada, pero el estado vive en
el móvil. Sin tablas no hay códigos de grupo compartidos de verdad, ni búsqueda de rival, ni ranking de grupos por
dinero ganado.

**Arreglo:** guardar en el servidor:

- `arena_groups` y `arena_group_members`;
- `arena_competitions`: formato, configuración con su versión de reglas, plataforma y estado;
- `arena_competition_players`;
- los resultados de cada ronda, enlazados a partidas verificadas.

El bote es una cuenta del libro del punto 2.

### 6. El ranking real lee una vista que nadie crea

`lib/server/postgresRankingRepository.ts` lee `skill_arena_global_profit_ranking`, pero ninguna migración la crea.
No falla porque está apagado (`RANKING_READ_MODEL_READY`).

**Arreglo:**

- una tabla de resultados verificados con columnas propias: cuenta, juego, versión, plataforma, puntuación,
  resultado y fecha;
- resúmenes por día para los periodos 1S, 1M, 6M, 1A y Todo;
- la vista se crea en una migración sobre esas tablas.

### 7. Los juegos de estudios van dentro de la base

Cada propuesta guarda su paquete (hasta 4 MB) en la tabla. El plan gratis de Neon tiene 1 GB. Unos 200 paquetes
grandes lo llenan, y entonces la base deja de aceptar escrituras para todo, partidas y carteras incluidas. No cobra,
pero el juego se pararía.

**Arreglo inmediato (gratis):**

- tope total de espacio para paquetes, y al pasarlo se rechazan envíos nuevos;
- el borrado automático de v190 sigue: 30 días para los rechazados y 180 para los no revisados.

Más adelante los paquetes podrían ir a un almacenamiento de archivos. Eso puede tener coste, y no se hará sin tu
permiso.

### 8. Datos importantes dentro de JSON

El juego y la versión de una partida solo están dentro de `manifest`. Contar partidas por juego o hacer rankings
obliga a abrir el JSON de cada fila, y con muchas partidas eso es lento.

**Arreglo:** columnas `game_id`, `game_version`, `scenario_id` y `platform` (copiadas del manifiesto, que sigue
siendo la fuente) con índices.

### 9. Sin plazo de conservación de partidas

No hay índice por fecha en `arena_matches` ni tarea que borre partidas viejas. El registro de tratamientos (v190) lo
deja pendiente.

**Arreglo:** decidir el plazo (por ejemplo, 12 meses para partidas de entrenamiento), añadir el índice y una tarea
diaria.

### 10. La app entra con todos los permisos

La conexión de Neon es la del propietario de la base: la app podría borrar tablas. Para dinero real hacen falta dos
usuarios:

- uno para migraciones, que crea tablas;
- uno para la app, que solo lee y escribe filas, y no puede editar el libro.

### 11. Nombres mezclados

Las tablas usan tres prefijos distintos: `arena_`, `studio_` y `skill_arena_`. No afecta al funcionamiento; las
tablas nuevas usarán `arena_`.

## Modelo de destino

```
arena_accounts ─┬─ arena_group_members ── arena_groups
                │                              │
                ├─ arena_competition_players ─ arena_competitions ─ (grupo, o grupo contra grupo)
                │                              │
                ├─ arena_results ──────────────┘   (cada resultado verificado: juego, versión,
                │        │                          plataforma, puntuación, fecha; desde una partida)
                │        └─ arena_results_daily     (resúmenes para rankings y pagos a estudios)
                │
                └─ arena_ledger_accounts ── arena_ledger_postings ── arena_ledger_transactions
                       (jugador, casa, bote,      (importe y moneda;        (tipo, clave de petición
                        fondo de estudios)          suman cero)               única, fecha)
```

## Plan por fases

| Fase | Qué | Cuándo |
|---|---|---|
| 1 | `account_id` y columnas propias en partidas y resultados; plataforma por partida; borrar = anonimizar; índices; tope de espacio para paquetes | Siguiente ronda, cuando decidas los puntos de abajo |
| 2 | Grupos y competiciones en el servidor: buscar rival, ranking de grupos | Después de la fase 1 |
| 3 | Libro de partida doble con ₡ ficticios; se pasan los movimientos actuales | Antes de activar entradas en grupos del servidor |
| 4 | Usuarios separados en la base, plazos legales, auditoría externa; plan de pago de Neon solo si hace falta y con tu permiso | Antes de dinero real |

Cada fase se hace con migraciones que solo añaden, se aplican solas y se prueban antes contra una base vacía y contra
una copia de la actual.

## Decisiones del propietario

- **Copia diaria:** pendiente. Permitir llevar `db-backup.yml` y `health.yml` a `main`, y poner los secretos.

- **Borrar una cuenta:** pendiente. La propuesta es anonimizarla y conservar el libro.
- **Una cuenta en móvil y ordenador:** pendiente. La propuesta es que sí.
- **Plazo de conservación de partidas:** pendiente. La propuesta es 12 meses.
