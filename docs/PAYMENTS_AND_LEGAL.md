# Pagos y obligaciones de información (1-nov-2026)

Nota de investigación para el propietario. No es asesoramiento jurídico; confirmar con un abogado especializado en
juego antes de la fase 4 (dinero real).

## 1. Sistemas de cobro

| Opción | Qué es | ¿Sirve para cuotas de grupo y premios? |
| --- | --- | --- |
| Newly (newly.app) | Generador de apps nativas iOS/Android con IA; su «paywall» crea suscripciones mensuales/anuales con RevenueCat | No. Exige rehacer la app como app nativa (la nuestra es una web Next.js) y solo cobra suscripciones |
| RevenueCat | Gestiona suscripciones y compras de App Store, Google Play y web (Web Billing sobre Stripe) | No para dinero de competición: Apple no permite comprar con compra integrada crédito para juego con dinero real, y Stripe prohíbe los juegos de habilidad con premio y las cuotas de inscripción que prometen un premio |
| Stripe directo | Pasarela de tarjetas | No, por la misma prohibición |
| PayPal | Monedero | Solo con aprobación previa como vendedor de juego, en jurisdicciones donde es legal; prohíbe por defecto «cualquier actividad con cuota de entrada y premio» |
| Pasarelas especializadas en juego con licencia (Nuvei, Paysafe, Trustly, Adyen con aprobación…) y Bizum a través de ellas o del banco | Procesan depósitos y retiradas de operadores con licencia | Sí, una vez concedida la licencia DGOJ. Bizum es habitual entre los operadores españoles |

**Recomendación:**
- Hasta la licencia, el saldo sigue siendo ficticio.
- En la fase 4: una sola pasarela especializada en juego que agrupe tarjeta, Bizum, transferencia instantánea y PayPal. Detrás, el libro de saldos propio en el servidor (`lib/server/`), con verificación de identidad (KYC) antes de retirar.
- RevenueCat solo tendría sentido para un producto sin premio en dinero (por ejemplo, una suscripción de avatares o estadísticas) y si la app llega a las tiendas. No es prioritario.

## 2. ¿Hay que explicar cada botón?

No. Lo que exige la ley es más concreto:

1. **Botón de pago:** debe decir sin ambigüedad que obliga a pagar.
   - Base: art. 8.2 de la Directiva 2011/83 y art. 98.2 del TRLGDCU. El TJUE (C-249/21, 7-abr-2022) exige que la claridad esté en el botón mismo.
   - Si no la tiene, el consumidor no queda obligado.
   - «PAGAR 5,00 € Y EMPEZAR» cumple. Mantener ese patrón en todo botón que mueva dinero.
2. **Antes de pagar:**
   - Precio total y comisión.
   - Reparto del bote.
   - Cuándo termina la competición.
   - Qué pasa si se abandona («La partida contará como perdida»).
   - Enlace a términos.
3. **Reglas de cada juego:** publicadas y accesibles fuera de la partida (puntuación, quién gana, desempates). Dentro del juego siguen sin tutoriales.
4. **Aviso legal (LSSI art. 10):** titular, NIF, domicilio, contacto. Además, la política de privacidad del RGPD, que ya está en la app.
5. **Accesibilidad:**
   - La Ley 11/2023, que transpone la Ley Europea de Accesibilidad y se aplica desde el 28-jun-2025, cubre el comercio electrónico en webs y apps.
   - Todo botón necesita un nombre accesible. Los botones de solo icono llevan `aria-label`, que es lo que ya hacemos. No hace falta texto visible.
   - La directiva exime a las microempresas de servicios; confirmarlo con el abogado.
6. **Con dinero real (Ley 13/2011, RD 1614/2011, RD 176/2023, RD 958/2020 de publicidad):**
   - Mayoría de edad y verificación de identidad.
   - Autoexclusión (RGIAJ).
   - Página «Juego más seguro».
   - Límites de depósito.
   - El RD 520/2026 (BOE 25-jun-2026) añade límites conjuntos entre operadores: 700 € al día, 1.750 € a la semana y 3.300 € cada cuatro semanas, de referencia. Entra en vigor nueve meses después de su publicación.

## Fuentes
- RevenueCat, socio Newly: https://www.revenuecat.com/partners/technology/partner/newly
- Stripe, negocios prohibidos: https://stripe.com/en-gi/legal/restricted-businesses
- PayPal, actividades de juego: https://www.paypal.com/ie/cshelp/article/what-gambling-activities-does-paypal-prohibit-help391
- Directrices de Apple (IAP y juego con dinero real): https://conductatlas.com/platform/apple/apple-app-store-review-guidelines/provision/CA-P-019098/in-app-purchase-may-not-fund-real-money-gaming/
- TJUE C-249/21: https://ga-p.com/publicaciones/pulsar-el-boton-de-pedido-en-los-contratos-electronicos-no-siempre-obliga-al-comprador/
- Ley 11/2023: https://www.cuatrecasas.com/es/global/propiedad-intelectual/art/claves-proxima-entrada-vigor-ley-accesibilidad-espana
- RD 520/2026: https://boe.es/boe/dias/2026/06/25/pdfs/BOE-A-2026-13762.pdf
