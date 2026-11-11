# v171-saturn — «Enviar juego» con instrucciones, Grupo rehecho (modalidades, jornadas, eliminatorias, reparto ±5 %, foto y nombre), cartera en la cabecera, Avatar más limpio y tres propuestas de color (11-nov-2026)

Base: v170-saturn.

## Enviar juego
- **Pantalla inicial:** al pulsar «Enviar juego» se abre siempre «Envía tu juego y gana dinero»: si lo publicamos, te llevas el 50 % de la comisión de cada partida. Lleva el botón «VER INSTRUCCIONES».
- **Instrucciones:** «Cómo enviar tu juego» en 4 pasos (kit, crear, subir el .zip y revisión con el 50 %), con «ENVIAR MI JUEGO», que abre el formulario de siempre, y «Volver».
- **Sustituye la bienvenida única** de v163.

## Grupo
- **Cabecera en una fila:**
  - foto del grupo, que el organizador sube desde el móvil (se recorta en cuadrado de 192 px y se guarda con el grupo);
  - nombre en una línea, que se cambia al tocarlo (lápiz);
  - código justo debajo del nombre.
- **Formato:** Partida única, Liga y **Eliminatorias** (antes Torneo).
- **Liga, Modalidad:** «Todos contra todos» o «Duelos 1 vs 1».
- **Liga, Final:** «Número de jornadas» con − y + (1 a 30). Se quita «A votación» al crear; las ligas antiguas por votación siguen funcionando.
- **Eliminatorias:** «Eliminados por ronda» con − y + (de 1 a jugadores − 1), con el número de rondas hasta el ganador.
  - Regla nueva en `lib/groupCompetition.ts`: `eliminatePerRound`, por defecto 1. Siempre queda al menos uno; el peor cae primero.
- **Reparto del bote** (desplegable): todas las posiciones de arriba abajo (1.º, 2.º… hasta el número de jugadores), con su importe y − / + de 5 en 5 %. Por defecto 70 / 20 / 10 y 0 % para el resto.
  - **Cómo cuadra:** al subir o bajar un puesto, la diferencia la pone o la recibe el último puesto con premio. Si es el mismo, el puesto más cercano que mantenga el orden.
  - **Límites:** siempre suma 100 y ningún puesto cobra más que el anterior. Los botones que romperían esto se desactivan (`stepSplit`, `defaultSplit`).

## Cabecera: cartera
- **El botón del saldo abre un desplegable** con:
  - el saldo;
  - la cantidad (10, 20, 50 o 100 €);
  - «INGRESAR» y «RETIRAR»;
  - los últimos movimientos.
- Se cierra al tocar fuera, con Escape o al cambiar de pantalla.

## Avatar
- **Quitado:**
  - el título «Tu avatar» (queda solo para lectores de pantalla);
  - «Identidad local»;
  - «Cuenta en este dispositivo»;
  - el cuadro de saldo con «Añadir» y «Retirar» (ahora en la cartera de la cabecera).
- **Beneficio neto:** va justo debajo del nombre.

## Tres propuestas de color para Grupo y Avatar
- **Vista previa:** con `?tema=1`, `?tema=2` o `?tema=3`; `?tema=0` vuelve al negro y oro, que sigue por defecto.
  1. **Pista:** verde hierba profundo, crema, morado de club en botones y selección, y oro solo para el dinero.
  2. **Marfil:** tarjetas de marfil sobre negro, texto en tinta, bermellón en botones y selección, y el premio en una placa negra.
  3. **Telemetría:** carbono con cuadrícula fina, naranja de señal, cifras en azul hielo y esquinas firmes.

## Validación
- `pnpm lint` y `pnpm test:determinism`. El test de grupos añade los repartos ±5 % (pulsaciones al azar siempre válidas) y las eliminatorias de dos por ronda (6 → 4 → 2 → 1).
- `pnpm build`, `scripts/qa-smoke-all.cjs` y `scripts/qa-overlap.cjs`.
- Capturas a 390 px:
  - las dos pantallas de «Enviar juego» y el formulario;
  - la cartera;
  - el grupo con foto y nombre cambiado;
  - liga y eliminatorias;
  - el reparto por posiciones;
  - el perfil;
  - las tres propuestas en Grupo y Avatar.
