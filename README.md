# Skill Arena V12 — demo mobile-first

Segunda versión funcional de Skill Arena. Está pensada para probar producto y UX en móvil antes de conectar autenticación real, PostgreSQL, ledger o pagos.

## Qué incluye

- Onboarding: Skill Arena → Continuar con Google/Apple (simulado) → configurar avatar.
- Galería de avatares y subida de foto con recorte local; sin generación de avatar por IA en esta fase.
- Panel de jugador horizontal: imagen, nombre, ranking y dinero ganado/perdido.
- 5 juegos demo activos, todos 1 vs 1: Tower Drop, Jet Stream, Pulse Runner, Metro Shift y Orbit Shift.
- Portada/cover de cada juego antes de jugar.
- Stakes: 0 €, 1 €, 5 €, 10 € y 50 €.
- Estado de matchmaking por color de todo el botón:
  - verde = jugada inicial;
  - azul = jugada existente;
  - morado = jugador esperando.
- Alternancia automática inicial → existente → inicial → existente.
- Wallet demo e historial.
- Avatar/perfil con gráfico de beneficio/pérdida acumulada.
- Reset competitivo de avatar sin borrar el saldo demo.
- Música ON/OFF como preferencia preparada para la integración futura.
- Zona legal placeholder.

## Arquitectura de juegos

Los metadatos están separados en `lib/games.ts` y cada juego vive en `components/games/`.
`GameLoader.tsx` utiliza `next/dynamic` para cargar el código del juego bajo demanda.

Esto permite ampliar el catálogo sin rehacer la interfaz. Para juegos futuros con assets pesados, la intención es mantener solo metadata/covers ligeras en la app principal y servir sprites, audio, mapas y otros recursos desde object storage/CDN.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Después abre el puerto 3000.

## Importante

Google/Apple, dinero, matchmaking, ranking y legal son simulaciones de producto. No hay autenticación real, PostgreSQL, EMI, KYC ni pagos reales en esta V2.


## V12

- Se elimina Helix Dive del catálogo.
- Se elimina la generación de avatar por IA para evitar dependencias de pago innecesarias.
- Tower Drop incorpora caída más lenta y cámara progresiva para mantener la torre bajo la grúa.
- Jet Stream aprovecha toda la superficie vertical disponible en móvil.
- Pulse Runner se rediseña como auto-runner rítmico con patrones deterministas y dificultad progresiva.
- Metro Shift mantiene avance continuo y responde al gesto durante el swipe.
- El percentil demo se muestra como “Mejor que X% de los intentos demo”.


## V13

- Tower Drop y Metro Shift ocupan todo el viewport de juego, sin bandas negras.
- Tower Drop permite hasta 5 minutos de inactividad por bloque antes del timeout verificado.
- El encabezado 1 vs 1 muestra los avatares de ambos jugadores junto al nombre.
- Jet Stream incorpora HUD de puertas, puntos, ritmo y proximidad a la siguiente puerta.
- Metro Shift mantiene los obstáculos visibles y desplazándose después de superarlos, añade sensación de velocidad continua y sustituye el indicador de carril por un HUD de superados, puntos y ritmo.
- Se amplían los objetivos táctiles principales: volver, jugar y navegación JUGAR/CUENTA.


## V14

- Los nombres de avatar admiten espacios simples, manteniendo validación de 3–18 caracteres.
- Control de sonido simplificado con botón de altavoz visible en cabecera y durante la partida.
- SFX arcade originales generados con Web Audio, sin assets de terceros ni costes/licencias.
- Se eliminan los marcadores internos de puntuación de los cinco juegos para limpiar la superficie de juego.
- Nueva pestaña GRUPO con sala cerrada, código privado, stake configurable y modo 1 vs todos los integrantes.
- La lógica de grupo se separa en `lib/groupPlay.ts` y la UI en `components/GroupHub.tsx`.
- Metro Shift incorpora física lateral con velocidad/inercia y movimiento de obstáculos con aceleración visual por perspectiva.
- Los cinco juegos terminan al alcanzar la marca objetivo; la victoria muestra una animación común a nivel de producto.
- Tower Drop v1.1 conserva verificación server-side y admite cierre autoritativo por objetivo alcanzado o primer fallo.


## Tower Drop v2

Tower Drop usa ahora un motor determinista v2 con péndulo, caída acelerada,
apoyo parcial, estabilidad por centro de masas y vuelco alrededor del borde.
El resultado competitivo sigue verificándose mediante replay server-side a
120 Hz.

La mecánica toma inspiración de `iamkun/tower_game` (MIT, Copyright 2018
BMQB, Inc). No se reutilizan sus assets, audio, interfaz ni marca. Consulta
`THIRD_PARTY_NOTICES.md` y `docs/TOWER_DROP_V2.md` para la procedencia y
separación entre mecánica MIT y código propio.


## URLs de prueba

La demo admite dos modos de QA mediante query string:

- `?fresh=1`: fuerza el flujo de bienvenida/acceso/avatar aunque ya exista una
  cuenta local. Conserva saldo, historial, estadísticas y grupo. Si se cierra
  la pestaña antes de terminar el onboarding, no sobrescribe el perfil
  guardado.
- `?reset=1`: elimina todos los datos locales de Skill Arena en ese navegador
  y simula una instalación completamente nueva.

La query se conserva al cambiar de pantalla mediante hash, por lo que al
recargar o volver a abrir el mismo enlace el modo de prueba vuelve a aplicarse.
