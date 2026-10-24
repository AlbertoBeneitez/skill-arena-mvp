"use client";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";

/** Small modal for destructive or important confirmations. */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="confirmScrim" role="presentation" onClick={onCancel}>
      <div className="confirmCard" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-body">{body}</p>
        <div className="confirmActions">
          <button ref={cancelRef} type="button" onClick={onCancel}>{t("common.cancel")}</button>
          <button type="button" className={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel ?? t("common.confirm")}</button>
        </div>
      </div>
    </div>
  );
}
