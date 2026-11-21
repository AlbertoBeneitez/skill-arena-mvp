# Pinball — especificación de juego

**Estado de conformidad:** CONFORME
**Azar en el resultado:** Ninguno · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `pinball` · 14.0.0 (`lib/games.ts`, estado VERIFIED) |
| Núcleo | `lib/verified/pinballCore.v14.ts` · SHA-256 `e481335685a3edf58221df01b43141a2dcd4d53a295b8d453322bb01f985846d` |
| Protocolo de entradas | `PINBALL_ACTIONS_V3` (`pinballProtocol.v3.ts`), versión de entrada 1 |
| Origen | propio (GALACTIC GAMES) |

## 2. Descripción y modo de juego

Mesa fija de 100 segundos, ampliables a 130 con tiempo extra. El jugador carga el muelle y maneja las palancas.
Gana la mayor puntuación. Se juega contra otros jugadores (duelos, grupos), con la misma mesa para todos.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | No | La semilla se guarda en el estado pero el núcleo no la usa: no importa `seeded.ts` ni llama a ningún generador |
| Contenido generado | No | Mesa, bumpers, rampas y dianas fijos en el código |
| Emparejamiento, orden, desempate | No influyen | Mismo muelle y mismas palancas: mismo resultado |
| Información oculta | No | Toda la mesa es visible |
| Reloj y refresco | No influyen | Ver README §2 y §5 |
| Coma flotante | No | Aritmética entera con subpasos (`integerMath`) |

Conclusión: **sin azar**. Dos partidas con las mismas entradas en los mismos ticks dan el mismo resultado en cualquier dispositivo.

## 4. Modelo de simulación

120 ticks/s con subpasos enteros. Tick final máximo 15 600 (130 s). Hasta 6000 entradas. Fin: se acaba el tiempo o
se pierden las bolas.

## 5. Verificación y registro

Común (README §1–§5). El servidor repite la partida con `PINBALL_CORE_V14` y calcula la puntuación.

## 6. Puntuación, desempate y premios

Suma de puntos de mesa: rampas (1500 a 6000, crecientes), órbitas 1500, agujero de gusano 3000, estrellas, bumpers,
postes, tirachinas, carriles, jackpots, súper jackpot, modos de 20 s, combos y multiplicador hasta ×5, más bonus final.
Detalle completo en `scoring` de `lib/games.ts`. Desempate: regla online V2 (puntuación y después tiempo, ADR 007).

## 7. Integridad del cliente

Común. **[INCIDENCIA crítica]** Al no haber azar, un programa con una copia del núcleo puede probar cada jugada antes
de hacerla. El simulador lo midió: 17 215 puntos con anticipación frente a 6 305 de un novato, y el servidor lo acepta.
No es azar, es trampa. Plan en `docs/TRASPASO.md` §6: política anti-bots y detección de comportamiento (v226).

## 8. Equidad económica

Duelos y grupos entre jugadores: el premio sale de las entradas. Ninguna estrategia gana contra la casa. Hoy todo es
saldo ficticio.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · prueba «Pinball V14 OK» con repetición de referencia |
| Independiente del refresco | Por diseño (README §2) |
| Sin generador, reloj ni coma flotante en el núcleo | Pasa (búsqueda en `lib/verified/`) |
| El servidor rechaza un resultado manipulado | Sí: el resultado lo calcula el servidor; el móvil no envía puntuación |
| Bots | Anticipación aceptada (ver §7) |

## 10. Declaración y responsabilidad

Redactada por la plataforma a partir del código. Pendiente de firma del propietario.
