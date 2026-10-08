# Orbit Shift 1.0

Evolución original de las cinco órbitas, transición radial y lectura anticipada
existentes. 0.1 queda archivado: su primer obstáculo coincidía con la órbita
inicial en ~1.24 s, no usaba escenarios por seed ni replay autoritativo y su
loop descartaba tiempo por frame. No se modifica ningún core histórico.

1.0 usa el coreRuntime, RNG/scenarios, lifecycle, registry lazy y adapter comunes.
120 ticks/s, 65536 unidades angulares por vuelta y radios en milipíxeles.
Transición radial 28% por tick con redondeo entero. IN/OUT cambian una órbita,
cooldown 12 ticks, límites 0–4, máximo 1400 inputs; doble input imposible o
fuera de orden se rechaza en replay. Trigonometría solo dibuja.

60 pasos, tres sectores de veinte. Primeros ocho excluyen la órbita central;
apertura estática segura ≥8 s. Obstáculos en una/dos/tres órbitas, siempre al
menos dos libres. Distancias seed-versionadas y velocidades 128/152/176 unidades
por tick. Arcos próximos anticipados, indicador ámbar antes de cruzar y recargas
verdes cada siete pasos en órbitas libres. Tres escudos, daño −350 (mínimo cero),
protección 180 ticks; último escudo: ORBIT_COLLISION. Contacto radial <18 px al
pasar el arco; recarga ≤12 px devuelve un escudo y 160 puntos, o 80 si completo.
Cada paso/recarga se consume una vez. Paso limpio: 420 + combo×8, máximo +240;
contacto protegido: 80, combo se reinicia. 60 pasos o target: victoria; bonus
final 1000 + escudos×150. Límite 120 segundos: derrota. Target demo 33000,
alcanzable; práctica recorre el curso completo con su configuración existente.

Golden 38130/tick 6811/hash en scripts/fixtures/orbit-v1.json. 64 cursos completos,
128 aperturas de ocho segundos, 1/2/3 arcos, recogibles libres, daño/protección,
consumo único, movimiento continuo/bounds/cooldown, replay/inputs inválidos y
render 60/120/144 Hz. UI con fondo común, reactor original, anillos, trazas,
impacto/recarga y finale corto; controles físicos fuera del campo, swipe/keys.
No assets/code ajenos ni nueva dependencia. No rival gráfico ficticio.

Verificación deriva score/fin desde inputs y manifest; HTTP continúa demo, no
activa identidad, pairing ni dinero reales. QA física a cargo del propietario
como seguimiento, sin bloquear desarrollo. Criterio de PRODUCCIÓN sigue requiriendo
sus integraciones externas y evaluación comercial/operacional.
