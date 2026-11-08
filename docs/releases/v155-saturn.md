# v155-saturn — Shot Gallery V13 «Jungla de Xeno» y portadas más abajo (8-nov-2026)

Base: v154-saturn (650c794).

- **Shot Gallery V13** (núcleo nuevo, `lib/verified/shotGalleryCore.v13.ts`; V1–V12 se conservan con verificadores y repeticiones):
  - el escenario es una jungla espacial de noche, en una luna alienígena: troncos, lianas, helechos, setas luminosas, dos lunas y niebla, pintados en cuatro capas de profundidad;
  - hay tres formas de ser: cazadores (máscara biomecánica, rastas con anillas, cañón al hombro y cuchillas), cornudos (cuernos de carnero, fauces y hombreras con púas) y sierpes (capucha de cobra con ocelos y corona);
  - cada ser irradia un aura interna verde, azul, roja o morada: brilla por dentro (ojos, venas, gema del pecho) y deja un halo que late a su alrededor;
  - los seres tienen el mismo acabado que los avatares: placas oscuras con filigrana dorada y gemas;
  - asoman desde diez escondites a tres profundidades, tras troncos o desde la maleza, y nunca en filas. Salen de 4 a 7 por orden;
  - cada orden pide abatir a todos los de un aura o a todos los de una forma, seis de cada tipo. Las dos primeras órdenes son una de cada;
  - desde la cuarta orden, algunos señuelos comparten el otro rasgo del blanco (la misma forma en una orden por aura, la misma aura en una orden por forma);
  - la orden se muestra con «ELIMINA», una esfera del color del aura o el icono de la forma, su nombre y «por su aura» o «por su forma»;
  - la puntuación es la de V12 sin civiles ni hologramas: tiempo de reacción acumulado; un señuelo suma 400 ms, disparar antes de tiempo 600 ms y cada blanco en pie 1500 ms;
  - la portada se genera con el propio renderizador del juego.
- **Portadas más abajo:** en Stack, Bowling, Galoku, Tower Drop y Pinball la escena se reduce y baja, para que quede centrada bajo la insignia de nivel (bronce al empezar). Los bordes se funden con el fondo.
- Ajustes muestra la versión 1.55.

## Validación
- Determinismo completo, con la prueba nueva de Shot Gallery V13:
  - seis órdenes por aura y seis por forma;
  - respuestas únicas;
  - señuelos parecidos desde la cuarta orden;
  - disparos dobles, señuelos, disparos antes de tiempo y partidas sin disparar;
  - repetición dorada.
- Prueba de presentación de Shot Gallery: 432 fotogramas, con varios toques a la vez.
- `pnpm lint`, build y `git diff --check`.
- Prueba básica de los 13 juegos y `qa-overlap`.
- Dos partidas reales en el navegador con toques táctiles, verificadas en el servidor:
  - una limpia: 12 de 12, 12 023 ms;
  - otra con señuelos abatidos a propósito: 14 400 ms.
- Tarjetas del catálogo revisadas: las escenas quedan bajo la insignia.
