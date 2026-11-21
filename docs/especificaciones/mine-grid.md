# Mine Grid — especificación de juego

**Estado de conformidad:** NO CONFORME (la versión que se juega en Vercel)
**Azar en el resultado:** minas ocultas; tablero distinto para cada rival en Vercel · **Verificación:** resultado del móvil en Vercel

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `mine-grid` · 0.2.0 (INTEGRATED, `verification: "client-result"`) |
| Entrada | `components/games/MineGridEntry.tsx`: elige entre dos versiones según el servidor |
| Versión con autoridad | `MineGridAuthority` + `lib/verified/mineGridCore.v2.ts` · SHA-256 `a51be4cf253134315b9fefb92197b04a1c3699dedfaa69936dc4ba5dbccd2d1e` (y `mineGridCore.v1.ts` · `bf55cc854b042e7319673d9c61b0fc5214223a5e305ccbc920c471b355bd12ff`) |
| Versión antigua | `components/games/MineGrid.tsx` · SHA-256 `5e603e1b5c7ab06ffe553669a56da38bd0d589cd2520c1559b25cf4cfd6369a8` |
| Origen | propio |

## 2. Descripción y modo de juego

Buscaminas: destapar casillas y marcar minas. Si se resuelve, puntúa el tiempo; si no, las casillas bien asignadas.
El juego promete «Ambos jugadores reciben el mismo campo».

## 3. Azar y fuentes de variabilidad

Hay dos versiones y cuál se juega depende de una variable del servidor:

| | Versión con autoridad | Versión antigua |
|---|---|---|
| Cuándo se usa | Si el servidor tiene el modo oculto activado (`ALLOW_PERSISTED_HIDDEN_TRAINING`) | En cualquier otro caso. **Hoy en Vercel**, porque ese modo está apagado (`docs/STATE.md`) |
| Tablero | Generado por semilla del servidor, el mismo para los dos rivales | **Elegido al azar en el móvil** (`crypto.getRandomValues`) entre 8 tableros, en cada partida |
| ¿Mismo campo para los dos rivales? | Sí | **No.** Cada jugador puede recibir un tablero distinto |
| ¿Hay que adivinar? | No: el generador solo acepta tableros que se resuelven sin adivinar | No: los 8 tableros están elegidos para resolverse por deducción |
| Información oculta | Minas en el servidor; el móvil solo ve lo destapado | Minas en el propio móvil (y en el repositorio público) |
| Resultado | Lo calcula el servidor | Lo calcula el móvil |

Conclusión: la versión con autoridad es un juego de deducción con información oculta pero sin necesidad de adivinar,
igual para los dos rivales. **La versión que hoy se juega en Vercel incumple su propia promesa**: el tablero se sortea
por jugador, así que dos rivales no compiten en el mismo campo y el resultado de la comparación sí depende del azar.

## 4. Modelo de simulación

Con autoridad: núcleo puro V2, protocolo por pasos (`/api/hidden-game`), un solo campo continuo. Antigua: lógica en el
componente, tiempo con `performance.now()`.

## 5. Verificación y registro

Con autoridad: el servidor guarda el estado secreto, aplica cada comando y calcula el resultado. Antigua: ninguna.

## 6. Puntuación, desempate y premios

Resuelto: puntúa el tiempo (más rápido, más puntos). No resuelto: casillas bien asignadas. Las marcas no pueden inflar
la puntuación (prueba «Mine V1»).

## 7. Integridad del cliente

Con autoridad: correcta; el simulador probó revisiones viejas, comandos repetidos, casillas inventadas, partidas ajenas
y fugas de minas o semilla. Antigua: sin integridad.

## 8. Equidad económica

No debe jugarse por dinero ni con entrada mientras se use la versión antigua.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado (V2) | Pasa · fixture `mine-grid@2.0.0` |
| Sin adivinar | «Mine V2»: 1000 campos distintos reproducibles sin necesidad de adivinar |
| Autoridad privada | «Mine V2 private authority»: campo común, sin revelar la semilla |
| Bots en el simulador (con autoridad) | 6 partidas: 4 ganadas y 2 perdidas |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Para cumplir: activar la versión con autoridad en Vercel (decisión del propietario: toca
variables de entorno de producción) o, mientras tanto, que la versión antigua use la semilla de la partida para que los
dos rivales reciban el mismo campo.
