# v129-saturn — Pasada de diseño: DESIGN.md, tipografía propia y feedback táctil (1-nov-2026)

Base: v128-saturn (10f1510). Solo presentación: ningún núcleo ni regla cambia.

Petición del propietario: una auditoría «Awesome Design», aplicando solo las mejoras claras; donde algo fuera un paso atrás, se mantiene lo anterior. Resultado de la auditoría:

| Punto | Estado encontrado | Decisión |
| --- | --- | --- |
| Tokens / DESIGN.md | No existía `DESIGN.md`; los tokens estaban repartidos en `globals.css` | Se crea `DESIGN.md` con los tokens reales y sus papeles |
| Paleta | Ya temática (abismo, ion, oro de anillo); 2 usos de morado decorativos | Se mantiene; se documentan los papeles (ion = interactivo, oro = dinero y puesto, degradado de lanzamiento = jugar) |
| Tipografía | La interfaz pedía «Inter» sin cargarla, así que salía Roboto o la del sistema | Chakra Petch (interfaz y texto) y JetBrains Mono con dígitos fijos (cifras); Unbounded sigue en la marca y los títulos |
| Profundidad | Paneles con degradado, borde y sombra; sin desenfoque desde v121 | Se mantiene: el desenfoque en directo daba tirones al desplazar en móvil |
| Interacción | Estados de foco y pulsación irregulares en la interfaz | Pulsación (1 px, −1,5 %, brillo), hover donde lo hay y anillo de foco ion; con movimiento reducido no hay recorrido |
| Textos | Ya concretos y honestos con el alcance | Solo «CONTINUAR» → «DESPEGAR» al entrar a la app; dinero y reglas siguen literales |

## Detalle
- **Tipografía:**
  - `@font-face` de Chakra Petch 400/600/700 (latin y latin-ext) y JetBrains Mono variable;
  - tokens `--gx-ui` y `--gx-data`;
  - las 9 pilas «Inter…» pasan a `var(--gx-ui)`;
  - las cifras con fuente de datos son el saldo, el código de grupo, las clasificaciones, la puntuación del ranking, las estadísticas del perfil y el selector de jornadas.
- **Rendimiento:** pesa 112 KB en total; con el español solo se descargan los ~70 KB del subconjunto latino.
- **Pulsación:** usa las propiedades `translate` y `scale`, que se suman al `transform` de posicionamiento sin pisarlo; queda fuera de `.gameScreen`.
- **Procedencia:** en `THIRD_PARTY_NOTICES.md` y en `docs/licenses/`.
- **Scripts de QA** actualizados al nuevo texto del botón de entrada.

## Validación
- `tsc`, i18n (10 × 692), determinismo completo, `git diff --check` y build.
- Prueba básica de los 14 juegos.
- Capturas a 390 × 844 de bienvenida, alta, catálogo, formulario de grupo y perfil. Las tipografías cargan: Unbounded, Chakra Petch 400/600/700 y JetBrains Mono.
