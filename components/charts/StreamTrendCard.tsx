"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import TrendChart from "@/components/charts/TrendChart";
import { fetchArtistPeriods, fetchOrgPeriods, type StreamPeriod } from "@/lib/supabase/streamPeriods";
import { fmtCompact, fmtMonth, fmtPct, forecastNext, growthPct, toMonthly } from "@/lib/label/trends";

type Metric = "streams" | "listeners";

/**
 * Карточка динамики: переключатель «стримы / слушатели», три цифры
 * (последний месяц, рост к предыдущему, прогноз) и помесячный график.
 * Две метрики разного масштаба — два режима одного графика, а не две оси.
 *
 * source: артист (его история) или вся организация (сумма по ростеру).
 */
export default function StreamTrendCard({
  artistId,
  orgId,
  title = "Динамика стримов",
  months = 12,
  emptyHint = "Помесячные цифры появятся, когда менеджер загрузит отчёты площадок",
  className = "",
}: {
  artistId?: string;
  orgId?: string;
  title?: string;
  months?: number;
  emptyHint?: string;
  className?: string;
}) {
  const [periods, setPeriods] = useState<StreamPeriod[] | null>(null);
  const [metric, setMetric] = useState<Metric>("streams");

  useEffect(() => {
    let cancelled = false;
    const load = artistId ? fetchArtistPeriods(artistId) : orgId ? fetchOrgPeriods(orgId) : Promise.resolve([]);
    load
      .then((p) => !cancelled && setPeriods(p))
      .catch(() => !cancelled && setPeriods([]));
    return () => {
      cancelled = true;
    };
  }, [artistId, orgId]);

  const series = useMemo(() => toMonthly(periods ?? [], months), [periods, months]);
  const known = series.filter((p) => p[metric] !== null);
  const last = known[known.length - 1];
  const growth = growthPct(series, metric);
  const forecast = forecastNext(series, metric);

  const tile = "rounded-[12px] bg-[#FAFAF9] dark:bg-[#232227] px-3 py-[10px] min-w-0";

  return (
    <div className={`bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[16px] p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-[17px] h-[17px] text-[#17161A] dark:text-[#F5F4F2]" strokeWidth={2} />
          <div className="text-[15px] font-semibold tracking-tight text-[#17161A] dark:text-[#F5F4F2]">{title}</div>
        </div>
        {series.length > 0 && (
          <div className="flex items-center gap-1 bg-[#FAFAF9] dark:bg-[#232227] rounded-full p-[3px]">
            {(
              [
                ["streams", "Стримы"],
                ["listeners", "Слушатели"],
              ] as [Metric, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                aria-pressed={metric === k}
                className={`text-[12px] font-medium px-[10px] py-[4px] rounded-full transition ${
                  metric === k
                    ? "bg-white dark:bg-[#1A191D] text-[#17161A] dark:text-[#F5F4F2] shadow-xs"
                    : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {periods === null ? (
        <div className="py-10 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : series.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">{emptyHint}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className={tile}>
              <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                {last ? fmtMonth(last.month) : "Месяц"}
              </div>
              <div className="text-[17px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] mt-[2px] truncate">
                {last ? fmtCompact(last[metric] as number) : "—"}
              </div>
            </div>
            <div className={tile}>
              <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">За месяц</div>
              <div className="text-[17px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] mt-[2px]">
                {fmtPct(growth)}
              </div>
            </div>
            <div className={tile}>
              <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                {forecast ? `Прогноз · ${fmtMonth(forecast.month).split(" ")[0]}` : "Прогноз"}
              </div>
              <div className="text-[17px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2] mt-[2px] truncate">
                {forecast ? `≈ ${fmtCompact(forecast.value)}` : "—"}
              </div>
            </div>
          </div>

          <TrendChart
            points={series}
            metric={metric}
            forecast={forecast}
            valueLabel={metric === "streams" ? "стримов" : "слушателей"}
          />

          <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mt-2">
            {forecast
              ? "Прогноз — продолжение тренда последних месяцев, ориентир для планирования."
              : "Прогноз появится, когда наберётся три месяца данных."}
            {metric === "listeners" ? " Слушатели — сумма по площадкам за месяц." : ""}
          </p>
        </>
      )}
    </div>
  );
}
