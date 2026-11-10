# v166-saturn — Fichas cuadradas, botones sobrios, portadas de Dardos, Galoku, Stack y Tower Drop, y pestaña de Grupo nueva (10-nov-2026)

Base: v165-saturn.

## Catálogo
- **Fichas cuadradas y más pequeñas:** caben casi tres por fila.
  - La imagen llena el cuadrado.
  - El botón del juego va sobre su borde inferior, encima de un degradado oscuro de la propia imagen.
  - Se retira el relleno desenfocado de v165, que ya no hace falta.

## Botones de inicio y cabecera
- **Sin los círculos brillantes:** se quitan los pozos de los iconos en «Enviar juego», «Rankings», sonido, saldo y ajustes.
- **Cuerpo:** grafito mate con un filo fino, algo más claro arriba, y una pulsación tranquila.
- **Iconos:** se dibujan nítidos en su color junto al texto.
- **«Enviar juego»:** pierde el relleno dorado; el oro queda solo en su moneda.

## Portadas
- **Dardos:** portada nueva dibujada con la diana del propio juego (sisal, araña plateada, anillo de números) bajo un foco de escenario. Lleva tres dardos de punta de acero en el triple 20, en perspectiva y con su sombra sobre la diana.
  - Se genera con `scripts/render-darts-cover.mjs` (`scripts/darts-cover/entry.ts`) y ya no sale de `rasterize-covers.cjs`.
  - El único cambio en el juego es que `boardSprite` se exporta para poder usarlo aquí.
- **Galoku, Stack y Tower Drop:** reencuadradas para la ficha cuadrada (`framed()` en `generate-covers.py`). El motivo va más grande y centrado en la parte visible, en vez de pequeño y bajo.

## Grupo
- **Cabecera:** a la derecha del nombre aparece «Código» con el código. Al pulsarlo se copia y se muestra «Copiado».
- **Invitar:**
  - un único botón «Compartir invitación» en lugar de «Copiar código» y «Copiar enlace»;
  - abre una hoja con WhatsApp, Telegram, X, Facebook, Email, SMS y «Copiar enlace»;
  - si el móvil lo permite, también «Más opciones», con el menú de compartir del sistema;
  - el enlace lleva `?join=CÓDIGO`.
- **Integrantes:** fila de avatares, sin la etiqueta «SIMULADO».
- **Unirse:** un campo con el código y el botón «UNIRME», sin paso ni texto de ayuda.
- **Nueva competición:** tres pasos numerados: Formato, Juego y Entrada y premios.
  - El final de liga se llama «A votación».
  - Los premios muestran el importe en grande.
- **Reparto del bote:**
  - **Desplegable** con el reparto actual en la cabecera, por defecto 70 · 20 · 10 %.
  - **Puestos con premio:** de 1 a 4, siempre menos que el número de jugadores.
  - **Barras:** una por puesto, con porcentaje e importe. Al mover una, las demás se ajustan a su proporción anterior (`rebalanceSplit`).
  - **Límites:** la suma es siempre 100 y cada puesto cobra más que el siguiente.
  - **Liquidación:** los céntimos que se pierden al redondear van al ganador, así que se reparte el premio entero.
  - **Repartos antiguos:** «winner» y «70-30» se siguen liquidando igual.

## Textos
- Se quitan «ficticio», «simulado» y la mención a «sin conexión a salas reales» de las pantallas, en los 10 idiomas:
  - saldo y beneficio neto del perfil;
  - cuenta y sesión;
  - movimientos;
  - avisos de grupo;
  - texto accesible del saldo y del ranking.
- Decisión del propietario: se mantienen en los textos legales y de ayuda (términos, privacidad, cookies, reglas, ayuda).
- **Excepción:** el ranking de ejemplo conserva «Ver ejemplo» y «Datos de ejemplo», para no presentar filas de muestra como clasificación real.

## Validación
- `pnpm lint` y `pnpm test:determinism`. El test de grupos añade repartos personalizados: validez, reequilibrio en todos los puestos y valores, liquidación 70/20/10 y guardado y recarga.
- `pnpm build`, `scripts/qa-smoke-all.cjs` (13 juegos) y `scripts/qa-overlap.cjs`.
- Capturas a 390 y 360 px: inicio, unirse, grupo, hoja de compartir, código copiado y reparto con barras.
