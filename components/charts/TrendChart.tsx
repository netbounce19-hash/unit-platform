"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMonth, type MonthPoint } from "@/lib/label/trends";

/**
 * Помесячный тренд одной метрики.
 *
 * Одна серия — поэтому без легенды: что показано, говорит заголовок карточки.
 * Линия 2px и лёгкая заливка, горизонтальная сетка волосяной линией, подпись
 * значения только у последней точки. Месяц без данных — разрыв линии, а не
 * ноль. Прогноз — приглушённый отрезок и полый маркер, чтобы не спутать с
 * фактом. Наведение и стрелки клавиатуры показывают значение месяца; всё то же
 * доступно таблицей.
 */

const W_MIN = 280;
const PAD = { top: 18, right: 56, bottom: 26, left: 58 };

function niceStep(max: number, ticks = 4) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

const fmtTick = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toString().replace(".", ",")} млн` : v >= 1000 ? `${Math.round(v / 1000)} тыс` : String(v);

export default function TrendChart({
  points,
  metric,
  forecast,
  height = 200,
  valueLabel = "стримов",
}: {
  points: MonthPoint[];
  metric: "streams" | "listeners";
  forecast?: { month: string; value: number } | null;
  height?: number;
  valueLabel?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(W_MIN, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = useMemo(() => {
    const base = points.map((p) => ({ month: p.month, value: p[metric], forecast: false }));
    return forecast ? [...base, { month: forecast.month, value: forecast.value, forecast: true }] : base;
  }, [points, metric, forecast]);

  const values = all.map((p) => p.value).filter((v): v is number => v !== null);
  const step = niceStep(Math.max(1, ...values));
  const yMax = Math.ceil(Math.max(1, ...values) / step) * step;
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (all.length === 1 ? innerW / 2 : (i / (all.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  // Факт — отрезками между известными точками; пропуск рвёт линию
  const factIdx = all.map((p, i) => (!p.forecast && p.value !== null ? i : -1)).filter((i) => i >= 0);
  const segments: number[][] = [];
  let cur: number[] = [];
  all.forEach((p, i) => {
    if (p.forecast) return;
    if (p.value === null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) segments.push(cur);

  const lastFact = factIdx[factIdx.length - 1];
  const fcIdx = forecast ? all.length - 1 : -1;
  const labelEvery = Math.ceil(all.length / Math.max(2, Math.floor(innerW / 64)));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    all.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(all.length - 1, (h ?? -1) + 1));
    if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? all.length) - 1));
    if (e.key === "Escape") setHover(null);
  };

  if (points.length === 0) {
    return <div className="py-10 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">Истории пока нет</div>;
  }

  const h = hover !== null ? all[hover] : null;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex justify-end -mt-1 mb-1">
        <button
          type="button"
          onClick={() => setTable((t) => !t)}
          className="text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2] px-[10px] py-[4px] rounded-full transition"
        >
          {table ? "График" : "Таблица"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                <th className="text-left font-normal py-1.5">Месяц</th>
                <th className="text-right font-normal py-1.5">{metric === "streams" ? "Стримы" : "Слушатели"}</th>
              </tr>
            </thead>
            <tbody>
              {all
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.month} className="border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                    <td className="py-1.5 text-[#6E6D73] dark:text-[#9A98A0]">
                      {fmtMonth(p.month, "long")}
                      {p.forecast ? " · прогноз" : ""}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-[#17161A] dark:text-[#F5F4F2]">
                      {p.value === null ? "нет данных" : p.value.toLocaleString("ru-RU")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${metric === "streams" ? "Стримы" : "Слушатели"} по месяцам`}
          tabIndex={0}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          className="block max-w-full text-[#17161A] dark:text-[#F5F4F2] outline-none focus-visible:ring-2 focus-visible:ring-[#17161A]/20 rounded-[12px] touch-none"
        >
          {/* сетка и подписи оси Y */}
          {Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step).map((v) => (
            <g key={v}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(v)}
                y2={y(v)}
                className="stroke-[#ECEAE5] dark:stroke-[#242327]"
                strokeWidth={1}
              />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="fill-[#A6A5AB] dark:fill-[#6E6D73]" fontSize={10.5}>
                {fmtTick(v)}
              </text>
            </g>
          ))}

          {/* подписи месяцев */}
          {all.map((p, i) =>
            i % labelEvery === 0 || i === all.length - 1 ? (
              <text
                key={p.month}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                className="fill-[#A6A5AB] dark:fill-[#6E6D73]"
                fontSize={10.5}
              >
                {fmtMonth(p.month)}
              </text>
            ) : null
          )}

          {/* заливка и линия факта */}
          {segments.map((seg, k) => {
            const line = seg.map((i, j) => `${j ? "L" : "M"}${x(i)},${y(all[i].value as number)}`).join("");
            const area =
              seg.length > 1
                ? `${line}L${x(seg[seg.length - 1])},${y(0)}L${x(seg[0])},${y(0)}Z`
                : "";
            return (
              <g key={k}>
                {area && <path d={area} fill="currentColor" opacity={0.08} />}
                <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}

          {/* прогноз */}
          {forecast && lastFact !== undefined && (
            <g>
              <path
                d={`M${x(lastFact)},${y(all[lastFact].value as number)}L${x(fcIdx)},${y(forecast.value)}`}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.3}
              />
              <circle cx={x(fcIdx)} cy={y(forecast.value)} r={4.5} className="fill-white dark:fill-[#1A191D]" stroke="currentColor" strokeWidth={2} opacity={0.55} />
            </g>
          )}

          {/* последняя точка факта и её значение */}
          {lastFact !== undefined && (
            <g>
              <circle cx={x(lastFact)} cy={y(all[lastFact].value as number)} r={6} className="fill-white dark:fill-[#1A191D]" />
              <circle cx={x(lastFact)} cy={y(all[lastFact].value as number)} r={4} fill="currentColor" />
              {!forecast && (
                <text
                  x={x(lastFact) + 10}
                  y={y(all[lastFact].value as number) + 4}
                  fontSize={11.5}
                  fontWeight={600}
                  className="fill-[#17161A] dark:fill-[#F5F4F2]"
                >
                  {fmtTick(all[lastFact].value as number)}
                </text>
              )}
            </g>
          )}

          {/* перекрестье */}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-[#D2D0CB] dark:stroke-[#4A4952]"
                strokeWidth={1}
              />
              {h.value !== null && (
                <>
                  <circle cx={x(hover)} cy={y(h.value)} r={6} className="fill-white dark:fill-[#1A191D]" />
                  <circle cx={x(hover)} cy={y(h.value)} r={4} fill="currentColor" opacity={h.forecast ? 0.55 : 1} />
                </>
              )}
            </g>
          )}
        </svg>
      )}

      {!table && h && hover !== null && (
        <div
          className="pointer-events-none absolute top-6 z-10 rounded-[12px] bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#33323A] shadow-sm px-3 py-2 whitespace-nowrap"
          style={{
            left: Math.min(Math.max(x(hover) - 70, 0), width - 150),
          }}
        >
          <div className="text-[14px] font-semibold tabular-nums text-[#17161A] dark:text-[#F5F4F2]">
            {h.value === null ? "нет данных" : `${h.value.toLocaleString("ru-RU")} ${valueLabel}`}
          </div>
          <div className="text-[11.5px] text-[#6E6D73] dark:text-[#9A98A0]">
            {fmtMonth(h.month, "long")}
            {h.forecast ? " · прогноз по тренду" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
