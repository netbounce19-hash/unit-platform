"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Check, X } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { Badge } from "@/components/label/LabelShell";
import {
  fetchRelease,
  fetchArtist,
  decideRelease,
  saveReleaseStrategy,
  releaseStatusLabels,
  formatDate,
  type MyOrg,
  type ReleaseRow,
  type ArtistRow,
} from "@/lib/supabase/label";

function ReleaseInner({ org, releaseId }: { org: MyOrg; releaseId: string }) {
  const [release, setRelease] = useState<ReleaseRow | null>(null);
  const [artist, setArtist] = useState<ArtistRow | null>(null);
  const [strategy, setStrategy] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"approve" | "reject" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetchRelease(releaseId);
      setRelease(r);
      setStrategy(r?.strategy ?? "");
      if (r?.artist_id) setArtist(await fetchArtist(r.artist_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить релиз");
    } finally {
      setLoading(false);
    }
  }, [releaseId]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    try {
      // Комментарий решения храним в стратегии — отдельного поля у релиза нет.
      const nextStrategy =
        decision === "rejected" && comment.trim()
          ? `${strategy}\n\n— Отклонено: ${comment.trim()}`.trim()
          : strategy;
      await decideRelease(releaseId, decision, nextStrategy);
      setComment("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить решение");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setError(null);
    try {
      await saveReleaseStrategy(releaseId, strategy);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить стратегию");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <LabelShell org={org} title="Релиз">
        <div className="py-12 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      </LabelShell>
    );
  }

  if (!release) {
    return (
      <LabelShell org={org} title="Релиз не найден">
        <Link href="/label/roster" className="text-[13px] text-[#E23A34] hover:opacity-80">
          ← К ростеру
        </Link>
      </LabelShell>
    );
  }

  const s = releaseStatusLabels[release.status] ?? {
    label: release.status,
    cls: "bg-[#F0EEEA] text-[#6E6D73]",
  };
  const decided = release.status === "approved" || release.status === "rejected";

  return (
    <LabelShell
      org={org}
      title={release.title}
      subtitle={artist ? artist.stage_name : undefined}
      actions={
        <Link
          href={artist ? `/label/artists/${artist.id}` : "/label/roster"}
          className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#6E6D73] px-[12px] py-[8px] rounded-[9px] hover:bg-[#F0EEEA] transition"
        >
          <ArrowLeft className="w-[15px] h-[15px]" strokeWidth={1.75} />
          Назад
        </Link>
      }
    >
      {error && (
        <div className="text-[13px] text-[#A62018] bg-[#FDEDEB] border-[0.5px] border-[#F3C9C6] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5">
        {/* Стратегия */}
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-[#6E6D73] uppercase tracking-[0.04em]">
              Стратегия релиза
            </h2>
            <button
              onClick={save}
              disabled={busy !== null}
              className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[#17161A] border border-[#E5E3DE] px-[11px] py-[6px] rounded-[8px] hover:bg-[#F0EEEA] transition disabled:opacity-40"
            >
              {busy === "save" && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />}
              {saved ? "Сохранено" : "Сохранить"}
            </button>
          </div>
          <textarea
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            rows={12}
            placeholder="План продвижения, площадки, даты, бюджет…"
            className="w-full resize-y text-[13.5px] leading-[1.55] rounded-[10px] border border-[#E5E3DE] bg-white px-3 py-[10px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
          />
        </div>

        {/* Решение */}
        <aside className="space-y-4 xl:sticky xl:top-[76px] self-start">
          <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4">
            <h2 className="text-[13px] font-semibold text-[#6E6D73] uppercase tracking-[0.04em] mb-3">
              Статус
            </h2>
            <Badge label={s.label} cls={s.cls} />

            <dl className="mt-4 space-y-[10px] text-[12.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-[#A6A5AB]">Плановая дата</dt>
                <dd className="text-[#17161A]">{formatDate(release.planned_date)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#A6A5AB]">Создан</dt>
                <dd className="text-[#17161A]">{formatDate(release.created_at)}</dd>
              </div>
              {release.approved_at && (
                <div className="flex justify-between gap-3">
                  <dt className="text-[#A6A5AB]">Решение</dt>
                  <dd className="text-[#17161A]">{formatDate(release.approved_at)}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] p-4">
            <h2 className="text-[13px] font-semibold text-[#6E6D73] uppercase tracking-[0.04em] mb-3">
              Решение
            </h2>

            {decided && (
              <p className="text-[12.5px] text-[#6E6D73] mb-3">
                Релиз уже {release.status === "approved" ? "утверждён" : "отклонён"}. Решение можно
                изменить.
              </p>
            )}

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Комментарий при отклонении"
              className="w-full resize-none text-[13px] rounded-[9px] border border-[#E5E3DE] bg-white px-3 py-[8px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8] mb-3"
            />

            <div className="flex flex-col gap-2">
              <button
                onClick={() => decide("approved")}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#1F9D6B] text-white px-[14px] py-[9px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
              >
                {busy === "approve" ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                )}
                Утвердить
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#A62018] border border-[#F3C9C6] bg-[#FDEDEB] px-[14px] py-[9px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
              >
                {busy === "reject" ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <X className="w-4 h-4" strokeWidth={2.5} />
                )}
                Отклонить
              </button>
            </div>
          </div>
        </aside>
      </div>
    </LabelShell>
  );
}

export default function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LabelGate>{({ org }) => <ReleaseInner org={org} releaseId={id} />}</LabelGate>;
}
