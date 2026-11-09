# v157-saturn — Avatares nuevos encuadrados en la cara (9-nov-2026)

Base: v156-saturn (b406af7).

- **16 retratos nuevos** (aportados por el propietario) sustituyen a los anteriores, con los mismos identificadores `portrait-01` … `portrait-16`, así que los perfiles guardados siguen siendo válidos. Son:
  - dragón celeste, elfa alada, cuervo pirata, chacal dorado, bailarina de fuego, sacerdotisa solar;
  - sabio seta, ángel de piedra, lobo de hielo, dragón rojo, hechicera lunar, cobra dorada;
  - chacal mago, samurái mantis, vidente de la luna, reina insecto.
- **Cada retrato tiene tres recortes centrados en la cara**, sacados del original vertical:
  - un cuadrado de 512 px para el círculo grande de alta, perfil y resultados;
  - su copia de 192 px para la barra inferior, el perfil, los rivales y los rankings;
  - un recorte 2:1 (512 × 256) para cada casilla de la hoja de 16 avatares.
- Se quitan los desplazamientos por retrato (`AVATAR_FACES`) y el zoom de la hoja: cada casilla muestra su recorte entero.
- Ajustes muestra la versión 1.57.

## Validación
- `pnpm lint`, build, determinismo, prueba básica de los 13 juegos y `qa-overlap`.
- En el navegador:
  - círculo de alta con el avatar aleatorio;
  - hoja de 16 avatares;
  - elección de otro avatar;
  - perfil y barra inferior.
