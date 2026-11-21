# Billar — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** disposición generada, visible y común · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `billiards` · 7.0.0 (VERIFIED) |
| Núcleo | `lib/verified/billiardsCore.v7.ts` · SHA-256 `2964b8df99e0acf218d21b4ce5cbfb5a964cc6ff1de484fb9b6f353a39a3d57d` |
| Dependencias | física de `billiardsCore.v1.ts`, acciones de `billiardsCore.v3.ts` |
| Protocolo | `BILLIARDS_ACTIONS_V3` (dirección y potencia cuantizadas), versión de entrada 2 |
| Origen | propio. Gymkana de cinco niveles por decisión del propietario (29-oct, `AGENTS.md`) |

## 2. Descripción y modo de juego

Cinco mesas seguidas con un número fijo de tiros (4, 5, 5, 6, 7). Hay que meter las lisas, evitar las rayadas y dejar
la 8 para el final. Contra otros jugadores, con las mismas mesas para todos en esa partida.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `billiardsLevelLayoutV7(seed, nivel)`: posición de bolas, huecos objetivo y bloqueos de cada nivel |
| Contenido generado | **Sí, visible y común** | Cada mesa se ve entera antes del primer tiro y es la misma para los dos rivales |
| Rebotes | Deterministas | Física entera; ningún rebote aleatorio |
| Información oculta | Parcial | La mesa del nivel siguiente no se ve hasta llegar a él, pero es la misma para los dos |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | `integerMath` |

Conclusión: la semilla cambia las mesas de una partida a otra; dentro de una partida es igual para los dos y cada tiro
es determinista.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 144 000 (20 min). Hasta 6000 entradas: apuntar, fijar potencia y golpear.

## 5. Verificación y registro

Común con `BILLIARDS_CORE_V7`.

## 6. Puntuación, desempate y premios

Lisa +1000, rayada −400, blanca en hueco −250, 8 al final +2000 (antes de tiempo −500), nivel limpio +500 y 150 por
tiro sobrante. Desempate: regla online V2.

## 7. Integridad del cliente

Común. Física determinista: un programa puede calcular el tiro óptimo (política anti-bots de v226). Además conoce las
mesas siguientes por la semilla.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · 2 fixtures `billiards@7.0.0` (15 100 y 17 650) |
| Reglas de la gymkana | «Billiards V7 OK» |
| Presentación sin efecto en el resultado | 4320 combinaciones de ida y vuelta, estado del renderizador intacto |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
