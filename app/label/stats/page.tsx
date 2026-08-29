"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  TrendingUp,
  Gauge,
  ListChecks,
  Info,
  Award,
  Crown,
  Medal,
  Zap,
  Activity,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard } from "@/components/label/LabelShell";
import {
  fetchRoster,
  fetchObligationStats,
  type MyOrg,
  type RosterArtist,
  type ObligationStat,
} from "@/lib/supabase/label";
import { fetchOrgStreamStats, type StreamStat } from "@/lib/supabase/streamStats";
import { computeScores, sortByMetric, fmtStreams, type Metric } from "@/lib/label/ranking";

const METRICS: { key: Metric; label: string; icon: typeof TrendingUp }[] = [
  { key: "efficiency", label: "Эффективность", icon: Zap },
  { key: "streams", label: "Стримы", icon: TrendingUp },
  { key: "obligation", label: "Обязательность", icon: ListChecks },
];

function StatsInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [obligations, setObligations] = useState<ObligationStat[]>([]);
  const [streamsMap, setStreamsMap] = useState<Map<string, StreamStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("efficiency");

  useEffect(() => {
    Promise.all([
      fetchRoster(org.org_id),
      fetchObligationStats(org.org_id),
      fetchOrgStreamStats(org.org_id),
    ])
      .then(([rows, obl, streams]) => {
        setArtists(rows);
        setObligations(obl);
        setStreamsMap(streams);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить статистику"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const rows = useMemo(
    () => sortByMetric(computeScores(artists, obligations, streamsMap), metric),
    [artists, obligations, streamsMap, metric]
  );

  return (
    <LabelShell
      org={org}
      title="Статистика"
      subtitle="Рейтинг артистов по стримам, эффективности и обязательности"
      actions={
        <div className="flex items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-[3px]">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const active = metric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`inline-flex items-center gap-[6px] text-[12.5px] font-medium px-[11px] py-[5px] rounded-full transition ${
                  active
                    ? "bg-[#F0EEEA] dark:bg-[#242327] text-[#17161A] dark:text-[#F5F4F2] shadow-xs"
                    : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
                }`}
              >
                <Icon className="w-[13px] h-[13px]" strokeWidth={1.75} />
                {m.label}
              </button>
            );
          })}
        </div>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {/* Инфографическая плашка формулы эффективности */}
      {metric === "efficiency" && (
        <div className="bg-[#FAFAF9] dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-3.5 mb-4 space-y-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-[#17161A] dark:text-[#F5F4F2] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#17161A] dark:text-[#F5F4F2]" strokeWidth={2.2} />
              Формула индекса эффективности
            </span>
            <span className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73]">100 баллов макс.</span>
          </div>

          <div className="h-2 w-full rounded-full bg-[#ECEAE5] dark:bg-[#242327] overflow-hidden flex">
            <div className="h-full bg-[#17161A] dark:bg-[#F5F4F2]" style={{ width: "60%" }} title="60% Стримы" />
            <div className="h-full bg-[#1F9D6B] dark:bg-[#5FCB9B]" style={{ width: "40%" }} title="40% Обязательность" />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#6E6D73] dark:text-[#9A98A0] pt-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#17161A] dark:bg-[#F5F4F2]" />
              60% стримы (нормированные)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#1F9D6B] dark:bg-[#5FCB9B]" />
              40% обязательность задач
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList empty={rows.length === 0 ? "В ростере пока нет артистов" : null}>
          {rows.map((r, i) => {
            const isTop1 = i === 0;
            const isTop2 = i === 1;
            const isTop3 = i === 2;

            let rankBadgeCls = "bg-[#F0EEEA] dark:bg-[#242327] text-[#6E6D73] dark:text-[#9A98A0]";
            let RankIcon = null;

            if (isTop1) {
              rankBadgeCls = "bg-[#FEF9C3] dark:bg-[#422006] text-[#854D0E] dark:text-[#FEF08A] border border-[#FDE047]/50";
              RankIcon = Crown;
            } else if (isTop2) {
              rankBadgeCls = "bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#CBD5E1] border border-[#CBD5E1]/50";
              RankIcon = Medal;
            } else if (isTop3) {
              rankBadgeCls = "bg-[#FFEDD5] dark:bg-[#431407] text-[#9A3412] dark:text-[#FED7AA] border border-[#FDBA74]/50";
              RankIcon = Award;
            }

            return (
              <ListCard key={r.artist.id} href={`/label/artists/${r.artist.id}`}>
                <div className="flex items-center justify-between gap-3 mb-[10px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-full text-[12px] font-bold flex items-center justify-center shrink-0 ${rankBadgeCls}`}
                    >
                      {RankIcon ? (
                        <RankIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="text-[15px] font-semibold truncate min-w-0 text-[#17161A] dark:text-[#F5F4F2]">
                      {r.artist.stage_name}
                    </span>
                  </div>

                  <div className="text-[11.5px] font-medium text-[#6E6D73] dark:text-[#9A98A0] flex items-center gap-1">
                    <span>Ранг #{i + 1}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        key: "efficiency",
                        label: "Эффективность",
                        value: String(r.efficiency),
                        scoreVal: r.efficiency,
                        icon: Zap,
                        color: "bg-[#17161A] dark:bg-[#F5F4F2]",
                      },
                      {
                        key: "streams",
                        label: "Стримы",
                        value: fmtStreams(r.streams),
                        scoreVal: r.streamsScore,
                        icon: TrendingUp,
                        color: "bg-[#C4C3C8] dark:bg-[#4A4952]",
                      },
                      {
                        key: "obligation",
                        label: "Обязательность",
                        value: r.obligationScore === null ? "—" : `${r.obligationScore}%`,
                        scoreVal: r.obligationScore ?? 0,
                        icon: ListChecks,
                        color: "bg-[#1F9D6B] dark:bg-[#5FCB9B]",
                      },
                    ] as const
                  ).map((m) => {
                    const isSelected = metric === m.key;
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.key}
                        className={`rounded-[12px] px-[10px] py-[8px] flex flex-col justify-between transition ${
                          isSelected
                            ? "bg-[#F0EEEA] dark:bg-[#242327] ring-1 ring-black/5 dark:ring-white/10"
                            : "bg-[#FAFAF9] dark:bg-[#232227]"
                        }`}
                      >
                        <div className="flex items-center gap-1 text-[10.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate mb-0.5">
                          <Icon className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{m.label}</span>
                        </div>
                        <div
                          className={`text-[15px] tabular-nums ${
                            isSelected
                              ? "font-semibold text-[#17161A] dark:text-[#F5F4F2]"
                              : "text-[#17161A] dark:text-[#F5F4F2]"
                          }`}
                        >
                          {m.value}
                        </div>
                        {/* Микро-полоска прогресса */}
                        <div className="h-[3px] w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${m.color}`}
                            style={{ width: `${Math.max(0, Math.min(100, m.scoreVal))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ListCard>
            );
          })}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function StatsPage() {
  return <LabelGate>{({ org }) => <StatsInner org={org} />}</LabelGate>;
}
