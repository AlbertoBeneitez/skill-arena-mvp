"use client";
/**
 * Wallet panel (v171, own component since v174): opened from the balance chip in the header.
 * v178: in the Group tab's look (carbon, ice, citron). Amounts are typed in euros (1 € = 1 cosmicoin, ₡). INGRESAR adds them to
 * the fictitious balance. RETIRAR opens the payment-provider step: real withdrawals need a payment provider, which is
 * not connected yet, so that step says so and only offers a withdrawal from the fictitious balance (it never moves
 * real money and asks for no bank details). The balance itself lives in DemoApp (onMove).
 */
import { useState } from "react";
import { formatNumber, t, useI18n } from "@/lib/i18n";
import UiIcon from "./UiIcon";
import st from "./WalletPanel.module.css";

type Props = {
  balance: number;
  /** Formats an amount in the app's currency (₡). */
  format: (value: number) => string;
  onMove: (direction: 1 | -1, amount: number) => void;
  onClose: () => void;
  /** The latest movements, already labelled. */
  movements: readonly { label: string; amount: number }[];
};

/** Typed amount → value (2 decimals, 0 < x ≤ 100 000), or 0 when not valid. */
export function parseWalletAmount(text: string) {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 100000 ? Math.round(n * 100) / 100 : 0;
}

const euros = (value: number) => `${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\u00a0€`;

export default function WalletPanel({ balance, format, onMove, onClose, movements }: Props) {
  useI18n();
  const [text, setText] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const amount = parseWalletAmount(text);
  const deposit = () => {
    if (!amount) return;
    onMove(1, amount);
    setText("");
  };
  const simulateWithdraw = () => {
    if (!amount || balance < amount) return;
    onMove(-1, amount);
    setText("");
    setWithdrawing(false);
  };
  return (
    <>
      <div className={st.scrim} onClick={onClose} aria-hidden="true" />
      <div className={st.panel} role="dialog" aria-label={t(withdrawing ? "wallet.withdrawTitle" : "wallet.title")}
        onKeyDown={(event) => { if (event.key === "Escape") { if (withdrawing) setWithdrawing(false); else onClose(); } }}>
        {!withdrawing ? (
          <>
            <div className={st.head}>
              <small>{t("wallet.title")}</small>
              <strong dir="ltr" aria-live="polite">{format(balance)}</strong>
            </div>
            <label className={st.field}>
              <span>{t("wallet.amountEuro")}</span>
              <span className={st.input}>
                <input type="text" inputMode="decimal" autoComplete="off" autoFocus placeholder="0,00" value={text} dir="ltr"
                  onChange={(event) => setText(event.target.value.replace(/[^0-9.,]/g, "").slice(0, 9))}
                  onKeyDown={(event) => { if (event.key === "Enter") deposit(); }} />
                <b aria-hidden="true">€</b>
              </span>
              <small className={st.rate} dir="ltr">{amount ? `${euros(amount)} = ${format(amount)}` : t("wallet.rate")}</small>
            </label>
            <div className={st.actions}>
              <button type="button" className={st.in} disabled={!amount} onClick={deposit}>{t("wallet.deposit")}</button>
              <button type="button" className={st.out} disabled={!amount || balance < amount} onClick={() => setWithdrawing(true)}>{t("wallet.withdraw")}</button>
            </div>
            {movements.length > 0 && (
              <div className={st.moves}>
                {movements.map((movement, index) => (
                  <div key={`${movement.label}-${index}`}>
                    <span>{movement.label}</span>
                    <b className={movement.amount < 0 ? st.negative : undefined} dir="ltr">{movement.amount > 0 ? "+" : ""}{format(movement.amount)}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className={st.stepHead}>
              <button type="button" className={st.back} aria-label={t("common.back")} onClick={() => setWithdrawing(false)}><UiIcon name="back" size={18} /></button>
              <strong>{t("wallet.withdrawTitle")}</strong>
            </div>
            <dl className={st.summary}>
              <dt>{t("wallet.amountEuro")}</dt>
              <dd dir="ltr">{euros(amount)}</dd>
              <dt>{t("wallet.provider")}</dt>
              <dd className={st.pending}>{t("wallet.providerPending")}</dd>
            </dl>
            <p className={st.note}>{t("wallet.providerNote")}</p>
            <button type="button" className={st.providerGo} disabled aria-describedby="wallet-provider-note">{t("wallet.toProvider")}</button>
            <p id="wallet-provider-note" className={st.fineprint}>{t("wallet.fictitiousNote")}</p>
            <button type="button" className={st.simulate} disabled={!amount || balance < amount} onClick={simulateWithdraw}>{t("wallet.simulateWithdraw")}</button>
          </>
        )}
      </div>
    </>
  );
}
