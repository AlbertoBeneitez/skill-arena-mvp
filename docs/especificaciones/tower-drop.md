# Tower Drop — especificación de juego

**Estado de conformidad:** PENDIENTE DE DICTAMEN
**Azar en el resultado:** variación generada, visible antes de actuar · **Verificación:** repetición en servidor

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `tower-drop` · 5.0.0 (VERIFIED) |
| Núcleo | `lib/verified/towerDropCore.v5.ts` · SHA-256 `2b2ca008ce7c9cbddb41d05d0ac8336e8a5b4cb0c57febbb24913fa92d1975ea` |
| Física | `lib/verified/towerDropPhysics.v5.ts` · SHA-256 `be485baa6391ed9f35d50dd1ac5dba86204b73b5f46cbae950c4459fbddf6051` |
| Protocolo | una sola acción `DROP`, versión de entrada 3 |
| Origen | propio |

## 2. Descripción y modo de juego

Un bloque cuelga de un péndulo; el jugador lo suelta para apilarlo sobre la torre. Tres vidas: se pierde una cuando un
bloque falla o se vuelca. Gana la torre más alta. Contra otros jugadores.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Generador o semilla | **Sí** | `hashSeed` elige 1 de 7 amplitudes del péndulo, 1 de 2 velocidades de partida y la fase inicial |
| Contenido generado | **Visible** | El péndulo se mueve en pantalla de forma regular; el jugador ve dónde está antes de soltar |
| Información oculta | No | Una línea discontinua marca dónde aterrizará el bloque |
| Reloj y refresco | No influyen | README §2 |
| Coma flotante | No | Física entera con restos acumulados |

Conclusión: la semilla fija el ritmo del péndulo de la partida, igual para los dos rivales y visible al jugar.

## 4. Modelo de simulación

120 ticks/s. Tick final máximo 43 200 (6 min). Hasta 500 entradas. Fin: sin vidas o inactividad.

## 5. Verificación y registro

Común con `TOWER_DROP_CORE_V5`.

## 6. Puntuación, desempate y premios

Por cada bloque apilado: 360, más hasta 420 según el solape con la torre, más 240 si queda centrado, más 28 por cada
centrado seguido anterior. Desempate: regla online V2.

## 7. Integridad del cliente

Común. Con la semilla, el instante ideal de cada soltada es calculable.

## 8. Equidad económica

Entre jugadores; saldo ficticio hoy.

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Mismas entradas, mismo resultado | Pasa · «Tower V5 lives OK», 24 repeticiones con semillas distintas |
| Reglas | «Tower V5 OK»: sin rebote lateral, tres vidas |
| Fixture de la versión vigente | No hay fixture `tower-drop@5.0.0` con hash de referencia (sí de la 3.0.0). **Conviene añadirla** |

## 10. Declaración y responsabilidad

Redactada por la plataforma. Pendiente de dictamen y de firma del propietario.
