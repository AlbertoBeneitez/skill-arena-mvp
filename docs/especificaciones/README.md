# Especificaciones de juego

Una especificación por juego del catálogo, salvo Roulette (juego de azar, nunca por dinero). Describe cada juego
**tal como está en el código** de `mobile-test` en `e8c476e` (v227-saturn, app 2.27), no como debería ser.
Si el código cambia, la especificación se actualiza en el mismo pull request (ver «Versionado»).

Estas especificaciones sirven para explicar a un tercero (banco, proveedor de pagos, abogado, regulador o jugador)
qué decide el resultado de cada juego y qué se ha comprobado. No sustituyen a un dictamen jurídico.

## Resumen

| Juego | id · versión | Azar en el resultado | Verificación | Estado |
|---|---|---|---|---|
| [Pinball](pinball.md) | `pinball` 14.0.0 | Ninguno | Repetición en servidor | CONFORME |
| [Bowling](bowling.md) | `bowling` 3.0.0 | Ninguno | Repetición en servidor | CONFORME |
| [Galoku](corner-sudoku.md) | `corner-sudoku` 4.0.0 | Disposición generada, visible y común | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Billar](billiards.md) | `billiards` 7.0.0 | Disposición generada, visible y común | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Slot](galactic-slot.md) | `galactic-slot` 4.0.0 | Disposición generada, visible y común | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Dardos](darts.md) | `darts` 3.0.0 | Variación generada, visible antes de actuar | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Tower Drop](tower-drop.md) | `tower-drop` 5.0.0 | Variación generada, visible antes de actuar | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Stack](precision-stack.md) | `precision-stack` 4.0.0 | Variación generada, visible antes de actuar | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Stack Shift](stack-shift.md) | `stack-shift` 4.0.0 | Secuencia oculta (2 piezas a la vista) | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Orb Burst](orb-burst.md) | `orb-burst` 8.0.0 | Secuencia oculta (1 orbe a la vista) | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Shot Gallery](reaction-test.md) | `reaction-test` 14.0.0 | Secuencia oculta (dónde y qué asoma) | Repetición en servidor | PENDIENTE DE DICTAMEN |
| [Solitaire Sprint](solitaire-sprint.md) | `solitaire-sprint` 0.2.0 | Cartas ocultas | **Resultado del móvil** | NO CONFORME |
| [Mine Grid](mine-grid.md) | `mine-grid` 0.2.0 | Minas ocultas; **tablero distinto para cada rival** en Vercel | **Resultado del móvil** en Vercel | NO CONFORME |

Fuera: Roulette (azar) y Memoria (`memory-match`, desactivado).

## Qué significa cada columna

**Azar en el resultado.** La Ley 13/2011 llama juego a arriesgar dinero sobre un resultado que dependa *en alguna
medida* del azar, aunque predomine la destreza. Por eso aquí no basta con «es de habilidad»: se clasifica qué parte
del resultado no controla el jugador.

- **Ninguno:** el juego no usa la semilla ni ningún generador. Misma partida, mismas jugadas, mismo resultado, siempre.
- **Disposición generada, visible y común:** la semilla genera el escenario (mesa, tablero, tiras), que el jugador ve
  entero desde el principio. Los dos rivales reciben el mismo escenario.
- **Variación generada, visible antes de actuar:** la semilla fija parámetros (velocidad, fase, dirección) que el
  jugador ve en pantalla antes de cada decisión. Igual para los dos rivales.
- **Secuencia oculta:** la semilla decide cosas futuras que el jugador **no ve** cuando decide. Igual para los dos
  rivales, pero no se conocen de antemano.

**Estado.**

- **CONFORME:** ninguna fuente de azar y resultado calculado por el servidor.
- **PENDIENTE DE DICTAMEN:** hay variación generada por semilla. El argumento a favor es fuerte (escenario idéntico
  para los dos rivales, resultado calculado por el servidor), pero que eso no sea «azar» a efectos legales lo tiene que
  decir un jurista, no este documento. Las categorías «visible» son más defendibles que «secuencia oculta».
- **NO CONFORME:** el servidor no calcula el resultado o los rivales no juegan el mismo escenario.

## Lo común a los juegos con repetición en servidor

Vale para los once juegos marcados «Repetición en servidor». Cada especificación remite aquí.

1. **Semilla del servidor.** Al empezar, el servidor crea un manifiesto inmutable (juego, versión, hash de reglas,
   hash de contenido, semilla, frecuencia, fin) y un ticket firmado con HMAC. El segundo jugador de un duelo se une al
   mismo manifiesto: **misma semilla, mismo escenario**. Ver `docs/VERIFIED_MATCH_ARCHITECTURE.md`.
2. **Simulación a frecuencia fija.** 120 ticks por segundo. El móvil calcula el tick a partir del tiempo transcurrido
   (`CoreCanvasGame.tsx`), así que la física no depende de los fotogramas por segundo del dispositivo.
3. **Aritmética entera.** Los núcleos vigentes usan `lib/deterministic/integerMath.ts` y no usan `Math.sin`, `Math.sqrt`
   ni similares, ni `Math.random`, `Date` o `performance` (comprobado por búsqueda en `lib/verified/`).
4. **Entradas.** El móvil solo envía la lista ordenada de `(tick, acción)` y el tick final. El servidor repite la partida
   con el núcleo congelado de esa versión y calcula puntuación, victoria y motivo de fallo. No acepta el resultado del móvil.
5. **Reloj real.** El servidor rechaza una partida simulada más rápido que el tiempo real
   (`SIMULATION_FASTER_THAN_REAL_TIME`).
6. **Pruebas.** `pnpm test:determinism` repite partidas de referencia («fixtures») y comprueba los hashes de repetición,
   dibujo, entradas y resultado. En `e8c476e` pasa completo (123 fixtures). Cada especificación cita las de su versión.

### Debilidad común conocida (anti-trampas, no azar)

La semilla llega al móvil al empezar. Un programa puede copiar el núcleo y probar jugadas antes de hacerlas. El
simulador de bots lo marca como **crítico** (Pinball: 17 215 puntos con anticipación frente a 6 305 de un novato,
aceptados por el servidor). En los juegos con secuencia oculta, conocer la semilla además **revela el futuro oculto**.
El plan aprobado está en `docs/TRASPASO.md` §6: información oculta por pasos, detección de comportamiento e identidad.

## Versionado

- Cada núcleo es un fichero congelado por versión (`lib/verified/<juego>Core.vN.ts`). Cambiar el comportamiento exige
  versión nueva; las antiguas se conservan para repetir partidas viejas.
- Cada especificación anota el SHA-256 de los ficheros que determinan el resultado en `e8c476e`. Si un hash ya no
  coincide, la especificación está desactualizada.
- Comprobación rápida: `sha256sum <fichero>` y comparar con la tabla de la sección 1 de cada juego.

## Plantilla

Cada especificación tiene estas diez secciones:

1. Identificación · 2. Descripción y modo de juego · 3. Azar y fuentes de variabilidad · 4. Modelo de simulación ·
5. Verificación y registro · 6. Puntuación, desempate y premios · 7. Integridad del cliente · 8. Equidad económica ·
9. Pruebas · 10. Declaración y responsabilidad.

Un juego nuevo o importado entra con su especificación completa. La sección 3 se rellena fuente por fuente:
generador o semilla, contenido generado, emparejamiento, orden, desempate, información oculta, reloj y frecuencia de
refresco, coma flotante y diferencias entre dispositivos. «Sin azar» solo vale si todas están en «no existe».
