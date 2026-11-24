"use client";
/**
 * v230 · In-app notices (owner, 20-nov-2026, on design/avisos/avisos-propuesta.jpg): only good news — a group accepts
 * your challenge, it is your turn to play, you win a matchday or a competition.
 *
 * - A new notice appears for a few seconds at the top, with the Galactic Games logo and one action.
 * - The inbox is a section of the avatar tab («Avisos», next to Perfil and Ranking), with the unread count on that tab
 *   in the bottom bar: the header already holds four controls and a fifth would squeeze the GALACTIC GAMES name.
 *   Opening the inbox marks what it shows as read (it stays highlighted while you are there).
 * - Settings below the list: what we tell you, and «Dónde» (App, Móvil — the phone needs Web Push keys that the owner
 *   sets in Vercel, so it shows as not available yet).
 *
 * The server files every notice with the fact (lib/server/groups.ts); the app only reads them. To keep server use (and
 * cost) down it never polls: it asks when the app opens, when it comes back to the screen and when the player moves
 * between screens (at most once every 30 s).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getLocale, t, useI18n } from "@/lib/i18n";
import { getGameDefinition } from "@/lib/games";
import type { Notice, NoticeInbox, NoticeSettings, NoticeTopic } from "@/lib/notices";
import UiIcon from "./UiIcon";
import st from "./NoticeCenter.module.css";

const MIN_GAP_MS = 30_000;
const TOAST_MS = 6_000;
const SHOWN_KEY = "gg-notices-shown";
const LOGO = "/icon-192.png?v=228";

const gameName = (id?: string) => (id ? getGameDefinition(id)?.name ?? "" : "");

/** Title and line of a notice, from its kind and the little data it carries. */
export function noticeText(n: Notice): { title: string; body: string; action: "play" | "see" } {
  const d = n.data;
  const game = gameName(d.gameId);
  const where = d.mode === "group" && d.group ? d.group : "";
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  switch (n.kind) {
    case "challenge-accepted":
      return { title: t("notice.challengeTitle"), body: t("notice.challengeBody", { group: d.group ?? "" }), action: "see" };
    case "your-turn":
      return { title: t("notice.turnTitle"), body: join(where, t("group.matchdayN", { n: d.round ?? 1 }), game), action: "play" };
    case "matchday-won":
      return { title: t("notice.dayTitle", { n: d.round ?? 1 }), body: join(where, game), action: "see" };
    case "competition-won":
      return d.mode === "group"
        ? { title: t("notice.wonTitle"), body: where, action: "see" }
        : { title: t("notice.wonGroupTitle"), body: d.group ?? "", action: "see" };
  }
}

function readShown(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
function writeShown(ids: string[]) {
  try { localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-100))); } catch { /* private mode: a notice may pop up twice */ }
}

async function post(body: Record<string, unknown>) {
  try {
    const res = await fetch("/api/notifications", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return res.ok ? ((await res.json()) as { settings?: NoticeSettings }) : null;
  } catch { return null; }
}

/** The person's notices: loading (never polling), the pop-up, marking read and the settings. */
export function useNotices(enabled: boolean, refreshKey: string) {
  const [inbox, setInbox] = useState<NoticeInbox | null>(null);
  const [toast, setToast] = useState<Notice | null>(null);
  const lastFetch = useRef(0);
  const busy = useRef(false);

  const load = useCallback(async (force = false) => {
    if (!enabled || busy.current || (!force && Date.now() - lastFetch.current < MIN_GAP_MS)) return;
    busy.current = true;
    lastFetch.current = Date.now();
    try {
      const res = await fetch("/api/notifications", { cache: "no-store", credentials: "same-origin" });
      if (!res.ok) return;
      const next = (await res.json()) as NoticeInbox;
      setInbox(next);
      // The newest unread notice not shown before pops up once, unless the person turned «App» off.
      const shown = readShown(), unseen = next.notices.filter((n) => !n.read && !shown.includes(n.id));
      if (unseen.length) {
        if (next.settings.app) setToast(unseen[0]);
        writeShown([...shown, ...unseen.map((n) => n.id)]);
      }
    } catch { /* offline for a moment: the next screen change tries again */ }
    finally { busy.current = false; }
  }, [enabled]);

  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => { if (!enabled) { setInbox(null); setToast(null); } }, [enabled]);

  const markRead = useCallback((ids: string[] | "all") => {
    setInbox((box) => box && {
      ...box,
      notices: box.notices.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)),
      unread: ids === "all" ? 0 : Math.max(0, box.unread - box.notices.filter((n) => !n.read && ids.includes(n.id)).length),
    });
    void post(ids === "all" ? { action: "read" } : { action: "read", ids });
  }, []);

  const saveSettings = useCallback((next: NoticeSettings) => {
    setInbox((box) => box && { ...box, settings: next });
    void post({ action: "settings", settings: next }).then((r) => { if (r?.settings) setInbox((box) => box && { ...box, settings: r.settings! }); });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);
  const reload = useCallback(() => load(true), [load]);
  return { inbox: enabled ? inbox : null, unread: enabled ? inbox?.unread ?? 0 : 0, toast: enabled ? toast : null, dismissToast, markRead, saveSettings, reload };
}
export type NoticesState = ReturnType<typeof useNotices>;

/** The short notice at the top of the screen. */
export function NoticeToast({ notices, onAct }: { notices: NoticesState; onAct: () => void }) {
  useI18n();
  const n = notices.toast;
  if (!n) return null;
  const x = noticeText(n);
  return (
    <div className={st.toast} role="status" aria-live="polite">
      <img className={st.logo} src={LOGO} alt="" width={30} height={30} />
      <div className={st.toastText}>
        <strong>{x.title}</strong>
        {x.body && <span>{x.body}</span>}
      </div>
      <button type="button" className={st.toastAct} onClick={() => { notices.markRead([n.id]); notices.dismissToast(); onAct(); }}>
        {t(x.action === "play" ? "notice.play" : "notice.see")}
      </button>
      <button type="button" className={st.toastClose} aria-label={t("notice.dismiss")} onClick={notices.dismissToast}><UiIcon name="close" size={16} /></button>
    </div>
  );
}

/** Hoy / Ayer / Antes, by the phone's calendar day. */
function dayGroup(iso: string, now: Date): "today" | "yesterday" | "earlier" {
  const d = new Date(iso).getTime(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d >= start) return "today";
  return d >= start - 86_400_000 ? "yesterday" : "earlier";
}
function when(iso: string, group: "today" | "yesterday" | "earlier") {
  const d = new Date(iso), locale = getLocale();
  return group === "earlier" ? d.toLocaleDateString(locale, { day: "numeric", month: "short" }) : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}
const DAY_LABEL = { today: "notice.today", yesterday: "notice.yesterday", earlier: "notice.earlier" } as const;
const TOPICS: { id: NoticeTopic; label: "notice.topicRival" | "notice.topicTurn" | "notice.topicWin" }[] = [
  { id: "rival", label: "notice.topicRival" }, { id: "turn", label: "notice.topicTurn" }, { id: "win", label: "notice.topicWin" },
];

/** The inbox section of the avatar tab: the list, then the settings. */
export function NoticeInboxView({ notices, onAct }: { notices: NoticesState; onAct: () => void }) {
  useI18n();
  const { inbox, markRead, saveSettings, reload } = notices;
  // What was unread when the section opened stays highlighted during this visit; the server marks it read at once.
  const [fresh, setFresh] = useState<string[] | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void reload().then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [reload]);
  useEffect(() => {
    if (!ready || !inbox || fresh) return;
    const ids = inbox.notices.filter((n) => !n.read).map((n) => n.id);
    setFresh(ids);
    if (ids.length) markRead("all");
  }, [ready, inbox, fresh, markRead]);

  if (!inbox) return <p className={st.empty} role="status">{t("common.loading")}</p>;
  const now = new Date();
  const groups = (["today", "yesterday", "earlier"] as const)
    .map((g) => ({ g, items: inbox.notices.filter((n) => dayGroup(n.createdAt, now) === g) }))
    .filter((x) => x.items.length);
  const s = inbox.settings;
  return (
    <div className={st.inbox}>
      <div className={st.list}>
        {groups.length === 0 ? <p className={st.empty}>{t("notice.empty")}</p> : groups.map(({ g, items }) => (
          <section key={g} aria-label={t(DAY_LABEL[g])}>
            <h2 className={st.day}>{t(DAY_LABEL[g])}</h2>
            {items.map((n) => {
              const x = noticeText(n), isNew = fresh?.includes(n.id);
              return (
                <button key={n.id} type="button" className={`${st.item} ${isNew ? st.unread : ""}`} onClick={onAct}>
                  <span className={st.up} aria-hidden="true">▲</span>
                  <span className={st.itemText}><strong>{x.title}</strong>{x.body && <span>{x.body}</span>}</span>
                  <time dateTime={n.createdAt}>{when(n.createdAt, g)}</time>
                  {isNew && <span className="visuallyHidden">{t("notice.unreadMark")}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
      <div className={st.settings}>
        <h2 className={st.day}>{t("notice.settingsTitle")}</h2>
        {TOPICS.map(({ id, label }) => (
          <button key={id} type="button" role="switch" aria-checked={s.topics[id]} className={st.row}
            onClick={() => saveSettings({ ...s, topics: { ...s.topics, [id]: !s.topics[id] } })}>
            <span>{t(label)}</span><i className={st.switch} aria-hidden="true" />
          </button>
        ))}
        <h2 className={st.day}>{t("notice.where")}</h2>
        <button type="button" role="switch" aria-checked={s.app} className={st.row} onClick={() => saveSettings({ ...s, app: !s.app })}>
          <span>{t("notice.whereApp")}</span><i className={st.switch} aria-hidden="true" />
        </button>
        <button type="button" role="switch" aria-checked={inbox.phoneAvailable && s.phone} disabled={!inbox.phoneAvailable} className={st.row}
          onClick={() => saveSettings({ ...s, phone: !s.phone })}>
          <span>{t("notice.wherePhone")}</span><i className={st.switch} aria-hidden="true" />
        </button>
        {!inbox.phoneAvailable && <p className={st.hint}>{t("notice.phoneSoon")}</p>}
      </div>
    </div>
  );
}
