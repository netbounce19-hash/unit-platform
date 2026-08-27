"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, UploadCloud } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import {
  fetchOrgStreamStats,
  saveStreamStat,
  type StreamStat,
} from "@/lib/supabase/streamStats";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[7px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

function DataUploadInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [stats, setStats] = useState<Map<string, StreamStat>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { streams: string; listeners: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [rows, s] = await Promise.all([
        fetchRoster(org.org_id),
        fetchOrgStreamStats(org.org_id),
      ]);
      setArtists(rows);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [org.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const draftOf = (id: string) => drafts[id] ?? { streams: "", listeners: "" };

  const save = async (artistId: string) => {
    const d = draftOf(artistId);
    const cur = stats.get(artistId);
    // Пустое поле означает «не менять», а не «обнулить»
    const streams = d.streams === "" ? cur?.streams ?? 0 : Number(d.streams);
    const listeners = d.listeners === "" ? cur?.listeners ?? 0 : Number(d.listeners);
    if (!Number.isFinite(streams) || !Number.isFinite(listeners)) return;
    if (d.streams === "" && d.listeners === "") return;

    setBusy(artistId);
    setError(null);
    try {
      const row = await saveStreamStat({ artistId, orgId: org.org_id, streams, listeners });
      setStats((m) => new Map(m).set(artistId, row));
      setDrafts((x) => {
        const next = { ...x };
        delete next[artistId];
        return next;
      });
      setSaved(artistId);
      setTimeout(() => setSaved((c) => (c === artistId ? null : c)), 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setBusy(null);
    }
  };

  return (
    <LabelShell
      org={org}
      title="Загрузка данных"
      subtitle="Стримы и слушатели по каждому артисту — цифры видит артист в своём кабинете"
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : artists.length === 0 ? (
        <div className={`${panelCls} py-12 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}>
          В ростере пока нет артистов
        </div>
      ) : (
        <div className="space-y-2">
          {artists.map((a) => {
            const cur = stats.get(a.id);
            const d = draftOf(a.id);
            const rowBusy = busy === a.id;
            return (
              <div key={a.id} className={`${panelCls} px-4 py-[13px]`}>
                <div className="text-[14px] font-medium text-[#17161A] dark:text-[#F5F4F2]">
                  {a.stage_name}
                </div>
                <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mb-3">
                  {cur
                    ? `Сейчас: ${cur.streams.toLocaleString("ru-RU")} стримов · ${cur.listeners.toLocaleString("ru-RU")} слушателей · обновлено ${new Date(cur.updated_at).toLocaleDateString("ru-RU")}`
                    : "Данных ещё нет"}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <label className="block">
                    <span className="block text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mb-[4px]">
                      Стримы
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder={cur ? String(cur.streams) : "0"}
                      value={d.streams}
                      onChange={(e) =>
                        setDrafts((x) => ({ ...x, [a.id]: { ...draftOf(a.id), streams: e.target.value } }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && save(a.id)}
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] mb-[4px]">
                      Слушатели в месяц
                    </span>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder={cur ? String(cur.listeners) : "0"}
                      value={d.listeners}
                      onChange={(e) =>
                        setDrafts((x) => ({ ...x, [a.id]: { ...draftOf(a.id), listeners: e.target.value } }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && save(a.id)}
                      className={inputCls}
                    />
                  </label>
                </div>

                <button
                  onClick={() => save(a.id)}
                  disabled={rowBusy || (d.streams === "" && d.listeners === "")}
                  className="w-full inline-flex items-center justify-center gap-[6px] text-[12.5px] font-medium bg-[#17161A] text-white px-[12px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rowBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  ) : saved === a.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Готово
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" strokeWidth={1.75} />
                      Сохранить
                    </>
                  )}
                </button>
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
