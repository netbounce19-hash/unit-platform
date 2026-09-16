"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/label/LabelShell";
import { formatDate } from "@/lib/supabase/label";
import {
  PITCH_CLS,
  PITCH_STATUSES,
  PITCH_TARGETS,
  createPitch,
  deletePitch,
  fetchPitches,
  pitchLabel,
  updatePitch,
  type Pitch,
  type PitchStatus,
} from "@/lib/supabase/promo";

const inputCls =
  "w-full text-[13px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Питчинг релиза: куда отправили, в каком статусе и что вышло. Артист видит
 * всё, кроме черновиков, контактов и заметок.
 */
export default function PitchPanel({ orgId, releaseId }: { orgId: string; releaseId: string }) {
  const [rows, setRows] = useState<Pitch[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ target: "", curator: "", contact: "", notes: "" });

  const load = useCallback(async () => {
    try {
      setRows(await fetchPitches(orgId, releaseId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить питчинг");
      setRows([]);
    }
  }, [orgId, releaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(null);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.target.trim()) return;
    run("add", async () => {
      await createPitch(orgId, releaseId, { ...draft, status: "draft" });
      setDraft({ target: "", curator: "", contact: "", notes: "" });
      setAdding(false);
    });
  };

  const setStatus = (p: Pitch, status: PitchStatus) =>
    run(p.id, () =>
      updatePitch(p.id, {
        status,
        // отправку датируем сами — это главное, что спросит артист
        sent_on: status !== "draft" && !p.sent_on ? today() : p.sent_on,
      })
    );

  const placed = (rows ?? []).filter((p) => p.status === "placed");

  return (
    <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" />
          Питчинг
          {placed.length > 0 && (
            <span className="normal-case tracking-normal font-medium text-[#166B49] dark:text-[#5FCB9B]">· попали в {placed.length}</span>
          )}
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] hover:border-[#D2D0CB] px-[11px] py-[5px] rounded-full transition"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
          Куда питчим
        </button>
      </div>

      {error && <div className="text-[12.5px] bg-[#F0EEEA] dark:bg-[#242327] rounded-[12px] px-3 py-2 mb-3">{error}</div>}

      {adding && (
        <form onSubmit={add} className="space-y-2 mb-3 rounded-[12px] bg-[#FAFAF9] dark:bg-[#232227] p-3">
          <datalist id="pitch-targets">
            {PITCH_TARGETS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <input list="pitch-targets" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} placeholder="Куда: редакция площадки или плейлист *" maxLength={80} className={inputCls} />
          <input value={draft.curator} onChange={(e) => setDraft({ ...draft, curator: e.target.value })} placeholder="Плейлист или куратор (видит артист)" maxLength={160} className={inputCls} />
          <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="Контакт — только для команды" maxLength={200} className={inputCls} />
          <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} placeholder="Заметки — только для команды" maxLength={2000} className={`${inputCls} resize-none`} />
          <button
            type="submit"
            disabled={busy !== null || !draft.target.trim()}
            className="inline-flex items-center gap-2 text-[12.5px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[14px] py-[7px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy === "add" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Добавить
          </button>
        </form>
      )}

      {rows === null ? (
        <div className="py-4 flex justify-center text-[#A6A5AB]">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[12.5px] text-[#A6A5AB] dark:text-[#6E6D73]">Ещё никуда не отправляли. Добавьте редакции и плейлисты, в которые питчите релиз.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const expanded = open === p.id;
            return (
              <div key={p.id} className="rounded-[12px] border-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                <button onClick={() => setOpen(expanded ? null : p.id)} className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">{p.target}</span>
                    <span className="block text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73] truncate">
                      {[p.curator, p.sent_on ? `отправлен ${formatDate(p.sent_on)}` : null, p.result].filter(Boolean).join(" · ") || "подробности — по нажатию"}
                    </span>
                  </span>
                  <Badge label={pitchLabel(p.status)} cls={PITCH_CLS[p.status]} />
                </button>

                {expanded && (
                  <PitchEditor
                    pitch={p}
                    busy={busy === p.id}
                    onStatus={(s) => setStatus(p, s)}
                    onSave={(patch) => run(p.id, () => updatePitch(p.id, patch))}
                    onDelete={() => run(p.id, () => deletePitch(p.id))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PitchEditor({
  pitch,
  busy,
  onStatus,
  onSave,
  onDelete,
}: {
  pitch: Pitch;
  busy: boolean;
  onStatus: (s: PitchStatus) => void;
  onSave: (patch: Partial<Pitch>) => void;
  onDelete: () => void;
}) {
  const [f, setF] = useState({
    curator: pitch.curator ?? "",
    contact: pitch.contact ?? "",
    sent_on: pitch.sent_on ?? "",
    result: pitch.result ?? "",
    result_url: pitch.result_url ?? "",
    reach: pitch.reach !== null ? String(pitch.reach) : "",
    notes: pitch.notes ?? "",
  });
  const reach = Number(f.reach.replace(/\s/g, ""));

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="flex flex-wrap gap-1">
        {PITCH_STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => onStatus(s.key)}
            disabled={busy}
            aria-pressed={pitch.status === s.key}
            className={`text-[11.5px] font-medium px-[9px] py-[4px] rounded-full border transition ${
              pitch.status === s.key
                ? "bg-[#17161A] border-[#17161A] text-white dark:bg-[#F5F4F2] dark:border-[#F5F4F2] dark:text-[#17161A]"
                : "border-[#E5E3DE] dark:border-[#33323A] text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={f.curator} onChange={(e) => setF({ ...f, curator: e.target.value })} placeholder="Плейлист / куратор" className={inputCls} />
        <input type="date" value={f.sent_on} onChange={(e) => setF({ ...f, sent_on: e.target.value })} aria-label="Дата отправки" className={inputCls} />
        <input value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })} placeholder="Результат: плейлист, позиция" className={inputCls} />
        <input inputMode="numeric" value={f.reach} onChange={(e) => setF({ ...f, reach: e.target.value })} placeholder="Охват плейлиста" className={inputCls} />
        <input value={f.result_url} onChange={(e) => setF({ ...f, result_url: e.target.value })} placeholder="Ссылка на плейлист https://…" className={`${inputCls} col-span-2`} />
        <input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} placeholder="Контакт (только команда)" className={`${inputCls} col-span-2`} />
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} placeholder="Заметки (только команда)" className={`${inputCls} col-span-2 resize-none`} />
      </div>
      {f.result_url && !/^https?:\/\//.test(f.result_url.trim()) && (
        <p className="text-[11.5px] text-[#6E6D73]">Ссылка должна начинаться с https://</p>
      )}
      <div className="flex items-center justify-between gap-2">
        {pitch.result_url ? (
          <a href={pitch.result_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#17161A] dark:text-[#F5F4F2] hover:opacity-70">
            Открыть <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          <button onClick={onDelete} disabled={busy} aria-label="Удалить питч" className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] dark:hover:text-[#F5F4F2] hover:bg-[#F0EEEA] dark:hover:bg-[#242327] transition">
            <Trash2 className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <button
            onClick={() =>
              onSave({
                curator: f.curator,
                contact: f.contact,
                sent_on: f.sent_on || null,
                result: f.result,
                result_url: /^https?:\/\//.test(f.result_url.trim()) ? f.result_url : null,
                reach: f.reach.trim() && Number.isFinite(reach) ? Math.max(0, Math.round(reach)) : null,
                notes: f.notes,
              })
            }
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] px-[12px] py-[6px] rounded-full hover:bg-[#2A282E] transition disabled:opacity-40"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
