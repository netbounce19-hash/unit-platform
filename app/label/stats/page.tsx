"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, TrendingUp, Gauge, ListChecks, Info } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { DataTable } from "@/components/label/LabelShell";
import { fetchRoster, fetchObligationStats, type MyOrg, type RosterArtist, type ObligationStat } from "@/lib/supabase/label";
import { seedStreamsIfEmpty } from "@/lib/label/mockStreams";
import { useStreams } from "@/lib/label/useStreams";

type Metric = "streams" | "efficiency" | "obligation";

const METRICS: { key: Metric; label: string; icon: typeof TrendingUp }[] = [
  { key: "streams", label: "Стримы", icon: TrendingUp },
  { key: "efficiency", label: "Эффективность", icon: Gauge },
  { key: "obligation", label: "Обязательность", icon: ListChecks },
];

function fmtStreams(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

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

  const rows = useMemo(() => {
    const oblByArtist = new Map(obligations.map((o) => [o.artistId, o]));
    const maxStreams = Math.max(1, ...artists.map((a) => streamsMap.get(a.id)?.streams ?? 0));

    const withScores = artists.map((a) => {
      const streams = streamsMap.get(a.id)?.streams ?? 0;
      const obl = oblByArtist.get(a.id) ?? null;
      const streamsScore = Math.round((streams / maxStreams) * 100);
      const obligationScore = obl?.ratio ?? null;
      // Эффективность = 60% нормированных стримов + 40% обязательности.
      // Если задач ещё нет — считаем только по стримам (без веса обязательности).
      const efficiency =
        obligationScore === null ? streamsScore : Math.round(streamsScore * 0.6 + obligationScore * 0.4);
      return { artist: a, streams, obligationScore, efficiency };
    });

    const sorted = [...withScores].sort((x, y) => {
      if (metric === "streams") return y.streams - x.streams;
      if (metric === "obligation") return (y.obligationScore ?? -1) - (x.obligationScore ?? -1);
      return y.efficiency - x.efficiency;
    });
    return sorted;
  }, [artists, obligations, streamsMap, metric]);

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
        <DataTable
          head={["#", "Артист", "Стримы", "Обязательность", "Эффективность"]}
          empty={rows.length === 0 ? "В ростере пока нет артистов" : null}
        >
          {rows.map((r, i) => (
            <tr key={r.artist.id} className="border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327] last:border-0 hover:bg-[#FAFAF9] dark:hover:bg-[#1F1E22]">
              <td className="px-4 py-[11px] text-[#A6A5AB] dark:text-[#6E6D73] font-medium">{i + 1}</td>
              <td className="px-4 py-[11px]">
                <Link
                  href={`/label/artists/${r.artist.id}`}
                  className="font-medium text-[#17161A] dark:text-[#F5F4F2] hover:text-[#E23A34] transition"
                >
                  {r.artist.stage_name}
                </Link>
              </td>
              <td className={`px-4 py-[11px] ${metric === "streams" ? "font-semibold" : "text-[#6E6D73] dark:text-[#9A98A0]"}`}>
                {fmtStreams(r.streams)}
              </td>
              <td className={`px-4 py-[11px] ${metric === "obligation" ? "font-semibold" : "text-[#6E6D73] dark:text-[#9A98A0]"}`}>
                {r.obligationScore === null ? "—" : `${r.obligationScore}%`}
              </td>
              <td className={`px-4 py-[11px] ${metric === "efficiency" ? "font-semibold" : "text-[#6E6D73] dark:text-[#9A98A0]"}`}>
                {r.efficiency}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </LabelShell>
  );
}

export default function StatsPage() {
  return <LabelGate>{({ org }) => <StatsInner org={org} />}</LabelGate>;
}
