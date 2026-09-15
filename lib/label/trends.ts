import type { StreamPeriod } from "@/lib/supabase/streamPeriods";

/**
 * Расчёты динамики поверх помесячной истории. Чистые функции — одни и те же
 * цифры видят лейбл и артист, и их легко проверить.
 */

export interface MonthPoint {
  /** YYYY-MM-01 */
  month: string;
  /** null — за месяц данных нет (это не ноль) */
  streams: number | null;
  listeners: number | null;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export function addMonths(month: string, n: number): string {
  const d = new Date(`${month}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return monthKey(d);
}

/** Прошлый месяц — за него обычно и приходят отчёты площадок. */
export function previousMonth(now = new Date()): string {
  return addMonths(monthKey(now), -1);
}

export function fmtMonth(month: string, style: "short" | "long" = "short"): string {
  const d = new Date(`${month}T00:00:00`);
  const s = d.toLocaleDateString("ru-RU", style === "short" ? { month: "short", year: "2-digit" } : { month: "long", year: "numeric" });
  return s.replace(/\./g, "").replace(/\s?г$/, "").trim();
}

/**
 * Помесячный ряд: суммы по площадкам (и по артистам, если строк несколько),
 * без пропусков месяцев между первым и последним с данными.
 */
export function toMonthly(periods: StreamPeriod[], lastMonths?: number): MonthPoint[] {
  if (periods.length === 0) return [];
  const byMonth = new Map<string, { streams: number; listeners: number }>();
  for (const p of periods) {
    const cur = byMonth.get(p.month) ?? { streams: 0, listeners: 0 };
    cur.streams += p.streams;
    cur.listeners += p.listeners;
    byMonth.set(p.month, cur);
  }
  const months = [...byMonth.keys()].sort();
  const out: MonthPoint[] = [];
  for (let m = months[0]; m <= months[months.length - 1]; m = addMonths(m, 1)) {
    const v = byMonth.get(m);
    out.push({ month: m, streams: v?.streams ?? null, listeners: v?.listeners ?? null });
  }
  return lastMonths ? out.slice(-lastMonths) : out;
}

/** Рост к предыдущему месяцу с данными, в процентах; null — не с чем сравнить. */
export function growthPct(series: MonthPoint[], key: "streams" | "listeners" = "streams"): number | null {
  const known = series.filter((p) => p[key] !== null);
  if (known.length < 2) return null;
  const last = known[known.length - 1][key] as number;
  const prev = known[known.length - 2][key] as number;
  if (prev === 0) return null;
  return Math.round(((last - prev) / prev) * 1000) / 10;
}

/**
 * Прогноз на следующий месяц: линейный тренд по последним (до 6) месяцам
 * с данными. Нужно хотя бы 3 точки — по двум это просто продолжение прямой.
 * Это ориентир для планирования, а не обещание.
 */
export function forecastNext(series: MonthPoint[], key: "streams" | "listeners" = "streams"): { month: string; value: number } | null {
  const known = series.filter((p) => p[key] !== null).slice(-6);
  if (known.length < 3) return null;
  const xs = known.map((p) => monthIndex(p.month));
  const ys = known.map((p) => p[key] as number);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const nextMonth = addMonths(known[n - 1].month, 1);
  const value = Math.max(0, Math.round(my + slope * (monthIndex(nextMonth) - mx)));
  return { month: nextMonth, value };
}

function monthIndex(month: string) {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

export interface ArtistGrowth {
  artistId: string;
  last: number;
  prev: number | null;
  pct: number | null;
  lastMonth: string;
}

/** Рост каждого артиста за последний месяц с данными. */
export function growthByArtist(periods: StreamPeriod[]): ArtistGrowth[] {
  const byArtist = new Map<string, StreamPeriod[]>();
  for (const p of periods) byArtist.set(p.artist_id, [...(byArtist.get(p.artist_id) ?? []), p]);
  return [...byArtist.entries()].map(([artistId, rows]) => {
    const s = toMonthly(rows).filter((p) => p.streams !== null);
    const last = s[s.length - 1];
    const prev = s.length > 1 ? s[s.length - 2] : null;
    return {
      artistId,
      last: last.streams as number,
      prev: prev ? (prev.streams as number) : null,
      pct: growthPct(s),
      lastMonth: last.month,
    };
  });
}

export const fmtCompact = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} млн`
    : n >= 10_000
      ? `${Math.round(n / 1000)} тыс.`
      : n.toLocaleString("ru-RU");

export const fmtPct = (p: number | null) =>
  p === null ? "—" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toString().replace(".", ",")}%`;
