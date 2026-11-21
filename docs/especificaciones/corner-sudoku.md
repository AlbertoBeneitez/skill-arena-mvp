# Galoku — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** disposición generada, visible y común · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `corner-sudoku` · 4.0.0 (VERIFIED) |
| Núcleo | `lib/verified/cornerSudokuCore.v4.ts` · SHA-256 `b002b7032cde5b6190b2c9cb90d608e2a938d5f079c24582236a546acb248544` |
| Dependencia | `cornerSudokuCore.v3.ts` (geometría y contador de soluciones) · SHA-256 `d4d3ec2190e0f4e4287ca2576ea22fdeaa10350f75ef84af28422bb3194f5945` |
| Protocolo | `CORNER_SUDOKU_ACTIONS_V3`, versión de entrada 3 |
| Origen | propio |

## 2. Descripción y modo de juego

Dos retos por partida sobre dos lados de un sudoku (cinco cuadrados que comparten la esquina). Cinco minutos.
Contra otros jugadores con los mismos retos.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `createRng(seed:corner-sudoku4:i)` construye una solución por vuelta atrás y quita números |
| Contenido generado | **Sí, visible y común** | Dos sudokus con **solución única** comprobada (`countCornerSudokuSolutionsV3`) y 30 y 26 pistas. El jugador ve el tablero entero |
| Información oculta | No | Toda la información necesaria está en pantalla; la solución es deducible |
| Emparejamiento, orden, desempate | No influyen | Mismo manifiesto para los dos rivales |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | |

Conclusión: la semilla decide **qué** sudoku sale, pero los dos rivales reciben el mismo, lo ven entero y tiene una única
solución deducible. El resultado entre rivales depende de resolverlo bien y rápido. Si eso basta para no ser «azar» lo
decide un dictamen.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 36 000 (5 min). Hasta 3000 entradas: escribir, cambiar o borrar en una casilla.

## 5. Verificación y registro

Común (README §1–§5) con `CORNER_SUDOKU_CORE_V4`.

## 6. Puntuación, desempate y premios

Reto resuelto (todo el tablero correcto): 600 más bonus por rapidez. Si se acaba el tiempo, 15 por casilla bien
rellenada del reto en curso. Desempate: regla online V2.

## 7. Integridad del cliente

Común. Con la semilla, un programa resuelve el sudoku al instante; el servidor solo exige que no vaya más rápido que el
tiempo real. Hace falta detección de ritmo inhumano.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 3 fixtures `corner-sudoku@4.0.0` |
| Solución única y destreza | «Galoku V4 OK»: rápido 4094, lento 3905, parcial 90 |
| Sin reloj ni coma flotante | Pasa |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen sobre el contenido generado y de firma del propietario.
