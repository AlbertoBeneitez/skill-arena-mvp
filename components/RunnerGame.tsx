"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameResult = {
  won: boolean;
  score: number;
  timeMs: number;
};

type Props = {
  active: boolean;
  onFinish: (result: GameResult) => void;
};

/*
 * VIEWPORT MOBILE-FIRST
 *
 * El juego siempre se calcula internamente con estas dimensiones.
 * En móviles simplemente se escala visualmente.
 *
 * Esto hace que todos los jugadores tengan:
 * - misma física
 * - mismos obstáculos
 * - mismo recorrido
 * - misma dificultad
 */
const WIDTH = 390;
const HEIGHT = 700;

const GROUND = 590;

const PLAYER_X = 72;
const PLAYER_W = 38;
const PLAYER_H = 48;

const SPEED = 265;
const GRAVITY = 1850;
const JUMP = -680;

const FINISH_X = 4300;

const OBSTACLES = [
  [650, 42, 48],
  [920, 48, 68],
  [1210, 38, 44],
  [1460, 44, 84],
  [1750, 50, 54],
  [2020, 42, 76],
  [2300, 38, 48],
  [2540, 46, 92],
  [2820, 42, 58],
  [3100, 52, 72],
  [3380, 40, 48],
  [3650, 46, 88],
  [3920, 40, 56],
] as const;

export default function RunnerGame({ active, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const onFinishRef = useRef(onFinish);

  const stateRef = useRef({
    y: GROUND - PLAYER_H,
    vy: 0,
    worldX: 0,
    last: 0,
    startedAt: 0,
    running: false,
  });

  const [status, setStatus] = useState<
    "ready" | "running" | "lost" | "won"
  >("ready");

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const s = stateRef.current;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    /*
     * FONDO
     */
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);

    sky.addColorStop(0, "#11182a");
    sky.addColorStop(0.6, "#091321");
    sky.addColorStop(1, "#06101b");

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    /*
     * LÍNEAS DEL FONDO
     */
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1;

    for (
      let x = -((s.worldX * 0.25) % 55);
      x < WIDTH;
      x += 55
    ) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND);
      ctx.stroke();
    }

    for (let y = 70; y < GROUND; y += 70) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();
    }

    /*
     * PROGRESO
     */
    const progress = Math.min(
      100,
      Math.round((s.worldX / FINISH_X) * 100)
    );

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(20, 25, WIDTH - 40, 6);

    ctx.fillStyle = "#66e3ff";
    ctx.fillRect(
      20,
      25,
      ((WIDTH - 40) * progress) / 100,
      6
    );

    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "700 14px system-ui";
    ctx.fillText(`${progress}%`, 20, 52);

    /*
     * SUELO
     */
    ctx.fillStyle = "#17243a";
    ctx.fillRect(
      0,
      GROUND,
      WIDTH,
      HEIGHT - GROUND
    );

    ctx.fillStyle = "#2b4062";
    ctx.fillRect(0, GROUND, WIDTH, 5);

    /*
     * META
     */
    const finishScreenX =
      FINISH_X - s.worldX + PLAYER_X;

    if (
      finishScreenX > -50 &&
      finishScreenX < WIDTH + 50
    ) {
      ctx.fillStyle = "#7cf29a";

      ctx.fillRect(
        finishScreenX,
        130,
        5,
        GROUND - 130
      );

      ctx.font = "800 16px system-ui";
      ctx.fillText(
        "META",
        finishScreenX - 18,
        110
      );
    }

    /*
     * OBSTÁCULOS
     */
    for (const [ox, ow, oh] of OBSTACLES) {
      const x =
        ox - s.worldX + PLAYER_X;

      if (x < -80 || x > WIDTH + 80) {
        continue;
      }

      const obstacleY = GROUND - oh;

      /*
       * brillo del obstáculo
       */
      ctx.shadowColor = "#ff5e7e";
      ctx.shadowBlur = 18;

      const grad = ctx.createLinearGradient(
        x,
        obstacleY,
        x + ow,
        GROUND
      );

      grad.addColorStop(0, "#ff936e");
      grad.addColorStop(1, "#ff4f72");

      ctx.fillStyle = grad;

      ctx.fillRect(
        x,
        obstacleY,
        ow,
        oh
      );

      ctx.shadowBlur = 0;

      /*
       * línea superior para distinguirlo mejor
       */
      ctx.fillStyle =
        "rgba(255,255,255,0.32)";

      ctx.fillRect(
        x,
        obstacleY,
        ow,
        3
      );
    }

    /*
     * PERSONAJE
     *
     * Mucho más visible en móvil.
     */
    ctx.shadowColor = "#66e3ff";
    ctx.shadowBlur = 22;

    ctx.fillStyle = "#66e3ff";

    ctx.fillRect(
      PLAYER_X,
      s.y,
      PLAYER_W,
      PLAYER_H
    );

    ctx.shadowBlur = 0;

    /*
     * cara
     */
    ctx.fillStyle = "#06101b";

    ctx.fillRect(
      PLAYER_X + 22,
      s.y + 10,
      7,
      7
    );

    /*
     * piernas / detalle visual
     */
    ctx.fillStyle = "#bdf5ff";

    ctx.fillRect(
      PLAYER_X + 5,
      s.y + PLAYER_H - 7,
      9,
      7
    );

    ctx.fillRect(
      PLAYER_X + PLAYER_W - 14,
      s.y + PLAYER_H - 7,
      9,
      7
    );

    /*
     * Indicador del jugador.
     * Hace imposible perderlo visualmente.
     */
    ctx.fillStyle = "rgba(102,227,255,0.9)";

    ctx.beginPath();

    ctx.moveTo(
      PLAYER_X + PLAYER_W / 2,
      s.y - 18
    );

    ctx.lineTo(
      PLAYER_X + PLAYER_W / 2 - 8,
      s.y - 30
    );

    ctx.lineTo(
      PLAYER_X + PLAYER_W / 2 + 8,
      s.y - 30
    );

    ctx.closePath();
    ctx.fill();

    /*
     * Ayuda inicial
     */
    if (
      s.running &&
      s.worldX < 380
    ) {
      ctx.fillStyle =
        "rgba(255,255,255,0.9)";

      ctx.font =
        "800 18px system-ui";

      ctx.textAlign = "center";

      ctx.fillText(
        "TOCA PARA SALTAR",
        WIDTH / 2,
        110
      );

      ctx.font =
        "500 13px system-ui";

      ctx.fillStyle =
        "rgba(255,255,255,0.55)";

      ctx.fillText(
        "Puedes tocar cualquier parte del juego",
        WIDTH / 2,
        134
      );

      ctx.textAlign = "start";
    }

    /*
     * Pantalla esperando partida
     */
    if (!s.running && s.worldX === 0) {
      ctx.fillStyle =
        "rgba(255,255,255,0.72)";

      ctx.font =
        "700 17px system-ui";

      ctx.textAlign = "center";

      ctx.fillText(
        "Neon Dash",
        WIDTH / 2,
        120
      );

      ctx.font =
        "500 13px system-ui";

      ctx.fillStyle =
        "rgba(255,255,255,0.5)";

      ctx.fillText(
        "Entra al torneo para comenzar",
        WIDTH / 2,
        145
      );

      ctx.textAlign = "start";
    }
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      const s = stateRef.current;

      if (!s.running) return;

      s.running = false;

      if (frameRef.current !== null) {
        cancelAnimationFrame(
          frameRef.current
        );

        frameRef.current = null;
      }

      const timeMs = Math.max(
        1,
        performance.now() - s.startedAt
      );

      const score = won
        ? Math.max(
            1000,
            Math.round(1000000 / timeMs)
          )
        : Math.round(s.worldX);

      setStatus(
        won ? "won" : "lost"
      );

      onFinishRef.current({
        won,
        score,
        timeMs: Math.round(timeMs),
      });
    },
    []
  );

  const loop = useCallback(
    (now: number) => {
      const s = stateRef.current;

      if (!s.running) return;

      const dt = Math.min(
        0.032,
        (now - s.last) / 1000 || 0
      );

      s.last = now;

      /*
       * Movimiento horizontal
       */
      s.worldX += SPEED * dt;

      /*
       * Física vertical
       */
      s.vy += GRAVITY * dt;

      s.y += s.vy * dt;

      /*
       * Suelo
       */
      if (
        s.y >
        GROUND - PLAYER_H
      ) {
        s.y =
          GROUND - PLAYER_H;

        s.vy = 0;
      }

      /*
       * Hitbox del jugador.
       *
       * En coordenadas del mundo,
       * no de pantalla.
       */
      const px1 = s.worldX;
      const px2 =
        px1 + PLAYER_W;

      const py1 = s.y;
      const py2 =
        s.y + PLAYER_H;

      /*
       * Colisiones
       */
      for (
        const [ox, ow, oh]
        of OBSTACLES
      ) {
        const collisionX =
          px2 > ox &&
          px1 < ox + ow;

        const obstacleTop =
          GROUND - oh;

        const collisionY =
          py2 > obstacleTop &&
          py1 < GROUND;

        if (
          collisionX &&
          collisionY
        ) {
          finish(false);
          draw();
          return;
        }
      }

      /*
       * Llegada a meta
       */
      if (
        s.worldX >= FINISH_X
      ) {
        finish(true);
        draw();
        return;
      }

      draw();

      frameRef.current =
        requestAnimationFrame(loop);
    },
    [draw, finish]
  );

  const start = useCallback(() => {
    const s = stateRef.current;

    s.y =
      GROUND - PLAYER_H;

    s.vy = 0;
    s.worldX = 0;

    s.last =
      performance.now();

    s.startedAt =
      s.last;

    s.running = true;

    setStatus("running");

    draw();

    frameRef.current =
      requestAnimationFrame(loop);
  }, [draw, loop]);

  const jump = useCallback(() => {
    const s = stateRef.current;

    const grounded =
      Math.abs(
        s.y -
          (GROUND - PLAYER_H)
      ) < 2;

    if (
      s.running &&
      grounded
    ) {
      s.vy = JUMP;
    }
  }, []);

  /*
   * Primer render
   */
  useEffect(() => {
    draw();
  }, [draw]);

  /*
   * Arrancar partida
   */
  useEffect(() => {
    if (active) {
      start();
    }

    return () => {
      stateRef.current.running =
        false;

      if (
        frameRef.current !== null
      ) {
        cancelAnimationFrame(
          frameRef.current
        );

        frameRef.current = null;
      }
    };
  }, [active, start]);

  /*
   * Teclado para PC.
   *
   * En móvil se juega tocando.
   */
  useEffect(() => {
    const key = (
      e: KeyboardEvent
    ) => {
      if (
        e.code === "Space" ||
        e.code === "ArrowUp"
      ) {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener(
      "keydown",
      key
    );

    return () =>
      window.removeEventListener(
        "keydown",
        key
      );
  }, [jump]);

  return (
    <div
      className="gameShell"
      style={{
        maxWidth: "430px",
        margin: "0 auto",
      }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="gameCanvas"
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
        }}
        aria-label="Juego de carrera determinista"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          touchAction: "none",
        }}
      />

      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          jump();
        }}
        disabled={
          status !== "running"
        }
        style={{
          width:
            "calc(100% - 24px)",
          margin: "12px",
          minHeight: "58px",
          border: "1px solid rgba(101,225,255,.25)",
          borderRadius: "14px",
          background:
            status === "running"
              ? "linear-gradient(135deg,#65e1ff,#71f5bd)"
              : "#101827",
          color:
            status === "running"
              ? "#06101b"
              : "#75839a",
          fontWeight: 900,
          fontSize: "16px",
          touchAction: "manipulation",
        }}
      >
        {status === "running"
          ? "SALTAR"
          : "ENTRA AL TORNEO"}
      </button>

      <div className="gameFooter">
        <span>
          Móvil: toca el juego o
          pulsa SALTAR
        </span>

        <span
          className={`statusDot ${status}`}
        >
          {status === "running"
            ? "EN PARTIDA"
            : status.toUpperCase()}
        </span>
      </div>
    </div>
  );
}