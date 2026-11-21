# Stack — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** variación generada, visible antes de actuar · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `precision-stack` · 4.0.0 (VERIFIED) |
| Núcleo | `lib/verified/precisionStackCore.v4.ts` · SHA-256 `d34fa393123cb02cfb74b696188899b6cdc875070be939176a9b658b296f4039` |
| Protocolo | una sola acción `DROP`, versión de entrada 3 |
| Origen | propio. Se usa también en los relevos de grupo (`stackRelay.v1.ts`) |

## 2. Descripción y modo de juego

Módulos que cruzan alternando los ejes X y Z; el jugador toca para acoplarlos. Se conserva solo la intersección real.
Gana la torre más alta; a igual altura, la mayor superficie. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `hashSeed(seed:stack3:nivel)` fija para cada bloque el sentido de entrada y una variación del periodo (9 escalones de 4 ticks) |
| Contenido generado | **Visible** | El bloque se mueve en pantalla antes de que el jugador decida |
| Información oculta | Parcial | Sentido y velocidad del bloque siguiente no se conocen hasta que aparece |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | |

Conclusión: la semilla varía la velocidad y el sentido de cada bloque, igual para los dos rivales y visible antes de
tocar.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 43 200 (6 min). Hasta 1000 entradas. El periodo baja de 448 a 192 ticks con la altura.

## 5. Verificación y registro

Común con el núcleo V4.

## 6. Puntuación, desempate y premios

Altura primero; la superficie apilada solo desempata a igual altura (regla online V2).

## 7. Integridad del cliente

Común. Con la semilla, el instante perfecto de cada bloque es calculable.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 2 fixtures `precision-stack@4.0.0` |
| Puntuación | «Stack V4 OK»: altura primero, desempate por superficie |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
