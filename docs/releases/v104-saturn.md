# v104-saturn — entorno único y mejoras por juego (24-oct-2026)

Base: v103-saturn (e9132ee).

## Global
- Sin selector Lanzadera/Saturno: un único entorno (la lógica de apuesta queda detrás para la futura modalidad de pago).
- **Login inicial en cada visita nueva**: al abrir el enlace en una pestaña nueva se muestra siempre la pantalla de inicio. Recargar la misma pestaña conserva la sesión; `?keep=1` desactiva el reinicio. Compromiso: el avatar/progreso local no se conserva entre visitas.
- Sin "Reto superado" (overlay y título del resumen: ahora "Partida completada"). Micro-animaciones: HUD que "late" al cambiar, tarjeta de resultado que sube.
- Nuevo modo de lienzo `expand-vertical` (pantalla completa hacia abajo en pantallas altas).

## Juegos
- **Galactic Roulette 7.0.0**: tapete más grande, fichas de 1/5/25, las fichas del tapete se vacían tras cada tirada, historial de las últimas 12 tiradas arriba, y las fichas colocadas caducan a los 10 s sin tirar (interpretación: no se cobran, simplemente desaparecen; 10 s = 1200 ticks a 120 Hz).
- **Galactic Slot**: sin números junto a las figuras de los rodillos (panel superior).
- **Dardos**: gesto de lanzamiento más permisivo, pantalla completa, contador de dardos restantes (texto + fila de dardos) y asa de lanzamiento animada.
- **Stack 4.0.0**: el último bloque cae visiblemente fuera; puntuación = altura × 100000 + superficie total apilada (la superficie solo desempata alturas iguales).
- **Orb Burst 5.0.0**: más dificultad; la siguiente bola está disponible al instante; sin contador de bolas; intercambio con recarga de 2,5 s.
- **Shot Gallery 5.0.0**: sin texto; solo color; mancha tipo salpicadura de pintura; campo que cubre más hacia arriba; efecto de disparo (trazador, destello, onda y chispas).
- **Solitaire**: palos clásicos rojo/negro; todas las manos son resolubles: nuevo solucionador exacto (`lib/solitaireSolver.ts`) que verifica las 65 manos (5 curadas + 60 generadas) y re-reproduce cada solución con la mecánica literal del cliente (`scripts/verify-solitaire-solvable.ts`).
- **Pinball 2.0.0**: una bola, 60 s, carril de skill shot, rollovers A-B-C, bumpers, slingshots, spinner, bancada de dianas abatibles, rampa/órbita, saucer, combos, flick, multiplicador y bonus final.
- **Stack Shift**: sin botón ↓.

## Dudas abiertas
- "Galactis shot": se interpretó como el panel de rodillos del Slot. Si era Shot Gallery, indicarlo.
- Pinball: "ajusta el nombre al original" — el nombre es coherente ("Pinball") en registro, cover y juego; falta saber qué nombre se espera.
