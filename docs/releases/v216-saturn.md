# v216-saturn · Inicio con cuenta, «Tu selección» grande y menos compilaciones (app 2.16)

- Al abrir la app con una cuenta ya cargada: pantalla propia con el avatar, «Hola de nuevo» y el nombre, «Entrar» y «Usar otra cuenta» (cierra la sesión y vuelve a la bienvenida para entrar con otra o crear una). Tras iniciar sesión se va directo a Juegos. 10 idiomas.
- Catálogo: «Tu selección» tiene las tarjetas más grandes (dos por pantalla); Populares, las segundas; el resto igual.
- Coste: cada subida compilaba dos veces en Vercel (rama `vNNN-saturn` y `mobile-test`). `vercel.json` (`ignoreCommand`) ahora solo deja compilar `mobile-test` y `main`, y se hace una sola subida por sesión (regla añadida a CLAUDE.md). Revierte la decisión del 7 de octubre de compilar también las ramas de versión.
