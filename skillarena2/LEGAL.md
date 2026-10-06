# Política legal del laboratorio

SkillArena2 separa cuatro capas que deben auditarse por separado antes de producción:

1. código;
2. dependencias;
3. assets (gráficos, audio, fuentes);
4. marca / identidad visual.

## Tower Lab

Upstream: `iamkun/tower_game`  
Licencia declarada del repositorio: MIT.

El bootstrap conserva el archivo LICENSE original. La versión de laboratorio sustituye el branding principal visible y elimina el analytics del upstream, pero **los assets de gameplay todavía no se consideran aprobados para producción hasta completar el inventario asset por asset**.

Estado: apto para prototipo técnico; no aprobado aún para explotación con dinero real.

## Referencias

HexGL, osu! lazer y Agar.io clone no forman parte actualmente del catálogo candidato. Se conservan únicamente para estudiar técnicas concretas cuando sea necesario.

## Regla de producción

Ningún candidato pasa a Skill Arena principal hasta tener:

- licencia del código confirmada;
- listado de dependencias y licencias;
- inventario de assets y procedencia;
- branding propio;
- atribuciones obligatorias conservadas;
- revisión de similitud visual/marca;
- determinismo y verificación técnica cerrados.
