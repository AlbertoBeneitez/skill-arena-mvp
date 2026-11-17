# v209-saturn · Shot Gallery V14 (app 2.09)

Petición del propietario (17-nov-2026): las pantallas siguen hasta abatir todos los blancos buenos, y cada disparo a
un ser que no era hace aparecer en otro lado un blanco nuevo, para que disparar a todo no compense.

- Núcleo `shotGalleryCore.v14.ts` (14.0.0): mismas pantallas que V13 para la misma semilla. Sin plazo por pantalla ni
  cierre por tres fallos. Señuelo abatido: +400 ms, se esconde y sale un blanco nuevo en un escondite libre distinto
  (determinista por semilla, pantalla y fallo). Disparo antes de tiempo: +600 ms, la pantalla sigue. Seguro de 30 s
  por pantalla solo para partidas abandonadas (cada blanco en pie +1500 ms). `PICK_n` = escondite n.
- Medido con el jugador de pruebas (mismo ritmo): limpio 9,3 s · un fallo por pantalla 20,1 s · disparando a todo 47,5 s.
- Pantalla: el señuelo abatido se encoge y se esconde; el blanco nuevo asoma desde su escondite.
- Verificador registrado; V1–V13 congeladas. Pruebas: `verify-gallery-v14`, fixture dorado, presentación.
