# Brick Relay 1.0 · contrato y progresión

El módulo 0.1 permanece archivado. La versión 1.0 usa el runtime, escenarios,
input sequence, lifecycle y adapter de replay comunes; no altera verificadores
históricos. Física original en enteros, 120 ticks/s y dos subpasos por tick.
La presentación/pantalla/FPS no determina colisiones ni puntuación.

Cuatro sectores de 10, 15, 20 y 24 bloques. Apertura con pala de 140 px,
velocidad 240 px/s y dos segundos para orientar el lanzamiento vertical.
Después aparecen blindajes de dos golpes, explosivos y bloques móviles
reproducibles; la pala se reduce hasta 104 px y la velocidad progresa con
límites. El rebote depende del punto de contacto sobre la pala, con componente
vertical mínima; paredes/techo y contacto círculo-caja se resuelven en orden
estable, separando la bola hacia fuera para evitar daño repetido por solape.

Tres vidas. Caída: −200 puntos, un segundo de recuperación; tercera caída:
BALL_LOST. Completar sector recupera una vida (máximo tres) y añade dos segundos
de pausa. Cuatro sectores o target emitido completan la partida; límite de
240 segundos, agotarlo es derrota. Blindaje: 95 por golpe. Bloque destruido:
(280 + sector × 26) multiplicado por combo de 8%, máximo 240%; cada contacto
con pala reinicia combo. Explosión elimina vecinos a 76 px sin cascada; cada
bloque se puntúa una vez. Bonus de sector: 500 + vidas × 50.

Protocolo AIM_000…078: coordenada de 5 px, limitada por anchura de pala.
LEFT/RIGHT: desplazar objetivo 25 px. Máximo un cambio cada siete ticks,
objetivo repetido rechazado, máximo 4500 inputs. El servidor reconstruye todo
con el escenario/seed emitido y inputs; el resultado del cliente no es autoridad.
El inicio HTTP continúa siendo demo, no emparejamiento/dinero/identidad real.

Golden: 31235 puntos, tick 22776, won; fixture en scripts/fixtures/brick-v1.json.
16 recorridos completos y 128 aperturas seguras; recuperación, blindaje,
explosión, separación de contacto, bounds/cooldown, payload cap, replay,
render 60/120/144 Hz e inputs inválidos. Renderer original con fondo común,
relieve, trazas, impacto y feedback de caída; no se importa código/asset ajeno.
La aceptación comercial y rendimiento en móviles físicos requieren QA humana.
