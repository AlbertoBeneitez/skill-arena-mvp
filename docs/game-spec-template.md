# Especificación de juego — plantilla obligatoria

Todo juego que se ofrezca en la plataforma, propio o importado, necesita en `games/<id>/` estos dos ficheros:

- `SPEC.md`: copia de esta plantilla rellenada (este documento).
- `manifest.json`: identifica la versión y lista los ficheros que la componen (ver «Versionado y hash»).

**Juegos importados.** El tercero entrega la especificación y el manifiesto, o los redacta la plataforma
con su confirmación escrita (sección 10). En ambos casos `scripts/game-integrity.mjs verify` falla si falta
alguna sección, si el manifiesto está incompleto o si el código no coincide con la versión registrada.
Una especificación completa **no** significa que el juego cumpla: el cumplimiento lo indica el campo
`Estado de conformidad` y solo puede ser `CONFORME` si las pruebas de la sección 9 se han ejecutado y pasan.

---

## Cómo rellenarla

Primera línea tras el título, obligatoria y literal:

`**Estado de conformidad:** CONFORME | NO CONFORME | PENDIENTE`

Después, estas diez secciones con estos títulos exactos (el verificador los comprueba):

### `## 1. Identificación`
`id`, nombre, versión, titular de los derechos, origen (`propio` o `importado`), proveedor, licencia de uso, fecha.

### `## 2. Descripción y modo de juego`
Objetivo del juego y qué determina quién gana. Indicar si el jugador compite **contra otros jugadores**
(el premio sale de las inscripciones) o **contra el recorrido o la casa** (el premio lo paga el operador).

### `## 3. Azar y fuentes de variabilidad`
Inventario de **todo** lo que puede hacer que dos partidas con las mismas decisiones den resultados distintos.
Una tabla con una fila por fuente: ¿existe?, dónde, cómo se neutraliza. Como mínimo:
generador de números aleatorios (`Math.random`, `crypto`, semillas), contenido generado, emparejamientos,
orden de turnos o de salida, desempates, información oculta, **reloj, frecuencia de refresco y latencia**,
aritmética en coma flotante y diferencias entre dispositivos.
La declaración «no interviene el azar» solo es válida si cada fila está en «no existe» o «neutralizada».

### `## 4. Modelo de simulación`
Frecuencia fija de la simulación (ticks por segundo), separada del dibujado. Estado, unidades y aritmética
(preferible entera o de coma fija). Modelo de entradas: lista de `(tick, acción)`. Función de transición,
condición de fin y condiciones de victoria. El resultado debe ser función pura de
`(versión del juego, parámetros de la partida, entradas)`.

### `## 5. Verificabilidad y registro de partidas`
El servidor debe poder **reproducir** cualquier partida a partir de sus entradas y obtener exactamente el mismo
resultado. Cada partida guarda: `match_id`, `game_id`, `game_version`, `digest` (hash de la versión),
parámetros, entradas, resultado, jugadores y marcas de tiempo del servidor. Una partida con un `digest` no
registrado se rechaza.

### `## 6. Puntuación, desempate y premios`
Fórmula de puntuación, desempate y reparto de premios. Todo en función de los ticks y del resultado simulado,
nunca del reloj de pared del dispositivo.

### `## 7. Integridad del cliente`
Qué calcula el cliente y qué valida el servidor. El resultado nunca se acepta tal cual lo comunica el cliente:
se obtiene reproduciendo sus entradas en el servidor.

### `## 8. Equidad económica`
Quién paga el premio. Comprobar que ninguna estrategia (incluido un bot) obtiene beneficio garantizado
contra el operador, y que cualquier recorrido fijo o repetible se tiene en cuenta en el diseño del premio.

### `## 9. Pruebas de conformidad`
Lista de pruebas y su resultado, como mínimo:
1. Mismas entradas, mismo resultado, en N ejecuciones.
2. Mismo resultado a 30, 60 y 144 Hz de refresco y bajo carga.
3. Mismo resultado en los navegadores y plataformas soportados.
4. Análisis estático: sin `Math.random`, `crypto.getRandomValues`, `Date.now`, `performance.now` ni
   `new Date` dentro de la lógica del juego (`node scripts/game-integrity.mjs scan <id>`).
5. El servidor reproduce las partidas y detecta un resultado manipulado.

### `## 10. Declaración y responsabilidad`
Quién firma, fecha, y si es el proveedor o la plataforma con confirmación del proveedor. La firma es de quien
afirma la sección 3, y debe poder sostenerla ante el banco, un regulador o un jugador.

---

## Versionado y hash

`games/<id>/manifest.json`:

```json
{
  "id": "mi-juego",
  "name": "Mi juego",
  "version": "0.1.0",
  "origin": "propio",
  "provider": "SkillArena",
  "files": ["games/mi-juego/engine.ts", "games/mi-juego/SPEC.md"]
}
```

- `files` lista **todo** lo que determina el resultado de una partida más su `SPEC.md`.
- El hash de la versión (`digest`) se calcula con SHA-256 sobre `id`, `version` y el hash de cada fichero.
- Los digests quedan en `games/versions.log.jsonl`: un registro por versión, **solo se añaden líneas**, cada
  una enlazada con la anterior por hash.
- Cualquier cambio en un fichero de `files` exige una versión nueva:
  `node scripts/game-integrity.mjs register <id> --version X.Y.Z`
- `node scripts/game-integrity.mjs verify` (también en CI) comprueba el manifiesto, la especificación,
  que el código coincide con el digest registrado y que el registro no se ha reescrito.

**Límite que conviene conocer.** El registro vive en el mismo repositorio que controla el propietario, así que
demuestra *qué versión era cuál* pero no impide que el propietario rehaga la historia. Para que valga ante
terceros hay que anclar fuera el último hash (etiquetas firmadas, copia en otro servicio, sellado de tiempo).
