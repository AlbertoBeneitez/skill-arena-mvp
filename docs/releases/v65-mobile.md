# v65-mobile · Base visible, escena completa y mute fiable

Parte de v64. Commits separados: Stack retira los textos de ejes manteniendo su
flecha y core3D; Tower conserva suelo y todas las capas, ajusta zoom uniforme del
área activa y comprime únicamente capas antiguas cuando el detalle sería pequeño.
Sin proyección de caída ni cambios de física/inputs/scoring/históricos. Regresión
con renderer real reproduce ausencia de suelo a cuatro bloques; test preserva
estado/replay real15bloques y comprueba1–501capas/base/crane/legibilidad.

Arte original generado para el producto, codificado WebP941×1672/90.606bytes,
reemplaza fondo compartido. CSS y canvas usan una sola composición respecto al
viewport completo, también en letterbox/safe areas; sin segundo Saturno ni costura
horizontal. Caché Image/una blit por frame, geometría cacheada al resize, cero
lecturas layout por frame; wash común y fallback procedural. Jet conserva estelas
que comunican velocidad. No assets protegidos ni dependencias nuevas.

Audio: master gain se cierra dentro del gesto; se detienen/desconectan todas las
voces, stopMusic cancela su cola y onended libera nodos. Resume pendiente puede
completar sin sonido; reactivar crea voces nuevas. Preferencia persistente, misma
infraestructura para botones de catálogo/juego/avatar. Ninguna lógica competitiva
se mueve a UI.

Typecheck/lint/build/diffcheck pasan, fixtures/goldens Stack/Tower y viewport
contain/expand/orientación/DPR preservados. Prueba Web Audio nativa reproduce el
fallo anterior con RMS0,00603 mientras OFF; corregidoRMS0 incluso tras resume,
OFF no programa voces y reactivación daRMS>0. Botones reales, pérdida de contexto
emulada y persistencia pasan vertical/horizontal, consola limpia.

QA Chromium local con touch real: Tower dos wins altura8, scores6369/6555,
22.275/28.183s; pérdida profunda altura14/12117/51.125s. Replay del registro
posteado coincide con servidor, un envío, base visible, reinicio/rotación y
dobletap exacto descartado. El mirror de QA aproxima timestamps y no decide score;
se conserva evidencia del primer actor fallido y se corrige selector del resultado.
Catálogo/search/empty/errors en320/horizontal;36montajes/abandonos18VERIFIED,
Jet explosión/envío inmediato/replay. Tras corregir alineación se comprueban
entrada, fondo y salida reales en ambas orientaciones; una Image y una blit/frame.
Comparación pixel CSS/canvas en Chromium: diferencia media0,086/255,100frames,
resize/falloimagen sin huecos. Física real/FPS en móviles del propietario sigue
siendo seguimiento, no requisito para continuar.

CI y Vercel se revisan antes de FF normal mobile-test. Pendientes actuales en
PRODUCT_BACKLOG_STATUS.md: Memoria, Alien, métricas/desempate, rotación1000,
privados y demás unidades; no se activa competición/dinero/identidad reales.
