# v66-mobile · Memoria: parejas orbitales verificadas

Parte de v65. Nuevo juego original `memory-match@1.0.0`, registry/loader común,
protocolo1 FLIP_0..23, core120Hz y coreAdapter de servidor. Tablero único6×4 con
12 parejas, dos adyacentes de aprendizaje; shuffle común versionado y seed de
manifest emitido por servidor. Preview completo8s, dos errores protegidos/ocho
vidas, revelado de error120→54ticks conforme al avance, timeout120s. Sin niveles,
cambios de baraja, score repetible ni resultados confiados al cliente.
Height=parejas únicas, score técnico1000/pareja; terminal por12parejas/escudos/
120s o target común firmado. El comparador global pendiente no se sustituye.

La preview revela legalmente todo el mapa. No se trata como estado secreto ni
se añade otra infraestructura privada; replay autoritativo no demuestra memoria
humana ni evita guardar/automatizar la preview. No se activa competición/dinero
reales. Mine/Solitaire secretos conservan su frontera privada independiente.

Tarjetas originales con forma/color/número, cara oculta uniforme, giro/selección,
confirmación de pareja y error; timer/vidas/avance reales, sin instrucciones.
Touch al soltar en la misma tarjeta; drag/cancel no consumen input. Topología
6×4 constante al rotar y targets≥44px reales; viewport visual común opt-in.
Finale420ms utiliza lifecycle común: envío terminal antes de animación, reinicio
nuevo y salida con receipt de abandono separados de un resultado competitivo.

Golden: seed64ae36509bfe1972dde0be893b462ffd5e0972892b61c5e82b48da794fcc822a,
30inputs, score12000/12pares/vida7/errores3/tick2454/won,
sha256:bb2c3615657eed3d8c2a3ea5c610a17384291978d25772f18ee2c13ed04c3679.
1000 boards distintos por contenido,64 wins con delays/errores, mapa inmutable,
gracia/cooldown/reveal, pérdidas/timeout/prefijo, inputs inválidos/semánticos,
replay/golden/render60/120/144 y guards RNG/reloj pasan. Registro común34versiones,
contrato histórico V2/V3/core driver/viewport, typecheck/lint y build pasan.

QA Chromium producción local, touch nativo y planner que recuerda solo números
legalmente dibujados en preview: wins de12pares/24inputs/28.750 y25.433s en vertical/
horizontal; errores10 tras dos pares →pérdida con avance2/24inputs/29.867 y29.175s;
timeout real120.000s/14400ticks preserva1par/2inputs. Replays/height/score/tiempo
exactos frente al registro posteado/servidor; un terminal, otro receipt al salir
tras reinicio. Cancel/drag/dobletap, rotación sin reordenar,320px, feedback audio,
reinicios y consola limpia. Otras dos wins/capturas verifican presentación real.
Catalog discovery/loading/error/empty/navigation comprueba21juegos desde registry.
No APIs/seed/target/clock de la app alterados en partidas Memoria; no QA físico
inventado. Arte/capturas revisadas, sin assets protegidos.

CI/Vercel antes de FF mobile-test. Alien V3 y resto de backlog siguen en ledger;
1000 boards no implica rotación persistente sin repetición del servidor público.
