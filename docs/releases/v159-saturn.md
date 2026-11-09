# v159-saturn — Los retratos nuevos llegan a todos los móviles (9-nov-2026)

Base: v158-saturn (399c303).

- **Causa:** en v157 los retratos nuevos se publicaron con el mismo nombre de archivo, y `/avatars/*` se cachea un día (más una semana de revalidación en segundo plano).
  - En los móviles que ya los tenían, el círculo seguía mostrando el retrato antiguo.
  - La hoja, en cambio, usaba archivos nuevos (`-t`) y mostraba el retrato nuevo, así que lo que se elegía no cuadraba con lo que salía.
- **Arreglo:**
  - las URL de los retratos llevan versión (`lib/avatars.ts`: `portraitSrc`, `portraitCrop`, `AVATAR_VERSION = 157`), en la hoja, el círculo, la barra, el perfil, los rivales, los grupos y los rankings;
  - un perfil guardado con un retrato integrado se pasa a la URL actual al cargar.
- **Hoja de 16:** vuelve a mostrar cada retrato en horizontal (recorte 2:1 centrado en la cara); el elegido lleva un anillo cian. Se quita el círculo sobre fondo desenfocado de v158.
- Ajustes muestra la versión 1.59.
- **Regla:** al cambiar los archivos de retrato, subir `AVATAR_VERSION`.

## Validación
- `pnpm lint`, build y prueba básica de los 13 juegos.
- Navegador: hoja en horizontal, elección y círculo final con la misma cara, inicio y perfil.
