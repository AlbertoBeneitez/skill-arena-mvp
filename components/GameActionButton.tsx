"use client";
import { useEffect, useRef, type ButtonHTMLAttributes } from "react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onActivate(): void;
};

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
        onActivate();
      }}
      onClick={(event) => {
        if (event.detail !== 0 && suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          return;
        }
        suppressClick.current = false;
        onActivate();
      }}
    >
      {children}
    </button>
  );
}
