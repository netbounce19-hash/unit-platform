"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Check,
  RotateCcw,
  ExternalLink,
  Megaphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  Share2,
  Globe,
  Video,
  Send,
  Music2,
  type LucideIcon,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard, Field, Badge } from "@/components/label/LabelShell";
import {
  fetchRoster,
  fetchPromoReports,
  decidePromo,
  promoStatusLabels,
  formatDate,
  type MyOrg,
  type RosterArtist,
  type PromoRow,
} from "@/lib/supabase/label";

function getPlatformIcon(platform: string): LucideIcon {
  const p = platform.toLowerCase();
  if (p.includes("vk") || p.includes("вк")) return Share2;
  if (p.includes("tg") || p.includes("telegr") || p.includes("телеграм")) return Send;
  if (p.includes("tik") || p.includes("тикт") || p.includes("reels") || p.includes("shorts")) return Video;
  if (p.includes("you") || p.includes("ют") || p.includes("video")) return Video;
  if (p.includes("music") || p.includes("муз") || p.includes("sound")) return Music2;
  return Globe;
}

function PromoInner({ org }: { org: MyOrg }) {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"submitted" | "all">("submitted");

  const load = useCallback(async () => {
    try {
      const [r, a] = await Promise.all([fetchPromoReports(org.org_id), fetchRoster(org.org_id)]);
      setRows(r);
      setArtists(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить отчёты");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = (id: string) => artists.find((a) => a.id === id)?.stage_name ?? "—";

  const decide = async (id: string, status: "accepted" | "needs_changes") => {
    setBusy(id);
    setError(null);
    try {
      await decidePromo(id, status);
      setRows((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить решение");
    } finally {
      setBusy(null);
    }
  };

  const visible = filter === "submitted" ? rows.filter((r) => r.status === "submitted") : rows;
  const waiting = rows.filter((r) => r.status === "submitted").length;
  const accepted = rows.filter((r) => r.status === "accepted").length;

  return (
    <LabelShell
      org={org}
      title="Промо-отчёты"
      subtitle="Ссылки на публикации, сниппеты и промо-кампании от артистов"
      actions={
        <div className="flex items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px]">
          {(
            [
              { key: "submitted", label: `Ждут проверки (${waiting})` },
              { key: "all", label: `Все (${rows.length})` },
            ] as const
          ).map((f) => (
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

      {/* Сводная инфографическая плашка */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] flex items-center justify-center shrink-0">
              <Megaphone className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {rows.length}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                всего отчётов
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                waiting > 0
                  ? "bg-[#FBF1DE] dark:bg-[#3A2F14] text-[#8A5A16] dark:text-[#E8B65A]"
                  : "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
              }`}
            >
              <Clock className="w-4 h-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {waiting}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                {waiting > 0 ? "ждут решения" : "все проверены"}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-2.5 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] leading-none mb-1">
                {accepted}
              </div>
              <div className="text-[10.5px] text-[#6E6D73] dark:text-[#9A98A0] leading-none truncate">
                принято
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList
          empty={
            visible.length === 0
              ? filter === "submitted"
                ? "Нет отчётов, ждущих проверки"
                : "Отчётов пока нет"
              : null
          }
        >
          {visible.map((r) => {
            const s = promoStatusLabels[r.status];
            const rowBusy = busy === r.id;
            const PlatformIcon = getPlatformIcon(r.platform);

            return (
              <ListCard key={r.id}>
                <div className="flex items-start justify-between gap-3 mb-[8px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-[10px] bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] flex items-center justify-center shrink-0">
                      <PlatformIcon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] truncate">
                        {r.platform}
                      </div>
                      <Link
                        href={`/label/artists/${r.artist_id}`}
                        className="text-[12px] text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2] transition block truncate"
                      >
                        {nameOf(r.artist_id)}
                      </Link>
                    </div>
                  </div>
                  <Badge label={s.label} cls={s.cls} dot />
                </div>

                <Field label="Отправлен">{formatDate(r.created_at)}</Field>

                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] px-[14px] py-[8px] rounded-full hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition mt-3 max-w-full"
                  >
                    <ExternalLink className="w-[14px] h-[14px] shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{r.url.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => decide(r.id, "accepted")}
                    disabled={rowBusy || r.status === "accepted"}
                    className="flex-1 inline-flex items-center justify-center gap-[5px] text-[12.5px] font-medium bg-[#1F9D6B] text-white px-[14px] py-[8px] rounded-full hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {rowBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    )}
                    Принять
                  </button>
                  <button
                    onClick={() => decide(r.id, "needs_changes")}
                    disabled={rowBusy || r.status === "needs_changes"}
                    className="flex-1 inline-flex items-center justify-center gap-[5px] text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] px-[14px] py-[8px] rounded-full hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                    Нужны правки
                  </button>
                </div>
              </ListCard>
            );
          })}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function PromoPage() {
  return <LabelGate>{({ org }) => <PromoInner org={org} />}</LabelGate>;
}
