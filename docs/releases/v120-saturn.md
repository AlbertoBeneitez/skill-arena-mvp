# v120-saturn — Ruleta 11, resultado del rival, dardos con más control y Billar 5 (bola 8) (28-oct-2026)

Base: v119-saturn (7e28c15).

## Resultado del rival en todos los juegos
- Tras cada partida, la pantalla de resultado empieza con un marcador «Tú VS rival»: tu resultado, el del rival, y quién gana.
- **De dónde sale el rival** (`components/RivalScoreboard.tsx`):
  - el rival de liga, con su nombre, avatar y resultado;
  - el rival de un duelo real: el servidor devuelve ahora `opponentScore` cuando la partida está resuelta;
  - el objetivo de un grupo o el resultado a batir en un reto;
  - «Pendiente» mientras esperas a un rival; «Sin resultado» si el rival abandonó.
- Las unidades son las del juego: fichas, puntos o milisegundos.

## Galactic Roulette 11 (`galactic-roulette@11.0.0`; V1–V10 intactos)
- **Medición de V10** (unos 680 lanzamientos repartidos entre todas las direcciones y potencias, altura medida sobre la superficie que hay bajo la bola):
  - tras tocar un separador la bola subía 1,3 px en un lanzamiento típico, 3,1 px en uno de cada diez y hasta 15 px;
  - los separadores medían 4,5 px para una bola de 12 px, y su salto crecía sin límite con la velocidad del golpe.
- **Cambios en V11:**
  - **Separadores:** separadores más bajos, de 2,5 px (0,23 de la bola).
  - **Golpes:** más suaves contra el separador (restitución 0,34) y un salto con tope.
  - **Fondo del hueco:** más blando que la pista de la bola (0,38 frente a 0,56).
  - **Bola:** algo más pequeña (10,8 px), así que un hueco mide unas 1,5 bolas, como en una ruleta de casino.
- **Resultado:** la bola sigue saltando de hueco en hueco, pero sin despegar.
  - 1,4 px de subida típica, 2,2 px en uno de cada diez, 7,5 px como máximo (V10 llegaba a 15 px).
  - Tarda lo mismo en pararse (unos 8,3 s) y siempre acaba en el fondo de un hueco.
  - El reparto entre los 37 números es justo: χ² entre 26 y 50 según la muestra, frente al umbral de unos 51.
- **Presentación:**
  - rueda un 8 % más grande y más baja;
  - la fila de últimos números va encima, con hueco, sin tocar la rueda;
  - separadores dibujados más finos.
- **Lanzador nuevo:** una «cuna magnética» con plataforma hexagonal, tres pinzas y anillos que giran en sentidos contrarios. Al arrastrar se cargan: giran más rápido, cambian a color cálido y saltan chispas entre las pinzas.

## Dardos (gesto V4; el núcleo no cambia)
- Se lanza igual que antes, pero ahora la altura depende de la velocidad del gesto y también de dónde sueltas el dedo:
  - soltar más abajo deja el dardo más bajo, soltar más arriba lo sube;
  - la velocidad pesa más (120 px por cada px/ms, antes 95) y se admiten gestos más lentos.
- Con gestos naturales ya se llega a todo el tablero, también al doble de abajo. Con V3 no se pasaba de 47 de las 60 unidades de puntería.

## Billar 5 (`billiards@5.0.0`, mismo protocolo; V1–V4 intactos)
- **Bola 8 en solitario:**
  - **Bolas:** triángulo real de 15 bolas (1–7 lisas, 9–15 rayadas, la 8 negra en el centro, una lisa y una rayada en las esquinas del fondo); el resto del orden depende de la semilla.
  - **Grupo:** la primera bola que metes decide si juegas con lisas o rayadas.
  - **Puntos:** cada bola de tu grupo suma 1000; una del otro grupo resta 300; la blanca en un hueco resta 250 y vuelve a su sitio.
  - **La 8:** va la última y en el hueco contrario al de tu séptima bola (de una esquina a la esquina opuesta en diagonal, del centro al otro centro). El hueco se marca en dorado. Suma 3000 y 100 por cada tiro que te quede.
  - **Fin de partida:** meter la 8 antes de tiempo, en otro hueco o junto con la blanca termina la partida. Si entra en la salida, vuelve a su sitio.
  - **Tiros:** 24.
- **Bola en los extremos**, el problema de no poder tirar hacia atrás. Soluciones:
  1. El tirón puede empezar en cualquier punto de la pantalla: el golpe va en la dirección del dedo hacia donde tocaste, y la longitud marca la potencia. Así una bola pegada a la banda o en una esquina siempre tiene sitio.
  2. Una banda de tirachinas muestra el gesto.
  3. La mesa es más pequeña (escala 0,78) y está más arriba.
  4. La potencia máxima se alcanza con unos 86 px de tirón en pantalla.
- **Bolas:** lisas, rayadas con su franja blanca y la 8 negra.
- **Debajo de la mesa:** la fila de tu grupo (las metidas, atenuadas).
- **Avisos:** el grupo asignado, las faltas y la 8.

## Tests
- Nuevos `verify-roulette-v11`, `verify-darts-gesture-v4` y `verify-billiards-v5`, con fixtures dorados:
  - **Ruleta:** bote bajo y separadores bajos.
  - **Dardos:** se alcanza todo el tablero.
  - **Billar:**
    - el triángulo;
    - el grupo y las faltas;
    - la 8 al hueco contrario, antes de tiempo, en otro hueco o junto con la blanca;
    - la 8 que vuelve a su sitio en la salida;
    - partidas completas con replay idéntico.
- Actualizados los tests de presentación de la ruleta, los dardos y el billar. El del billar comprueba además el tirón desde cualquier punto, incluso con la blanca en la esquina.
- Pasan el determinismo completo, el typecheck, i18n (10 × 628), el build y el smoke de los 14 juegos.
