# v122-saturn — Inicio de sesión activado, marcadores digitales, Ruleta 12, Billar 6 (gymkana) y portadas de cine (29-oct-2026)

Base: v121-saturn (ea542c7).

## Inicio de sesión con otras cuentas (activado por el propietario)
- **Flujo real de servidor** para Google, Apple, X, Discord y Microsoft (`app/api/auth/*`, librería `arctic`):
  - `state` y PKCE;
  - Apple vuelve por POST;
  - sesión en una cookie firmada del dispositivo, con proveedor, id de cuenta y nombre visible, sin correo.
- **Cada proveedor se enciende cuando sus credenciales y `AUTH_SECRET` están en Vercel.**
  - Hoy no hay ninguna configurada, así que los botones siguen mostrando el aviso.
  - Pasos para crearlas: `docs/AUTH_PROVIDERS.md`.
- **Al volver del proveedor:** el nombre se rellena con el de la cuenta y se pasa a elegir avatar.
  - El perfil muestra «Conectado con …».
  - «Cerrar sesión» y «Borrar mis datos» borran la cookie.
- **Avisos:** si el inicio de sesión falla o no está disponible, sale un aviso traducido.
- **Textos legales:** la política de privacidad y la de cookies explican los nuevos datos y las cookies `ga_session` y `ga_oauth`.
- **Pruebas:** firma, manipulación, caducidad, secreto corto, limpieza del nombre y opciones de las cookies. En local se comprobaron la redirección real a Google y Discord y el rechazo de `state` falso, de cookie falsificada y de cierre de sesión desde otro origen.

## Pantalla previa al juego
- Se quitan la frase de descripción y las etiquetas de cualidades.
- **Tablero del rival digital:**
  - avatar con el color de la liga y el nombre;
  - un panel LED con el objetivo en dígitos de siete segmentos (`components/SegmentDigits.tsx`): dorado para fichas, turquesa para puntos.
- **En partida:** la línea de marcador (fichas, tiradas, puntos, nivel…) también es una tira LED con números en segmentos.

## Galactic Roulette 12 (`galactic-roulette@12.0.0`; V1–V11 intactos)
- **Rombos:** los ocho rombos de la pista exterior son ahora deflectores de verdad. Al chocar, la bola se desvía y salta según la velocidad del golpe, con un tope de unos 20 px.
  - Hay choque con un rombo en el 89 % de las tiradas.
  - El salto típico es de 14,8 px.
- **Más rebote en los separadores:**
  - restitución 0,47 (V11: 0,34) y salto con tope de unos 9,6 px (V11: 4,5);
  - suelo del hueco a 0,45 (V11: 0,38);
  - la bola sube 9,3 px en una de cada diez tiradas (V11: 2,2).
- **Reparto justo:** χ² = 27,5 con 36 grados de libertad en 768 tiradas, y la bola siempre acaba en un hueco.
- **Sin fichas no se lanza:** con el tapete vacío, el lanzador muestra un candado y no deja coger la bola (el núcleo ya rechazaba el lanzamiento).
- Se quita la frase «x fichas en la mesa».
- El rombo que golpea la bola se ilumina.

## Billar 6: gymkana de 5 niveles (`billiards@6.0.0`; V1–V5 intactos)
- Excepción pedida por el propietario a la regla de una partida continua, igual que Galactic Birds V5.
- **Mesa de cada nivel:** sale de la semilla de la partida. Es distinta en cada partida y la misma para todos en esa partida.

| Nivel | Mesa | Tiros |
|---|---|---|
| Calentamiento | 2 bolas junto a 2 huecos | 4 |
| Por la banda | 3 bolas pegadas a 3 bandas distintas | 5 |
| Combinación | 2 bolas en línea hacia un hueco + 1 | 5 |
| Eslalon | 3 bolas detrás de un muro de 3 rayadas | 6 |
| Final de la 8 | 4 bolas + 2 rayadas + la 8, que va la última | 7 |

- **Puntuación:**

| Acción | Puntos |
|---|---|
| Lisa metida | +1000 |
| Rayada metida | −400 |
| Blanca en un hueco | −250 (vuelve a la mesa) |
| La 8 al final | +2000 |
| La 8 antes de tiempo | −500 (vuelve a la mesa) |
| Nivel limpio | +500 y 150 por tiro que sobre |

  - Si se acaban los tiros, se pasa al siguiente nivel sin bonus.
  - La puntuación no baja de 0.
- **Interfaz:**
  - rótulos «Nivel N · nombre», «¡Nivel superado! +X» y «Sin tiros · siguiente nivel»;
  - una tira bajo la mesa con los 5 niveles, las bolas del nivel y los tiros que quedan;
  - las bolas de un nivel nuevo aparecen con un fundido.
- **Objetivos:** rival 9000; base de liga 8000. El jugador de prueba con simulación perfecta saca entre 16 100 y 18 750.
- **Pruebas:**
  - 60 mesas por nivel, todas válidas y distintas;
  - puntuación, niveles limpios, tiros agotados, rayadas, la 8 y blanca;
  - partidas completas idénticas al repetir la grabación (replay);
  - partidas de referencia.

## Portadas
- **Tower Drop:** la torre empieza más abajo y ya no tapa la liga. Contrapicado al anochecer, con una grúa que baja el contenedor balanceándose, focos cruzados y ciudad desenfocada.
- **Solitaire Sprint:** bajo una lámpara de sala de cartas. Un arco de cartas vuela del mazo a las cuatro bases y el as de picas queda nítido.
- **Mine Grid:** plano bajo sobre el campo, con el horizonte en la niebla. Hay una explosión a media distancia que tiñe el tablero de naranja, con escombros, humo y una bandera nítida en primer plano.
- **Pinball:** desde los flippers mirando hacia arriba. La bola cromada en primer plano refleja el neón y detrás quedan los bumpers, las rampas y el marcador desenfocado.
- **Halo de luz de `cine()`:** ahora es un degradado y ya no se ve un disco gris. Afecta también a Dardos, Galoku y Stack Shift.
- Las portadas cambiadas llevan `?v=122`.

## Ramas
- `chore/fase-0-orden` es trabajo de hoy de otra sesión, con 5 commits:
  - revisión de código;
  - limpieza de 16 módulos sin uso;
  - CI con la versión de Node de Vercel;
  - `CLAUDE.md` y `docs/STATE.md`.
  No está en v122. Hay que fusionarla o descartarla explícitamente.
- `main`, `archive/*`, `audit/*`, `feature/*`, `improve/*`, `qa/*`, `refactor/*` y `skillarena2` tienen cada una 1 commit antiguo (del 29-sep al 23-oct) que no está en las versiones actuales.
  - Su trabajo ya se rehízo en las vNN.
  - Se pueden archivar como etiquetas y borrar si el propietario lo confirma. No se han tocado.
