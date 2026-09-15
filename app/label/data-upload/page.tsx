"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Check, UploadCloud, TrendingUp, Users, FileSpreadsheet, AlertTriangle } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import { fetchOrgPeriods, upsertPeriods, ALL_SOURCES, type PeriodInput, type StreamPeriod } from "@/lib/supabase/streamPeriods";
import { addMonths, fmtMonth, previousMonth } from "@/lib/label/trends";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[7px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

const SAMPLE = `артист;месяц;площадка;стримы;слушатели
Имя артиста;2026-08;Яндекс Музыка;120000;18000
Имя артиста;2026-08;VK Музыка;40000;9000`;

interface ParsedRow {
  line: number;
  raw: string;
  input?: PeriodInput;
  artistName?: string;
  error?: string;
}

/** «2026-08», «08.2026», «2026-08-01» → «2026-08-01». */
function parseMonth(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-01`;
  m = t.match(/^(\d{1,2})[./](\d{4})$/);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
  return null;
}

const rows = (n: number) => {
  const m10 = n % 10, m100 = n % 100;
  const w = m10 === 1 && m100 !== 11 ? "строку" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "строки" : "строк";
  return `${n} ${w}`;
};

const toInt = (s: string | undefined) => {
  const n = Number((s ?? "").replace(/[\s ]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : NaN;
};

function parseCsv(text: string, artists: RosterArtist[]): ParsedRow[] {
  const byName = new Map(artists.map((a) => [a.stage_name.trim().toLowerCase(), a]));
  const lines = text.split(/\r?\n/);
  const out: ParsedRow[] = [];
  lines.forEach((raw, i) => {
    if (!raw.trim()) return;
    const cells = raw.split(raw.includes(";") ? ";" : raw.includes("\t") ? "\t" : ",").map((c) => c.trim().replace(/^"|"$/g, ""));
    // строка заголовка
    if (i === 0 && /арт|artist/i.test(cells[0])) return;
    const [name, monthRaw, source, streamsRaw, listenersRaw] = cells;
    const artist = byName.get((name ?? "").toLowerCase());
    const month = parseMonth(monthRaw ?? "");
    const streams = toInt(streamsRaw);
    const listeners = listenersRaw === undefined || listenersRaw === "" ? 0 : toInt(listenersRaw);
    const row: ParsedRow = { line: i + 1, raw };
    if (!artist) row.error = `артист «${name ?? ""}» не найден в ростере`;
    else if (!month) row.error = `месяц «${monthRaw ?? ""}» — нужен формат 2026-08`;
    else if (Number.isNaN(streams) || Number.isNaN(listeners)) row.error = "стримы и слушатели — целые числа";
    else {
      row.artistName = artist.stage_name;
      row.input = { artistId: artist.id, month, source: source || ALL_SOURCES, streams, listeners };
    }
    out.push(row);
  });
  return out;
}

function DataUploadInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [periods, setPeriods] = useState<StreamPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(previousMonth());
  const [drafts, setDrafts] = useState<Record<string, { streams: string; listeners: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [imported, setImported] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [rows, p] = await Promise.all([fetchRoster(org.org_id), fetchOrgPeriods(org.org_id)]);
      setArtists(rows);
      setPeriods(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  // Выбранный месяц у артиста: общая цифра, если есть, иначе сумма по площадкам
  const monthOf = (artistId: string) => {
    const rows = periods.filter((p) => p.artist_id === artistId && p.month === month);
    if (rows.length === 0) return null;
    const all = rows.find((r) => r.source === ALL_SOURCES);
    const bySource = rows.filter((r) => r.source !== ALL_SOURCES);
    return {
      streams: all ? all.streams : bySource.reduce((t, r) => t + r.streams, 0),
      listeners: all ? all.listeners : bySource.reduce((t, r) => t + r.listeners, 0),
      split: bySource.length > 0 && !all,
    };
  };
  const loadedMonths = (artistId: string) =>
    [...new Set(periods.filter((p) => p.artist_id === artistId).map((p) => p.month))].sort().slice(-4);

  const draftOf = (id: string) => drafts[id] ?? { streams: "", listeners: "" };

  const save = async (artistId: string) => {
    const d = draftOf(artistId);
    const cur = monthOf(artistId);
    // Пустое поле означает «не менять», а не «обнулить»
    const streams = d.streams === "" ? cur?.streams ?? 0 : toInt(d.streams);
    const listeners = d.listeners === "" ? cur?.listeners ?? 0 : toInt(d.listeners);
    if (Number.isNaN(streams) || Number.isNaN(listeners)) return;
    if (d.streams === "" && d.listeners === "") return;
    setBusy(artistId);
    setError(null);
    try {
      await upsertPeriods(org.org_id, [{ artistId, month, source: ALL_SOURCES, streams, listeners }]);
      setDrafts((x) => {
        const next = { ...x };
        delete next[artistId];
        return next;
      });
      await load();
      setSaved(artistId);
      setTimeout(() => setSaved((c) => (c === artistId ? null : c)), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  };

  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv, artists) : []), [csv, artists]);
  const good = parsed.filter((r) => r.input);
  const bad = parsed.filter((r) => r.error);

  const runImport = async () => {
    if (good.length === 0) return;
    setBusy("csv");
    setError(null);
    try {
      await upsertPeriods(org.org_id, good.map((r) => r.input!));
      setImported(good.length);
      setCsv("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Импорт не удался");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (f: File | null) => {
    if (!f) return;
    setImported(null);
    setCsv(await f.text());
  };

  const monthOptions = Array.from({ length: 18 }, (_, i) => addMonths(previousMonth(), 1 - i));

  return (
    <LabelShell
      org={org}
      title="Загрузка данных"
      subtitle="Стримы и слушатели по месяцам — из них строятся динамика, рейтинг и цифры в кабинете артиста"
      actions={
        <label className="flex items-center gap-2 text-[13px] text-[#6E6D73] dark:text-[#9A98A0]">
          Месяц
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setDrafts({});
            }}
            className="text-[13px] rounded-full border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] text-[#17161A] dark:text-[#F5F4F2] px-[14px] py-[7px] outline-none cursor-pointer"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {fmtMonth(m, "long")}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {/* Импорт отчёта площадки */}
      <section className={`${panelCls} p-4 mb-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2]">
            <FileSpreadsheet className="w-4 h-4" strokeWidth={1.75} />
            Импорт из таблицы
          </h2>
          <label className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[12px] py-[6px] rounded-full transition cursor-pointer">
            <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
            Выбрать CSV
            <input type="file" accept=".csv,.txt,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-2">
          Колонки: артист; месяц; площадка; стримы; слушатели. Площадку можно оставить пустой — тогда цифра считается общей.
          Повторная загрузка того же месяца и площадки заменяет цифры.
        </p>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setImported(null);
          }}
          rows={csv ? 5 : 3}
          placeholder={SAMPLE}
          spellCheck={false}
          className={`${inputCls} font-mono text-[12.5px] resize-y`}
        />

        {parsed.length > 0 && (
          <div className="mt-3 text-[12.5px]">
            <div className="text-[#17161A] dark:text-[#F5F4F2]">
              Готово к импорту: {good.length} {bad.length > 0 && <span className="text-[#6E6D73]">· с ошибками: {bad.length}</span>}
            </div>
            {bad.slice(0, 5).map((r) => (
              <div key={r.line} className="flex items-start gap-1.5 text-[#6E6D73] dark:text-[#9A98A0] mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
                <span>
                  Строка {r.line}: {r.error}
                </span>
              </div>
            ))}
            <button
              onClick={runImport}
              disabled={busy !== null || good.length === 0}
              className="mt-3 inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
            >
              {busy === "csv" && <Loader2 className="w-4 h-4 animate-spin" />}
              Импортировать {rows(good.length)}
            </button>
          </div>
        )}
        {imported !== null && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-[#166B49] dark:text-[#5FCB9B]">
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Загружено: {rows(imported)}
          </div>
        )}
      </section>

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : artists.length === 0 ? (
        <div className={`${panelCls} py-12 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}>
          В ростере пока нет артистов
        </div>
      ) : (
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
          {artists.map((a) => {
            const cur = monthOf(a.id);
            const d = draftOf(a.id);
            const rowBusy = busy === a.id;
            const loaded = loadedMonths(a.id);
            return (
              <div key={a.id} className={`${panelCls} p-4`}>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-full bg-[#17161A] dark:bg-[#242327] text-white dark:text-[#F5F4F2] flex items-center justify-center text-[11.5px] font-semibold shrink-0">
                    {a.stage_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-[14.5px] font-semibold text-[#17161A] dark:text-[#F5F4F2] truncate">{a.stage_name}</div>
                </div>

                <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mb-3 truncate">
                  {cur
                    ? `${fmtMonth(month, "long")}: ${cur.streams.toLocaleString("ru-RU")} стримов · ${cur.listeners.toLocaleString("ru-RU")} слуш.${cur.split ? " (по площадкам)" : ""}`
                    : loaded.length
                      ? `Загружены: ${loaded.map((m) => fmtMonth(m)).join(", ")}`
                      : "Данных ещё нет"}
                </div>

                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <label className="block">
                    <span className="flex items-center gap-1 text-[11.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-[4px]">
                      <TrendingUp className="w-3 h-3 text-[#A6A5AB]" />
                      Стримы за месяц
                    </span>
                    <input
                      inputMode="numeric"
                      placeholder={cur ? String(cur.streams) : "0"}
                      value={d.streams}
                      disabled={cur?.split}
                      onChange={(e) => setDrafts((x) => ({ ...x, [a.id]: { ...draftOf(a.id), streams: e.target.value } }))}
                      onKeyDown={(e) => e.key === "Enter" && save(a.id)}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="flex items-center gap-1 text-[11.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-[4px]">
                      <Users className="w-3 h-3 text-[#A6A5AB]" />
                      Слушатели за месяц
                    </span>
                    <input
                      inputMode="numeric"
                      placeholder={cur ? String(cur.listeners) : "0"}
                      value={d.listeners}
                      disabled={cur?.split}
                      onChange={(e) => setDrafts((x) => ({ ...x, [a.id]: { ...draftOf(a.id), listeners: e.target.value } }))}
                      onKeyDown={(e) => e.key === "Enter" && save(a.id)}
                      className={inputCls}
                    />
                  </label>
                </div>

                {cur?.split ? (
                  <p className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                    За этот месяц цифры загружены по площадкам — правьте их повторным импортом.
                  </p>
                ) : (
                  <button
                    onClick={() => save(a.id)}
                    disabled={rowBusy || (d.streams === "" && d.listeners === "")}
                    className="w-full inline-flex items-center justify-center gap-[6px] text-[12.5px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[12px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {rowBusy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    ) : saved === a.id ? (
                      <>
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        Сохранено
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
                        Сохранить за {fmtMonth(month)}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LabelShell>
  );
}

export default function DataUploadPage() {
  return <LabelGate>{({ org }) => <DataUploadInner org={org} />}</LabelGate>;
}
