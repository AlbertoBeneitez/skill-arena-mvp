# v105-saturn — ajustes de juego y capa de experiencia de jugador (24-oct-2026)

Base: v104-saturn (7782239).

## Juegos
- **Ruleta 8.0.0**: la bola no puede salirse de la rueda (rebota en el borde) y no desaparece (queda en su casilla); selector de fichas 1/5/25 con aspecto de ficha de casino; las fichas del tapete conservan su color y se vacían al acabar la tirada.
- **Slot**: el HUD ya no parpadea (animación solo en la puntuación).
- **Dardos**: zona táctil de lanzamiento mucho más amplia (desde el 50 % inferior de la pantalla, 30 px de arrastre).
- **Billar**: mesa al 84 % y más alta, para dejar espacio al dedo.
- **Tower Drop**: zoom constante; los bloques antiguos se quedan abajo y salen de pantalla (como Stack).
- **Shot Gallery 6.0.0**: una orden de color + figura se cumple con la única figura coloreada que tiene ambas características.
- **Pinball 3.0.0**: sin zonas laterales de pérdida; solo se pierde por el hueco central, la bola vuelve al muelle (multiplicador ×1) y la partida dura siempre 60 s.

## Experiencia de jugador (solo presentación; no toca núcleos ni puntuación)
- Nivel/XP con rangos, racha diaria, estrellas, misiones diarias, mejores marcas por juego.
- Decisión previa RIESGO: Tranquilo ×1 / Atrevido ×2 (alcanzar objetivo) / Leyenda ×3 (objetivo + récord personal); si no se cumple, recompensa a la mitad.
- Tras cada partida: XP animado, subida de nivel con partículas y cofre de 3 cartas (estrellas, XP, cosméticos o "polvo estelar" ocasional).
- Cosméticos (marcos de avatar, temas de acento), fondo con paralaje, tarjetas con acento por categoría, "+N" flotante al puntuar. Progreso en `ga-progress-v1` (sobrevive al login forzado).
