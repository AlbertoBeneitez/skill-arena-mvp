# Skill Arena V2 — demo mobile-first

Segunda versión funcional de Skill Arena. Está pensada para probar producto y UX en móvil antes de conectar autenticación real, PostgreSQL, ledger o pagos.

## Qué incluye

- Onboarding: Skill Arena → Continuar con Google/Apple (simulado) → configurar avatar.
- Galería de 8 avatares ficticios.
- Panel de jugador horizontal: imagen, nombre, ranking y dinero ganado/perdido.
- 4 juegos demo, todos 1 vs 1.
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
