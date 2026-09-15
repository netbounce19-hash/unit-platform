"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import type { RosterArtist } from "@/lib/supabase/label";
import { fetchOrgPeriods, type StreamPeriod } from "@/lib/supabase/streamPeriods";
import { fmtCompact, fmtMonth, fmtPct, growthByArtist } from "@/lib/label/trends";

/**
 * Кто растёт и кто проседает за последний месяц. Скаутам и проджектам это
 * важнее абсолютных цифр: рост показывает, в кого стоит вкладываться сейчас.
 */
export default function GrowthList({ orgId, artists }: { orgId: string; artists: RosterArtist[] }) {
  const [periods, setPeriods] = useState<StreamPeriod[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrgPeriods(orgId)
      .then((p) => !cancelled && setPeriods(p))
      .catch(() => !cancelled && setPeriods([]));
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const nameOf = useMemo(() => new Map(artists.map((a) => [a.id, a.stage_name])), [artists]);
  const rows = useMemo(
    () =>
      growthByArtist(periods ?? [])
        .filter((g) => nameOf.has(g.artistId))
        .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity)),
    [periods, nameOf]
  );

  return (
    <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[16px] p-5">
      <div className="text-[15px] font-semibold tracking-tight text-[#17161A] dark:text-[#F5F4F2] mb-1">Рост за месяц</div>
      <p className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] mb-3">Стримы последнего месяца к предыдущему</p>

      {periods === null ? (
        <div className="py-6 flex justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">Нет помесячных данных</p>
      ) : (
        <div className="divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327]">
          {rows.map((g) => {
            const Icon = g.pct !== null && g.pct < 0 ? ArrowDownRight : ArrowUpRight;
            return (
              <Link
                key={g.artistId}
                href={`/label/artists/${g.artistId}`}
                className="flex items-center gap-3 py-[9px] hover:opacity-80 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{nameOf.get(g.artistId)}</div>
                  <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                    {fmtCompact(g.last)} · {fmtMonth(g.lastMonth)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-[2px] text-[13px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] shrink-0">
                  {g.pct !== null && <Icon className="w-3.5 h-3.5" strokeWidth={2.25} aria-hidden />}
                  {g.pct === null ? <span className="text-[#A6A5AB] font-normal">первый месяц</span> : fmtPct(g.pct)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
