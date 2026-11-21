# Dardos — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** variación generada, visible antes de actuar · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `darts` · 3.0.0 (VERIFIED) |
| Núcleo | `lib/verified/dartsCore.v3.ts` · SHA-256 `724c39f8509af6b13f48ebd4a9de582fa83a954f5af5f9d53fdb02f53f793c12` |
| Protocolo | `DARTS_ACTIONS` (61 × 61 pasos de puntería y `THROW`), versión de entrada 1 |
| Origen | propio |

## 2. Descripción y modo de juego

Veinte lanzamientos a una diana continua. El punto de mira se balancea; el jugador apunta deslizando y suelta para
lanzar. El balanceo y la presión aumentan a lo largo de la partida. Gana la mayor suma. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `createRng(seed:darts3:sway)` fija la fase inicial del balanceo de cada lanzamiento (X e Y) |
| Contenido generado | Balanceo, **visible** | El balanceo es una oscilación determinista que se ve en pantalla en tiempo real; el jugador elige cuándo soltar |
| Diana | Fija | Una sola diana para los 20 lanzamientos |
| Información oculta | No | El vuelo dura 1 s y es determinista |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | Seno entero (`sinPhaseMilli`) |

Conclusión: la semilla decide en qué punto del balanceo empieza cada lanzamiento; el jugador lo ve y decide cuándo
lanzar. Es común a los dos rivales.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 36 000. Hasta 8000 entradas. Plazo por lanzamiento de 14 a 9 s según la etapa.

## 5. Verificación y registro

Común con `DARTS_CORE_V3`.

## 6. Puntuación, desempate y premios

Suma de los 20 impactos según el valor de la diana. Sin bonus. Desempate: regla online V2.

## 7. Integridad del cliente

Común. Conociendo la semilla, un programa sabe la fase del balanceo y lanza en el instante óptimo.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · fixture `darts@3.0.0` (925) |
| Variedad y destreza | «Darts V3»: 1000 perfiles de balanceo, 64 victorias y 8 derrotas completas |
| Presentación sin efecto | 6336 fotogramas, renderizador puro |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
