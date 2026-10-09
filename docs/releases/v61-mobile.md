# v61-mobile · Piano Rush sin cortes

Parte de v60. Piano V3 reemplaza el schedule de tres sectores por un único
recorrido de 48 notas: ocho de aprendizaje con ventanas amplias, después ramp
entero gradual de intervalos108→84ticks y ventanas36→24. No saltos ni pausas240.
Los premios/escudos cada16 notas son hitos dentro de la misma secuencia; nunca
cambian el campo ni congelan la simulación. HUD conserva avance/combo sin niveles.

Reutiliza la generación probada de carriles y las funciones V2 de judgement,
inputs/protección/scoring. El nuevo schedule se genera antes de simular; no se
ejecutan/revierten efectos de V2. Adapter V3 añadido al archivo, registry actual
3.0.0 y protocolo/lifecycle/loader/replay comunes. V1/V2 y sus fixtures intactos.
No dependencias, assets externos ni nueva arquitectura competitiva.

Golden: seed`0c527c55c337c3f70028ebf44de363a709f80cfff6bd96eee3b6b62711d7dcd1`,
48inputs, score51960, tick4848, won, hash
`sha256:12317ef9ba309d9eb4916aab23626ba77409b2cf9846e15c75b63736f17c2c01`.
64 cursos perfectos y replay idéntico; 128 schedules comprueban aprendizaje,
ramp monótono, ausencia de huecos, carriles históricos y ventanas compatibles
con cooldown. Bordes inclusivos, doble tap, derrota tick1354, inputs inválidos,
render60/120/144 y archivo V2 pasan. Registro común cubre ahora30 versiones.
Typecheck/lint, suite histórica/determinista, diff-check y build pasan.

QA Chromium touch real en producción local: victoria48/48 en vertical/horizontal
(scores50728/49977, tick4850, tres escudos); derrota11notas/tick1354 ambas,
reinicio con manifest distinto, sonido, cancel/blur, rotación/320px, controles>=44,
submit único y replay autoritativo de inputs reales, cero errores de consola.
No modificación de tiempo/seed/target/core por el runner.

Scoring/comparación por avance real, rotación1000, River y restantes cortes,
Mine/Solitaire privados y persistencia/delivery durable permanecen pendientes.
La prueba física del propietario es seguimiento; no impide la siguiente unidad.
Comprobar CI/Vercel antes de FF mobile-test.
