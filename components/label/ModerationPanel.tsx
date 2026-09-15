"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, Check, FileAudio, ExternalLink } from "lucide-react";
import { Badge } from "@/components/label/LabelShell";
import {
  MODERATION_CHECKS,
  allChecksDone,
  decideModeration,
  moderationLabels,
  saveModerationChecks,
  type ModerationChecks,
} from "@/lib/supabase/moderation";
import { formatDate, type ReleaseRow } from "@/lib/supabase/label";
import { getSupabase } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/supabase/uploads";

interface CleanVersion {
  id: string;
  title: string | null;
  url: string | null;
  created_at: string;
}

/**
 * Модерация релиза в кабинете лейбла: чек-лист, отметка 18+, решение и
 * цензурные версии, которые загрузил артист.
 */
export default function ModerationPanel({
  release,
  onChanged,
}: {
  release: ReleaseRow;
  onChanged: () => void;
}) {
  const [checks, setChecks] = useState<ModerationChecks>(release.moderation_checks ?? {});
  const [explicit, setExplicit] = useState(release.is_explicit);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"pass" | "changes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clean, setClean] = useState<CleanVersion[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await getSupabase()
        .from("assets")
        .select("id, title, storage_path, created_at")
        .eq("release_id", release.id)
        .eq("is_clean_version", true)
        .order("created_at", { ascending: false });
      const rows = await Promise.all(
        (data ?? []).map(async (a) => {
          const { data: signed } = await getSupabase().storage.from(BUCKET).createSignedUrl(a.storage_path, 3600);
          return { id: a.id, title: a.title, created_at: a.created_at, url: signed?.signedUrl ?? null };
        })
      );
      if (!cancelled) setClean(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [release.id]);

  const toggle = (key: keyof ModerationChecks) => {
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    // промежуточное состояние сохраняем сразу — проверка может занять не один заход
    saveModerationChecks(release.id, next, explicit).catch(() => {});
  };

  const decide = async (decision: "passed" | "needs_changes") => {
    setBusy(decision === "passed" ? "pass" : "changes");
    setError(null);
    try {
      await decideModeration({ releaseId: release.id, decision, checks, isExplicit: explicit, comment });
      setComment("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить решение");
    } finally {
      setBusy(null);
    }
  };

  const m = moderationLabels[release.moderation_status];
  const ready = allChecksDone(checks);

  return (
    <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Модерация
        </h2>
        <Badge label={m.label} cls={m.cls} dot />
      </div>

      {release.moderated_at && (
        <p className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mb-3">
          Решение от {formatDate(release.moderated_at)}
          {release.moderation_status === "needs_changes" && release.moderation_comment
            ? `: «${release.moderation_comment}»`
            : ""}
        </p>
      )}

      <div className="space-y-1.5 mb-3">
        {MODERATION_CHECKS.map((c) => {
          const on = checks[c.key] === true;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={on}
              className="w-full flex items-start gap-2.5 text-left rounded-[12px] px-2.5 py-2 hover:bg-[#FAFAF9] dark:hover:bg-[#232227] transition"
            >
              <span
                className={`mt-[1px] w-[18px] h-[18px] rounded-[6px] border flex items-center justify-center shrink-0 transition ${
                  on
                    ? "bg-[#17161A] border-[#17161A] dark:bg-[#F5F4F2] dark:border-[#F5F4F2]"
                    : "border-[#D2D0CB] dark:border-[#4A4952]"
                }`}
              >
                {on && <Check className="w-3 h-3 text-white dark:text-[#17161A]" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-[#17161A] dark:text-[#F5F4F2]">{c.label}</span>
                <span className="block text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">{c.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <label className="flex items-center justify-between gap-3 rounded-[12px] bg-[#FAFAF9] dark:bg-[#232227] px-3 py-2.5 mb-3 cursor-pointer">
        <span className="text-[13px] text-[#17161A] dark:text-[#F5F4F2]">Отметка 18+ (explicit)</span>
        <input
          type="checkbox"
          checked={explicit}
          onChange={(e) => {
            setExplicit(e.target.checked);
            saveModerationChecks(release.id, checks, e.target.checked).catch(() => {});
          }}
          className="w-4 h-4 accent-[#17161A]"
        />
      </label>

      {clean.length > 0 && (
        <div className="mb-3">
          <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mb-1.5">Цензурные версии от артиста</div>
          {clean.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[12.5px] py-1">
              <FileAudio className="w-3.5 h-3.5 text-[#6E6D73] shrink-0" />
              <span className="truncate flex-1 dark:text-[#F5F4F2]">{c.title ?? "Файл"}</span>
              <span className="text-[#A6A5AB] shrink-0">{formatDate(c.created_at)}</span>
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label="Открыть файл" className="text-[#6E6D73] hover:text-[#17161A] dark:hover:text-[#F5F4F2]">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Что исправить артисту: строка, тайминг, нужна цензурная версия…"
        className="w-full resize-none text-[13px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8] mb-3"
      />

      {error && (
        <div className="text-[12.5px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] rounded-[12px] px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button
          onClick={() => decide("passed")}
          disabled={busy !== null || !ready}
          title={ready ? undefined : "Отметьте все пункты чек-листа"}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy === "pass" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
          Модерация пройдена
        </button>
        <button
          onClick={() => decide("needs_changes")}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] px-[14px] py-[8px] rounded-full hover:border-[#D2D0CB] transition disabled:opacity-40"
        >
          {busy === "changes" && <Loader2 className="w-4 h-4 animate-spin" />}
          Вернуть артисту на правки
        </button>
      </div>
    </div>
  );
}
