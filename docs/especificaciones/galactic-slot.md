# Slot — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** disposición generada, visible y común · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `galactic-slot` · 4.0.0 (VERIFIED) |
| Núcleo | `lib/verified/galacticSlotCore.v4.ts` · SHA-256 `fcb4d459675077ce4c881583edc353bd7215e28159d7080e119026e275629f17` |
| Generador | `lib/deterministic/seeded.ts` · SHA-256 `612499ac710879c06bfd01a0390c7d81358a4f3bb9430b93dfe54fe7b1ab1046` |
| Protocolo | `SLOT_ACTIONS`, versión de entrada 4 |
| Decisión del propietario | v192: el Slot **no** es juego de azar («las tiras salen de la semilla y el jugador elige los movimientos»), así que es juego por dinero. Recogido en `lib/games.ts` |

## 2. Descripción y modo de juego

Tres tiras de siete símbolos. El jugador empieza con 100 fichas ficticias; cada tirada cuesta 5. Antes de tirar elige
cuánto avanza cada tira (de −3 a +3 posiciones, no las tres a 0). Máximo tres minutos. Gana el saldo final más alto.
Contra otros jugadores con las mismas tiras.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `seededShuffle` ordena los 7 símbolos de cada tira y `createRng` fija la posición inicial |
| Contenido generado | **Sí, visible y común** | El juego dibuja las tiras completas (`GalacticSlot.tsx`). El jugador ve dónde caerá cada tira antes de tirar |
| Resultado de cada tirada | **No aleatorio** | Destino = posición actual + avance elegido. El núcleo lo declara: `outcome: "REEL_POSITIONS_NOT_RNG"` |
| Información oculta | No | |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | |

Conclusión: el único elemento generado es el orden inicial de las tiras, visible y común. Cada tirada es una decisión con
resultado conocido. Hay estrategia real: en las pruebas, un bot que planifica termina con 1045 fichas frente a 350 de uno
que no.

**[RIESGO]** Aunque el mecanismo no sea aleatorio, el nombre «Slot», la apariencia de tragaperras y el lenguaje de
fichas y tiradas hacen que un banco, una pasarela de pago o un regulador lo clasifiquen como juego de azar a primera
vista. Es una decisión de producto, no técnica: si se quiere usar por dinero, conviene un dictamen específico.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 21 600 (3 min). Hasta 2400 entradas. Cada tirada dura 180 ticks. Fin: tiempo agotado o
saldo a 0.

## 5. Verificación y registro

Común con `SLOT_CORE_V4`. El saldo final lo calcula el servidor.

## 6. Puntuación, desempate y premios

Saldo final. Trío: 4 a 24 veces la tirada según el símbolo (tres sietes, 40). Pareja: 1 a 6 veces (dos sietes, 8).
Sin pareja no hay premio. Desempate: regla online V2.

## 7. Integridad del cliente

Común. Con información completa, un programa calcula la mejor secuencia de avances. Es la ventaja de planificar, no un
azar oculto.

## 8. Equidad económica

Entre jugadores. El saldo de fichas es interno a la partida y no se convierte en dinero; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 2 fixtures `galactic-slot@4.0.0` (90 000 y 16 000) |
| La estrategia importa | «Slot V4 OK»: planificador 1045 frente a 350 fichas |
| Sin reloj ni coma flotante | Pasa |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Clasificación «no es de azar»: decisión del propietario (v192), pendiente de dictamen.
