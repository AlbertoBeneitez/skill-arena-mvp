# v73-mobile · Jet Stream: puertas hasta los extremos

Corrección exclusivamente de presentación en `jet-stream@4.0.0`. Los cuerpos
opacos superior/inferior se extienden por el letterboxing hasta los bordes reales
del canvas. Se usa una lectura del transform visual ya aplicado por el canvas
común, sin DOM en la simulación ni cámara nueva. El área firmada390×620, todos
los huecos simples/dobles, widths/posiciones, colisiones, shields/pickups, generador,
inputs y physics/score/replay V1–V4 permanecen intactos. La extensión fuera del
área jugable es decoración: no cambia fronteras físicas ni ofrece espacio extra.

Renderer real comprobado en36 casos:6 tamaños×3DPR×huecos simples/dobles generados
naturalmente por V4. Top/bottom llegan al canvas completo, borde de cada hueco
conservado, contexto balanceado y estado no mutado. Comparación de suma flotante
del borde con tolerancia1e-9, después de observar una diferencia de una ULP en
179.99999999999997 frente a180; los enteros/core/hashes siguen exactos. Golden
históricoV4/score98046/t21600 y replay/render60/120/144/invalidinputs pasan.
Typecheck/lint/build y diff-check pasan.

QA producción Chromium, escenarios emitidos y controles táctiles nativos:
victoria vertical180s/235portales/55pickups/3vidas/331inputs; horizontal180s/
235portales/56pickups/3vidas/324inputs. El observador de dibujos confirma puertas
contra ambos extremos físicos durante cada partida, sin modificar su core,
clock, seed, reglas ni HTTP. Resultado/replay/enviado únicos y exactos, reinicios,
rotación/320px y consola limpia pasan. Derrotas con un input real, cancel/doble
protegidos: verticalt625/horizontalt623, cero vidas. Capturas revisadas; tickets/
registros emitidos fuera del repo. Fondo/explosión/audio comunes preservados.

Arte propio existente, sin assets/dep externos. QA física posterior sigue siendo
seguimiento del dueño. No activa auth/dinero/competición real. Rotación1000,
comparación común y demás solicitudes pendientes siguen en el ledger. Siguiente
unidad prioritaria: gesto de retroceso/dirección/potencia de Billar, con versión
competitiva nueva si la resolución de potencia/protocolo cambia.
