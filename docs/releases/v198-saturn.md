# v198-saturn — Guía de entrada con Google (16-nov-2026)

Base: v197-saturn (+ clave pública de copias ya guardada en `ops/backup-recipient.txt`). Solo documentación (app 1.97).

- `docs/GUIA_ENTRADA_CON_GOOGLE.pdf` (2 páginas, coste 0 €): AUTH_SECRET, AUTH_URL, DATABASE_URL, cliente OAuth de Google en modo Pruebas con usuarios de prueba, desactivar Vercel Authentication, comprobación.
- Hallazgo: el proyecto tiene `ssoProtection` en `all_except_custom_domains`; sin desactivarla (o sin dominio propio) solo entran miembros del equipo de Vercel.
- Apple exige cuenta de pago (99 USD/año): no se activa.
- `CLAUDE.md`: Vercel Pro no se cancela hasta el 12 de diciembre de 2026.
