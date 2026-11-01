"use client";
/**
 * "Proponer un juego" (v135): the form a studio uses to start the external-game process, and, for the owner only,
 * the inbox of received proposals. The draft stays on this device until it is sent. Validation is the server's
 * (lib/studioProposal.ts), run here first so mistakes show before sending.
 */
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { t, useI18n, type MessageKey } from "@/lib/i18n";
import { PROPOSAL_CONSENT_VERSION, PROPOSAL_SHELVES, checkProposal, type ProposalField } from "@/lib/studioProposal";

type Draft = { studio: string; contact: string; game: string; shelf: string; summary: string; link: string; terms: boolean; privacy: boolean };
type Stored = { id: string; createdAt: string; studio: string; contact: string; game: string; shelf: string; summary: string; link: string };
type Status = { kind: "idle" | "sending" | "notOpen" | "failed" } | { kind: "sent"; id: string } | { kind: "invalid"; field: ProposalField };

const DRAFT_KEY = "gg.studioProposalDraft";
const EMPTY: Draft = { studio: "", contact: "", game: "", shelf: "alternative", summary: "", link: "https://", terms: false, privacy: false };
const FIELD_LABEL: Record<ProposalField, MessageKey> = {
  studio: "studio.studio", contact: "studio.contact", game: "studio.game", shelf: "studio.shelf",
  summary: "studio.summary", link: "studio.link", terms: "studio.acceptTerms", consent: "studio.acceptPrivacy",
};
const TERMS: MessageKey[] = ["studio.terms1", "studio.terms2", "studio.terms3", "studio.terms4", "studio.terms5"];
const shelfName = (s: string) => t(`catalog.shelf.${s}` as MessageKey);
const loadDraft = (): Draft => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") }; } catch { return EMPTY; } };
const API = "/api/studio/proposals";

export default function GameProposal({ onClose }: { onClose: () => void }) {
  useI18n();
  const [d, setD] = useState<Draft>(EMPTY);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [inbox, setInbox] = useState<Stored[] | null>(null);
  const [tab, setTab] = useState<"form" | "inbox">("form");
  useEffect(() => { setD(loadDraft()); }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* the draft is a convenience */ } }, [d]);
  const refresh = () => fetch(API).then((r) => (r.ok ? r.json() : null)).then((j) => setInbox(j ? j.proposals : null)).catch(() => setInbox(null));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.currentTarget.type === "checkbox" ? (e.currentTarget as HTMLInputElement).checked : e.currentTarget.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...d, consent: d.privacy ? PROPOSAL_CONSENT_VERSION : "" };
    const check = checkProposal(body);
    if (!check.ok) { setStatus({ kind: "invalid", field: check.field }); return; }
    setStatus({ kind: "sending" });
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 201) { setStatus({ kind: "sent", id: String(j.id).slice(0, 8) }); setD(EMPTY); void refresh(); }
      else if (r.status === 503) setStatus({ kind: "notOpen" });
      else if (r.status === 400 && j.field) setStatus({ kind: "invalid", field: j.field });
      else setStatus({ kind: "failed" });
    } catch { setStatus({ kind: "failed" }); }
  };
  const remove = async (id: string) => { await fetch(`${API}?id=${id}`, { method: "DELETE" }).catch(() => null); void refresh(); };
  const wrong = status.kind === "invalid" ? status.field : null;
  const field = (k: "studio" | "contact" | "game" | "link", type = "text", max = 80) => (
    <label className="studioField">
      <span>{t(FIELD_LABEL[k])}</span>
      <input type={type} value={d[k]} onChange={set(k)} maxLength={max} aria-invalid={wrong === k} autoComplete={k === "contact" ? "email" : "off"} />
    </label>
  );
  return (
    <div className="studioSheet" role="dialog" aria-modal="true" aria-labelledby="studio-title">
      <header className="studioHead">
        <h2 id="studio-title">{t("studio.title")}</h2>
        <button type="button" className="studioClose" onClick={onClose} aria-label={t("studio.close")}>✕</button>
      </header>
      {inbox && (
        <div className="studioTabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "form"} onClick={() => setTab("form")}>{t("studio.propose")}</button>
          <button type="button" role="tab" aria-selected={tab === "inbox"} onClick={() => setTab("inbox")}>{t("studio.inbox", { n: inbox.length })}</button>
        </div>
      )}
      {tab === "inbox" && inbox ? (
        <ul className="studioInbox">
          {inbox.length === 0 && <li className="studioEmpty">{t("studio.inboxEmpty")}</li>}
          {inbox.map((p) => (
            <li key={p.id}>
              <b>{p.game}</b> · {shelfName(p.shelf)}
              <span>{p.studio} · <a href={`mailto:${p.contact}`}>{p.contact}</a> · {new Date(p.createdAt).toLocaleDateString()}</span>
              <p>{p.summary}</p>
              <a href={p.link} target="_blank" rel="noopener noreferrer">{p.link}</a>
              <button type="button" onClick={() => void remove(p.id)}>{t("studio.delete")}</button>
            </li>
          ))}
        </ul>
      ) : (
        <form className="studioForm" onSubmit={submit} noValidate>
          <ul className="studioTerms">{TERMS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
          {field("studio")}
          {field("contact", "email", 120)}
          {field("game", "text", 60)}
          <label className="studioField">
            <span>{t("studio.shelf")}</span>
            <select value={d.shelf} onChange={set("shelf")} aria-invalid={wrong === "shelf"}>
              {PROPOSAL_SHELVES.map((s) => <option key={s} value={s}>{shelfName(s)}</option>)}
            </select>
          </label>
          <label className="studioField">
            <span>{t("studio.summary")}</span>
            <textarea value={d.summary} onChange={set("summary")} maxLength={280} rows={3} aria-invalid={wrong === "summary"} />
          </label>
          {field("link", "url", 300)}
          <label className="studioCheck"><input type="checkbox" checked={d.terms} onChange={set("terms")} aria-invalid={wrong === "terms"} />{t("studio.acceptTerms")}</label>
          <label className="studioCheck"><input type="checkbox" checked={d.privacy} onChange={set("privacy")} aria-invalid={wrong === "consent"} />{t("studio.acceptPrivacy")}</label>
          <p className="studioStatus" role="status" aria-live="polite">
            {status.kind === "invalid" && t("studio.invalid", { field: t(FIELD_LABEL[status.field]) })}
            {status.kind === "notOpen" && t("studio.notOpen")}
            {status.kind === "failed" && t("studio.failed")}
            {status.kind === "sent" && t("studio.sent", { id: status.id })}
          </p>
          <button type="submit" className="mainAction studioSend" disabled={status.kind === "sending"}>
            {t(status.kind === "sending" ? "studio.sending" : "studio.send")}
          </button>
        </form>
      )}
    </div>
  );
}
