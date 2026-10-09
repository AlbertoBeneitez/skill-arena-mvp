# v69-mobile · Sky Hop: riesgo evitable y rescates

`sky-hop@3.0.0` compone literalmente `SKY_HOP_CORE_V2.step`, con los75 apoyos,
gravedad, aceleración, wrap, rebotes, boost, pickups y recuperación de crumble
originales. V1/V2/adapters/goldens y protocolo1 permanecen intactos. Marcianos
originales después del apoyo14 patrullan bajo los extremos, fuera del lado de
llegada. Separación mínima3apoyos; sin enemigos en balizas, sus dos siguientes
apoyos, crumbles o boosts. Todo cuerpo/patrulla/antena cabe en FOV390 compartido.
Aviso120ticks al entrar visible, sin daño durante aviso/gracia de recuperación.

La ruta central aprendida y el despegue quedan libres: un error al salir por el
borde puede causar contacto; descender sobre la cabeza permite stomp de rescate
y rebote. La derrota persiste tras caer, sin puntos/avance extra ni farming.
Daño lateral consume una vida, conserva altura, pickups y held directions,
restaura supports tras checkpoint y rearma los enemigos vivos después de gracia.
La función privada de caída V1 obliga a repetir únicamente esas asignaciones de
checkpoint en la extensión V3; no se duplica ni reemplaza el integrador.

Presentación propia: cuerpo/outline coincidente con AABB, aviso ámbar, armado
rosa, estela/partículas acotadas por ticks y recorte. Predicados de visibilidad/
armado provienen del core. HUD altura sin puntos/coaching, META75 reparada
(no era un checkpoint y antes no se dibujaba), audio/haptic comunes. Impacto
terminal300ms usa el clock visual compartido, sin cambiar estado ni retrasar el
registro. Física/inputs/viewport/lifecycle siguen comunes.

1000 fingerprints excluyendo seed/ID/timestamps y fases de apoyos estáticos;
7–16marcianos por curso, patrullas/bounds/47px de corredor central seguro.
96 ascensos completos con volante histórico:32arbitrarios,32catálogo y32cada
8ticks/66.7ms. Apertura5s idénticaV2, cuatro recuperaciones de caída, contactos
naturales, golpe con crumble13 colapsado/restaurado, stomp y antifarming pasan.
Tres goldens con inputs legales, replay y render60/120/144:

| Caso | Altura | Score técnico | Tick | Resultado |
| --- | --- | --- | --- | --- |
| Stomp y ascenso | 75 | 43560 | 6532 | won |
| Contacto y recuperación | 75 | 43280 | 7124 | won |
| Tres contactos | 16 | 4678 | 2105 | ALIEN_CONTACT |

Hash principal sha256:0b8d79fec82ca5284da15234fb56416b039aad81a73d3492608c3c17dcccca22.
Warning120/grace90/rearme, contacto/collider/límites, soporte primero, derrotados
persistentes, invalidinputs/RNG/reloj y hashes históricos comprobados. Registro
común37versiones reconstruye altura/score/tiempo rechazando valores cliente;
prefijo con input recibe receipt sin adjudicación. Renderer real prueba warning/
armado/gracia/recorte/FOV/AABB/impacto/goal/audio y no mutación. Typecheck/lint,
tests pertinentes/contrato/lifecycle y build de producción pasan.

QA Chromium producción con touch nativo, escenarios realmente emitidos y
registro enviado como única autoridad: victorias75 vertical/horizontal,
crumble13 efectivamente colapsado antes de caer y restaurado tras checkpoint10,
stomp-rescate real y contacto hostil con altura/pickups/held preservados.
Derrotas FALLEN de21.800s vertical (contacto previo) y14.692s horizontal;
reinicio con seed/curso nuevos, cancel/blur/dobletap/rotación/320px, finalización/
envío únicos y receipts de abandono con inputs pasan. Capturas reales revisadas;
consola limpia. El observador conserva el pulso públicamente dibujado de apoyo,
no lee refs ni altera seed/target/clock/estado. Fallos previos del actor y sus
registros válidos permanecen fuera del repo; la captura de progreso es asíncrona
para no bloquear el control de la prueba. No se suaviza replay ni se reescribe
core para lograr un resultado automatizado. QA física es seguimiento del dueño.

Marcianos/UI/arte propios; se conserva atribución MIT del linaje Sky en
THIRD_PARTY_NOTICES. No assets comerciales importados. Rotación1000 sin repetición
y comparación común por avance/tiempo siguen pendientes; auth/ledger/dinero reales
siguen desactivados. Orb/Brick/Phalanx continuos y privados Mine/Solitaire son
trabajo siguiente del ledger; este checkpoint no declara el backlog completo.
