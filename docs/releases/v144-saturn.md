# v144-saturn — Ruleta cenital con bola en 3D y rodillos del Slot más grandes (4-nov-2026)

Base: v143-saturn (358a29e). Solo presentación: ningún núcleo cambia (Roulette 16.0.0, Slot 3.0.0).

- **Roulette:** vuelve la vista cenital de v142 (petición del propietario: solo debía cambiar el movimiento de la bola). La bola se mueve ahora como un lanzamiento en tres dimensiones visto desde arriba:
  - su altura cambia solo cómo se dibuja: cuanto más alta, más grande (más cerca de la cámara) y con la sombra más lejos, más difusa y más tenue; su posición en la rueda es siempre exactamente la del núcleo;
  - el vuelo desde la cuna es un arco balístico cuyo pico crece con la fuerza del lanzamiento (el núcleo lo vuela en línea recta, con la misma velocidad y duración);
  - dentro de la rueda la altura es la del núcleo (botes en rombos y trastes), aumentada ×2,5 para que se aprecie en el móvil, más dos botes de llegada dibujados que se apagan en el primer medio segundo tras pasar el borde;
  - la bola en la cuna se eleva al cargar el lanzamiento; una bola rápida deja una estela tenue; sombreado esférico con brillo.
- **Slot:** rodillos más grandes: tambores de 104 px de ancho (antes 92) y símbolos hasta 92 px de paso al 84 % (antes 74 al 81 %); las tablas de rodillos superiores quedan compactas en todas las pantallas para dejarles el sitio.
- `verify-roulette-presentation` vuelve a la vista cenital: la bola se dibuja en la posición del núcleo y su tamaño sigue su altura (la del núcleo en la rueda, más los botes de llegada dibujados).

## Validación
- `tsc`, `pnpm lint`, determinismo completo, build, prueba básica de los 14 juegos y `qa-overlap`.
- Slot a 360 × 640, 375 × 667 y 412 × 915; ruleta: lanzamiento, llegada, rodadura y reposo.
