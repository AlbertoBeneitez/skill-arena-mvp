# v99-mobile — selección, rebotes y escenarios visibles

Iteración de jugabilidad solicitada el 20 de octubre de 2026. Las reglas que
afectan a simulación se publican como cores nuevos y los históricos permanecen
congelados y reproducibles.

- Galactic Birds 6.0.0: selección directa de explorador, rápido o pesado antes
  de cada disparo, diez unidades de cada tipo y controles 1/2/3. La goma se
  limita a54px y siempre queda dentro del lienzo. Un apoyo inferior al18%, con
  mínimos/máximos acotados, ya no mantiene una pieza equilibrada: la estructura
  recibe deslizamiento e impulso deterministas. Los seis niveles fijos de V5 y
  su física de impactos se reutilizan sin modificar el histórico.
- Galactic Roulette 4.0.0: el tapete de49apuestas aparece abierto y una pulsación
  coloca la ficha. La bola se libera en la posición tocada, queda contenida por
  un aro exterior alto y elástico, rebota repetidamente sobre la superficie y
  solo se captura tras una duración mínima y velocidad baja. El tiempo máximo
  por tirada pasa a960ticks; saldo, coste ficticio, resultado geométrico y replay
  siguen bajo autoridad del servidor. La composición móvil se conserva.
- Tower Drop 4.0.0: gancho articulado visible, apertura progresiva al soltar y
  descenso repartido en dos ticks por paso físico. La trayectoria, apoyo,
  vuelco, puntuación y resultado final de V3 se conservan exactamente.
- Dardos: diana e impactos ampliados un8% con transformación inversa del toque;
  el core V3, el sway y la puntuación autoritativa no cambian.
- Mine Grid: cada escenario seedado muestra desde el inicio su apertura segura,
  identificador, número de casillas iniciales y minas. La variante privada
  muestra el identificador de escenario y sus dimensiones sin revelar la seed
  ni las minas ocultas.

Validación local: TypeScript/lint, suite determinista histórica y nuevas pruebas
de Birds V6, Roulette V4 y Tower V4;576frames Birds,8352frames Roulette,
6336frames Dardos y stress de501capas Tower sin mutar estado. Build de producción
Next.js16.3.8 correcto. La segunda ejecución integral continuó desde Dardos tras
corregir dos fixtures de presentación; todos los tramos quedan aprobados. QA en
dispositivo físico continúa como seguimiento y no se confunde con automatización.

No se activa dinero real, autenticación, ledger ni PostgreSQL en Vercel. La rama
de entrega es `qa/gameplay-polish-v99`; `main` y `mobile-test` no se modifican.
