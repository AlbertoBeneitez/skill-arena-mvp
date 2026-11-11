# v173-saturn — Telemetría cítrica en Grupo y Avatar, cartera manual, dardos separados, «Tu selección» siempre, juegos sin cambio de escenario, Galoku y Billar (11-nov-2026)

Base: v172-saturn.

## Color (decisión del propietario)
- **Telemetría con la variante ámbar, más verdosa:** acento cítrico `#d2df3a`, sobre texto `#151903`. Pasa a ser el aspecto por defecto de **Grupo y Avatar** (no del resto de la app, por decisión del propietario).
- **Se retiran las vistas previas `?tema=`:** si en la sesión quedaba alguna, se borra.

## Cabecera: cartera
- **Cantidad a mano:** se escribe en un campo con el € dentro, en euros con hasta dos decimales y un máximo de 100 000.
- **«INGRESAR» y «RETIRAR»:** se activan solo con una cantidad válida; para retirar, además, no puede superar el saldo. Intro ingresa.

## Juegos
- **«Tu selección» siempre visible**, como primera fila: tus juegos más jugados primero y, hasta seis, los primeros del catálogo.
- **Portada de Dardos:** los tres dardos se separan y ya no se montan unos sobre otros. Uno está en la zona del 12, otro en el 20 y otro en la del 1/18, todos lanzados desde el mismo sitio.
- **Juegos verificados (todo `CoreCanvasGame`):** el tablero no se dibuja hasta que llega el escenario del servidor. Antes se veía la vista previa local, con otra semilla, y cambiaba tras la cuenta atrás; ahora el juego aparece ya bien cargado, con un fundido breve.
  - Solo cambia la presentación: no cambia ni la lógica ni el momento en que se pide el escenario, para no alterar la política de abandono.
- **Galoku:**
  - las cifras se dibujan en la fuente de títulos, con degradado y sombra, y centradas ópticamente midiendo el glifo;
  - el teclado tiene teclas en relieve, con canto inferior y brillo superior;
  - las cifras del tablero siguen el mismo estilo.
- **Billar:**
  - se quitan los paneles de abajo (nivel, bolas y tiros), que ya están en el marcador; queda solo la barra de fuerza;
  - los avisos («Nivel 1 · Calentamiento», faltas y la 8) pasan debajo de la mesa y nunca tapan el marcador.

## Validación
- `pnpm lint`, `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px:
  - Billar antes y después de la cuenta atrás;
  - Galoku;
  - Grupo y Avatar en cítrico;
  - inicio con «Tu selección»;
  - cartera con 12,50 € ingresados a mano.
