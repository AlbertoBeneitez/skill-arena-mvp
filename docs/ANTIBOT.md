# Módulo anti-bots — diseño (v188, 13-nov-2026)

Pedido por el propietario: «hay que hacer un módulo anti-bots bueno». Un bot en Galactic Games puede (a) jugar
perfecto y ganar torneos, (b) inflar las partidas de un juego para cobrar más reparto de estudios, (c) crear miles de
identidades para saltarse límites y (d) saturar el servidor. Ninguna capa sola basta; este es el diseño por capas, en
el orden en que se construye. Cada capa marca, limita o rechaza; ninguna decide sola un baneo con dinero en juego.

## Capa 1 · Puerta de entrada: navegador real (Vercel BotID)

- `botid` (de Vercel) en el cliente y `checkBotId()` en el servidor en las rutas que crean o cierran algo:
  inicio y verificación de partidas, comandos de juegos ocultos, sesión, inicio de sesión y envío de estudios.
- Nivel Basic (gratis): rechaza scripts sin navegador, tokens repetidos o de otro origen.
- Nivel Deep Analysis (1 $ por 1 000 comprobaciones, solo en las rutas que se marquen): detecta navegadores
  automatizados (Playwright en proxies residenciales). Se activa solo en cierre de partida y retirada de dinero.
- Ya existe: límites de peticiones del cortafuegos (v185–v186).

## Capa 2 · Identidad: una persona, una cuenta

- Partidas públicas, grupos y torneos solo con cuenta (Google, Apple…). Una cuenta nueva no entra en torneos con
  premio hasta pasar un mínimo (por ejemplo, unas partidas de entrenamiento y unos días de antigüedad).
- Con dinero real: verificación de identidad (KYC) obligatoria, una cuenta por persona.
- Nunca se empareja a una cuenta consigo misma ni con cuentas del mismo dispositivo o red de forma repetida (colusión).
- Límites por cuenta y día (inicio de partidas, cambios de moneda), no solo globales.

## Capa 3 · Partidas imposibles de preparar

- Semillas derivadas de un secreto del servidor (HMAC) sobre un catálogo grande, en vez de un hash público de
  constantes: nadie puede resolver de antemano los escenarios (hallazgo 7 de la revisión de seguridad).
- En juegos de información completa (Galoku, el puzle del Slot), el servidor revela el estado paso a paso, como ya
  hacen los juegos ocultos.

## Capa 4 · Comportamiento: jugar como un humano

Cada partida ya llega como lista ordenada de entradas con su tiempo (el contrato competitivo), así que el servidor
puede medir sin pedir nada nuevo al jugador. Para cada juego, una función pura y versionada calcula señales:

- tiempos de reacción por debajo del mínimo humano o demasiado constantes (varianza casi cero);
- precisión perfecta sostenida (siempre el punto exacto, sin correcciones);
- ritmo idéntico entre partidas distintas de la misma cuenta;
- patrones de toque imposibles en un móvil (dos acciones en el mismo milisegundo, sin movimiento previo).

Resultado: una puntuación de sospecha por partida, guardada con la partida. Por encima de un umbral, la partida no
cuenta para torneos, rankings ni reparto a estudios y queda para revisión; nunca se cambia el resultado verificado.
Los umbrales se calibran con partidas reales de humanos antes de aplicarlos.

## Capa 5 · Recuento y dinero

- El reparto a estudios ya cuenta como máximo 20 partidas por jugador, juego y día (v187); además excluirá las
  partidas marcadas por la capa 4 y las de cuentas sin la antigüedad mínima.
- Alertas al propietario: picos de partidas de un juego, muchas cuentas nuevas desde la misma red, retiradas raras.

## Orden de construcción

1. Capa 1 (BotID Basic) y capa 3 (semillas secretas), antes de abrir partidas entre móviles.
2. Capa 2 (cuentas) y límites por cuenta, junto con el inicio de sesión en producción.
3. Capa 4 con umbrales en modo observación (solo marcar), calibrada con las primeras semanas de juego real.
4. Deep Analysis y capa 5 completa antes de dinero real.
