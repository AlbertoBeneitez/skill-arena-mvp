# Stack Shift — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** secuencia oculta (2 piezas a la vista) · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `stack-shift` · 4.0.0 (VERIFIED) |
| Núcleo | `lib/verified/stackShiftCore.v4.ts` · SHA-256 `eb80cca3e452bc14d3a2ad70101b612cbe1ec3dc2254442fe83f8a47a9147525` |
| Protocolo | `STACK_SHIFT_ACTIONS` (`LEFT`, `RIGHT`, `ROTATE`, `SOFT_DROP`, `HARD_DROP`), versión de entrada 1 |
| Origen | propio |

## 2. Descripción y modo de juego

Puzle de piezas que caen en un tablero de 8 columnas: completar filas y no llegar arriba. Contra otros jugadores con la
misma secuencia de piezas.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `stackPiece(seed, n)`: las 4 primeras piezas salen de 3 fáciles; después, bolsas de las 6 piezas barajadas (`seededShuffle`) |
| Contenido generado | **Sí, común** | Misma secuencia para los dos rivales (lo dice el propio juego: «Ambos reciben la misma secuencia exacta») |
| Información oculta | **Sí** | El jugador ve la pieza actual y las **2 siguientes** (`StackShiftVerified.tsx`); el resto de la secuencia no se ve |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | |

Conclusión: la secuencia de piezas es aleatoria por semilla y en su mayor parte desconocida al decidir. Es igual para
los dos rivales y las bolsas de 6 limitan las rachas malas, pero **sí hay información futura que el jugador no
controla**. Es la categoría más difícil de defender como «sin azar»: cada partida es distinta y la suerte de una
secuencia afecta al resultado absoluto, aunque no a la comparación entre dos rivales de la misma partida.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 21 600 (3 min). Hasta 6000 entradas. Desde V4 el tablero empieza vacío.

## 5. Verificación y registro

Común con `STACK_SHIFT_CORE_V4`.

## 6. Puntuación, desempate y premios

120 por pieza colocada; filas: 900, 2200, 3900 o 6200 por 1 a 4 filas, más combo hasta 400; 6 por fila de caída
rápida. Desempate: regla online V2.

## 7. Integridad del cliente

Común. **Con la semilla, un programa conoce toda la secuencia futura**, que el jugador honrado no ve. Es exactamente lo
que resuelve el plan de información oculta por pasos (`docs/TRASPASO.md` §6, «Tower y Stack: siguiente pieza»).

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · fixture `stack-shift@4.0.0` (25 406) |
| Variedad de aperturas | «Stack Shift V4 OK»: 74 aperturas distintas, 31/32 victorias del bot |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
