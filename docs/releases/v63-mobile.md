# v63-mobile · Jet Stream: cambios de altura claros

Parte de v62. V4 compone create/step V3 y prepara una sola vez cada nuevo paso
lejano, fuera de pantalla. Dos pasos centrados/amplios enseñan vuelo; después
cambios de25px mínimos hasta45 y75px máximos hasta85. Dirección reflejada en
límites145–475 preserva amplitud, evitando clamping que alineaba pasos. Conservar
anchuras, espaciado, vidas, recogibles y calendario de dobles ventanas; estas se
reanclan juntas sin solape. Ningún paso/pickup visible se desplaza durante juego.

Física, cooldown/protocolo3, scoring y terminal180s siguen V3. Registry4.0.0 y
adapter adicional; V1/V2/V3/core/goldens se conservan. Height cuenta portales
superados y resultado muestra avance verificado; HUD sin puntos. No se cambia
el comparador histórico/global ni se deriva altura de una puntuación cliente.
Registro terminal/abandono usa el lifecycle común; no servicios paralelos.

Golden: seed61797d9d64a085f8b62ac2732ae93c7fbc4a8f669b18b5ef84b3e890d297b7a8,
score98046, tick21600,235portales,53recogibles,309FLAP,tres vidas, won;
sha256:d8350c2cc8e535ba299d46ab109b89fcbd6ff169b8e07a01bed82a014097ae83.
1000 fingerprints de geometría inicial sin incluir seed/id,32 recorridos de180s,
128 aperturas protegidas, cambios acotados, geometría estable, doble ventana,
recogibles, derrota sin inputs, replay/golden/render60/120/144 e inputs inválidos
pasan. Registro común cubre32 versiones; altura cliente falsa ignorada. Check
(typecheck/lint+suite completa), build y diff-check pasan.

QA Chromium touch nativo en producción local, sin alterar seed/target/clock:
partidas completas21600ticks,236/235portales,58/54recogibles,329/328inputs;
replay de registro enviado y resultado autoritativo coinciden. Derrota con un
solo FLAP(ticks623/622), cancel/doble toque no duplican input; reinicio con nuevo
manifest, rotación/320px y consola limpia. Explosión720ms y envío inmediato;
salida durante animación conserva transporte y no muestra resultado obsoleto.
Capturas de apertura/resultados revisadas en ambas orientaciones.

El jugador de QA anticipa con clones del core real y observa render/input events;
sus estimaciones nunca modifican la simulación del navegador. El actor anterior
precalculado derivaba con latencia de taps y sus derrotas se verificaron; no se
rebajaron asserts ni reglas para forzar una victoria. No se reutilizaron assets
ni código externo.

Pendientes: rotación1000 persistente/sin repetición (HTTP público sigue V2 y
seed aleatoria), unicidad de otros juegos, métricas/desempate comunes, pulido
Maze, enemigo Sky, cortes restantes Billar/Orb/Brick/Phalanx, Mine/Solitaire
privados y durabilidad/offline. No se activa competición, identidad ni dinero
reales. CI/Vercel se comprueban antes del fast-forward normal de mobile-test.
