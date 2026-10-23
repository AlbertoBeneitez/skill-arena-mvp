# v103-saturn — experiencia y ajustes (23-oct-2026)

Base: v102-saturn (9a79e9e).

## Nuevo
- **Pinball 1.0.0** (núcleo determinista): muelle con potencia cuantizada (PLUNGER_HOLD/RELEASE), palas que cierran el centro (la bola solo
  se pierde por los carriles laterales), bumpers, kickers, dianas, multiplicador ×1–×5, salvabolas corto, 3 bolas.

## Núcleos nuevos (los anteriores se conservan para replays)
- **Galactic Roulette 6.0.0**: la partida acaba cuando el jugador pulsa TERMINAR PARTIDA (acción `CASH_OUT`) o se queda sin fichas; sin tope de 3 min
  (seguridad 10 min). Siempre 100 fichas iniciales.
- **Galactic Slot 3.0.0**: giros de −4 a +4.
- **Billar 4.0.0**: sin las dos esferas naranjas inertes; disposición inicial según semilla.
- **Shot Gallery 4.0.0**: manchas de color (sin figura) y figuras siempre grises; órdenes COLOR, FIGURA y SUMA (color + figura por separado).
- **Orb Burst 4.0.0**: fases de dificultad, hielo, comodín arcoíris, bomba, rayo, poderes almacenados que el jugador elige, combos.
- **Stack Shift 3.0.0**: apertura distinta en cada partida (primeras piezas fáciles aleatorias + bloques sueltos en el suelo).

## Presentación / UX
- Avatar inicial aleatorio mostrado solo; el resto se despliega con "ELEGIR OTRO AVATAR".
- Ruleta: asentamiento final de la bola lento y suave (150 ticks de easing con rebote amortiguado); casillas verdes y azules con el mismo peso visual.
- Sin celebración "Reto superado" en juegos de saldo (Slot, Ruleta). Botones: "N FICHAS".
- Música ambiental de menú fuera de partida, sonido suave en todos los botones, entradas animadas (respeta reduced-motion).
- Solitaire, Billar (taco), Orb Burst: iconografía clara por bola especial.

## Arquitectura
- [ROADMAP_ARQUITECTURA.md](../ROADMAP_ARQUITECTURA.md): decisión del ganador, reparto, anti-bots, orquestación, seguridad, RGPD y salto a estructura real.

## Límites
- Los 12 juegos archivados siguen en el código (los verificadores históricos dependen del registro); quitarlos del todo es una iteración aparte.
- Imán de Orb Burst no implementado; los poderes de Orb Burst pueden resultar fáciles (ajustar tras probar).
