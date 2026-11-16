# v199-saturn — Sin conexión / online, rivales inventados y traducciones (16-nov-2026)

Base: v198b-saturn. App 1.99.

- **Botón negro:** los juegos que no se pueden jugar por dinero (hoy solo Roulette, oculta) y los juegos de estudios
  llevan el botón con el nombre en negro; el dorado queda solo para los juegos por dinero.
- **Globo en la cabecera** (icono del propietario, `network`), junto al altavoz: online (luz verde) o sin conexión
  (gris). Ajuste del dispositivo `online`, por defecto online.
- **Grupo sin conexión:** se añaden y quitan rivales inventados (nombres reservados de ejemplo, retratos de la app).
  Cada rival toma una partida verificada real de otro jugador del mismo juego y plataforma
  (`GET /api/rival-samples`, solo puntuación y tiempo, sin identidad; elección reproducible por semilla). Sin servidor
  o sin partidas, vuelve a la simulación anterior. El jugador real no espera. Sin entrada ni premios (ni ficticios).
- **Grupo online:** con cuenta del servidor, la pantalla de grupos del servidor (v197); sin cuenta, el grupo local de siempre.
- **Traducciones:** pantalla Online y textos nuevos en los 10 idiomas (996 claves).
- **Pruebas:** `verify-group-competition` (rivales con puntuaciones reales, reproducibles) y `verify-groups`
  (muestras: misma plataforma, sin las propias, solo verificadas, solo puntuación y tiempo).
- **Sin partidas jugadas** por Claude (orden del propietario): no se ejecutaron `qa-smoke-all` ni `qa-overlap`, que abren
  los juegos; solo capturas de cabecera y grupo sin pulsar «Empezar».
- **Validación:** i18n, lint, determinismo, `test:repository`, build, `git diff --check`.
