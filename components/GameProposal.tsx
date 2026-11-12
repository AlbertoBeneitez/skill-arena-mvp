"use client";
/**
 * "Enviar juego" (v135, by package file since v142): a studio sends its game as one .zip and gets the automatic
 * check report at once; the owner sees the inbox, plays each game in an isolated frame and confirms that the score
 * the interface reports is the score its core replays. Validation and checks are the server's
 * (lib/studioProposal.ts, lib/studio/package.ts); the form runs the field rules first so mistakes show before sending.
 */
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { t, useI18n, type MessageKey } from "@/lib/i18n";
import { PROPOSAL_CONSENT_VERSION, STUDIO_TERMS_VERSION, checkSubmission, type SubmissionField } from "@/lib/studioProposal";
import { PACKAGE_LIMITS, type Manifest, type Report } from "@/lib/studio/package";
import StudioPreview from "./StudioPreview";

type InfoId = "kit" | "file" | "send";
/** v174: the «i» beside a step; it opens that step's explanation just below it. */
function Info({ id, open, onToggle }: { id: InfoId; open: boolean; onToggle: (id: InfoId) => void }) {
  return (
    <button type="button" className="studioInfoBtn" aria-expanded={open} aria-controls={`studio-info-${id}`} aria-label={t("studio.infoAria")} onClick={() => onToggle(id)}>
      <span aria-hidden="true">i</span>
    </button>
  );
}

type Draft = { studio: string; contact: string; terms: boolean; privacy: boolean };
type Stored = { id: string; createdAt: string; studio: string; contact: string; game: string; shelf: string; summary: string; manifest: Manifest | null; report: Report | null; sha256: string | null; size: number; status: "received" | "approved" | "rejected" };
type Status = { kind: "idle" | "sending" | "notOpen" | "failed" | "checksFailed" } | { kind: "sent"; id: string } | { kind: "invalid"; field: SubmissionField };

const DRAFT_KEY = "gg.studioProposalDraft";
const EMPTY: Draft = { studio: "", contact: "", terms: false, privacy: false };
const FIELD_LABEL: Record<SubmissionField, MessageKey> = { studio: "studio.studio", contact: "studio.contact", file: "studio.file", terms: "studio.acceptTerms", consent: "studio.acceptPrivacy" };
const TERMS: MessageKey[] = ["studio.terms1", "studio.terms2", "studio.terms3", "studio.terms4", "studio.terms5", "studio.terms6", "studio.terms7", "studio.terms8"];
export const CHECK_LABEL: Record<string, MessageKey> = {
  zip: "studio.check.zip", manifest: "studio.check.manifest", game: "studio.check.game", cover: "studio.check.cover",
  coreLoad: "studio.check.coreLoad", coreReplay: "studio.check.coreReplay", coreSeed: "studio.check.coreSeed", coreSpeed: "studio.check.coreSpeed",
  core: "studio.check.core", view: "studio.check.view",
};
const shelfName = (s: string) => t(`catalog.shelf.${s}` as MessageKey);
const loadDraft = (): Draft => { try { const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}"); return { ...EMPTY, studio: String(d.studio ?? ""), contact: String(d.contact ?? "") }; } catch { return EMPTY; } };
const API = "/api/studio/proposals";
const KIT = "/studio/galactic-games-kit.zip";

export function ReportList({ report }: { report: Report }) {
  return (
    <ul className="studioReport">
      {report.checks.map((c) => (
        <li key={c.id} data-state={c.ok ? "ok" : c.skipped ? "skipped" : "fail"}>
          <span aria-hidden="true">{c.ok ? "✓" : c.skipped ? "–" : "✕"}</span>
          <b>{t(CHECK_LABEL[c.id])}</b>
          {!c.ok && !c.skipped && c.detail && <code>{c.detail}</code>}
        </li>
      ))}
    </ul>
  );
}

export default function GameProposal({ onClose }: { onClose: () => void }) {
  useI18n();
  const [d, setD] = useState<Draft>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [report, setReport] = useState<Report | null>(null);
  const [info, setInfo] = useState<InfoId | null>(null);
  const toggleInfo = (id: InfoId) => setInfo((open) => (open === id ? null : id));
  const [inbox, setInbox] = useState<Stored[] | null>(null);
  const [tab, setTab] = useState<"form" | "inbox">("form");
  const [trying, setTrying] = useState<Stored | null>(null);
  useEffect(() => { setD(loadDraft()); }, []);
  useEffect(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ studio: d.studio, contact: d.contact })); } catch { /* the draft is a convenience */ } }, [d]);
  const refresh = () => fetch(API).then((r) => (r.ok ? r.json() : null)).then((j) => setInbox(j ? j.proposals : null)).catch(() => setInbox(null));
  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && !trying && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, trying]);
  const set = (k: keyof Draft) => (e: ChangeEvent<HTMLInputElement>) =>
    setD({ ...d, [k]: e.currentTarget.type === "checkbox" ? e.currentTarget.checked : e.currentTarget.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setReport(null);
    const fields = { studio: d.studio, contact: d.contact, terms: d.terms ? STUDIO_TERMS_VERSION : "", consent: d.privacy ? PROPOSAL_CONSENT_VERSION : "" };
    const check = checkSubmission(fields);
    if (!check.ok) { setStatus({ kind: "invalid", field: check.field }); return; }
    if (!file || file.size === 0 || file.size > PACKAGE_LIMITS.zipBytes) { setStatus({ kind: "invalid", field: "file" }); return; }
    const body = new FormData();
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    body.set("file", file);
    setStatus({ kind: "sending" });
    try {
      const r = await fetch(API, { method: "POST", body });
      const j = await r.json().catch(() => ({}));
      if (j.report) setReport(j.report);
      if (r.status === 201) { setStatus({ kind: "sent", id: String(j.id).slice(0, 8) }); setFile(null); void refresh(); }
      else if (r.status === 422) setStatus({ kind: "checksFailed" });
      else if (r.status === 503 && j.error === "PROPOSALS_NOT_OPEN") setStatus({ kind: "notOpen" });
      else if ((r.status === 400 || r.status === 413) && j.field) setStatus({ kind: "invalid", field: j.field });
      else setStatus({ kind: "failed" });
    } catch { setStatus({ kind: "failed" }); }
  };
  const act = async (id: string, method: "DELETE" | "PATCH", query = "") => { await fetch(`${API}?id=${id}${query}`, { method }).catch(() => null); void refresh(); };
  const wrong = status.kind === "invalid" ? status.field : null;
  const field = (k: "studio" | "contact", type: string, max: number) => (
    <label className="studioField">
      <span>{t(FIELD_LABEL[k])}</span>
      <input type={type} value={d[k]} onChange={set(k)} maxLength={max} aria-invalid={wrong === k} autoComplete={k === "contact" ? "email" : "organization"} />
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
            <li key={p.id} data-status={p.status}>
              <div className="studioItemHead">
                <b>{p.game}</b>
                <em>{t(`studio.status.${p.status}` as MessageKey)}</em>
              </div>
              <span>{shelfName(p.shelf)}{p.manifest && ` · v${p.manifest.version}`} · {(p.size / 1024).toFixed(0)} KB</span>
              <span>{p.studio} · <a href={`mailto:${p.contact}`}>{p.contact}</a> · {new Date(p.createdAt).toLocaleDateString()}</span>
              <p>{p.summary}</p>
              {p.report && <ReportList report={p.report} />}
              {p.manifest?.thirdParty.length ? <span>{t("studio.thirdParty")}: {p.manifest.thirdParty.map((x) => `${x.name} (${x.license})`).join(", ")}</span> : null}
              <div className="studioItemActions">
                {/* Format 2 (v178) is TypeScript to integrate as a version, not a package the app can run as is. */}
                {p.manifest && p.manifest.format !== 2 && <button type="button" className="studioTry" onClick={() => setTrying(p)}>{t("studio.try")}</button>}
                {p.manifest && <a href={`${API}?id=${p.id}`} download>{t("studio.download")}</a>}
                {p.status !== "approved" && <button type="button" onClick={() => void act(p.id, "PATCH", "&status=approved")}>{t("studio.approve")}</button>}
                {p.status !== "rejected" && <button type="button" onClick={() => void act(p.id, "PATCH", "&status=rejected")}>{t("studio.reject")}</button>}
                <button type="button" className="studioDelete" onClick={() => void act(p.id, "DELETE")}>{t("studio.delete")}</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <form className="studioForm" onSubmit={submit} noValidate>
          <p className="studioLead">{t("studio.lead")}</p>
          {/* v174: each real step carries its explanation behind an «i» on its right. */}
          <div className="studioStepRow">
            <a className="studioKit" href={KIT} download>{t("studio.kit")}</a>
            <Info id="kit" open={info === "kit"} onToggle={toggleInfo} />
          </div>
          {info === "kit" && <p className="studioInfo" id="studio-info-kit">{t("studio.step1")} {t("studio.step2")}</p>}
          {field("studio", "text", 80)}
          {field("contact", "email", 120)}
          <div className="studioStepRow">
            <label className="studioField studioFile">
              <span>{t("studio.file")}</span>
              <input type="file" accept=".zip,application/zip" aria-invalid={wrong === "file"} onChange={(e) => { setFile(e.currentTarget.files?.[0] ?? null); setReport(null); setStatus({ kind: "idle" }); }} />
            </label>
            <Info id="file" open={info === "file"} onToggle={toggleInfo} />
          </div>
          {info === "file" && <p className="studioInfo" id="studio-info-file">{t("studio.step3")}</p>}
          <details className="studioTerms">
            <summary>{t("studio.termsShow")}</summary>
            <ul>{TERMS.map((k) => <li key={k}>{t(k)}</li>)}</ul>
          </details>
          <label className="studioCheck"><input type="checkbox" checked={d.terms} onChange={set("terms")} aria-invalid={wrong === "terms"} />{t("studio.acceptTerms")}</label>
          <label className="studioCheck"><input type="checkbox" checked={d.privacy} onChange={set("privacy")} aria-invalid={wrong === "consent"} />{t("studio.acceptPrivacy")}</label>
          <p className="studioStatus" role="status" aria-live="polite">
            {status.kind === "invalid" && t("studio.invalid", { field: t(FIELD_LABEL[status.field]) })}
            {status.kind === "sending" && t("studio.checking")}
            {status.kind === "checksFailed" && t("studio.checksFailed")}
            {status.kind === "notOpen" && t("studio.notOpen")}
            {status.kind === "failed" && t("studio.failed")}
            {status.kind === "sent" && t("studio.sent", { id: status.id })}
          </p>
          {report && <ReportList report={report} />}
          <div className="studioStepRow">
            <button type="submit" className="mainAction studioSend" disabled={status.kind === "sending"}>
            {t(status.kind === "sending" ? "studio.sending" : "studio.send")}
          </button>
            <Info id="send" open={info === "send"} onToggle={toggleInfo} />
          </div>
          {info === "send" && <p className="studioInfo" id="studio-info-send">{t("studio.step4")}</p>}
        </form>
      )}
      {trying && <StudioPreview id={trying.id} game={trying.game} onClose={() => setTrying(null)} />}
    </div>
  );
}
