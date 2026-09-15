"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Clock, RotateCcw, Radio } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Field, Badge } from "@/components/label/LabelShell";
import { fetchRoster, formatDate, releaseStatusLabels, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import {
  MODERATION_CHECKS,
  fetchModerationQueue,
  moderationLabels,
  type ModerationRow,
  type ModerationStatus,
} from "@/lib/supabase/moderation";

type Filter = "todo" | "needs_changes" | "catalog" | "passed";

/**
 * Очередь модерации. Сюда попадают и новые релизы, и уже вышедший каталог:
 * по новым требованиям его тоже нужно перепроверить, а при необходимости
 * заменить треки цензурными версиями.
 */
function ModerationInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<ModerationRow[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todo");

  useEffect(() => {
    Promise.all([fetchModerationQueue(org.org_id), fetchRoster(org.org_id)])
      .then(([r, a]) => {
        setRows(r);
        setArtists(a);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить очередь"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const nameOf = useMemo(() => new Map(artists.map((a) => [a.id, a.stage_name])), [artists]);

  const groups: Record<Filter, ModerationRow[]> = {
    // новые релизы, которые идут к отгрузке
    todo: rows.filter((r) => r.moderation_status === "pending" && r.status !== "released"),
    needs_changes: rows.filter((r) => r.moderation_status === "needs_changes"),
    // уже на площадках, но не проверены
    catalog: rows.filter((r) => r.moderation_status === "pending" && r.status === "released"),
    passed: rows.filter((r) => r.moderation_status === "passed"),
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "todo", label: `Новые (${groups.todo.length})` },
    { key: "needs_changes", label: `На правках (${groups.needs_changes.length})` },
    { key: "catalog", label: `Каталог (${groups.catalog.length})` },
    { key: "passed", label: `Проверены (${groups.passed.length})` },
  ];

  const EMPTY: Record<Filter, string> = {
    todo: "Новых релизов на проверке нет",
    needs_changes: "Никто не ждёт правок",
    catalog: "Весь вышедший каталог проверен",
    passed: "Проверенных релизов пока нет",
  };

  const visible = groups[filter];
  const progress = (r: ModerationRow) =>
    MODERATION_CHECKS.filter((c) => r.moderation_checks?.[c.key] === true).length;

  const tiles: { label: string; value: number; icon: typeof Clock; tone: string }[] = [
    { label: "ждут проверки", value: groups.todo.length, icon: Clock, tone: "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]" },
    { label: "на правках у артистов", value: groups.needs_changes.length, icon: RotateCcw, tone: "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]" },
    { label: "из каталога не проверено", value: groups.catalog.length, icon: Radio, tone: "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2]" },
  ];

  return (
    <LabelShell
      org={org}
      title="Модерация"
      subtitle="Проверка треков на законодательные ограничения перед отгрузкой и в вышедшем каталоге"
      actions={
        <div className="flex flex-wrap items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-[12.5px] font-medium px-[11px] py-[5px] rounded-full transition ${
                filter === f.key
                  ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] shadow-xs"
                  : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.label}
                className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.tone}`}>
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                    {t.value}
                  </div>
                  <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-tight">{t.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList empty={visible.length === 0 ? EMPTY[filter] : null}>
          {visible.map((r) => {
            const m = moderationLabels[r.moderation_status as ModerationStatus];
            const st = releaseStatusLabels[r.status as keyof typeof releaseStatusLabels];
            return (
              <ListCard key={r.id} href={`/label/releases/${r.id}`}>
                <div className="flex items-start justify-between gap-3 mb-[6px]">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{r.title}</div>
                    <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                      {(r.artist_id && nameOf.get(r.artist_id)) || "Артист не указан"}
                    </div>
                  </div>
                  <Badge label={m.label} cls={m.cls} icon={ShieldCheck} />
                </div>
                <Field label="Этап">{st?.label ?? r.status}</Field>
                <Field label="Чек-лист">
                  {progress(r)} из {MODERATION_CHECKS.length}
                  {r.is_explicit ? " · 18+" : ""}
                </Field>
                {r.moderation_status === "needs_changes" && r.moderation_comment && (
                  <p className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] mt-1 line-clamp-2">«{r.moderation_comment}»</p>
                )}
                {r.moderated_at && <Field label="Решение">{formatDate(r.moderated_at)}</Field>}
              </ListCard>
            );
          })}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function ModerationPage() {
  return <LabelGate>{({ org }) => <ModerationInner org={org} />}</LabelGate>;
}
