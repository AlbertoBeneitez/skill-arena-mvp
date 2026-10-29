# v121-saturn — Escenario orbital común, botones propios, cuentas de inicio, catálogo más fluido y portadas de cine (29-oct-2026)

Base: v120-saturn (e15e17d). No cambia ningún núcleo competitivo: todo es presentación.

## Hilo ilustrativo común
- **Escena compartida** (`components/OrbitalScene.tsx`): un mundo vectorial original, el mismo en la bienvenida, la elección de avatar y el catálogo.
  - **Contenido:**
    - gigante gaseoso con anillos, iluminado desde arriba a la izquierda;
    - sombra de los anillos sobre las nubes y del planeta sobre los anillos;
    - nebulosa violeta y turquesa;
    - estrellas con semilla fija;
    - una órbita con tres «lunas» de juego: una bola 8, una ficha y un dardo.
  - **Cámara por pantalla:**
    - **Bienvenida:** planeta arriba.
    - **Avatar:** la cámara baja y el planeta queda en el borde superior. Es un único movimiento de transformación compuesta de 1,15 s.
    - **Catálogo:** solo cielo, atenuado.
- **Paleta:**
  - abismo `#050a1a` y profundo `#0b1630`;
  - ion `#7fe3ee`;
  - oro de anillo `#e9c27a`;
  - nebulosa `#8c7bff`;
  - tinta `#e8f0fb`.
- **«Liga X» → «X»** en los 10 idiomas: «Bronce», «Rival Bronce»; las etiquetas accesibles también.

## Botones de interfaz
- **Iconos** (`components/UiIcon.tsx`): un sistema de dibujo propio en rejilla de 24, trazo 1,8, puntas redondas.
  - altavoz con y sin sonido, engranaje de 8 dientes, atrás, cerrar, subir foto, cuadrícula, fantasma, mando, grupo, trofeo, salir y papelera;
  - sustituyen a los emoji 🔊/🔇/👻/↻ y a las flechas ←/✕/⎋.
- **Botón de icono común** (`.gxIconBtn`): 42 px, panel con bisel y canto ion.
  - El altavoz lleva un piloto que indica si el sonido está encendido.
  - Mismo estilo en la cabecera, en la cabecera de juego, en Ajustes y en las hojas de documentos.

## Pantalla de inicio
- **Composición tipo póster:** planeta y anillos arriba, debajo el título en dos niveles:
  - «GALACTIC» grande;
  - «GAMES» en oro, espaciado, entre filetes.
- **Cuentas:**
  - «Continuar con Google» y «Continuar con Apple»;
  - «Otras cuentas»: X, Discord y Microsoft, con sus logotipos según sus guías (ver `THIRD_PARTY_NOTICES.md`).
- **Ninguna cuenta está activada:** tocarla muestra un aviso flotante y la entrada sigue siendo «Iniciar sesión · Sesión local en este dispositivo».
  - Configuración en `lib/authProviders.ts`.
  - Requisitos y recomendación en `docs/AUTH_PROVIDERS.md`.

## Elección de avatar
- El título queda en el tercio superior, sobre la escena que continúa.
- Retrato más grande y el bloque centrado.
- Dos botones con icono y texto: «Elegir avatar» y «Subir foto».
- Los 16 avatares se abren a pantalla completa en 8 filas × 2 columnas, con número, marca de seleccionado y botón de cerrar.

## Pantalla de juegos
- Se quita «Elige tu reto»; el título queda solo para lectores de pantalla.
- Rankings pasa a una píldora pequeña con trofeo.
- **Barra de pestañas nueva:**
  - iconos dibujados para Juegos y Grupo, y avatar con anillo;
  - indicador superior ion en la pestaña activa;
  - etiquetas en minúscula inicial;
  - fondo sólido.
- **Desplazamiento más rápido:** con la pantalla quieta, Chrome repintaba 480 veces en 3 s. Ahora son **0**. Cambios:
  - se quitan las animaciones infinitas que repintaban: borde que barría las 14 tarjetas, brillo pulsante del botón de jugar y estrellas animadas;
  - el reflejo del botón ahora es solo de transformación;
  - cabecera y barra sin desenfoque de fondo en vivo;
  - fondo fijo como capa compuesta, sin `background-attachment: fixed`.

## Portadas (`scripts/generate-covers.py`)
- **Shot Gallery:** vista táctica a través de una mira de noche:
  - placas de acero en su bastidor y un impacto con chispas;
  - retícula con mil-dots y punto rojo;
  - lecturas de alcance y viento;
  - focos en la bruma y sacos terreros desenfocados.
- **Stack Shift:** el pozo real del juego:
  - 8 columnas y los 6 colores con su bisel;
  - pieza cayendo sobre su silueta discontinua;
  - línea limpiándose, suelo menta y bandeja «NEXT».
- **Mine Grid, Galoku, Dardos y Pinball:** pase de cine ligero sobre la imagen que ya había (función `cine()`):
  - viñeta que enfoca el punto de interés;
  - halo de luz principal y destello anamórfico;
  - haz de luz volumétrico.
  - Mine Grid además lleva humo y brasas.
- Las seis portadas llevan `?v=121` para que no se sirva la versión en caché.

## Validación
- `pnpm lint` (tsc), determinismo e i18n (632 claves × 10).
- Build de producción.
- Smoke de los 14 juegos.
- Capturas en 390×844, 375×667 y árabe (RTL).
- Traza de pintado en reposo del catálogo.
