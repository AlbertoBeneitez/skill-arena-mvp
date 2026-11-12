# v178-saturn — Portadas, Enviar juego con el formato de la app, Avatar más simple, ranking con buscador y cartera nueva (12-nov-2026)

Base: v177-saturn.

## Portadas (imagen de presentación del catálogo)
- **Billar:** las quince bolas juntas en el triángulo inicial (la 1 delante y la 8 en el centro de la tercera fila).
  La blanca espera delante con el taco preparado (`billiards_rack()` en `generate-covers.py`).
- **Bowling:** la escena sube (`shifted(-24)`; desde v162 estaba 46 más abajo) para que la bola quede por encima del
  nombre de la tarjeta.
- **Orb Burst:** vuelve la portada anterior (v162), idéntica byte a byte.
- **Stack Shift:** portada nueva y realista, un render 3D con three.js:
  - bloques lacados con canto redondeado, sombras suaves y reflejos;
  - el pozo de cristal con postes metálicos y una fila iluminándose al limpiarse;
  - la pieza cayendo sobre su sombra de aterrizaje;
  - renderizador en `scripts/render-stackshift-cover.mjs`, con la escena en `scripts/stackshift-cover/entry.ts`;
  - three.js solo se usa para generar la imagen; consta en `THIRD_PARTY_NOTICES.md`.

## Enviar juego: el formato de la app (paquete formato 2)
- **Formato 2:** los estudios escriben el juego igual que los de Galactic Games:
  - `src/core.ts`, las reglas, como un `GameCore` igual a `lib/verified/*Core.v*.ts`;
  - `src/game.ts`, la pantalla en canvas, con lo mismo que recibe `CoreCanvasGame`;
  - `kit/`, con el contrato y el RNG con semilla;
  - la **imagen de presentación obligatoria** (`cover.webp`, 16:11).
- **Integración:** un juego aprobado lo integra Claude como versión nueva cuando el propietario le pasa el .zip. La
  lista de pasos está en `docs/STUDIO_SUBMISSIONS.md`.
- **Kit nuevo** (`studio-kit/`, empaquetado en `public/studio/galactic-games-kit.zip`), con el ejemplo «Pulse»
  reescrito en TypeScript:
  - `npm run check`: la misma prueba de determinismo que pasamos antes de integrar;
  - `npm run preview`: jugarlo en el navegador;
  - `npm run zip`: preparar el envío.
- **Comprobación al subir** (`lib/studio/package.ts`): es estática, porque en la subida no se ejecuta código:
  - el zip y el manifiesto (con `width` y `height`);
  - las reglas sin reloj, `Math.random`, APIs del navegador, red, `eval` ni imports no relativos;
  - la pantalla sin red, `eval` ni URLs externas;
  - la imagen de presentación.
- **Las subidas solo aceptan formato 2.** El formato 1 (WebAssembly + HTML) se sigue entendiendo para los paquetes
  ya guardados y publicados; su kit pasa a ser una prueba (`scripts/fixtures/studio/`).
- **Bandeja del propietario:** en los paquetes de formato 2, «Probar» no aparece y aprobarlos no los publica solos.
- **Textos:**
  - el botón es «ENVIAR JUEGO», sin «MI»;
  - la cabecera pide subir el juego y su imagen de presentación;
  - las notas «i» explican el formato nuevo.

## Avatar
- **Perfil:** sin las filas «Ajustes», «Nombre y avatar» ni «Cerrar sesión local».
  - Tocar la ficha de arriba (con un lápiz) edita el nombre y el avatar.
  - Ajustes sigue en el engranaje de la cabecera, y cerrar sesión y borrar datos siguen en Ajustes › Cuenta.
- **Nombre disponible:** cuentan como cogidos, además de los reservados, los nombres de los jugadores de ejemplo
  del ranking, de los miembros simulados de grupo y de los rivales de liga y de cada juego.
- **Ranking:**
  - una sola vista: el selector pone «Global»;
  - al tocarlo se abre un buscador que, sin escribir, muestra los juegos más populares, y al escribir encuentra
    cualquiera;
  - elegir un juego muestra su ranking.

## Cartera
- **Diseño:** el de la pestaña Grupo (panel carbón, líneas hielo).
- **Cantidad:** se escribe en euros, con la equivalencia «1 € = 1 CC».
- **INGRESAR:** en pistacho.
- **RETIRAR:** en ámbar, el color análogo, y abre el paso del **proveedor de pago**.
  - El proveedor aún no está conectado: el paso lo indica y su botón está desactivado.
  - Solo ofrece retirar del saldo ficticio. No mueve dinero real ni pide datos bancarios.

## Validación
- `pnpm lint`, `pnpm test:determinism` (con pruebas nuevas del paquete formato 2), `pnpm build`,
  `scripts/qa-smoke-all.cjs` (13 juegos), `scripts/qa-overlap.cjs` y `git diff --check`.
- El kit nuevo se ha probado aparte: `npm install`, `npm run check`, `npm run zip` y la vista previa en el navegador.
- Capturas a 390 px de las portadas en sus tarjetas, la cartera y la retirada, Enviar juego, el perfil, el ranking
  (cerrado, abierto, buscando y con un juego) y el nombre cogido.
