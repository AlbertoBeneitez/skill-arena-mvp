# v125-saturn — Bowling 3 con bolos personaje, fondo sin corte, avatares e icono nuevo (31-oct-2026)

Base: v124-saturn (8927ab7).

## Bowling 3 (`bowling@3.0.0`; V1 y V2 intactos con sus adaptadores y fixtures)
- **Núcleo** `lib/verified/bowlingCore.v3.ts` y **protocolo** `lib/verified/bowlingProtocol.v2.ts`:
  - pista de 32,0 m al primer bolo (105 ft; V2: 27,4 m). La bola tarda ~1,17× más en llegar; el aceite acaba al 60 %;
  - tirada más sensible: 49 pasos de dirección (centro 24) y 17 de efecto (centro 8). Cada paso mueve la bola ~0,6 de un paso de V2, y el recorrido total llega más lejos (efecto máximo ~1,3×);
  - celebraciones de 1410 ticks (11,75 s): repetición de 1,75 s y un corto de 10 s. SKIP las termina igual que antes.
- **Gesto** (`lib/bowlingGesture.v3.ts`, prueba `scripts/verify-bowling-gesture.ts`):
  - el lanzamiento empieza en el punto más bajo del trazo, así que el arrastre lateral para colocar la bola no cuenta;
  - dirección: la recta entre el principio y el final del trazo;
  - efecto: la mayor separación de la línea dibujada respecto a esa recta (una línea que se curva a la izquierda engancha a la derecha al final, como el final del trazo);
  - potencia: la velocidad final del golpe.
  - Una inclinación de 10 px en un trazo de 300 px ya cambia la dirección.
- **Gráficos** (`scripts/render-bowling-art.py` → `public/art/bowling-lane.webp`, `bowling-pit.webp`):
  - madera de arce y pino con veta, juntas, flechas, puntos y marcas de los bolos, en perspectiva (una fila de textura por línea de pantalla);
  - canales cromados;
  - foso con cortina y panel «GALACTIC LANES» con planeta y neón;
  - kickbacks con neón y reflejos de bolos y bola en el barniz.
- **Celebraciones** (`components/games/bowlingShow.ts`): los bolos tienen ojos, brazos, piernas y zapatillas. Hay tres cortos:
  - **«Despegue»** (pleno): los bolos derribados se marean, se levantan, se ponen el casco y suben a un cohete; cuenta atrás y despegue con los bolos saludando por las ventanillas;
  - **«Disco orbital»** (pleno): una bola de espejos con forma de planeta, una línea de patadas al ritmo y, al final, la pirámide de los diez bolos con confeti;
  - **«Abducción»** (semipleno): un platillo se lleva los bolos con su rayo y los devuelve en paracaídas.
  - El corto de cada pleno sale de un hash de la semilla, el marco y la tirada.
- **Portada** renderizada con el propio motor.
- **Pruebas:**
  - longitud de pista y sensibilidad de los pasos;
  - efecto negativo;
  - nombres de acciones de V1 rechazados;
  - duración del pleno;
  - seis partidas completas con replay;
  - 3 fixtures golden;
  - el gesto.

## Fondo de juego sin corte
- El arte del fondo era un fondo fijo de `.gameScreen`, cuya caja termina en `100dvh`. En un móvil que pinta bajo la barra de gestos asomaba el color liso con un corte.
- Ahora el arte va en una capa fija más alta que `100lvh` más la zona segura.
- La página de juego ya no reserva hueco para la barra de pestañas, que está oculta en juego, así que no se desplaza.
- El fondo pintado en el lienzo (`lib/spaceBackdrop.ts`) también cubre por debajo del viewport.

## Avatares
- El encuadre de la cara se mantiene con menos ampliación: 1,28 (antes 1,5) y 1,36 la seleccionada (antes 1,62).

## Icono y pantalla de arranque
- `scripts/render-app-icon.py` genera `icon-192/512`, `icon-maskable-512` y `apple-touch-icon`. El icono es un gigante gaseoso iluminado con la G tallada y luminosa, el anillo por delante y por detrás, una luna dorada y un fondo de nebulosa.
- El manifiesto ya no ofrece el SVG plano, así que Android usa este PNG en la pantalla de arranque. En una app ya instalada se actualiza cuando Chrome refresca la app instalada, o al reinstalarla.

## Ramas
- El propietario confirmó el borrado de las 10 ramas antiguas y de `chore/fase-0-orden`, que ya está en `mobile-test`. La sesión vuelve a recibir 403 de la política de git, así que el borrado queda para el propietario (comando en `docs/STATE.md`).

## Validación
- `pnpm test:determinism` completo, `tsc`, i18n (10 × 668), `git diff --check` y build.
- Smoke test de los 14 juegos.
- QA a 390 × 844 en la app:
  - Galoku sin corte ni desplazamiento;
  - selector de avatares;
  - lanzamiento de Bowling con un trazo táctil real.
- Fotogramas sin conexión de la pista y de los tres cortos.

## Para continuar (traspaso)
- Flujo de cada ronda en `CLAUDE.md`, `AGENTS.md` y `docs/STATE.md`: rama `vNNN-saturn`, núcleo nuevo si cambian las reglas, pruebas deterministas, doc de versión, push y fast-forward de `mobile-test`.
- Ideas no hechas:
  - un segundo corto de semipleno;
  - sonido propio para los cortos;
  - una prueba de presentación del Bowling en `scripts/` (hoy se comprobó con un banco de pruebas fuera del repositorio).
