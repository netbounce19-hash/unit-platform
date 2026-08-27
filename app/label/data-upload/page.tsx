"use client";

import { useEffect, useState } from "react";
import { Loader2, Info, Check, UploadCloud } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import { setStreams, seedStreamsIfEmpty } from "@/lib/label/mockStreams";
import { useStreams } from "@/lib/label/useStreams";

function DataUploadInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  const streamsMap = useStreams();

  useEffect(() => {
    fetchRoster(org.org_id)
      .then((rows) => {
        setArtists(rows);
        seedStreamsIfEmpty(rows.map((a) => a.id));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить ростер"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const save = (artistId: string) => {
    const raw = drafts[artistId];
    const n = Number(raw);
    if (raw === undefined || raw === "" || !Number.isFinite(n) || n < 0) return;
    setStreams(artistId, Math.round(n));
    setDrafts((d) => {
      const next = { ...d };
      delete next[artistId];
      return next;
    });
    setSaved(artistId);
    setTimeout(() => setSaved((cur) => (cur === artistId ? null : cur)), 1600);
  };

  return (
    <LabelShell org={org} title="Загрузка данных" subtitle="Свежие цифры по стримам для каждого артиста">
      <div className="flex items-start gap-2 text-[12px] text-[#8A5A16] dark:text-[#E8B65A] bg-[#FBF1DE] dark:bg-[#3A2F14] border-[0.5px] border-[#F0E2BF] dark:border-[#4A3E1E] rounded-[12px] px-3 py-[9px] mb-4">
        <Info className="w-[14px] h-[14px] shrink-0 mt-[1px]" strokeWidth={2} />
        <span className="leading-[1.5]">
          Пока это ручной ввод, который хранится только в памяти вкладки (страница обновится — данные сбросятся).
          Чтобы цифры сохранялись по-настоящему и попадали в «Статистику» на постоянной основе, нужна отдельная
          таблица в Supabase (например, artist_stream_stats) и импорт из источника стримов.
        </span>
      </div>

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
        <div className={`${panelCls} divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327]`}>
          {artists.map((a) => {
            const current = streamsMap.get(a.id)?.streams ?? 0;
            const updatedAt = streamsMap.get(a.id)?.updatedAt;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-[13px]">
                <div className="min-w-[160px] flex-1">
                  <div className="text-[13.5px] font-medium text-[#17161A] dark:text-[#F5F4F2]">{a.stage_name}</div>
                  <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                    Сейчас: {current.toLocaleString("ru-RU")}
                    {updatedAt && ` · обновлено ${new Date(updatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`}
                  </div>
                </div>

                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Новое значение"
                  value={drafts[a.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(a.id);
                  }}
                  className="w-[160px] text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[7px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
                />

                <button
                  onClick={() => save(a.id)}
                  disabled={!drafts[a.id]}
                  className="inline-flex items-center gap-[6px] text-[12.5px] font-medium bg-[#17161A] text-white px-[12px] py-[7px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saved === a.id ? (
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
