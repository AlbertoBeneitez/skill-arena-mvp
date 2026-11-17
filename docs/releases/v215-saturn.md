# v215-saturn · Bowling: letrero GALACTIC GAMES y ratón más sensible (app 2.15)

- Letrero: el panel sobre los bolos lleva el logo (G orbital con satélite) y «GALACTIC / GAMES» con las fuentes de la marca, sobre el cielo estrellado y entre los tubos de neón. Antes: un planeta genérico y «GALACTIC LANES». `scripts/render-bowling-sign.cjs` + `scripts/render-bowling-art.py`; `bowling-pit.webp?v=215`.
- Ordenador: perfil de ratón en `lib/bowlingGesture.v3.ts`. Con el mismo trazo da más dirección (×1,56), más efecto (×1,58) y más fuerza (umbral de velocidad 0,16 y paso 0,15 frente a 0,30 y 0,26), con zonas muertas menores. Es más sensible y más difícil de controlar. Solo cambia la traducción del gesto: mismas acciones grabadas, mismo núcleo 3.0.0 y la misma verificación en el servidor. En móvil no cambia nada.
- Pruebas: `verify-bowling-gesture` (ratón más sensible; táctil por defecto e intacto).
