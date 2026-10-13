"use client";
import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onActivate(source: "touch" | "click"): void;
};

/** A compatibility click can target a different button after this one unmounts.
 * Consume only that click; a new physical pointer gesture clears the guard. */
function consumeTouchCompatibilityClick() {
  let timer: ReturnType<typeof setTimeout>;
  const clear = () => {
    document.removeEventListener("click", consume, true);
    document.removeEventListener("pointerdown", clear, true);
    clearTimeout(timer);
  };
  const consume = (event: MouseEvent) => {
    clear();
    if (event.detail === 0) return; // keyboard and assistive activation
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  document.addEventListener("click", consume, true);
  document.addEventListener("pointerdown", clear, true);
  timer = setTimeout(clear, 500);
}

/** Touch release is reliable even when a browser suppresses the compatibility
 * click after a canvas gesture. Keep keyboard/mouse clicks and deduplicate touch. */
export default function GameActionButton({
  onActivate,
  children,
  ...props
}: Props) {
  const pointer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => {
    const clear = () => {
      if (pointer.current !== null) suppressClick.current = true;
      pointer.current = null;
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      onPointerDown={(event) => {
        suppressClick.current = false;
        if (event.pointerType === "touch" && pointer.current === null)
          pointer.current = event.pointerId;
      }}
      onPointerCancel={() => {
        suppressClick.current = true;
        pointer.current = null;
      }}
      onLostPointerCapture={() => {
        pointer.current = null;
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        pointer.current = null;
        suppressClick.current = true;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          return;
        consumeTouchCompatibilityClick();
        onActivate("touch");
      }}
      onClick={(event) => {
        if (event.detail !== 0 && suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          return;
        }
        suppressClick.current = false;
        onActivate("click");
      }}
    >
      {children}
    </button>
  );
}
