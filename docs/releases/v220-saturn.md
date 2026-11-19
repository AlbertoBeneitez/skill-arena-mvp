# v220-saturn · Átomo de inicio, más ligas, imágenes de grupo y retos (app 2.20)

- **Inicio:** el fondo de la bienvenida (y de «Hola de nuevo») es un átomo retro interactivo (`components/AtomScene.tsx`):
  lienzo de baja resolución ampliado sin suavizado, líneas de pantalla y viñeta. El electrón da una vuelta en 6–16 s
  según la órbita. Un toque en el fondo lo sube de órbita con un pequeño destello; solo, vuelve a bajar tras unos
  segundos y oscurece la zona donde está; en reposo sube de vez en cuando. Normas de luz (WCAG 2.3.1): como mucho un
  destello cada 0,7 s, pequeño (≤ 48 px) y breve; con «reducir movimiento» la escena queda quieta. Textos y botones
  igual que antes.
- **Ligas:** tras Diamante vienen Madera (80 victorias), Ámbar (120) y Perla (175): materiales hechos por seres vivos,
  más raros en el espacio que cualquier gema. Rivales más exigentes en cada una; camino de 8 niveles.
- **Imágenes de grupo:** cinco escenas nuevas (agujero negro, aurora, mineros de asteroides, supernova, estación
  abandonada). Al tocar la imagen del grupo se elige entre las once (o una foto, sin conexión). Con conexión la elige el
  dueño y se guarda en el servidor (migración 017, `arena_groups.art`, acción `art`).
- **Grupos con conexión:** «Publicar reto» pasa a «Lanzar reto» y «Buscar rival» a «Aceptar retos». Fuera el ranking de
  todos los grupos: en su lugar, la clasificación de las competiciones del grupo del jugador.
- Propuesta de diseño «Retro suave» (B) añadida al lienzo de diseño junto a «Cabina 84» (A).
