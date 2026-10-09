# v68-mobile · Billar: una mesa continua

`billiards@2.0.0` mantiene protocolo1 y compone física entera V1:120Hz,
dos substeps, colisiones ordenadas, bandas, fricción y recuperación de blanca.
Core/adapter/golden V1 siguen intactos. Una arena de10objetivos/18tiros conserva
bolas y posiciones tras cada tiro; no hay reconstrucción, refill ni niveles.
El marcador interno heredado solo selecciona el terminal V1, nunca otro tablero.

Generación versionada con RNG/seed comunes: apertura probada cerca de tronera,
distancias/ángulos y uno/dos bumpers variables. Avance=objetivos realmente
embocados; score técnico1000por objetivo, sin racha, premio de mesa ni reducción
por scratch. El tiro fallido consume presupuesto y recupera la blanca. La UI
oculta puntos y no predice dónde caerá: guía corta de dirección/primer contacto,
palo retraído por potencia, bandas, sombras de bolas, impactos y partículas.
Cámara horizontal amplia y números rectos; inputs usan su misma inversa visual.
No búsqueda de trayectorias ni lectura de layout por frame en el renderer.

Determinismo/replay/render60/120/144, inputs inválidos/semánticos, guards RNG/reloj,
1000 geometrías reales distintas excluyendo seed/IDs,128 aperturas sin scratch y
16 partidas naturales completas de8–10tiros pasan. Quince trazas adicionales
congeladas se reproducen en CI sin repetir el planificador caro. Paridad física
V1 tick a tick sobre arena V2, posiciones/identidades persistentes, presupuesto,
scoring monotónico, límites/colisiones/fricción/scratch/idle/derrota comprobados.
Golden10000/avance10/t3812/9tiros/21inputs,
sha256:d65423ac89711b9e9e40b1ef7730edea5326fd2caccada34f2c410a731f0f0a0.
Registro común36versiones rechaza resultados del navegador y reconstruye este
terminal mediante el adapter común. Presentación prueba540 combinaciones aim/
power y4320 inversas/tokens en6viewports×4DPR; renderer no muta el estado.
Typecheck/lint, tests pertinentes/lifecycle/canvas y build de producción pasan.

QA Chromium producción, touch nativo sobre escenarios realmente emitidos:

| Partida | Avance | Tiros | Tiempo autoritativo | Resultado |
| --- | --- | --- | --- | --- |
| Vertical | 10 | 10 | 54.108s | Victoria |
| Horizontal | 10 | 9 | 51.717s | Victoria |
| Vertical | 1 | 18 | 89.658s | SHOTS_EXHAUSTED |
| Horizontal | 1 | 18 | 85.075s | SHOTS_EXHAUSTED |

Replay real del registro coincide en bolas/bumpers, score, height y time_ms;
scratch en tiro2 conserva avance1/score1000 en ambas derrotas. Cancel/doble toque,
potencias, rotación al apuntar/en movimiento, finalización/envío únicos,
reinicio con seed/geometría nueva y receipt de abandono pasan; consola limpia.
Capturas de apertura/progresión vertical/horizontal revisadas. Observación pública
del lienzo/HUD y planificador externo usan el core real para decidir acciones;
no se modifican manifest, seed, target, reloj ni estado de la app. Física, UI y
arte propios; no se importan código ni assets de billar comercial.

No se afirma rotación1000 sin repetición ni comparador común por avance/tiempo;
ambos siguen en el ledger. Tampoco se activan auth, ledger o dinero reales. QA
física del propietario es seguimiento, sin bloquear nuevas unidades. Las siete
solicitudes recientes de Tower/Stack/fondo/mute/Alien/Memoria se conservan de
v65–v67. Siguiente: enemigo Sky Hop y restantes resets/privados pendientes.
