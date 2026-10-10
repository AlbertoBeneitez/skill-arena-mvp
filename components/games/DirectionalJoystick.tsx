"use client";
import { useEffect, useRef, useState } from "react";
import { stickDirection, type StickDirection } from "@/lib/directionalJoystick";
const keys: Readonly<Record<string, StickDirection>> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
  " ": "STOP",
};
/** Releasing latches the continuous heading; cancellation stops safely. */
export default function DirectionalJoystick({
  enabled,
  send,
}: {
  enabled: boolean;
  send(action: StickDirection): void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const owner = useRef<number | null>(null);
  const direction = useRef<StickDirection>("STOP");
  const latestSend = useRef(send);
  latestSend.current = send;
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  function reset(stop: boolean) {
    const id = owner.current;
    owner.current = null;
    direction.current = "STOP";
    if (id !== null && stop) latestSend.current("STOP");
    if (id !== null && surface.current?.hasPointerCapture(id))
      surface.current.releasePointerCapture(id);
    setOffset({ x: 0, y: 0 });
  }
  useEffect(() => {
    const blur = () => reset(true);
    const hidden = () => {
      if (document.hidden) reset(true);
    };
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  useEffect(() => {
    if (!enabled) reset(false);
  }, [enabled]);
  function move(clientX: number, clientY: number) {
    const rect = surface.current!.getBoundingClientRect();
    const x = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
    const next = stickDirection(x, y, direction.current);
    const length = Math.hypot(x, y),
      scale = length > 0.58 ? 0.58 / length : 1;
    setOffset({
      x: (x * scale * rect.width) / 2,
      y: (y * scale * rect.height) / 2,
    });
    if (next !== direction.current) {
      direction.current = next;
      latestSend.current(next);
    }
  }
  return (
    <div className="directionalStickControls">
      <div
        ref={surface}
        className="directionalStick"
        role="group"
        aria-label="Joystick de dirección"
        tabIndex={enabled ? 0 : -1}
        aria-disabled={!enabled}
        onPointerDown={(event) => {
          if (!enabled || owner.current !== null) return;
          event.preventDefault();
          owner.current = event.pointerId;
          direction.current = "STOP";
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            Math.hypot(
              event.clientX - rect.left - rect.width / 2,
              event.clientY - rect.top - rect.height / 2,
            ) <
            rect.width * 0.1
          )
            latestSend.current("STOP");
          move(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (enabled && owner.current === event.pointerId) {
            event.preventDefault();
            move(event.clientX, event.clientY);
          }
        }}
        onPointerUp={(event) => {
          if (owner.current === event.pointerId) reset(false);
        }}
        onPointerCancel={(event) => {
          if (owner.current === event.pointerId) reset(true);
        }}
        onLostPointerCapture={(event) => {
          if (owner.current === event.pointerId) reset(true);
        }}
        onBlur={() => reset(true)}
        onKeyDown={(event) => {
          const action = keys[event.key];
          if (enabled && action) {
            event.preventDefault();
            if (!event.repeat) latestSend.current(action);
          }
        }}
      >
        <span className="stickMark stickUp" aria-hidden="true">
          ↑
        </span>
        <span className="stickMark stickDown" aria-hidden="true">
          ↓
        </span>
        <span className="stickMark stickLeft" aria-hidden="true">
          ←
        </span>
        <span className="stickMark stickRight" aria-hidden="true">
          →
        </span>
        <span
          className="stickThumb"
          aria-hidden="true"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        />
      </div>
      <button
        type="button"
        className="stickStop"
        aria-label="Detener movimiento"
        disabled={!enabled}
        onClick={() => latestSend.current("STOP")}
      >
        ■
      </button>
    </div>
  );
}
