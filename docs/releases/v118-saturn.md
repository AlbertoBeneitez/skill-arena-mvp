# v118-saturn — Megáfono con las seis canciones y portadas nuevas de Stack, Billar y Shot Gallery (26-oct-2026)

Base: v117-saturn (7a0261b).

## Megáfono (`components/SoundMenu.tsx`)
- Al tocar el megáfono, tanto en la barra del catálogo como dentro de cada juego, se abre un panel:
  - **Sonido:** interruptor para activarlo o desactivarlo.
  - **Elige la música:** las seis canciones (Lo-fi, Ambiente, Piano, Concentración profunda, Synth suave y Lluvia y teclas), y debajo Mezcla y Del juego.
- La canción que suena lleva un ecualizador animado y la etiqueta «Suena».
- Elegir una canción la pone al momento y vuelve a activar el sonido y la música si estaban apagados.
- La elección es el mismo ajuste que «Tipo de música» en Ajustes.
- El panel se cierra tocando fuera o con Escape, y no se sale de la pantalla.
- `lib/gameFeedback.ts` recuerda qué música pidió la pantalla, para reanudarla al reactivar la música.

## Portadas
- **Stack:** la torre entera está más abajo, así que el bloque dorado que cae y el anillo de aterrizaje quedan fuera de la insignia de liga.
- **Billar:** plano bajo y cinematográfico del momento de la rotura:
  - lámpara colgante con cono de luz y humo;
  - bokeh cálido en la sala oscura;
  - la blanca impactando en el triángulo, con destello y polvo de tiza;
  - bolas desenfocadas en primer plano y el taco acompañando el golpe.
- **Shot Gallery:** caseta de feria de noche:
  - toldo a rayas;
  - postes con bombillas;
  - lona blanca iluminada con la sábana levantándose;
  - figuras grandes, un impacto con chispas y la mira roja;
  - escopeta de feria con fogonazo en primer plano.

## Notas
- Los scripts de QA antiguos que pulsaban el megáfono como interruptor directo (`qa-audio-toggle`, `qa-memory-touch`, `qa-billiards-touch` y `qa-casino-lifecycle`, que no se ejecutan en CI) ahora tienen que abrir el panel primero: el interruptor está dentro, con rol `switch`.
- Pasan el determinismo completo, el typecheck, i18n (10 × 600), el build y el smoke de los 14 juegos.
