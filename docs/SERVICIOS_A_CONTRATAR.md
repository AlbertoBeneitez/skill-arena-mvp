# Servicios a contratar según beneficios (checklist del propietario)

> **Documento vivo (el que se usa): [Galactic Games · Servicios a contratar](https://claude.ai/artifact/BWap6G5AZ3i6ioQiF9wuPP)** — en Claude, editable y con
> comentarios, para marcar casillas y apuntar cada contratación. Este archivo es la copia de referencia en el
> repositorio; si no coinciden, manda el documento vivo.

Pedida por el propietario el 20-nov-2026. Regla (`CLAUDE.md`): nada de pago sin su permiso explícito. Antes de
proponer cualquier servicio hay que decir el importe, cada cuánto se cobra y cómo se cancela. Los precios son
orientativos y **se comprueban el día de contratar**.

## Ya pagado / gratis hoy

- [x] **Vercel Pro**: 20 $ al mes más IVA. No cancelar antes del 12-dic-2026 (recordarlo ese día).
- [x] **Neon**, plan gratis (1 GB; si se llena deja de escribir, no cobra).
- [x] **GitHub**, gratis (repositorio público; Actions incluidas).
- [x] **Inicio de sesión con Google**, gratis.

## Fase A · Cuando haya jugadores reales de forma constante (antes de ingresos)

| ✓ | Servicio | Para qué | Coste orientativo | Cómo se cancela | Disparador |
|---|---|---|---|---|---|
| [x] | Vercel BotID **Basic** (activado el 21-nov-2026, v228) | Frenar scripts sin navegador al empezar partida, crear cuenta y en grupos | Gratis en Pro | Quitarlo del código | Hecho |
| [ ] | Dominio propio (`.com` o `.games`) | Marca y confianza; necesario para Apple y para el correo | 10–40 € al año | No renovar | Antes de anunciar la app |
| [ ] | Correo transaccional (por ejemplo, Resend) | Avisos por correo y recuperación de cuenta | Gratis hasta unos 3 000 correos al mes | Darse de baja | Si se añade correo |

## Fase B · Cuando la plataforma genere ingresos (primeros beneficios)

| ✓ | Servicio | Para qué | Coste orientativo | Cómo se cancela | Disparador |
|---|---|---|---|---|---|
| [ ] | **Apple Developer Program** | Inicio de sesión con Apple (ya programado y oculto) y, más adelante, app en la App Store | 99 $ al año | No renovar | Cuando una parte relevante de los jugadores use iPhone |
| [ ] | Neon **Launch** (de pago) | Más de 1 GB, copias de seguridad más largas | Desde unos 19 $ al mes (según uso) | Volver al plan gratis | Base de datos por encima del 70 % |
| [ ] | Vercel BotID **Deep Analysis** | Detección avanzada de bots solo en cierre de partida y retirada | 1 $ cada 1 000 comprobaciones | Quitarlo del código | Cuando haya premios |
| [ ] | Reglas gestionadas del cortafuegos (OWASP) | Ataques web comunes | Comprobar si el plan Pro lo cobra | Desactivarlas | Con tráfico alto |
| [ ] | Monitorización de errores (por ejemplo, Sentry) | Ver fallos de los jugadores | Gratis hasta un volumen; después, desde unos 26 $ al mes | Darse de baja | Con más de unos cientos de jugadores al día |

## Fase C · Antes de dinero real (obligatorio)

| ✓ | Servicio | Para qué | Coste orientativo | Disparador |
|---|---|---|---|---|
| [ ] | Asesoría legal (juego de habilidad, consumidores, RGPD) | Saber dónde y cómo se puede jugar con dinero | Presupuesto cerrado | Antes de cualquier premio en dinero |
| [ ] | Verificación de identidad (KYC; por ejemplo, Veriff u Onfido) | Una cuenta por persona y edad mínima | Unos 1–2 € por verificación | Antes de cobros o premios |
| [ ] | Pasarela de pagos (por ejemplo, Stripe) | Cobros y retiradas | Comisión por operación (en torno al 1,5 % + 0,25 € en Europa) | Junto con KYC |
| [ ] | Auditoría de seguridad externa | Revisión independiente antes de mover dinero | Presupuesto cerrado | Antes de abrir dinero real |
| [ ] | Servidor en tiempo real (solo si hiciera falta) | Que el juego corra en el servidor en los juegos de reflejos | Desde unos 20 $ al mes | Solo si la detección de bots no basta |

Cada vez que se contrate algo: anotarlo aquí con la fecha, el importe y quién lo aprobó, y actualizar el estado de
costes de `CLAUDE.md`.
