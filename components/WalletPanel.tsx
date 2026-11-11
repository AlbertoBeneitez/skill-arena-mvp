"use client";
/**
 * Wallet panel (v171, own component since v174): opened from the balance chip in the header. The player types an
 * amount and adds or withdraws it; the last movements show below. The balance itself lives in DemoApp (onMove).
 */
import { useState } from "react";
import { COIN_SYMBOL, t, useI18n } from "@/lib/i18n";
import st from "./WalletPanel.module.css";

type Props = {
  balance: number;
  /** Formats an amount in the app's currency. */
  format: (value: number) => string;
  onMove: (direction: 1 | -1, amount: number) => void;
  onClose: () => void;
  /** The latest movements, already labelled. */
  movements: readonly { label: string; amount: number }[];
};

/** Typed amount → value in the app currency (2 decimals, 0 < x ≤ 100 000), or 0 when not valid. */
export function parseWalletAmount(text: string) {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 100) / 100 : 0;
}

export default function WalletPanel({ balance, format, onMove, onClose, movements }: Props) {
  useI18n();
  const [text, setText] = useState("");
  const amount = parseWalletAmount(text);
  const move = (direction: 1 | -1) => {
    if (!amount || (direction < 0 && balance < amount)) return;
    onMove(direction, amount);
    setText("");
  };
  return (
    <>
      <div className={st.scrim} onClick={onClose} aria-hidden="true" />
      <div className={st.panel} role="dialog" aria-label={t("wallet.title")} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
        <div className={st.head}>
          <small>{t("wallet.title")}</small>
          <strong dir="ltr">{format(balance)}</strong>
        </div>
        <label className={st.field}>
          <span>{t("wallet.amount")}</span>
          <span className={st.input}>
            <input type="text" inputMode="decimal" autoComplete="off" autoFocus placeholder="0,00" value={text} dir="ltr"
              onChange={(event) => setText(event.target.value.replace(/[^0-9.,]/g, "").slice(0, 9))}
              onKeyDown={(event) => { if (event.key === "Enter") move(1); }} />
            <b aria-hidden="true">{COIN_SYMBOL}</b>
          </span>
        </label>
        <div className={st.actions}>
          <button type="button" className={st.in} disabled={!amount} onClick={() => move(1)}>{t("wallet.deposit")}</button>
          <button type="button" className={st.out} disabled={!amount || balance < amount} onClick={() => move(-1)}>{t("wallet.withdraw")}</button>
        </div>
        <div className={st.moves} aria-live="polite">
          {movements.length === 0 ? <p>{t("profile.noMovements")}</p> : movements.map((movement, index) => (
            <div key={`${movement.label}-${index}`}>
              <span>{movement.label}</span>
              <b className={movement.amount < 0 ? st.negative : undefined} dir="ltr">{movement.amount > 0 ? "+" : ""}{format(movement.amount)}</b>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
