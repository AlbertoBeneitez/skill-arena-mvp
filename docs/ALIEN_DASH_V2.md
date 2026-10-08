# GALACTIC GAMES · Alien Dash V2

El ID histórico `dino-dash` se conserva. La versión 2.0.0 añade plataformas, altura, centinelas con disparos anticipados y escudos recogibles. Dino Dash 1.0.0 y su adapter siguen intactos y reproducibles.

## Reglas

Core original, entero, 120 ticks/s, posiciones en milésimas de píxel. Dos minutos máximo. Desplazamiento de 160 a 240 px/s con resto entero, salto de velocidad -4100 y gravedad 85 por tick. Las plataformas solo admiten aterrizaje descendente con soporte horizontal; tocar un lateral no teletransporta al jugador. Ventana de seis ticks al abandonar un borde. Tres escudos, máximo tres; un impacto resta uno y 200 puntos (suelo cero), con 120 ticks de protección. Tres impactos no protegidos terminan el intento.

Los primeros obstáculos están separados y enseñan salto y plataforma. Después se combinan rocas de distintas alturas, drones para esquivar/agacharse y plataformas. Los centinelas aparecen después de la introducción, anticipan su disparo durante 60 ticks y apuntan una vez al suelo: no persiguen la posición del jugador. Recogibles sobre plataformas o entre obstáculos restauran un escudo y dan 100 puntos; con escudos completos dan 50.

Puntuación: 0,42 puntos por píxel recorrido; superar rocas intactas da 250, plataformas 220, drones/centinelas 320; un obstáculo golpeado solo da 60 al superarlo. Esquivar un proyectil da 180. Sobrevivir al tiempo máximo supera el reto; el contrato común también permite alcanzar el target autoritativo del manifiesto. Los puntos no representan dinero.

## Contrato y reproducción

Acciones mínimas `JUMP`, `DUCK_DOWN`, `DUCK_UP`, registradas por tick mediante el runtime común. No hay salto en el aire, ni crouch/release duplicados válidos. Máximo 3000 inputs. Registry y loader comunes; adapter de servidor append-only, replay y hash comunes. Escenario derivado del seed emitido por servidor mediante el PRNG compartido existente y namespace versionado del generador; no se crean archivos de niveles ni otro servicio de seeds. Mismas condiciones iniciales y mismo seed producen el mismo contenido.

El cliente dibuja y recoge inputs. El servidor reproduce la secuencia y calcula score y resultado. No se activa competición real: identidad autenticada, emparejamiento persistido y consumo atómico de tickets siguen pendientes de sus integraciones.

## Presentación y procedencia

Alien, estación, plataformas, drones, proyectiles y recogibles son dibujos originales sin assets externos. Fondo común reutilizado; parallax ligado al scroll de simulación. El callback común `feedbackScore` es exclusivamente de presentación: evita emitir sonidos por cada punto de distancia y no altera HUD, score, replay ni verificación.

## Validación

Pruebas de 24 partidas completas y replay, 64 progresiones completas con controles retrasados 67 ms, 128 aperturas sin daño durante los primeros tres segundos, plataformas alcanzables, recogibles, centinelas, salto/coyote, no teletransporte lateral, protección ante impactos simultáneos, inputs inválidos, fixture golden y render 60/120/144 Hz. QA táctil completa de dos minutos en ambas orientaciones: 24780/25470 puntos, tres escudos al final, recogibles y disparos reales, replay de servidor, derrota, cancelación/doble toque, sonido y reinicio sin errores de página. La primera prueba detectó un controlador de QA con anticipación insuficiente; se corrigió y se añadió tolerancia de 67 ms a la suite. Typecheck/lint, históricos, PostgreSQL local y build pasan. QA física humana sigue siendo recomendable.
