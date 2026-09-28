# SkillArena MVP

Primera versión funcional de una plataforma de torneos deterministas de habilidad.

## Qué incluye

- Landing + lobby de torneos.
- Wallet visual con créditos ficticios.
- Historial y ranking demo.
- Un minijuego jugable (`Neon Dash`) con recorrido fijo y sin RNG.
- Flujo de entrada de 5 créditos y premio ficticio de 9 créditos.
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

## Siguiente fase recomendada

Sustituir `localStorage` por PostgreSQL y añadir autenticación real. Después, crear un ledger append-only del servidor, torneos persistentes, partidas con identificador de servidor y validación de resultados. La integración EMI/pagos reales debe ir después de esa capa.

## Importante

Esta demo usa créditos ficticios. No custodia dinero ni procesa pagos reales. El motor del juego es deliberadamente simple y sirve para validar experiencia de usuario; no constituye todavía un sistema anti-cheat de producción.
