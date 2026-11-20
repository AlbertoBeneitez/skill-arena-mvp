# Revisión estratégica de seguridad y anti-bots — noviembre de 2026 (v224)

Pedida por el propietario el 20 de noviembre de 2026. Sustituye como referencia viva a
[SECURITY_REVIEW_V98](../SECURITY_REVIEW_V98.md) y concreta el plan de [ANTIBOT](../ANTIBOT.md).

**Método.** Lectura del código de todas las rutas de `app/api` y de `lib/server`; configuración real de Vercel
(nombres de variables, sin leer valores; cortafuegos activo); `pnpm audit --prod` (0 avisos); y ataques reales con el
[simulador de bots](../SIMULADOR_BOTS.md) contra la compilación de producción en local, con PostgreSQL y partidas
durables. No se ha atacado Vercel ni se ha leído ningún secreto.

## Resumen

- **Lo que aguanta.** La verificación por repetición en el servidor rechazó todas las manipulaciones de los bots:
  acciones inventadas, entradas desordenadas, final adelantado, partidas más rápidas que el reloj, partidas ajenas,
  semillas elegidas por el cliente, sesiones falsificadas o caducadas, peticiones desde otra web y cuerpos enormes. El
  inicio de sesión (OAuth con `state` y PKCE), la firma de la sesión, el libro contable y la idempotencia están bien
  hechos.
- **Riesgo nº 1: bots que juegan «perfecto».** La semilla llega al móvil al empezar, así que cualquier programa puede
  probar jugadas en una copia del juego antes de hacerlas. La repetición no puede distinguirlo, porque la partida es
  legal. Hoy no hay ninguna capa anti-bot activa.
- **Riesgo nº 2: identidad barata.** Los límites cuentan cookies, no personas.
- **Riesgo nº 3: bloqueo global.** El tope de 2000 partidas es para todo el servicio y no caduca.
- **Estado real en Vercel:** las partidas durables no están activadas. Funciona el modo antiguo sin base de datos, y
  ligas, victorias y récords viven en el navegador. Mientras no haya premios no es grave; con premios, todo lo que
  depende del navegador se puede falsificar.

## Configuración comprobada en Vercel (20-nov-2026)

| Elemento | Estado |
|---|---|
| `ALLOW_PERSISTED_MATCH_TRAINING` | **No existe** en ningún entorno: partidas sin estado (modo antiguo) |
| `ALLOW_LEGACY_STATELESS_TRAINING` | Presente en vista previa y producción |
| `MATCH_SIGNING_SECRET` | Distinto en vista previa y producción (creados en momentos distintos) |
| `AUTH_SECRET` | Creado **en el mismo instante** en vista previa y producción: muy probablemente el mismo valor |
| Cortafuegos | Activo, con 2 reglas por IP: API 300/min y envíos de estudios 10 cada 10 min |
| Reglas gestionadas OWASP del cortafuegos | Todas desactivadas |
| BotID (anti-bots de Vercel) | No instalado (estaba diseñado en ANTIBOT, capa 1) |
| Cabeceras | HSTS, CSP, `nosniff`, `frame-ancestors 'self'` y Permissions-Policy, bien. CSP permite `'unsafe-inline'` en scripts |
| Dependencias | `pnpm audit --prod`: 0 avisos conocidos |

## Hallazgos

Gravedad: **crítico** (rompe la justicia o el servicio en cuanto haya competición abierta), **alto** (explotable con
poco esfuerzo, impacto real), **medio**, **bajo**. «Cuándo» indica si hay que arreglarlo ya o antes de una fase.

### C1 · Crítico · Bots con anticipación perfecta (semilla conocida)
- **Qué.** El manifiesto que recibe el móvil al empezar incluye la semilla. Todos los juegos con información completa
  (todos menos Mine Grid y Solitaire) se pueden simular por adelantado: un programa prueba jugadas en una copia y envía
  solo las buenas, con tiempos de aspecto humano.
- **Evidencia (simulador).** Un bot «experto» genérico, que no conoce ningún juego en concreto, saca en Pinball 50 270
  puntos frente a 4 220 de un novato (otra ronda: 22 230 frente a 2 855), y el servidor acepta las dos partidas. Fuera de
  línea: Pinball ×17, Slot ×2,3 y Billar 9 000 puntos (el rival de referencia del catálogo). Un atacante dedicado escribiría un solucionador por juego y
  sería más fuerte todavía.
- **Impacto.** Rankings, ligas, grupos y torneos con premio quedan en manos de quien programe un bot.
- **Arreglo.** Por capas (ver «Estrategia»): detección de comportamiento, revelar información por tramos en los juegos
  que lo permitan, BotID y, con dinero, verificación de identidad. No tiene arreglo único.
- **Cuándo.** Antes de abrir partidas entre desconocidos con cualquier cosa en juego (aunque solo sea ranking).

### C2 · Crítico · Tope global de 2000 partidas sin caducidad
- **Qué.** `postgresPublicAttemptRepository.start` rechaza con `TRAINING_QUOTA` cuando la tabla tiene 2000 intentos en
  total (de siempre, no por día) o el jugador tiene 20 en 24 h.
- **Evidencia (simulador).** **En 38 segundos**, 1 814 partidas empezadas y abandonadas desde unas 90 cookies nuevas,
  sin cuenta, llevan la tabla a 2 000, y a partir de ahí cualquier jugador nuevo recibe `TRAINING_QUOTA`.
- **Impacto.** Al activar las partidas durables, unos pocos minutos de un script bloquean el juego para todo el mundo.
  Y sin atacante, se bloqueará solo cuando se acumulen 2000 partidas reales.
- **Arreglo.** Quitar el tope global y sustituirlo por un límite por cuenta y día, más una limpieza programada de
  intentos antiguos (retención). Esfuerzo pequeño.
- **Cuándo.** Antes de activar `ALLOW_PERSISTED_MATCH_TRAINING`.

### A1 · Alto · Los límites cuentan cookies, no cuentas
- **Qué.** El límite de 20 partidas al día va por «actor», que es la cookie de partida; basta pedir otra en
  `/api/verified-match/session`. La cuenta con sesión se guarda en el intento, pero no se usa para limitar.
- **Evidencia (simulador).** Tras recibir `TRAINING_QUOTA`, la misma cuenta pide otra cookie y empieza otra partida.
- **Impacto.** Sin tope real por persona: granjas de partidas, inflado de juegos y abuso de recursos.
- **Arreglo.** Límites por cuenta (y por dispositivo cuando exista) además de por cookie. Exigir cuenta para jugar
  online.

### A2 · Alto · Grupos online: «mejor de N» y semillas distintas en la misma jornada
- **Qué.** `recordResult` acepta cualquier partida verificada del juego de la jornada, empezada después de la
  competición. No exige que sea la primera ni que se haya empezado para esa jornada, y cada jugador juega con una semilla
  distinta.
- **Evidencia (simulador).** En Tower Drop, un bot juega 4 partidas seguidas (1 607, 1 382, 3 073 y 2 737 puntos) y el
  servidor acepta como resultado de la jornada la de 3 073, que no es la primera.
- **Impacto.** Un jugador juega 20 veces y anota la mejor. Además, los rivales de la misma jornada no juegan la misma
  partida, lo que añade suerte.
- **Arreglo.** Que el servidor emita la partida de la jornada (una por jugador y jornada, con la semilla de la jornada,
  igual para todos) y anote solo esa. Hay que hacerlo antes de construir el flujo de juego de grupos online; hoy el móvil
  todavía no lo usa.

### A3 · Alto (cuando haya pagos a estudios) · Reparto inflable
- **Qué.** El recuento para pagar a estudios (`playCounts.ts`) limita a 20 partidas por jugador, juego y día, pero
  «jugador» es la cookie.
- **Impacto.** Un estudio puede inflar sus partidas con cookies nuevas.
- **Arreglo.** Contar por cuenta con antigüedad mínima, excluir partidas marcadas por la capa de comportamiento y poner
  alertas de picos (ANTIBOT, capa 5).

### A4 · Alto (con premios) · En Vercel, el progreso vive en el navegador
- **Qué.** Sin partidas durables, ligas (Bronce…Perla), victorias por juego, récords y «Tu selección» se guardan en el
  navegador, y el servidor no los conoce.
- **Impacto.** Cualquiera puede ponerse Perla en todos los juegos editando su navegador. Hoy no da nada.
- **Arreglo.** Activar las partidas durables (después de C2) y calcular ligas y victorias en el servidor a partir de
  partidas verificadas.

### A5 · Alto · Ninguna capa anti-bot de entrada
- **Qué.** BotID no está instalado; la comprobación de mismo origen solo frena a otras webs (CSRF), no a scripts.
- **Arreglo.** BotID Basic (gratis) en inicio y cierre de partida, sesión y envíos de estudios.

### A6 · Alto (con premios) · Mine Grid y Solitaire: el resultado lo da el móvil en Vercel
- **Qué.** Los dos están marcados `client-result`. En Vercel no existe `ALLOW_PERSISTED_HIDDEN_TRAINING`, así que Mine
  Grid usa la versión antigua del navegador; Solitaire siempre se juega entero en el navegador.
- **Evidencia (simulador).** Con la versión oculta activada en local, Mine Grid aguanta todas las pruebas (sin fugas de
  minas ni de semilla; revisiones viejas, casillas inventadas, partidas ajenas y otra web rechazadas) y 5 de 6 bots ganan
  jugando limpio. Solitaire no tiene camino de servidor.
- **Arreglo.** Activar Mine Grid oculto en Vercel (con base de datos `sslmode=verify-full`) y llevar Solitaire al mismo
  protocolo oculto (`solitaireSetup.v1.server.ts` ya prepara el reparto privado). Hasta entonces, sin premios en estos dos.

### M1 · Medio · `AUTH_SECRET` probablemente compartido entre vista previa y producción
- **Impacto.** Quien obtenga el secreto de la vista previa (que se usa para pruebas) puede firmar sesiones de producción,
  incluida la del propietario de estudios (`STUDIO_OWNER_ACCOUNTS`).
- **Arreglo (propietario, en Vercel).** Un `AUTH_SECRET` distinto por entorno. Al cambiarlo se cierran las sesiones
  abiertas de ese entorno.

### M2 · Medio · Sesión de 30 días sin revocación
- **Qué.** La cookie firmada vale 30 días y el servidor no puede invalidarla (cerrar sesión solo la borra del
  navegador). **Arreglo.** Una versión de sesión por cuenta en la base de datos para poder cerrar sesiones robadas;
  pedir de nuevo el inicio de sesión antes de mover dinero.

### M3 · Medio · Cortafuegos mínimo
- **Qué.** Solo hay límites por IP, y las reglas gestionadas OWASP están apagadas.
- **Arreglo.** Límites específicos por ruta, más estrictos en inicio y cierre de partida, cuenta y grupos. Valorar
  activar las reglas gestionadas; antes hay que comprobar si tienen coste en el plan Pro.

### M4 · Medio-bajo · Subidas de estudios con tope global
- **Qué.** El tope de 20 paquetes al día es para todos: cualquiera puede agotarlo y dejar fuera a estudios reales.
- **Arreglo.** Exigir cuenta para subir y poner el tope por cuenta.

### B1 · Bajo · Suplantación con letras parecidas
- **Evidencia (simulador).** «Аdmin» con la A cirílica se acepta como nombre; los reservados solo miran letras latinas.
- **Arreglo.** Normalizar confusables (por ejemplo, con la tabla de Unicode) antes de comparar con los reservados y
  entre nombres.

### B2 · Bajo · «Tu selección» la fija el móvil
- **Qué.** `/api/account/plays` acepta `atLeast` hasta 1 000 000 por juego. Es cosmético; no debe usarse nunca para
  rankings ni pagos.

### B3 · Bajo · Cuerpos leídos enteros antes de medirlos
- **Qué.** `readJson` de cuentas y grupos hace `req.text()` y después mira el tamaño. Vercel limita el cuerpo a 4,5 MB,
  pero conviene leerlo por partes con un límite, como ya hace el circuito de partidas.

### B4 · Bajo · CSP con `'unsafe-inline'` en scripts
- **Qué.** Debilita la defensa ante una inyección de HTML. **Arreglo.** Nonces de Next para los scripts en línea.

### Observación · Solitaire no termina cuando el jugador se queda sin jugadas
- **Evidencia (simulador).** Los bots se atascan con 6 de 52 cartas en la fundación: la partida solo termina al
  destapar todas las cartas, el reloj sigue y la única salida es volver atrás (cuenta como abandono). **Arreglo
  (experiencia).** Botón «Terminar» o fin automático cuando el mazo ha dado una vuelta completa sin jugadas.

### Observación · Un registro mal formado no cierra el intento
- **Qué.** Un registro de partida con formato inválido se rechaza con 400 y el intento sigue «jugando»: el móvil puede
  enviar el bueno o abandonar. No da ventaja (solo cuenta el primer registro válido), pero un cliente con un fallo
  podría quedarse bloqueado hasta el límite de tiempo del juego si no abandona.

## Resultados de la primera campaña de bots (local, 20-nov-2026)

| Familia | Resultado |
|---|---|
| Interfaz | 9 bots (móvil 375, móvil 360 y ordenador) × 70 toques: sin errores de página, consola ni servidor, y ninguna pantalla más ancha que el móvil |
| Personas (API) | Cuenta, cartera, avatar, nombre, rankings, grupos e historial: todo responde como debe |
| Partidas | Más de 40 partidas completas en tiempo real (Billar, Bowling, Tower Drop, Orb Burst, Pinball…): todas aceptadas, con la misma puntuación en el bot y en el servidor |
| Competir | Grupo de 4 bots, competición «Todos vs todos» de 2 jornadas: se juega, se anota y termina |
| Trampas rechazadas | Sesión falsificada o caducada, otra web (CSRF), cuerpo de 600 KB, semilla elegida por el cliente, acción inventada, entradas desordenadas, final adelantado, partida más rápida que el reloj y partida ajena |
| Mine Grid (oculto, local) | 6 bots: 5 victorias jugando solo con la vista pública; todas las pruebas de protocolo rechazadas |
| Solitaire (navegador) | 3 bots juegan con criterio hasta atascarse (ver observación) |
| Trampas que pasan | C1, C2, A1, A2 y B1 de esta revisión |

Avisos sobre los propios bots: las primeras campañas dieron falsos fallos («partida abandonada», «error de red»)
causados por el simulador (cálculo que bloqueaba los avisos de «sigo jugando», nombres repetidos entre campañas,
conexiones reutilizadas). Están corregidos y no son fallos de la app.

## Estrategia anti-bots por capas (plan priorizado)

| Fase | Cuándo | Qué | Coste |
|---|---|---|---|
| 0 | Ya | C2 (tope por cuenta y día con limpieza), A1 (límites por cuenta), A2 (partida de la jornada emitida por el servidor), B1 | 0 € |
| 1 | Antes de partidas entre desconocidos | BotID Basic; **capa de comportamiento en modo observación**: por partida, una puntuación de sospecha (reacción por debajo de lo humano, varianza casi nula, precisión sostenida, ritmo idéntico entre partidas), guardada sin cambiar resultados; el simulador aporta los ejemplos «bot» para calibrarla | 0 € |
| 2 | Antes de premios | Activar partidas durables (A4); revelar información por tramos donde el juego lo permita (cartas, mesas o rondas siguientes solo al llegar); antigüedad mínima de cuenta; límites por cuenta y día; detección de colusión en grupos | 0 € |
| 3 | Antes de dinero real | Verificación de identidad (KYC), una cuenta por persona; BotID Deep Analysis solo en cierre de partida y retirada; revisión manual de casos marcados; atestación de dispositivo si hay app nativa; auditoría externa | Deep Analysis: 1 $ cada 1 000 comprobaciones (avisar y aprobar antes) |

## Política para Billar y Pinball (decisión del propietario, 20-nov-2026)

Billar y Pinball **se quedan como están**: sin información oculta por pasos (es física, y calcular el propio tiro es
parte del juego). Se protegen solo con política anti-bots:

1. **Detección de comportamiento específica.** Billar: tiempo entre tiros, precisión de ángulo y fuerza respecto al
   tiro ideal y constancia entre partidas. Pinball: reacción de los flippers ante la bola (por debajo de unos 120 ms de
   forma sostenida, sospechoso) y regularidad de los toques. El simulador aporta los perfiles «experto» como ejemplos
   de bot.
2. **Umbral de revisión.** Una puntuación por encima del percentil 99,9 de los humanos se marca para revisión y no
   entra en premios hasta revisarla. En ranking se muestra, pero con marca «en revisión».
3. **Límite de partidas puntuables.** Solo cuentan para premios las primeras N partidas del día por cuenta (sin
   reintentos ilimitados para elegir la mejor).
4. **Fricción e identidad.** BotID en inicio y cierre de partida; con premios, cuenta con antigüedad mínima y, con
   dinero, KYC.
5. **Sin cambios de juego:** las versiones competitivas actuales de Billar y Pinball no se tocan.

## Lo que se repite en cada versión

El simulador queda en el repositorio: `pnpm sim` (API) y `pnpm sim:ui` (interfaz). Antes de cada fase, repetir la
campaña completa y comprobar que cada hallazgo cerrado ya no aparece en `sim-reports/`.
