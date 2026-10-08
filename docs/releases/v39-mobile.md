# v39-mobile · Alien Dash V2

Parte de v38-mobile. El ID dino-dash se conserva y el nuevo core 2.0.0 mantiene VERIFIED mediante el adapter/replay común. Dino V1 queda congelado. Plataformas con aterrizaje descendente, obstáculos de distintas alturas, drones, centinelas que anticipan y disparan, escudos recogibles y tres vidas. Dos minutos de progresión: introducción separada, variedad y combinaciones crecientes. Colonia espacial y personaje/arte originales, controles grandes para salto y agachado.

La infraestructura común añade una señal opcional de feedback de presentación: distancia continua no produce un sonido de premio por frame. No cambia scoring, HUD o replay y las demás integraciones conservan el comportamiento anterior. No se activa competición, identidad ni dinero reales.

Validación técnica: golden 25690 puntos/tick 14400; replay/render 60/120/144 Hz; 24 partidas completas; 64 progresiones con 67 ms de retraso de controles; 128 aperturas sin daño en tres segundos; colisiones/plataformas/coyote/escudos e inputs inválidos. Typecheck/lint, históricos, tests PostgreSQL local y build pasan. QA táctil en producción local: partidas completas vertical/horizontal, derrota, cancelación de agachado, doble toque sin salto aéreo, verificación única, sonido sin spam y reinicio. Cero errores de página; QA física humana recomendada.

Pendiente: opening Jet, nueve juegos INTEGRATED, Piano y UX global; Mine privado validado localmente aún requiere integración pública segura. Ranking propio y partidas reales requieren servicios externos. Backlog completo en PRODUCT_BACKLOG_STATUS.md; no se declara terminado.
