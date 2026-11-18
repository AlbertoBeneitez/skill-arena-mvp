# CLAUDE.md — Galactic Games

Punto de entrada para cualquier sesión de Claude en este repositorio.

@AGENTS.md

## Antes de trabajar

1. Lee `docs/STATE.md`: es el estado actual en una página y prevalece sobre
   los demás documentos de `docs/` cuando se contradicen.
2. Comprueba la rama y el HEAD, y compáralos con lo que dice `docs/STATE.md`.
3. Si el código y `docs/STATE.md` no coinciden, el código manda: corrige el
   documento en el mismo cambio.

## Forma de trabajar

- Un cambio = una rama corta con un solo propósito (`fix/…`, `feat/…`,
  `chore/…`, `refactor/…`) y un pull request. No mezclar varios juegos ni
  juego e infraestructura en el mismo pull request.
- Tamaño orientativo: unas 400 líneas o un juego por pull request.
- Antes de pedir revisión: `pnpm lint`, `pnpm test:determinism`, `pnpm build`
  y `git diff --check`. Con PostgreSQL local, también `pnpm test:repository`.
- El propietario prueba cada pull request en el móvil desde la vista previa de
  Vercel y es quien aprueba la fusión.
- Todo pull request que cambie el estado del producto (catálogo, versiones,
  infraestructura, decisiones) actualiza `docs/STATE.md`.

## Límites entre capas

- `lib/verified/` y `lib/deterministic/`: TypeScript puro. Nada de React,
  DOM, red, reloj (`Date`, `performance`) ni `Math.random`.
- `lib/server/` y `app/api/`: autoridad. No importan `components/`.
- `components/` y `app/` (páginas): presentación. No importan `lib/server/`
  ni deciden puntuaciones, premios ni saldos.

## Nunca sin el propietario

Lo que `AGENTS.md` enumera en «Autonomy», más: borrar ramas o etiquetas,
cambiar la rama de producción de Vercel, tocar variables de entorno de
producción y cualquier cambio de visibilidad o permisos del repositorio.

## Pagos y costes (propietario, 15 de noviembre de 2026)

«ÚLTIMA VEZ QUE UN PAGO NO ME LO NOTIFICAS.»

- Nada que cueste dinero sin el permiso explícito del propietario: planes de pago,
  pruebas que pasan a ser de pago, dominios, almacenamiento, integraciones o
  cualquier servicio con tarifa. Antes de proponerlo, decir el importe, cada
  cuánto se cobra y cómo se cancela.
- Al empezar cada sesión con acceso a Vercel, mirar los cargos de los últimos
  días y avisar de cualquier cargo nuevo, aunque sea pequeño.
- Si una tarea puede generar uso de pago (más tráfico, más compilaciones, más
  datos), avisar antes de hacerla, no después.
- Propietario (18 de noviembre): una sola subida a `mobile-test` al final de cada
  sesión, con todas las versiones juntas. Cada subida compila en Vercel y cuesta.
  Solo compilan `mobile-test` y `main` (`vercel.json`); las ramas `vNNN-saturn` no.
- Estado al 16 de noviembre: Vercel Pro (20 $ al mes más IVA) ya pagado; el propietario
  ordena **no cancelarlo hasta el 12 de diciembre de 2026** (no proponer cancelarlo antes;
  recordárselo ese día); Neon en plan gratis (1 GB; si se llena, deja de
  escribir, no cobra); GitHub gratis (repositorio público).
