# SkillArena2

Laboratorio paralelo a Skill Arena. La rama `skillarena2` no modifica `main`.

## Qué hace

El experimento descarga versiones **fijadas por commit** de cuatro upstreams y evita reescribirlos antes de probarlos:

- **Tower Building Game** — `iamkun/tower_game`, MIT. Se publica como copia jugable casi intacta.
- **HexGL** — `BKcore/HexGL`, MIT. Se publica como copia jugable casi intacta.
- **Agar.io clone** — `owenashurst/agar.io-clone`, MIT. Se conserva como laboratorio de servidor autoritativo.
- **osu! lazer** — `ppy/osu`, MIT para el código. Se trae de forma sparse para estudiar timing/scoring/replay/input; no se incorporan marca ni recursos de osu!.

Los repositorios clonados viven en `vendor/` y **no se versionan dentro de Skill Arena**. Los dos juegos web estáticos se copian a `public/games/` durante el bootstrap.

## Arranque en Codespaces

```bash
cd skillarena2
npm run bootstrap
npm run check
npm run dev:fast
```

Abrir el puerto **4173**.

También puede hacerse en una sola orden:

```bash
cd skillarena2
npm run dev
```

## Agar.io clone

Después del bootstrap:

```bash
cd skillarena2
npm run dev:agar
```

Ese upstream usa Node + Socket.IO y se ejecuta separado del launcher estático. Su objetivo aquí es estudiar arquitectura de servidor, no convertirlo todavía en un juego de Skill Arena.

## Regla del experimento

1. Primero: upstream prácticamente tal cual.
2. Segundo: medir controles, tiempo de sesión, dificultad, rendimiento móvil y superficie de trampas.
3. Tercero: solo si pasa el filtro, crear un adaptador Skill Arena.
4. Cuarto: después añadir determinismo/replay/server-verification y sustituir identidad visual o recursos cuando sea necesario.

No mezclar este laboratorio con el ledger, wallet ni dinero real.
