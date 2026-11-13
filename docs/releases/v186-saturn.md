# v186-saturn — Comisión solo al cambiar, mantenimiento y arreglos de la revisión de seguridad (13-nov-2026)

Base: v185-saturn.

## Producto (decisiones del propietario, 13-nov)

- **Grupos sin comisión:** el premio es el bote entero. `GroupConfig.commissionBps` se fija a 0 al crear; las
  competiciones guardadas antes no lo tienen y conservan su 5 %, así que sus pagos no cambian (probado).
- **Comisión del cambio, 5 % en cada sentido** (`lib/wallet.ts`): ingresar 10 € suma 9,50 ₡; retirar 10 ₡ paga 9,50 €.
  La cartera lo enseña antes de confirmar y la retirada lo desglosa. Prueba `scripts/verify-wallet.ts` (céntimos
  exactos). Sigue siendo saldo ficticio.
- **Aviso de mantenimiento:**
  - automático (`components/MaintenanceGate.tsx`): si `/api/health` responde 503 (la base no contesta), toda la app
    queda tapada por «En mantenimiento» en 10 idiomas, que se quita sola al volver; sin conexión no sale;
  - manual: regla «MODO MANTENIMIENTO» en Vercel › Firewall (apagada) que manda la producción a
    `public/mantenimiento.html` (página autónoma en 10 idiomas, funciona aunque la app esté rota).

## Revisión de seguridad independiente (13-nov)

Hecha por un agente que no escribió el código. Sin hallazgos críticos. Arreglado aquí:

1. **.zip trampa** (medio): `lib/studio/package.ts` lee el directorio del zip sin descomprimir y rechaza zip64,
   cifrado, métodos raros y expansiones de más de 100:1; en el servidor `lib/server/boundedInflate.ts` descomprime con
   zlib y para en cuanto se pasa del tamaño declarado. Prueba: un zip de 10 MB de ceros que dice ocupar 16 bytes se
   rechaza en milisegundos.
2. **Buzón de estudios abusable** (medio): la recepción queda **cerrada** salvo `STUDIO_UPLOADS_OPEN=1`, y cerrada
   responde antes de leer nada. El propietario sigue viendo y borrando lo recibido. Abrirla exige antes inicio de
   sesión o comprobación anti-bots y un límite por cuenta.
3. **Copias legibles por cualquiera** (medio): ahora se cifran con `age` y la clave pública del propietario
   (`ops/backup-recipient.txt`, pendiente); solo su clave privada, fuera de internet, las abre, y `age` detecta
   manipulaciones. PostgreSQL 18 se instala desde el repositorio oficial firmado. Ensayado: su clave abre, otra no.
8. `/api/health` consulta la base como mucho una vez por minuto; el listado de juegos de estudios con `s-maxage`.
9. «Borrar mis datos locales» también borra el borrador del formulario de estudios (`gg.`).
10. El pool de PostgreSQL ya no tumba la instancia si Neon corta una conexión, y las consultas caducan a los 10 s.
12. Correo de contacto de estudios: solo direcciones simples, y el enlace del buzón se limpia.
13. Los paquetes de formato 2 aprobados no se pueden descargar.
16. La regla de límite de envíos coincide por prefijo.

Pendiente (anotado en `docs/PRODUCT_BACKLOG.md`): 5 (cuota global y bloqueo global, antes de partidas persistentes),
6 (entrenamiento sin estado: umbral elegido por el cliente y orden de comprobaciones), 7 (semillas predecibles,
identidades gratis, plataforma declarada por el cliente: antes de dinero real), 4 (el chequeo de código de estudios
no es una frontera de seguridad: revisión humana línea a línea), 11, 13 (CSP con nonces), 15 (secretos distintos en
preview y producción), 18 (rol de base sin permisos de dueño), 19 (protección de forks en Vercel).

- **Validación:** `pnpm lint`, `pnpm test:determinism`, `pnpm test:repository`, `pnpm build`, smoke de 13 juegos,
  solapes, `git diff --check`; capturas de cartera, retirada, grupo, aviso y página de mantenimiento.
