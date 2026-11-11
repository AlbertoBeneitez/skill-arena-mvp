# v169-saturn — Negro y oro metálico, más elaborado, en Grupo y Avatar (11-nov-2026)

Base: v168-saturn.

## Decisión del propietario
- **De las propuestas de v168** (Brawl, Candy, Tapete y la actual en negro), se queda la negra, más elaborada y con el oro metálico en lugar del sepia plano.
- **Las tres propuestas se retiran:** su CSS y el parámetro `?tema=`. Si en la sesión quedaba un tema de vista previa, se borra al abrir la app.

## Grupo (`GroupHub.module.css`)
- **Oro metálico:** degradado de champán a oro profundo, en vez de un oro plano.
  - Se usa en el botón principal, que lleva un brillo lento que lo cruza cada pocos segundos (no se anima si el sistema pide menos movimiento).
  - También en los bordes de lo elegido, en el anillo del jugador y en las cifras importantes: premio, código y puestos.
- **Superficies:** negros en capas con grano fino, luz suave desde arriba y un filete dorado que brilla más en la esquina superior izquierda.
- **Detalles:**
  - pasos numerados como monedas doradas;
  - código en un ticket con borde dorado y troquel;
  - entradilla con un filete dorado;
  - un trazo dorado bajo el titular;
  - juegos elegidos con marco dorado y marca de moneda;
  - placa del premio iluminada;
  - hoja de compartir a juego.

## Avatar (`.avatarScreen` en `globals.css`)
- **Mismo lenguaje:** pestañas Perfil, Ranking, Por juego y Global con la elegida en oro metálico.
- **Identidad:** el avatar con anillo dorado y el resultado en oro (en rojo si es negativo).
- **Estadísticas:** cuatro placas con filete dorado y cifras en oro.
- **Progreso por juego:** filas oscuras y mejor marca en oro.
- **Saldo:**
  - importe en oro;
  - «Añadir» en dorado macizo y «Retirar» con borde dorado.
- **Gráfica de beneficio:** línea dorada sobre una cuadrícula tenue.
- **Ajustes y ranking por juego:** a juego.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px:
  - grupo sin crear, creado, selector de juegos, entrada y premios, y hoja de compartir;
  - perfil completo y ranking.
- Una liga de Billar, Dardos y Bowling arranca con Billar en la jornada 1.
