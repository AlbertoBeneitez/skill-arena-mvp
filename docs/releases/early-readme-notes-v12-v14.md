# Notas históricas del README (V12–V14 y Tower Drop v2)

Movidas desde `README.md` el 22 de octubre de 2026 para que el README describa solo el estado actual. Contenido original, sin cambios.

## V12

- Se elimina Helix Dive del catálogo.
- Se elimina la generación de avatar por IA para evitar dependencias de pago innecesarias.
- Tower Drop incorpora caída más lenta y cámara progresiva para mantener la torre bajo la grúa.
- Jet Stream aprovecha toda la superficie vertical disponible en móvil.
- Pulse Runner se rediseña como auto-runner rítmico con patrones deterministas y dificultad progresiva.
- Metro Shift mantiene avance continuo y responde al gesto durante el swipe.
- El percentil demo se muestra como “Mejor que X% de los intentos demo”.


## V13

- Tower Drop y Metro Shift ocupan todo el viewport de juego, sin bandas negras.
- Tower Drop permite hasta 5 minutos de inactividad por bloque antes del timeout verificado.
- El encabezado 1 vs 1 muestra los avatares de ambos jugadores junto al nombre.
- Jet Stream incorpora HUD de puertas, puntos, ritmo y proximidad a la siguiente puerta.
- Metro Shift mantiene los obstáculos visibles y desplazándose después de superarlos, añade sensación de velocidad continua y sustituye el indicador de carril por un HUD de superados, puntos y ritmo.
- Se amplían los objetivos táctiles principales: volver, jugar y navegación JUGAR/CUENTA.


## V14

- Los nombres de avatar admiten espacios simples, manteniendo validación de 3–18 caracteres.
- Control de sonido simplificado con botón de altavoz visible en cabecera y durante la partida.
- SFX arcade originales generados con Web Audio, sin assets de terceros ni costes/licencias.
- Se eliminan los marcadores internos de puntuación de los cinco juegos para limpiar la superficie de juego.
- Nueva pestaña GRUPO con sala cerrada, código privado, stake configurable y modo 1 vs todos los integrantes.
- La lógica de grupo se separa en `lib/groupPlay.ts` y la UI en `components/GroupHub.tsx`.
- Metro Shift incorpora física lateral con velocidad/inercia y movimiento de obstáculos con aceleración visual por perspectiva.
- Los cinco juegos terminan al alcanzar la marca objetivo; la victoria muestra una animación común a nivel de producto.
- Tower Drop v1.1 conserva verificación server-side y admite cierre autoritativo por objetivo alcanzado o primer fallo.


## Tower Drop v2

Tower Drop usa ahora un motor determinista v2 con péndulo, caída acelerada,
apoyo parcial, estabilidad por centro de masas y vuelco alrededor del borde.
El resultado competitivo sigue verificándose mediante replay server-side a
120 Hz.

La mecánica toma inspiración de `iamkun/tower_game` (MIT, Copyright 2018
BMQB, Inc). No se reutilizan sus assets, audio, interfaz ni marca. Consulta
`THIRD_PARTY_NOTICES.md` y `docs/TOWER_DROP_V2.md` para la procedencia y
separación entre mecánica MIT y código propio.


