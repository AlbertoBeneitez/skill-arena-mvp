# v112-saturn — Ruleta 9, Orb Burst 7, Shot Gallery 9, Tower Drop 5 y pulido de Slot, Dardos, Billar y Bolos (25-oct-2026)

Base: v111-saturn (9ed0e0e).

## Galactic Roulette 9.0.0 (V1–V8 intactos)
- La bola rebota más y tarda bastante más en caer: el vuelo mínimo es de 620 ticks y el máximo de 1500, con más restitución en la pared y en los rombos y menos fricción de rodadura.
- Cuando la bola cruza los separadores de los huecos a velocidad, rebota y salta («fret clatter») antes de quedarse en uno. De media gira unos 9 s y da unos 2 saltos entre separadores.

## Orb Burst 7.0.0 (más difícil; V1–V6 intactos)
- Empieza con 8 filas y colores menos agrupados.
- Con 4 fallos baja una fila. El margen se reduce en uno cada dos filas, hasta 1.
- El techo también baja por tiempo: una fila cada 20 s, un segundo antes por cada fila añadida, con un mínimo de 8 s. Un anillo junto a los fallos muestra cuánto queda.

## Shot Gallery 9.0.0 (dianas fijas, estilo «killer»; V1–V8 intactos)
- Las dianas ya no se mueven: son placas de acero repartidas por la galería, de 8 a 12 por pantalla.
- Las órdenes siguen combinando color y figura, con 2 a 4 aciertos por orden.
- Nueva presentación sobria: galería de hormigón con focos, placas de acero con silueta de cabeza alienígena, agujeros de bala con grietas, chispas, retícula roja, retroceso al disparar, cartuchos como contador y una sola luz roja/verde. Se han quitado el mural, los raíles con chevrones y el neón.

## Tower Drop 5.0.0 (V1–V4 intactos)
- Sin rebote en los extremos: el bloque que cae ya no choca con paredes laterales. Si se sale, se pierde una vida.
- El gancho cuelga ahora de un módulo elevador planetario: cable orbital, luces de escalador, paneles solares y cápsula con ventana.

## Presentación (sin cambio de versión)
- **Dardos:** el dardo se coge con solo poner el dedo en él. Arrastrarlo despacio apunta, y el lanzamiento sale con un golpe rápido hacia arriba. La portada lleva un dardo clavado junto a la diana.
- **Billar:** el taco está más cerca de la bola.
- **Galactic Slot:** máquina de recreativa con marquesina de neón, bombillas que se encienden en cadena (y parpadean al ganar), marco dorado, rodillos cilíndricos con desenfoque de movimiento, línea de premio láser, símbolos con volumen, contadores LED, tabla de premios en fichas y lluvia de monedas al ganar.
- **Galactic Bowling:**
  - Cámara de persecución más cerca de la bola, que la encuadra en el centro y se separa al llegar a los bolos, con estelas de velocidad.
  - Los bolos son personajes: parpadean y se balancean, se asustan cuando llega la bola (ojos abiertos, boca en «O», sudor y temblor) y quedan mareados, con ojos en X y estrellas, al caer.
  - Lanzamiento más fino: la potencia se mide con la velocidad del golpe final, con una curva más suave, y el ángulo y el efecto tienen menos ganancia y una zona muerta. Mientras deslizas se ven la estela y una barra de potencia.

## Tests
- Nuevos `verify-roulette-v9`, `verify-orb-v7`, `verify-gallery-v9` y `verify-tower-v5`, con fixtures dorados donde aplica.
- Actualizadas las pruebas de presentación de Ruleta, Orb, Gallery y Tower.
- Pasan el determinismo completo, el typecheck, i18n (10 × 571), el build y el smoke móvil de los 14 juegos.
