# Simulador de jugadores bot (v225, 20-nov-2026)

Pedido por el propietario el 20 de noviembre de 2026: jugadores simulados, lo más realistas posible y sin pagar nada,
para encontrar fallos y estructurar la plataforma. Es una excepción, autorizada por el propietario, a la norma del 16 de
noviembre («Claude no juega partidas»): solo con bots, **solo en local** y nunca contra Vercel.

## Qué es

- **Servidor real en local**: la compilación de producción (`next start`) con PostgreSQL propio y partidas durables
  activadas, igual que Vercel con `ALLOW_PERSISTED_MATCH_TRAINING=1`. Nada sale de la máquina: coste 0 €.
- **Bots con «Bot» en el nombre** (por ejemplo «Bot Vega 131012»): cada uno tiene su cuenta (la misma cookie firmada que
  deja el inicio de sesión real), su cartera y sus cookies, como un móvil.
- **Mismo camino que un jugador**: semilla emitida por el servidor, entradas generadas tick a tick con el núcleo
  congelado del juego (`lib/verified`), avisos de «sigo jugando» cada 4 s, espera en tiempo real y verificación por
  repetición en el servidor.

## Familias de bots

| Familia | Qué hace | Cómo se lanza |
|---|---|---|
| Personas (API) | Cuenta, cartera, cambio de monedas, avatar y nombre, rankings, grupos, historial | `campaign personas` |
| Partidas | Partidas completas en tiempo real con tres estilos: novato, medio y experto | `campaign partidas` |
| Competir | Grupo entre bots: código, competición «Todos vs todos», jornadas y resultados | `campaign competir` |
| Trampas | Sesiones falsas, CSRF, entradas manipuladas, partidas más rápidas que el reloj, partidas ajenas, cuotas, semilla conocida, mejor de N en grupos | `campaign trampas` |
| Cupo global | Agota el tope global de partidas para ver si bloquea a todos (**bloquea la base de datos de simulación**: lanzarlo al final) | `campaign cuota` |
| Interfaz | Navegadores reales (móvil 375, móvil 360 y ordenador) que tocan, escriben, desplazan y vuelven atrás; registra errores de página, de consola, de servidor y pantallas más anchas que el móvil, con captura | `scripts/sim/ui-bots.cjs` |

Estilos de juego (`scripts/sim/policies.ts`): **novato** (lento, jugadas al azar), **medio** (ritmo humano, elige la mejor
de unas pocas jugadas mirando 2,5 s por delante) y **experto** (la trampa que hoy puede hacer cualquier cliente:
conoce la semilla y prueba hasta 28 jugadas en una copia del juego, con retrasos de aspecto humano).

## Cómo se ejecuta

```bash
# 1. Base de datos de simulación (una vez) y servidor local
sudo -u postgres psql -c "create database skill_arena_sim owner qa"
pnpm build
SIM_DATABASE_URL=postgres://qa:qa@127.0.0.1:5432/skill_arena_sim scripts/sim/start-server.sh &

# 2. Bots (el secreto es el del servidor local de simulación)
export SIM_AUTH_SECRET=sim-local-secret-0123456789-abcdefghijkl
pnpm sim                      # personas, partidas, competir y trampas
pnpm sim -- partidas          # una familia
SIM_PLAYERS=24 SIM_MATCHES=3 pnpm sim -- partidas
pnpm sim:ui -- 9 70           # 9 bots de interfaz × 70 toques
```

Informes en `sim-reports/<fecha>/report.md` y `report.json` (fuera del repositorio). Seguridad: `SIM_BASE` y
`SIM_DATABASE_URL` solo aceptan `127.0.0.1` o `localhost`.

## Limitaciones

- Mine Grid y Solitaire Sprint usan su protocolo oculto propio: todavía no tienen bot.
- Slot, Galoku y Reaction Test duran más de 150 s con estos estilos y se saltan en tiempo real
  (`SIM_MAX_MATCH_S` lo cambia).
- Los estilos son genéricos: miden robustez y justicia, no son la mejor estrategia posible de cada juego. Un atacante
  dedicado haría un solucionador por juego, que sería todavía más fuerte que el «experto».
- En grupos online solo existe todavía la modalidad «Todos vs todos».

Resultados de la primera campaña: [revisión de seguridad de noviembre](security/REVISION_2026-11.md).
