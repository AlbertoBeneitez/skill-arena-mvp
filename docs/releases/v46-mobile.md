# v46-mobile · Metro Shift

Parte de v45-mobile validada. Metro Shift pasa de 0.1 INTEGRATED a 1.0
VERIFIED con el core, escenarios/seeds, inputs, lifecycle, lazy registry y
adapter/replay comunes. Conserva siete carriles y salto; el módulo anterior
queda archivado. No cambia ningún core/verificador/golden histórico.

60 grupos por tres sectores, ocho segundos de aprendizaje seguro, cambios
continuos de carril, vallas ámbar saltables y muros que se esquivan. Densidad,
combinaciones y recorrido progresan; al menos tres carriles libres por grupo.
Recargas únicas en carriles libres, tres escudos, protección de impacto,
puntuación core por pases limpios/salto y penalización de errores. Colisión en
coordenadas de mundo, independiente de la perspectiva/FPS/pantalla. Puente
orbital original, fondo compartido, profundidad/sombra y feedback; controles
físicos fuera del campo. Ninguna dependencia, asset externo ni producción real.

Golden 43320 puntos/tick 11133; 32 cursos completos, 128 aperturas, rutas,
colisiones, barrera/muro, cooldown/no air double jump/daño único, replay y
60/120/144 Hz. Typecheck/lint, suite histórica y build pasan.

QA Chromium táctil: vertical 42960/tick 11169 y horizontal 42560/tick 11155,
60 grupos/tres escudos; derrota 0/tick 1482/cuatro grupos y cero escudos.
Swipe actúa durante arrastre; cancelar no deshace el input aceptado ni añade
otro al soltar. Doble toque, SFX activados por toque, resultado único/replay,
reinicio y orientación sin nuevo start pasan, sin errores de consola/página.
El controlador QA se corrigió para registrar el swipe ya aceptado y recorrer
la duración completa; ningún ajuste del test cambia reglas/seed/score.

GAME_ARCHITECTURE referencia el ledger actual de madurez en lugar de repetir
versiones desactualizadas. Estado pendiente central en PRODUCT_BACKLOG_STATUS:
cinco INTEGRATED, calidad de Piano, perfil/grupos/legal y QA humana. Mine privado
requiere integración pública segura; auth/PG/ledger reales no configurados.
No se declara backlog completo ni aceptación comercial humana.
