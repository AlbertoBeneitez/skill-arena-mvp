# v174-saturn — Cosmicoins, Grupo con «EMPEZAR», Enviar juego con notas «i» y auditoría técnica (11-nov-2026)

Base: v173-saturn. Rama `v174-saturn`, sin fusionar en `main` ni en `mobile-test`: el propietario la prueba desde
la vista previa de Vercel de la rama.

## Producto
- **Cosmicoins en toda la app:** el saldo, las entradas, los premios, los movimientos y el beneficio neto se muestran en
  cosmicoins (`CC`, por ejemplo «25,00 CC»). La equivalencia es 1 CC = 1 €.
  - Los registros internos y la moneda del servidor siguen en `EUR`, así que no cambia ningún dato guardado.
  - El símbolo vive en `COIN_SYMBOL` (`lib/i18n`), para poder cambiarlo en un solo sitio.
- **Grupo:**
  - el botón pasa a «EMPEZAR»;
  - en Eliminatorias se quita «X rondas hasta el ganador».
- **Enviar juego:**
  - el botón de la pantalla inicial abre directamente la página de envío;
  - cada paso real (descargar el kit, adjuntar el archivo y enviar) lleva una nota informativa «i» a su derecha que se
    abre y cierra en el sitio (`aria-expanded`).
  - Desaparece la pantalla intermedia de instrucciones.

## Auditoría técnica

| Propuesta | Decisión | Motivo |
| --- | --- | --- |
| 1 · Desempates deterministas | **Implementar** | Había empates que se resolvían por el orden de la lista de jugadores (arbitrario) y un empate exacto contra el rival de liga contaba como victoria. |
| 2 · Modularización | **Parcialmente** | Se extrae lo que reduce acoplamiento real. No se trocea `globals.css` en masa, porque el orden de la cascada es parte del comportamiento y el riesgo supera al beneficio. |
| 3 · Controles de calidad | **Implementar** | oxlint en `pnpm lint` con reglas que previenen fallos reales; encontró 17 restos de código muerto. |
| 4 · Carga selectiva de motores históricos | **Descartar** | Medido: el ahorro máximo es de unos 10–15 ms de arranque en frío, a cambio de un registro asíncrono y riesgo para los replays. |

### 1 · Desempates (implementado)
- **Competiciones de grupo:** a igual puntuación decide el **menor tiempo**. Si también empatan en tiempo, decide un
  **sorteo con semilla** (FNV-1a sobre competición, ronda, semilla de la partida y jugador): es reproducible y no
  depende del orden de la lista.
  - Se aplica a Eliminatorias (quién cae en la última plaza y el orden de varios eliminados en la misma ronda), a las
    victorias de jornada en Liga y a los duelos.
  - Va versionado como `tieBreak: "time-v1"`: solo lo usan las competiciones creadas desde v174. Las guardadas antes
    conservan su regla, así que su clasificación no cambia.
  - Los miembros simulados registran un tiempo determinista.
- **Liga contra rival:** el rival tiene ahora un tiempo de referencia. Un empate exacto a puntos lo gana quien lo hizo
  en menos tiempo; antes contaba como victoria del jugador. Los rivales guardados sin tiempo mantienen la regla antigua.
- **Partidas públicas del servidor:** ya resolvían alcance → tiempo → sorteo con semilla. Se revisan y no cambian.
- **Pruebas:** `scripts/verify-group-competition.ts` cubre el desempate por tiempo, el sorteo reproducible e
  independiente del orden, el eliminado más lento, los eliminados de una misma ronda y el duelo empatado. También
  mantiene la regla antigua para las competiciones guardadas.

### 2 · Modularización (parcial)
- `components/WalletPanel.tsx` y su `.module.css`: la cartera sale de `DemoApp.tsx`, con su propio estado de texto y
  `parseWalletAmount`. Se borran sus dos capas de `globals.css`.
- `components/StudioWelcome.tsx` y su `.module.css`: la bienvenida de Enviar juego reúne sus tres capas de
  `globals.css` (v163, v167 y v171) con los valores finales. También se borran las reglas muertas de los pasos.
- `DemoApp.tsx` pierde constantes y funciones sin uso (`STAKES`, `LEAGUE_ICONS` y `selectStake`).

### 3 · Controles de calidad (implementado)
- **Adopción de oxlint:** typescript-eslint no funciona con TypeScript 7 nativo (no hay API de JS), así que se adopta
  oxlint 1.93.0. Tarda unos 1,3 s y lo ejecuta `pnpm lint` después de `tsc`, de modo que CI lo pasa sin un paso nuevo.
- **Reglas, medidas antes de activarlas:**
  - `react/rules-of-hooks` da 2 falsos positivos, en un núcleo histórico que queda excluido.
  - `react/jsx-key` y `import/no-cycle` no dan avisos hoy y quedan como guarda.
  - `no-unused-vars` dio 17 casos en código de producto, todos corregidos.
- **Reglas no activadas:**
  - `exhaustive-deps`: 12 avisos, todos patrones intencionados con refs o callbacks estables, así que solo añadiría ruido.
  - Las reglas del React Compiler: solo serían avisos.
- **Fuera del lint:** los núcleos versionados (`lib/verified/*Core.v*.ts` y `*Protocol.v*.ts`), porque son inmutables
  y no se tocan para contentar al linter.

### 4 · Motores históricos (descartado)
- **Servidor:**
  - el bloque del verificador mide 627 459 bytes (103 KB con gzip) y se carga una vez por ruta de verificación;
  - V8 lo compila en unos 15 ms, y la importación añade unos 4,5 MB de memoria.
- **Cliente:** los núcleos ya se cargan por juego (2,1 MB repartidos en 46 bloques).
- **Conclusión:** la carga diferida ahorraría como mucho el arranque en frío y obligaría a hacer asíncrono el registro
  de verificadores. Eso es justo la pieza que garantiza los replays, así que se conserva.

## Validación
- `pnpm lint` (tsc y oxlint), `pnpm test:determinism`, `pnpm build`, `scripts/qa-smoke-all.cjs` (13 juegos),
  `scripts/qa-overlap.cjs` y `git diff --check`.
- Capturas a 390 px: bienvenida de Enviar juego, página de envío con sus «i» (cerrada y abierta), cartera en CC y Grupo
  con «EMPEZAR».
