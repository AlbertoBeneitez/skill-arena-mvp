# v188-saturn — Ranking Juegos, copia sin comentarios y tareas esenciales (13-nov-2026)

Base: v187-saturn.

- **Ranking › Jugadores | Juegos:** la pestaña Ranking del avatar tiene dos tipos. «Jugadores» es lo que había
  (Global o un juego). «Juegos» (`components/GamesIncomeRanking.tsx`) muestra los ingresos de cada juego: su parte de la
  comisión del cambio según sus partidas. Gráfica de ingresos del mes en los últimos 6 meses, lista de juegos ordenada
  con barras y, al tocar uno, su evolución de 6 meses. Una sola serie por gráfica, valor en texto, tabla para lectores
  de pantalla. Hasta que exista el libro de cuentas son **datos de ejemplo** (`lib/demo/sampleGameIncome.ts`) y la
  pantalla lo dice. 10 idiomas.
- **Integrar juegos de estudios sin leer sus comentarios:** `scripts/studio-strip-comments.mjs` copia el paquete sin
  comentarios con el analizador de TypeScript 5 (`typescript-api`, solo desarrollo, Apache-2.0) y vuelve a analizar cada
  archivo; lo que no es código queda aparte. Con el kit: 38 comentarios quitados y el mismo JavaScript al compilar
  (salvo cómo se escribe un número). Paso 0 del procedimiento en `docs/STUDIO_SUBMISSIONS.md`; Claude escribe sus
  propios comentarios al integrar.
- **Anti-bots:** diseño por capas en `docs/ANTIBOT.md` (navegador real con Vercel BotID, una persona una cuenta,
  semillas secretas, señales de comportamiento sobre las entradas de cada partida, recuento y dinero) y orden de
  construcción.
- **Tareas del propietario:** `docs/TAREAS_PROPIETARIO.pdf` pasa de 10 a 7: fuera el mantenimiento manual, la
  comprobación de forks (la hace Claude) y volver atrás (queda en el manual); nueva tarea de dominio y correo, con el
  aviso de salud dentro.
- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`; capturas de Ranking › Jugadores, Juegos y el detalle de un juego.
