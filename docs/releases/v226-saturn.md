# v226-saturn · Fecha del ranking, sin Apple y servicios a contratar (app 2.26)

- **Ranking › Juegos:** como en la imagen de referencia del propietario: una cápsula arriba con la cantidad y la fecha
  completa en la misma línea («379 ₵ 20 nov 2026»; por meses, «jun 2026»), y una línea discontinua desde la cápsula
  hasta la base pasando por el punto elegido.
- **Inicio de sesión:** se oculta «Continuar con Apple» (`HIDDEN_SIGN_IN` en `lib/authProviders.ts`). El servidor lo
  conserva para activarlo en el futuro (Apple Developer Program, 99 $ al año).
- **[Servicios a contratar](../SERVICIOS_A_CONTRATAR.md):** lista por fases según la plataforma vaya generando
  ingresos (BotID, Apple, Neon de pago, KYC, pagos, auditoría…), con coste y forma de cancelar.
- **Política anti-bots de Billar y Pinball** (en la [revisión](../security/REVISION_2026-11.md)): los juegos no
  cambian; solo detección específica, umbral de revisión, límite de partidas puntuables, BotID e identidad.
- Notificaciones: cambios del propietario registrados en el [traspaso](../TRASPASO.md) (aún sin programar).
