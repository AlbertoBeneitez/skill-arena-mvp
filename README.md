# SkillArena MVP

Primera versión de demostración de una plataforma de torneos de habilidad.

## Qué incluye

- Landing + lobby de torneos.
- Wallet visual con créditos ficticios.
- Sin juegos publicados por ahora: cada juego se añade con su especificación y versión registrada (ver más abajo).
- Persistencia temporal mediante `localStorage`.
- Responsive para PC y móvil.
- Preparado para desplegar en Vercel.

## Ejecutar en GitHub Codespaces

```bash
pnpm install
pnpm dev
```

Después abre el puerto 3000 que detecte Codespaces.

## Publicar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. En Vercel, importa el repositorio.
3. Framework: Next.js (detección automática).
4. Deploy.

En esta versión no necesitas `DATABASE_URL` ni `BETTER_AUTH_SECRET`, porque aún no existe una base de datos ni autenticación real.

## Especificación e integridad de los juegos

Cada juego vive con una especificación (`games/<id>/SPEC.md`, plantilla en `docs/game-spec-template.md`) y un manifiesto (`games/<id>/manifest.json`). Los hashes de cada versión quedan en `games/versions.log.jsonl`, un registro solo-añadir encadenado.

```bash
node scripts/game-integrity.mjs verify                      # comprueba hashes, especificación y registro
node scripts/game-integrity.mjs register <id> --version X.Y.Z   # registra una versión nueva tras cambiar el juego
node scripts/game-integrity.mjs scan                        # busca azar o reloj en la lógica de juego
```

Un workflow de GitHub (`Integridad de juegos`) ejecuta `verify` en cada PR y push a `main`. Cuando exista el servidor de partidas, cada partida debe guardar el `digest` de la versión con la que se jugó y rechazarse si no está registrado.

## Siguiente fase recomendada

Sustituir `localStorage` por PostgreSQL y añadir autenticación real. Después, crear un ledger append-only del servidor, torneos persistentes, partidas con identificador de servidor y validación de resultados. La integración EMI/pagos reales debe ir después de esa capa.

## Importante

Esta demo usa créditos ficticios. No custodia dinero ni procesa pagos reales. El motor del juego es deliberadamente simple y sirve para validar experiencia de usuario; no constituye todavía un sistema anti-cheat de producción.
