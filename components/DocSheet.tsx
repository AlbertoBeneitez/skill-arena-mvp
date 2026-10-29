"use client";
import UiIcon from "./UiIcon";
import { useEffect, useRef } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { DOC_BLOCKS, DOC_TITLES, LICENSES, type DocId } from "@/lib/i18n/docs";
import { APP_VERSION, LEGAL_UPDATED, PRODUCT_NAME, SUPPORT_EMAIL } from "@/lib/productIdentity";

/** Full-screen reader for legal and help pages. Works before and after onboarding. */
export default function DocSheet({ doc, onClose }: { doc: DocId; onClose(): void }) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const updated = new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
  const legal = doc === "terms" || doc === "privacy" || doc === "cookies" || doc === "rules";
  return (
    <div className="docSheet" role="dialog" aria-modal="true" aria-labelledby="doc-title" ref={ref} tabIndex={-1}>
      <header className="docSheetHead">
        <button type="button" className="docSheetBack gxIconBtn" onClick={onClose} aria-label={t("common.back")}>
          <UiIcon name="back" mirrorRtl />
        </button>
        <h1 id="doc-title">{t(DOC_TITLES[doc])}</h1>
      </header>
      <article className="docSheetBody">
        {legal && <p className="docNote">{t("docs.draftNote")}</p>}
        {DOC_BLOCKS[doc].map((block, index) =>
          block[0] === "h" ? (
            <h2 key={index}>{t(block[1])}</h2>
          ) : block[0] === "p" ? (
            <p key={index}>{t(block[1])}</p>
          ) : (
            <details key={index} className="docFaq">
              <summary>{t(block[1])}</summary>
              <p>{t(block[2] as MessageKey)}</p>
            </details>
          ),
        )}
        {doc === "contact" &&
          (SUPPORT_EMAIL ? (
            <>
              <p>{t("contact.p1")}</p>
              <a className="docAction" href={`mailto:${SUPPORT_EMAIL}`}>{t("contact.email")} · {SUPPORT_EMAIL}</a>
            </>
          ) : (
            <p>{t("contact.pending")}</p>
          ))}
        {doc === "licenses" && (
          <ul className="docLicenses">
            {LICENSES.map((item) => (
              <li key={item.name}>
                <strong>{item.name}</strong>
                <span>{item.license}</span>
              </li>
            ))}
          </ul>
        )}
        {doc === "about" && (
          <>
            <p className="docAbout"><strong>{PRODUCT_NAME}</strong> · {t("settings.version", { version: `\u2068${APP_VERSION}\u2069` })}</p>
            <p>{t("about.made")}</p>
          </>
        )}
        {legal && <p className="docUpdated">{t("docs.updated", { date: updated })}</p>}
      </article>
    </div>
  );
}
