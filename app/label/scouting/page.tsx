"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Plus,
  Search,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { Badge, panelCls } from "@/components/label/LabelShell";
import { DemoIcon } from "@/components/ui/icons";
import { formatDate, inviteLink, type MyOrg } from "@/lib/supabase/label";
import {
  DEMO_STATUSES,
  createScoutFind,
  deleteSubmission,
  demoStatusLabel,
  fetchSubmissionSettings,
  fetchSubmissions,
  inviteFromSubmission,
  submitUrl,
  updateSubmission,
  type DemoStatus,
  type DemoSubmission,
} from "@/lib/supabase/scouting";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

type Filter = DemoStatus | "active" | "all";

const STATUS_CLS: Record<DemoStatus, string> = {
  new: "bg-[#FBF1DE] text-[#8A5A16] dark:bg-[#3A2F14] dark:text-[#E8B65A]",
  listening: "bg-[#F0EEEA] text-[#17161A] dark:bg-[#242327] dark:text-[#F5F4F2]",
  shortlist: "bg-[#F0EEEA] text-[#17161A] dark:bg-[#242327] dark:text-[#F5F4F2]",
  offer: "bg-[#17161A] text-white dark:bg-[#F5F4F2] dark:text-[#17161A]",
  signed: "bg-[#E9F6EF] text-[#166B49] dark:bg-[#1C3B2E] dark:text-[#5FCB9B]",
  declined: "bg-[#F0EEEA] text-[#A6A5AB] dark:bg-[#242327] dark:text-[#6E6D73]",
};

const fmtNum = (n: number | null) => (n === null ? "—" : n.toLocaleString("ru-RU"));
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

function Stars({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Оценка">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            onClick={() => onChange(value === n ? null : n)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition"
          >
            <Star
              className={`w-[18px] h-[18px] ${on ? "fill-[#17161A] text-[#17161A] dark:fill-[#F5F4F2] dark:text-[#F5F4F2]" : "text-[#C4C3C8]"}`}
              strokeWidth={1.75}
            />
          </button>
        );
      })}
    </div>
  );
}

function ScoutingInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<DemoSubmission[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [find, setFind] = useState({ artistName: "", trackUrl: "", email: "", telegram: "", city: "", genre: "", followers: "", notes: "" });

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchSubmissions(org.org_id), fetchSubmissionSettings(org.org_id)]);
      setRows(r);
      setSlug(s.slug);
      setOpen(s.submissions_open);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить скаутинг");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, active: 0 };
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.status !== "signed" && r.status !== "declined") c.active += 1;
    }
    return c;
  }, [rows]);

  const visible = rows.filter((r) => {
    const byStatus =
      filter === "all" ? true : filter === "active" ? r.status !== "signed" && r.status !== "declined" : r.status === filter;
    const q = query.trim().toLowerCase();
    const byQuery = !q || [r.artist_name, r.genre, r.city, r.email, r.telegram].some((v) => v?.toLowerCase().includes(q));
    return byStatus && byQuery;
  });

  const current = rows.find((r) => r.id === selected) ?? null;

  const pick = (r: DemoSubmission) => {
    setSelected(r.id);
    setNotes(r.notes ?? "");
    // открыть новую заявку = взять её в работу
    if (r.status === "new") patch(r.id, { status: "listening" });
  };

  const patch = async (id: string, p: Partial<Pick<DemoSubmission, "status" | "rating" | "notes">>) => {
    setRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    try {
      await updateSubmission(id, p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
      load();
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Не удалось скопировать");
    }
  };

  const invite = async (r: DemoSubmission) => {
    setBusy("invite");
    setError(null);
    try {
      const inv = await inviteFromSubmission(r);
      await copy(inviteLink(inv.token), "invite");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать приглашение");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy("delete");
    try {
      await deleteSubmission(id);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить");
    } finally {
      setBusy(null);
    }
  };

  const addFind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!find.artistName.trim() || !/^https?:\/\//.test(find.trackUrl.trim())) {
      setError("Нужны имя и ссылка, начинающаяся с https://");
      return;
    }
    setBusy("add");
    setError(null);
    try {
      const f = Number(find.followers.replace(/\s/g, ""));
      const row = await createScoutFind({
        orgId: org.org_id,
        artistName: find.artistName,
        trackUrl: find.trackUrl,
        email: find.email,
        telegram: find.telegram,
        city: find.city,
        genre: find.genre,
        followers: find.followers.trim() && Number.isFinite(f) ? Math.round(f) : null,
        notes: find.notes,
      });
      setFind({ artistName: "", trackUrl: "", email: "", telegram: "", city: "", genre: "", followers: "", notes: "" });
      setAddOpen(false);
      await load();
      setFilter("active");
      setSelected(row.id);
      setNotes(row.notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить");
    } finally {
      setBusy(null);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "active", label: "В работе" },
    ...DEMO_STATUSES.map((s) => ({ key: s.key as Filter, label: s.label })),
    { key: "all", label: "Все" },
  ];

  return (
    <LabelShell
      org={org}
      title="Скаутинг"
      subtitle="Демо от артистов и находки команды — от первого прослушивания до подписания"
      actions={
        <>
          {slug && open ? (
            <button
              onClick={() => copy(submitUrl(slug), "link")}
              className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] bg-white dark:bg-[#1A191D] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition"
            >
              {copied === "link" ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
              {copied === "link" ? "Ссылка скопирована" : "Ссылка для демо"}
            </button>
          ) : (
            <Link
              href="/label/settings"
              className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] bg-white dark:bg-[#1A191D] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition"
            >
              Открыть приём демо
            </Link>
          )}
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] hover:bg-[#2A282E] px-[14px] py-[8px] rounded-full transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Добавить находку
          </button>
        </>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {addOpen && (
        <form onSubmit={addFind} className={`${panelCls} p-4 mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <input value={find.artistName} onChange={(e) => setFind({ ...find, artistName: e.target.value })} placeholder="Имя артиста *" className={inputCls} />
          <input value={find.trackUrl} onChange={(e) => setFind({ ...find, trackUrl: e.target.value })} placeholder="Ссылка на трек или профиль *" className={`${inputCls} sm:col-span-1 lg:col-span-3`} />
          <input value={find.email} onChange={(e) => setFind({ ...find, email: e.target.value })} placeholder="Почта" className={inputCls} />
          <input value={find.telegram} onChange={(e) => setFind({ ...find, telegram: e.target.value })} placeholder="Telegram" className={inputCls} />
          <input value={find.city} onChange={(e) => setFind({ ...find, city: e.target.value })} placeholder="Город" className={inputCls} />
          <input value={find.genre} onChange={(e) => setFind({ ...find, genre: e.target.value })} placeholder="Жанр" className={inputCls} />
          <input inputMode="numeric" value={find.followers} onChange={(e) => setFind({ ...find, followers: e.target.value })} placeholder="Подписчики" className={inputCls} />
          <input value={find.notes} onChange={(e) => setFind({ ...find, notes: e.target.value })} placeholder="Где нашли, чем зацепил" className={`${inputCls} sm:col-span-1 lg:col-span-2`} />
          <button
            type="submit"
            disabled={busy === "add"}
            className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[9px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy === "add" && <Loader2 className="w-4 h-4 animate-spin" />}
            Добавить
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-full transition ${
                filter === f.key
                  ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]"
                  : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
              }`}
            >
              {f.label}
              <span className="ml-1 text-[#A6A5AB] dark:text-[#6E6D73] tabular-nums">{counts[f.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <label className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="w-4 h-4 text-[#A6A5AB] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Имя, жанр, город" className={`${inputCls} pl-9`} />
        </label>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4 lg:items-start">
          {/* Список */}
          <div className={`${current ? "hidden lg:block" : ""} space-y-2`}>
            {visible.length === 0 ? (
              <div className={`${panelCls} px-4 py-10 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}>
                {rows.length === 0
                  ? slug && open
                    ? "Демо пока нет — поделитесь ссылкой для демо в соцсетях лейбла"
                    : "Демо пока нет. Откройте приём в настройках или добавьте находку скаута"
                  : "Ничего не нашлось"}
              </div>
            ) : (
              visible.map((r) => (
                <button
                  key={r.id}
                  onClick={() => pick(r)}
                  aria-current={r.id === selected ? "true" : undefined}
                  className={`${panelCls} w-full text-left px-4 py-3 flex items-start gap-3 transition hover:border-[#D2D0CB] dark:hover:border-[#33323A] ${
                    r.id === selected ? "ring-1 ring-[#17161A] dark:ring-[#F5F4F2]" : ""
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-[#F0EEEA] dark:bg-[#242327] flex items-center justify-center shrink-0">
                    <DemoIcon className="w-[18px] h-[18px] text-[#17161A] dark:text-[#F5F4F2]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{r.artist_name}</span>
                      {r.rating ? (
                        <span className="text-[12px] tabular-nums text-[#6E6D73] dark:text-[#9A98A0] shrink-0">★ {r.rating}</span>
                      ) : null}
                    </span>
                    <span className="block text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                      {[r.genre, r.city, r.followers !== null ? `${fmtNum(r.followers)} подп.` : null].filter(Boolean).join(" · ") || host(r.track_url)}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1 shrink-0">
                    <Badge label={demoStatusLabel(r.status)} cls={STATUS_CLS[r.status]} />
                    <span className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73]">
                      {r.source === "scout" ? "находка" : "форма"} · {formatDate(r.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Карточка */}
          {current ? (
            <aside className={`${panelCls} p-5 lg:sticky lg:top-8`}>
              <button
                onClick={() => setSelected(null)}
                className="lg:hidden inline-flex items-center gap-1 text-[13px] font-medium text-[#6E6D73] hover:text-[#17161A] mb-3"
              >
                <ArrowLeft className="w-4 h-4" />
                К списку
              </button>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[18px] font-semibold tracking-tight truncate text-[#17161A] dark:text-[#F5F4F2]">{current.artist_name}</div>
                  <div className="text-[12.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                    {current.source === "scout" ? "Находка скаута" : "Прислал через форму"} · {formatDate(current.created_at)}
                  </div>
                </div>
                <Stars value={current.rating} onChange={(v) => patch(current.id, { rating: v })} />
              </div>

              <a
                href={current.track_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-4 w-full inline-flex items-center justify-center gap-2 text-[14px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[18px] py-[10px] rounded-full hover:bg-[#2A282E] transition"
              >
                Слушать · {host(current.track_url)}
                <ExternalLink className="w-4 h-4" />
              </a>

              <dl className="grid grid-cols-2 gap-2 mt-4">
                {(
                  [
                    ["Жанр", current.genre ?? "—"],
                    ["Город", current.city ?? "—"],
                    ["Подписчики", fmtNum(current.followers)],
                    ["Слушатели / мес", fmtNum(current.monthly_listeners)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="rounded-[12px] bg-[#FAFAF9] dark:bg-[#232227] px-3 py-2 min-w-0">
                    <dt className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73]">{k}</dt>
                    <dd className="text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{v}</dd>
                  </div>
                ))}
              </dl>

              {current.links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {current.links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 text-[12px] text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[10px] py-[4px] rounded-full transition"
                    >
                      {host(l)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}

              {current.message && (
                <p className="mt-3 text-[13px] leading-[1.55] text-[#17161A] dark:text-[#F5F4F2] bg-[#FAFAF9] dark:bg-[#232227] rounded-[12px] px-3 py-2.5 whitespace-pre-line">
                  {current.message}
                </p>
              )}

              <div className="mt-3 text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] space-y-1">
                {current.email && (
                  <a href={`mailto:${current.email}`} className="flex items-center gap-1.5 hover:text-[#17161A] dark:hover:text-[#F5F4F2]">
                    <Mail className="w-3.5 h-3.5" /> {current.email}
                  </a>
                )}
                {current.telegram && (
                  <a
                    href={`https://t.me/${encodeURIComponent(current.telegram)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
                  >
                    <Send className="w-3.5 h-3.5" /> @{current.telegram}
                  </a>
                )}
                {current.consent_at && (
                  <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                    Согласие на обработку данных — {formatDate(current.consent_at)}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-1.5">Этап</div>
                <div className="flex flex-wrap gap-1">
                  {DEMO_STATUSES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => patch(current.id, { status: s.key })}
                      title={s.hint}
                      aria-pressed={current.status === s.key}
                      className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-full border transition ${
                        current.status === s.key
                          ? "bg-[#17161A] border-[#17161A] text-white dark:bg-[#F5F4F2] dark:border-[#F5F4F2] dark:text-[#17161A]"
                          : "border-[#E5E3DE] dark:border-[#33323A] text-[#6E6D73] dark:text-[#9A98A0] hover:border-[#D2D0CB] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block mt-4">
                <span className="block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-1.5">Заметки команды</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => notes !== (current.notes ?? "") && patch(current.id, { notes: notes.trim() || null })}
                  rows={3}
                  maxLength={4000}
                  placeholder="Что понравилось, что смущает, с кем обсудить"
                  className={`${inputCls} resize-y`}
                />
                <span className="block text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] mt-1">Сохраняется, когда уходите из поля. Артист заметки не видит.</span>
              </label>

              {(current.status === "offer" || current.status === "signed") && (
                <div className="mt-4 rounded-[12px] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] p-3">
                  {current.invite_id ? (
                    <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0]">
                      Приглашение в кабинет создано — статус в разделе{" "}
                      <Link href="/label/invites" className="text-[#17161A] dark:text-[#F5F4F2] underline underline-offset-2">
                        «Приглашения»
                      </Link>
                      .
                    </p>
                  ) : (
                    <>
                      <button
                        onClick={() => invite(current)}
                        disabled={busy !== null || !current.email}
                        className="w-full inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[14px] py-[8px] rounded-full transition disabled:opacity-40"
                      >
                        {busy === "invite" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {copied === "invite" ? "Ссылка приглашения скопирована" : "Пригласить в кабинет"}
                      </button>
                      <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-1.5">
                        {current.email
                          ? `Приглашение на ${current.email}; ссылку скопируем — отправьте её артисту.`
                          : "Нужна почта артиста — без неё приглашение не выписать."}
                      </p>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => remove(current.id)}
                disabled={busy !== null}
                className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Удалить заявку и данные артиста
              </button>
            </aside>
          ) : (
            <div className={`hidden lg:flex ${panelCls} p-8 flex-col items-center justify-center text-center text-[#A6A5AB] dark:text-[#6E6D73]`}>
              <DemoIcon className="w-8 h-8 mb-2" />
              <div className="text-[14px] font-medium text-[#6E6D73] dark:text-[#9A98A0]">Выберите демо слева</div>
              <div className="text-[12.5px] mt-1">Новые заявки уходят в «Слушаем», как только вы их открываете</div>
            </div>
          )}
        </div>
      )}
    </LabelShell>
  );
}

export default function ScoutingPage() {
  return <LabelGate>{({ org }) => <ScoutingInner org={org} />}</LabelGate>;
}
