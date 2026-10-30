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
