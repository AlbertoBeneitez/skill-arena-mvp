# Bowling — especificación de juego

**Estado de conformidad:** CONFORME
**Azar en el resultado:** Ninguno · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `bowling` · 3.0.0 (VERIFIED) |
| Núcleo | `lib/verified/bowlingCore.v3.ts` · SHA-256 `463987f21f7f3b1f2b34f2d91af3c686fca4a3032982ff6d0fb3e4df6ff048c8` |
| Protocolo de entradas | `BOWLING_ACTIONS_V2` (`bowlingProtocol.v2.ts`), versión de entrada 2 |
| Origen | propio |

## 2. Descripción y modo de juego

Bolos de diez con reglamento oficial (plenos, semiplenos, bolas extra en el décimo marco). Pista de 32 m. El jugador
coloca la bola y traza el lanzamiento: la recta del trazo da la dirección (49 pasos), la curvatura el efecto (17 pasos)
y la velocidad final la potencia. Gana la mayor puntuación. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | No | La semilla se guarda pero el núcleo no la usa ni importa ningún generador |
| Contenido generado | No | Pista y bolos fijos |
| Emparejamiento, orden, desempate | No influyen | |
| Información oculta | No | |
| Reloj y refresco | No influyen | README §2 y §5 |
| Coma flotante | No | Física entera en µm/s con subpasos |

Conclusión: **sin azar**.

## 4. Modelo de simulación

120 ticks/s con subpasos enteros. Tick final máximo 108 000 (15 min). Hasta 1200 entradas. Fin: décimo marco completo.

## 5. Verificación y registro

Común (README §1–§5) con `BOWLING_CORE_V3`.

## 6. Puntuación, desempate y premios

Puntuación oficial de bolos (máximo 300). Desempate: regla online V2.

## 7. Integridad del cliente

Común. Al ser determinista, un programa podría probar lanzamientos en una copia (misma debilidad que Pinball). Con
entradas cuantizadas (49 × 17 pasos), el lanzamiento óptimo de cada tirada se puede calcular. Detección pendiente.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 3 fixtures `bowling@3.0.0` (273, 129, 105) |
| Variedad de resultados por destreza | «Bowling V3 OK»: 241/261/164/173/219/114 con distintos trazos |
| Independiente del refresco | Por diseño |
| Sin generador, reloj ni coma flotante | Pasa |

## 10. Declaración y responsabilidad

Redactada por la plataforma a partir del código. Pendiente de firma del propietario.
