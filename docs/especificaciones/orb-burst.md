# Orb Burst — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** secuencia oculta (1 orbe a la vista) · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `orb-burst` · 8.0.0 (VERIFIED) |
| Núcleo | `lib/verified/orbBurstCore.v8.ts` · SHA-256 `df0bff715d3d12d0db8a3fbc237c04578217d801e847ca7d68847009f2a9bd33` |
| Reglas y tablero | `lib/verified/orbBurstCore.v7.ts` · SHA-256 `ce12df7a17767a99f16f0254e8b03285ceb5c7ceb326bade8521c331fa8f2eb5` (V8 solo cambia la puntuación) |
| Protocolo | `ORB_ACTIONS_V6`, versión de entrada 6 |
| Origen | propio |

## 2. Descripción y modo de juego

Lanzador de burbujas clásico: seis colores, ocho filas. Grupos de 3 o más del mismo color explotan y los que quedan
colgando caen. Tras varios fallos baja una fila nueva y el techo baja con el reloj. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | Colores de cada fila nueva (`orb7:row`) y de cada orbe de munición (`orb7:ammo`) |
| Contenido generado | **Sí, común** | Mismas filas y misma munición para los dos rivales en la misma partida |
| Información oculta | **Sí** | Se ven el orbe cargado y el **siguiente**; los demás y las filas futuras no |
| Dependencia de las jugadas | Sí | La munición se elige entre los colores que quedan en el tablero, así que depende también de lo que haya hecho el jugador |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | Ángulos cuantizados y `roundDiv` |

Conclusión: igual que Stack Shift, hay información futura generada que el jugador no ve. Además, como la munición
depende del tablero, **dos rivales que juegan distinto reciben munición distinta** a partir de la primera diferencia.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 43 200 (6 min). Hasta 4000 entradas: apuntar, cambiar y disparar.

## 5. Verificación y registro

Común con `ORB_BURST_CORE_V8`.

## 6. Puntuación, desempate y premios

Número de orbes eliminados (explotados más caídos). Desempate: regla online V2.

## 7. Integridad del cliente

Común. Con la semilla, un programa conoce la munición futura y las filas nuevas.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 2 fixtures `orb-burst@8.0.0` (222 y 4) |
| Presentación sin efecto | 1602 casos de entrada, 6 pantallas, renderizador puro |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
