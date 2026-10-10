# v79-mobile · Phalanx continuo

Base v78-mobile93078ed, CI38060785664success; VercelReady y mobile-test fast-forward.

Star Phalanx2.0.0 convierte las16capas/100enemigos en un curso continuo sin pausas,
borrado de proyectiles ni reset de vuelo/volley. Conserva geometrías progresivas,
carga/ataques dobles, blindaje y protección. Rebasa coordenadas de filas derrotadas
para que nuevos enemigos no aparezcan fuera de pantalla por descenso acumulado.
Alcance=muertes únicas. Presentaciónv77 preservada, sin sectores/instrucciones.
Reutiliza core runtime, RNG, protocolo, registry/lazyloader, recorder y server
adapter común; archiveV1 inalterado. Destinos táctiles finales coalescidos usan
la corrección comúnv78, acciones de disparo mantienen su cola ordenada.

## Validación

- V1golden score43475/tick13529 preservado; V2golden43475/tick10352/sha256
023e94a805184bcfff80a95971e02d7c72b3b2be57f331213439b285e116694e.
-32replays completosV2:29victorias/3derrotas;128aperturas seguras, renderrates
60/120/144, inputs inválidos/duplicados/límites, RNG/reloj controlado, disparos
conservados, rebasing visible, shield/derrota y held fire sin exploit.
-5138frames del renderer real sobre estadosV1/V2: simulación solo lectura,
centros/identidad de proyectiles exactos y estado canvas equilibrado.
-42versiones del endpoint de registro, sin rebajar verificación histórica.
-Native touch Chromium build producción: victoria portrait100enemigos/16capas,
tick10643/88.692s/3vidas/419inputs; landscape11245/93.708s/3vidas/446inputs.
-Un envío terminal por intento, score/replay del servidor coincidente; cancel/
blur libera FIRE_UP. Derrotas en ambas vistas3649ticks/1enemigo, reinicio con
nuevo manifiesto, rotación del QA y ausencia de consola/overflow/resultado viejo.
-Audio activado en portrait; typecheck/lint, producción build y diffcheck verdes.

Sin importaciones/assets ajenos, identidad/dinero/PG de producción no activados.
CI/Vercel se comprueban antes del fast-forward estable. Dispositivos físicos son
seguimiento del propietario, no bloqueo de la siguiente unidad. Mine/Solitaire
privados/variedad pública y confirmar doce piezas permanecen pendientes.
