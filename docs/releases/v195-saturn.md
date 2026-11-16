# v195-saturn — Cada partida, de una persona (16-nov-2026)

Base: v194-saturn. App 1.95 (solo servidor).

- `sessionAccountId(req)` (`lib/server/accountHttp.ts`): la cuenta se lee solo de la cookie de sesión firmada; el
  navegador nunca dice quién es. Invitado, sin cuentas configuradas o fallo de lectura → sin persona (se sigue
  jugando).
- `POST /api/verified-match/start` (modo persistente) pasa esa cuenta al servicio, que guarda `account_id` en
  `arena_public_attempts`.
- Prueba en `verify-accounts`: sesión válida, cuenta inexistente, firma con otro secreto e invitado.
- **Validación:** lint, `test:repository`, `git diff --check`.
