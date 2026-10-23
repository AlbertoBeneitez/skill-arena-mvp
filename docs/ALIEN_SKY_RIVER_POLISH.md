# Alien Dash, Sky Hop y River Dash — revisión de claridad y presentación

Base: `v100-mobile` (`e53e957`). Se preservan las mejoras de esa rama y todos
los cores, versiones competitivas, protocolos, manifiestos y verificadores.

- Alien Dash: sombra sobre el apoyo real, con reducción durante el salto;
  contorno del cuerpo peligroso del dron separado del escape y proyectiles más legibles.
- Sky Hop: borde que se consume durante la vida de una plataforma frágil,
  fragmentos breves después de romperse, halo de los recogibles y efecto de caída terminal.
- River Dash: canvas separado del muelle táctil en vertical y horizontal,
  objetivos de 60 px en vertical / 48 px en horizontal, corriente según el sentido
  real del carril, cubiertas transitables diferenciadas del tráfico por forma,
  luces delanteras/traseras y salto visual con sombra fija en el carril.
- Los tres: foco de teclado visible y acabado de los botones consistente.

No se han cambiado física, hitboxes, dificultad, puntuación ni semántica de
inputs. Los efectos leen ticks del core; la animación terminal usa el reloj
visual compartido y no retrasa el envío del replay.

Validación: typecheck y build de producción; suite completa `test:determinism`;
prueba adicional `verify-arcade-presentation.cjs` (pureza, coordenadas finitas,
sombra sobre tejado y suelo, caducidad de fragmentos y efecto terminal).
El test se integra en la suite. QA táctil con Chromium y respuestas HTTP reales,
sin cambiar seed, reloj, objetivo ni cuerpos de peticiones.

El harness de River también comprueba que ningún control cubre el canvas.
Su actor de QA detecta el borde mediante `canApply`: un umbral fijo en milímetros
podía dejarlo intentando un desplazamiento imposible indefinidamente.

Alcance: pulido de claridad y respuesta visual, no cierre del backlog general.
Siguen pendientes la evolución continua de Sky Hop más allá de sus 75 apoyos y
las decisiones opcionales de Alien Dash descritas en el ledger. Este cambio no
activa dinero real ni infraestructura de producción. La aceptación en móviles
físicos sigue siendo una comprobación del propietario.

QA completada:

| Juego | Vertical | Horizontal |
| --- | --- | --- |
| Alien Dash | Derrota verificada, tick 1077, reinicio/salida | Sesión completa, tick 14400, avance 57, tres vidas |
| Sky Hop | Victoria verificada, 75 apoyos, tick 6650, reinicio/abandono | Caída verificada, recuperación hasta pérdida de vidas, reinicio/abandono |
| River Dash | Derrota verificada, avance 2, reinicio/rotación/abandono | Avance 80, derrota verificada, reinicio/rotación/abandono |

Las seis ejecuciones terminaron sin errores de consola. Se inspeccionaron
capturas de Sky vertical, Alien horizontal y River horizontal. El estado leído
por los renderizadores permanece intacto. CI y despliegue remoto se registran
en la propuesta de integración; no se avanza `mobile-test` desde esta rama.
