# Solitaire · preparación de setups privados

Candidato de generación1.0.0 en `lib/verified/solitaireSetup.v1.server.ts`, no
conectado al catálogo ni publicado como core VERIFIED. Legacy0.1 sigue intacto.
El futuro core privado debe consumir la seed del manifiesto privado común emitido
por servidor y compartido entre participantes. No hay selector de seed cliente,
nueva RNG, emisión/persistencia paralela ni proveedor concreto.

Fisher–Yates utiliza la utilidad HMAC privada existente con la key completa y un
dominio versionado.52cartas, columnas1..7,24en stock; solo la última carta de cada
columna es visible. La proyección devuelve IDs únicamente de caras visibles y
cantidad de stock, nunca IDs de cartas ocultas, orden del mazo, seed o manifiesto.
No reutiliza el pequeño pool público de deals que permitiría inferir cartas ocultas.

1000seeds de prueba dan1000tableros y1000disposiciones visibles iniciales distintas,
cada carta una sola vez. Mismo input produce mismo setup; clave completa cuenta;
proyección no modifica ni filtra estado secreto; RNG/reloj no controlados prohibidos.
Golden sintético: seed`solitaire-setup-v1-golden`,
sha256:350fb434ddd9422966a56e88888d01919de868fc85147df30bd2330ce0f57f49.
Las seeds de test no son credenciales ni escenarios privados de usuarios.

Pendiente: validar la policy de resolubilidad y duración; un shuffle válido NO
prueba que un Klondike sea ganable. Reutilizar la autoridad de comandos común para
el core/replay/scoring, cerrar únicamente con52cartas en bases y corregir el farming
legacy, UI táctil/proyección/delivery y QA completa. Solo entonces conectar la
integración pública con identidad/repositorios durables configurados. No se activa
el singleton local como persistencia de Vercel ni se inventa autenticación real.

Esta unidad prepara variedad segura para la futura migración; no cierra el requisito
visible de cambiar el setup cada intento, ni promete1000escenarios sin repetición
por usuario (requiere selección durable). Implementación original, sin terceros.
