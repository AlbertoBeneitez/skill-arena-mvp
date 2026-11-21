# Solitaire Sprint — especificación de juego

**Estado de conformidad:** NO CONFORME
**Azar en el resultado:** cartas ocultas · **Verificación:** resultado calculado por el móvil

## 1. Identificación

| Campo | Valor |
|---|---|
| id · versión | `solitaire-sprint` · 0.2.0 (estado INTEGRATED, `verification: "client-result"`) |
| Juego | `components/games/SolitaireSprint.tsx` · SHA-256 `822a6ec6c7878bbc456bb773b94e9e6a86a68cf3615c6309775c8fd07cbec8fd` |
| Repartos | `lib/deterministic/solitairePool.ts` · SHA-256 `a8eca5dc5574c05bcf21b541001c751066c80be59c1002133d1bf0114c03edc5`, y `challengeSets.ts` |
| Núcleo verificado | No existe. Hay un generador privado candidato (`solitaireSetup.v1.server.ts`) sin conectar |
| Origen | propio |

## 2. Descripción y modo de juego

Solitario Klondike, robando de una en una y con vueltas al mazo ilimitadas. Gana quien más avance y más rápido.

## 3. Azar y fuentes de variabilidad

| Fuente | ¿Existe? | Detalle |
|---|---|---|
| Reparto | **Sí, fijo** | `GameLoader.tsx` pasa la semilla fija `solitaire-arena-001`, que elige siempre **el mismo reparto** de un grupo de repartos con solución comprobada |
| Información oculta | **Sí** | Cartas boca abajo y orden del mazo |
| Repartos públicos | **[INCIDENCIA]** | Todos los repartos están en el repositorio, que es público. Cualquiera puede ver las cartas ocultas |
| Reloj | **[INCIDENCIA]** | El tiempo se mide con `performance.now()` en el móvil |
| Coma flotante | No aplica | |

Conclusión: hoy no hay azar *entre partidas* (siempre el mismo reparto), pero hay información oculta que se puede
conocer leyendo el repositorio o memorizando la partida. El orden del mazo es azar desde el punto de vista del jugador
la primera vez que juega.

## 4. Modelo de simulación

Lógica de cartas en el componente de React, sin núcleo puro ni frecuencia fija. Las acciones son toques de interfaz.

## 5. Verificación y registro

**[INCIDENCIA]** Ninguna. El móvil calcula la puntuación y el tiempo y los comunica (`onFinish`). El servidor no puede
comprobarlo.

## 6. Puntuación, desempate y premios

+100 por destapar una carta, +40 por mover dentro del tablero, +500 por subir a una base; tiempo final.
**[INCIDENCIA]** `docs/SOLITAIRE_PRIVATE_DATASETS.md` reconoce que mover cartas de un lado a otro permite acumular
puntos («farming») y que está pendiente de corregir.

## 7. Integridad del cliente

**Sin integridad.** Puntuación, tiempo y reparto los decide el móvil.

## 8. Equidad económica

No debe jugarse por dinero ni con entrada en este estado (`AGENTS.md`: nunca confiar en una puntuación del cliente con
dinero real).

## 9. Pruebas

| Prueba | Resultado en `e8c476e` |
|---|---|
| Repartos con solución | Comprobados por `scripts/verify-solitaire-solvable.ts` |
| Generador privado | «Solitaire setup candidate»: 1000 repartos distintos, cartas ocultas; sin conectar |
| Repetición en servidor | No existe |
| Bot del simulador | 16 jugadas y 97 robos en ~290 s, sin terminar |

## 10. Declaración y responsabilidad

Redactada por la plataforma. **No declarar este juego «sin azar» ni «verificado».** Para cumplir: núcleo puro con
repetición en servidor, reparto privado por partida igual para los dos rivales y sin publicar, y corregir la
acumulación de puntos.
