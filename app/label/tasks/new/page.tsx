"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell from "@/components/label/LabelShell";
import {
  fetchRoster,
  fetchReleases,
  createTask,
  type MyOrg,
  type RosterArtist,
  type ReleaseRow,
} from "@/lib/supabase/label";

const inputCls =
  "w-full text-[13.5px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";
const labelCls = "block text-[12px] font-medium text-[#6E6D73] dark:text-[#9A98A0] mb-[6px]";

function NewTaskInner({ org }: { org: MyOrg }) {
  const router = useRouter();
  const params = useSearchParams();

  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [releases, setReleases] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [artistId, setArtistId] = useState(params.get("artist") ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [releaseId, setReleaseId] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchRoster(org.org_id)
      .then((r) => {
        setArtists(r);
        setArtistId((cur) => cur || r[0]?.id || "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить ростер"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  // Релизы подтягиваем под выбранного артиста — задача может быть к релизу.
  const loadReleases = useCallback(async () => {
    if (!artistId) return setReleases([]);
    try {
      setReleases(await fetchReleases(org.org_id, artistId));
    } catch {
      setReleases([]);
    }
  }, [artistId, org.org_id]);

  useEffect(() => {
    loadReleases();
    setReleaseId("");
  }, [loadReleases]);

  const canSubmit = artistId && title.trim().length > 0 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await createTask({
        orgId: org.org_id,
        artistId,
        title,
        description,
        dueDate: dueDate || null,
        releaseId: releaseId || null,
      });
      setDone(true);
      setTimeout(() => router.push(`/label/artists/${artistId}`), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать задачу");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LabelShell
      org={org}
      title="Новая задача"
      subtitle="Задача появится в кабинете артиста и уйдёт ему уведомлением"
    >
      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : done ? (
        <div className="max-w-[520px] bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-5 text-center">
          <span className="w-10 h-10 rounded-full bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B] flex items-center justify-center mx-auto mb-2">
            <Check className="w-5 h-5" strokeWidth={2.5} />
          </span>
          <div className="text-[14px] font-semibold">Задача поставлена</div>
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-[520px] bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4 space-y-4">
          <label className="block">
            <span className={labelCls}>Артист</span>
            <select
              value={artistId}
              onChange={(e) => setArtistId(e.target.value)}
              className={`${inputCls} cursor-pointer`}
            >
              {artists.length === 0 && <option value="">В ростере нет артистов</option>}
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.stage_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={labelCls}>Задача</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Загрузить финальный мастер"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Описание</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Что именно нужно сделать"
              className={`${inputCls} resize-none leading-[1.5]`}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Дедлайн</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className={labelCls}>Релиз</span>
              <select
                value={releaseId}
                onChange={(e) => setReleaseId(e.target.value)}
                className={`${inputCls} cursor-pointer`}
              >
                <option value="">Без привязки</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 text-[13.5px] font-medium bg-[#17161A] text-white px-[14px] py-[8px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />}
            Поставить задачу
          </button>
        </form>
      )}
    </LabelShell>
  );
}

export default function NewTaskPage() {
  return (
    <LabelGate>
      {({ org }) => (
        // useSearchParams требует Suspense-границы при пререндере.
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
              <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
            </div>
          }
        >
          <NewTaskInner org={org} />
        </Suspense>
      )}
    </LabelGate>
  );
}
