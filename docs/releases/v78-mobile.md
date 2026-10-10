# v78-mobile · Brick Relay continuo y aceleración

Base v77-mobile d23814a. Unidad original, sin terceros ni cambios de proveedores.
Brick2.0 conserva V1/core/protocolo/golden/verificador como archivo append-only.

Un muro69bloques, sin sectores/reemplazos/pausas/resets. Apertura plana; profundidad
con explosivos, blindaje y movimiento. Velocidad y pala progresan por avance.
Acelerador táctil mantenido3/2, release/cancel/blur registrados en protocolo2.
Alcance=destruidos únicos; UI sin score crudo. Detalle: [reglas](../BRICK_RELAY_V2.md).

QA encontró y corrigió un fallo real: el último destino de arrastre se descartaba
si caía dentro del cooldown. Opt-in usa el slot de destino coalescido existente;
se aplica/registra cuando lo acepta el core. Colas de otros juegos intactas.
No se alteró timestep ni se añadió física en React.

## Validación

- V1golden/replays intactos; V2golden score24887/tick14259/hash congelado.
-16partidas completas V2 con boost (todas ganadas),128aperturas seguras,
1000muros distintos reproducibles; render60/120/144, inputs inválidos/límites,
rebote boost, reversibilidad de100toggles, blindaje/explosión/derrota.
-41versiones actuales/históricas del endpoint de registro, hashes/firmasV2/V3,
joystick y lifecycle de entrega/abandonos conservados.
-Native touch Chromium sobre build producción: victoria portrait69bloques,
15906ticks/132.550s/3vidas/937inputs; landscape17252ticks/143.767s/3vidas/
1119inputs. Un envío terminal verificado por partida; replay/score coincidentes.
-Derrota portrait1567ticks/6bloques; cancel/blur/boost live/release, reinicio con
nuevo manifiesto, sonido, consola y overflow correctos. Derrota landscape1234ticks
sobre build anterior con mismo core; primer piloto ganó sin fix en ambas vistas,
pero otros runs perdieron y revelaron el cooldown que quedó reparado y revalidado.
-Regresión de arrastre rápido: un movimiento final sin más eventos llega270px.
-Rotación en vivo portrait/landscape/320px, toque y boost tras resize, sin
overflow/errores/resultado obsoleto; prueba complementaria sin alterar estado.
-Typecheck/lint, producción build y whitespace correctos. Logs/manifiestos fuera
Git. QA física del propietario como seguimiento, sin bloquear otras unidades.

CI y Vercel deben estar verdes antes del fast-forward normal de mobile-test.
No se activa dinero/identidad/persistencia de producción. Mine/Solitaire privados
siguen locales hasta conexión segura; Phalanx continuo y doce piezas pendientes.
