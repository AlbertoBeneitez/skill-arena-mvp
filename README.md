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
