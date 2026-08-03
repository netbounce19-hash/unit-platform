"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, Gauge, ListChecks, Info } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { CardList, ListCard } from "@/components/label/LabelShell";
import { fetchRoster, fetchObligationStats, type MyOrg, type RosterArtist, type ObligationStat } from "@/lib/supabase/label";
import { seedStreamsIfEmpty } from "@/lib/label/mockStreams";
import { useStreams } from "@/lib/label/useStreams";
import { computeScores, sortByMetric, fmtStreams, type Metric } from "@/lib/label/ranking";

const METRICS: { key: Metric; label: string; icon: typeof TrendingUp }[] = [
  { key: "streams", label: "Стримы", icon: TrendingUp },
  { key: "efficiency", label: "Эффективность", icon: Gauge },
  { key: "obligation", label: "Обязательность", icon: ListChecks },
];

function StatsInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [obligations, setObligations] = useState<ObligationStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("efficiency");

  useEffect(() => {
    Promise.all([fetchRoster(org.org_id), fetchObligationStats(org.org_id)])
      .then(([rows, obl]) => {
        setArtists(rows);
        setObligations(obl);
        seedStreamsIfEmpty(rows.map((a) => a.id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить статистику"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const streamsMap = useStreams();

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
        <div className="flex items-center gap-1 bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[9px] p-[3px]">
          {METRICS.map((m) => {
            const Icon = m.icon;
            const active = metric === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`inline-flex items-center gap-[6px] text-[12.5px] font-medium px-[11px] py-[5px] rounded-[7px] transition ${
                  active
                    ? "bg-[#FDEDEB] dark:bg-[#3A2422] text-[#A62018] dark:text-[#F3928C]"
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
        <div className="text-[13px] text-[#A62018] dark:text-[#F3928C] bg-[#FDEDEB] dark:bg-[#3A2422] border-[0.5px] border-[#F3C9C6] dark:border-[#4A2F2C] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="flex items-start gap-2 text-[12px] text-[#8A5A16] dark:text-[#E8B65A] bg-[#FBF1DE] dark:bg-[#3A2F14] border-[0.5px] border-[#F0E2BF] dark:border-[#4A3E1E] rounded-[10px] px-3 py-[9px] mb-4">
        <Info className="w-[14px] h-[14px] shrink-0 mt-[1px]" strokeWidth={2} />
        <span className="leading-[1.5]">
          Стримы — демо-данные (мокаются в памяти вкладки). Реальные цифры появятся здесь после раздела
          «Загрузка данных». Обязательность уже считается по настоящим задачам.
          {metric === "efficiency" && " Эффективность = 60% нормированных стримов + 40% обязательности."}
        </span>
      </div>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : (
        <CardList empty={rows.length === 0 ? "В ростере пока нет артистов" : null}>
          {rows.map((r, i) => (
            <ListCard key={r.artist.id} href={`/label/artists/${r.artist.id}`}>
              <div className="flex items-center gap-3 mb-[8px]">
                <span className="w-7 h-7 rounded-full bg-[#F0EEEA] dark:bg-[#242327] text-[#6E6D73] dark:text-[#9A98A0] text-[12.5px] font-semibold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-[15px] font-medium truncate min-w-0 dark:text-[#F5F4F2]">
                  {r.artist.stage_name}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "streams", label: "Стримы", value: fmtStreams(r.streams) },
                    {
                      key: "obligation",
                      label: "Обязательность",
                      value: r.obligationScore === null ? "—" : `${r.obligationScore}%`,
                    },
                    { key: "efficiency", label: "Эффективность", value: String(r.efficiency) },
                  ] as const
                ).map((m) => (
                  <div
                    key={m.key}
                    className={`rounded-[9px] px-[10px] py-[8px] ${
                      metric === m.key
                        ? "bg-[#FDEDEB] dark:bg-[#3A2422]"
                        : "bg-[#FAFAF9] dark:bg-[#232227]"
                    }`}
                  >
                    <div className="text-[11px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                      {m.label}
                    </div>
                    <div
                      className={`text-[15px] mt-[2px] ${
                        metric === m.key
                          ? "font-semibold text-[#A62018] dark:text-[#F3928C]"
                          : "text-[#17161A] dark:text-[#F5F4F2]"
                      }`}
                    >
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </ListCard>
          ))}
        </CardList>
      )}
    </LabelShell>
  );
}

export default function StatsPage() {
  return <LabelGate>{({ org }) => <StatsInner org={org} />}</LabelGate>;
}
