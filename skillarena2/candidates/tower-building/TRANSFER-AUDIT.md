# Tower Lab — transfer audit

## Conservar

- game loop;
- lógica de bloque, caída y colisión;
- scoring base;
- canvas renderer;
- control táctil de una pulsación.

## Sustituir / encapsular

- aleatoriedad global por PRNG con seed;
- reloj/FPS si afecta a la reproducción;
- menús e identidad visual;
- assets que no superen auditoría individual;
- callbacks globales por el contrato de juego de Skill Arena.

## Estado actual

- móvil vertical: sí;
- seed determinista: prototipo;
- captura de inputs: sí;
- replay autoritativo servidor: pendiente;
- interfaz del adaptador común: pendiente de conectar;
- listo para dinero real: no.

El siguiente hito técnico es desacoplar la física del tiempo real del navegador para que un replay pueda reproducirse en servidor o en una simulación headless.
