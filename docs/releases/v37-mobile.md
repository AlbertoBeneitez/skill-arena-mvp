# v37-mobile · Shot Gallery

Parte de v36-mobile. Reaction Test pasa a Shot Gallery (ID histórico conservado), core 1.0.0 y server replay VERIFIED. Doce pruebas progresivas de colores, formas, números y combinaciones. Suma autoritativa, errores recuperables, cap de 100 ms y feedback claro. Loader lazy y adapter del sistema existente, sin arquitectura paralela.

- Golden: 9090 puntos, tick 3385, hash/replay/render 60/120/144 Hz.
- 1536 pruebas con respuesta única, 32 partidas completas, inputs inválidos/límites/duplicados, anticipación/error/timeout y suma.
- QA táctil real: 12 aciertos vertical (9965 puntos), 12 horizontal (10030), derrota por 12 errores y derrota por 12 anticipaciones; cancelación, doble toque, resultado único y reinicio. Cero errores de página.
- Typecheck/lint, tests deterministas, repositorios PostgreSQL local y build pasan. Históricos intactos.

No se activa identidad, competición o dinero real. QA física humana pendiente. Quedan Alien Dash, opening Jet, nueve juegos INTEGRATED y pulido global/resultados/ranking; Mine 1.0 está validado localmente pero aún no activado públicamente.
