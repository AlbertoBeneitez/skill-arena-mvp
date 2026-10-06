# SkillArena2

Laboratorio **mobile-first** para convertir software open-source en juegos transferibles a Skill Arena. La rama `skillarena2` permanece separada de `main`.

## Regla

Un juego solo es candidato si cumple simultáneamente:

- móvil/táctil;
- licencia permisiva y auditable;
- núcleo de código trasladable a Skill Arena;
- determinismo alcanzable;
- score e inputs capturables;
- branding y recursos sustituibles.

## Candidato activo

### Tower Lab

Base: `iamkun/tower_game` (MIT), fijada al commit indicado en `vendor-lock.json`.

El bootstrap conserva el upstream en `vendor/tower` y genera una copia de laboratorio en `public/games/tower` con cambios mínimos alrededor del núcleo:

- orientación y prueba mobile-first;
- branding externo principal sustituido por Skill Arena Lab;
- Google Analytics upstream retirado;
- `Math.random()` reemplazado por PRNG determinista basado en `?seed=`;
- captura de inputs para replay v1;
- telemetría de score/bloques/inputs hacia el launcher.

La verificación autoritativa de replay en servidor **todavía está pendiente**. No usar esta versión para dinero real.

## Referencias no candidatas

HexGL, osu! lazer y Agar.io clone se mantienen solo como referencias técnicas y no se descargan por defecto.

## Ejecutar

```bash
cd skillarena2
npm run bootstrap
npm run check
npm run dev:fast
```

Abrir el puerto **4173**.

Para descargar también las referencias:

```bash
npm run bootstrap:refs
```

## Objetivo de transferencia

Todo candidato deberá terminar adaptándose al contrato de `shared/` y después poder moverse a la carpeta de juegos de Skill Arena sin llevarse el launcher de SkillArena2 ni depender del repositorio upstream completo.
