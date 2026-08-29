"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Check,
  X,
  Disc3,
  Calendar,
  Clock,
  CheckCircle2,
  FileAudio,
  Radio,
  FileEdit,
  Sparkles,
  FileText,
} from "lucide-react";
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

const PIPELINE_STEPS = [
  { key: "draft", label: "Черновик", icon: FileEdit },
  { key: "pending_master", label: "Мастер", icon: FileAudio },
  { key: "approved", label: "Утверждён", icon: CheckCircle2 },
  { key: "released", label: "Выпущен", icon: Radio },
];

function getStepIndex(status: string) {
  switch (status) {
    case "draft":
      return 0;
    case "pending_master":
      return 1;
    case "approved":
      return 2;
    case "released":
      return 3;
    case "rejected":
      return 1; // отклонен на этапе проверки
    default:
      return 0;
  }
}

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
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      </LabelShell>
    );
  }

  if (!release) {
    return (
      <LabelShell org={org} title="Релиз не найден">
        <Link href="/label/roster" className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] hover:opacity-80">
          ← К ростеру
        </Link>
      </LabelShell>
    );
  }

  const s = releaseStatusLabels[release.status] ?? {
    label: release.status,
    cls: "bg-[#F0EEEA] dark:bg-[#232227] text-[#6E6D73] dark:text-[#9A98A0]",
  };
  const decided = release.status === "approved" || release.status === "rejected";
  const currentStep = getStepIndex(release.status);

  return (
    <LabelShell
      org={org}
      title={release.title}
      subtitle={artist ? `Артист: ${artist.stage_name}` : undefined}
    >
      {error && (
        <div className="text-[13px] text-[#17161A] dark:text-[#F5F4F2] bg-[#F0EEEA] dark:bg-[#242327] border-[0.5px] border-[#D2D0CB] dark:border-[#33323A] rounded-[12px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {/* Инфографический степпер пайплайна релиза */}
      <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4 mb-5">
        <div className="flex items-center justify-between text-[12px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] mb-3">
          <span className="flex items-center gap-1.5">
            <Disc3 className="w-3.5 h-3.5" />
            Этапы производства
          </span>
          <span className="text-[11px] font-normal normal-case text-[#A6A5AB] dark:text-[#6E6D73]">
            {release.status === "rejected" ? "Отклонён на доработку" : `Шаг ${currentStep + 1} из 4`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2 relative">
          {PIPELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = idx < currentStep || (idx === currentStep && release.status === "released");
            const isCurrent = idx === currentStep && release.status !== "released";
            const isRejected = release.status === "rejected" && idx === 1;

            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 transition ${
                    isRejected
                      ? "bg-[#FDF0EE] dark:bg-[#341B1A] text-[#E23A34] dark:text-[#F87171] ring-1 ring-[#E23A34]"
                      : isCompleted
                      ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                      : isCurrent
                      ? "bg-[#17161A] dark:bg-[#F5F4F2] text-white dark:text-[#17161A] shadow-xs"
                      : "bg-[#F0EEEA] dark:bg-[#242327] text-[#A6A5AB] dark:text-[#6E6D73]"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                  )}
                </div>
                <span
                  className={`text-[11px] leading-tight ${
                    isCurrent || isCompleted
                      ? "font-semibold text-[#17161A] dark:text-[#F5F4F2]"
                      : "text-[#A6A5AB] dark:text-[#6E6D73]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-5">
        {/* Стратегия */}
        <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Стратегия и промо-план
            </h2>
            <button
              onClick={save}
              disabled={busy !== null}
              className="inline-flex items-center gap-[6px] text-[12.5px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#E5E3DE] dark:border-[#33323A] px-[11px] py-[6px] rounded-full hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition disabled:opacity-40"
            >
              {busy === "save" && <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />}
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Сохранено
                </>
              ) : (
                "Сохранить"
              )}
            </button>
          </div>
          <textarea
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
            rows={10}
            placeholder="План продвижения, площадки, даты, бюджет…"
            className="w-full resize-y text-[13.5px] leading-[1.55] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[10px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
          />
        </div>

        {/* Решение и Метаданные */}
        <aside className="space-y-4 xl:sticky xl:top-[76px] self-start">
          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4">
            <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] mb-3">
              Статус и даты
            </h2>
            <Badge label={s.label} cls={s.cls} dot />

            <dl className="mt-4 space-y-[10px] text-[12.5px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#A6A5AB] dark:text-[#6E6D73] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Плановая дата
                </dt>
                <dd className="text-[#17161A] dark:text-[#F5F4F2] font-medium">
                  {formatDate(release.planned_date)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#A6A5AB] dark:text-[#6E6D73] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Создан
                </dt>
                <dd className="text-[#17161A] dark:text-[#F5F4F2]">{formatDate(release.created_at)}</dd>
              </div>
              {release.approved_at && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[#A6A5AB] dark:text-[#6E6D73] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D6B]" />
                    Решение принято
                  </dt>
                  <dd className="text-[#17161A] dark:text-[#F5F4F2] font-medium">
                    {formatDate(release.approved_at)}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[12px] p-4">
            <h2 className="text-[12.5px] font-semibold text-[#6E6D73] dark:text-[#9A98A0] uppercase tracking-[0.05em] mb-3">
              Решение лейбла
            </h2>

            {decided && (
              <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-3">
                Релиз {release.status === "approved" ? "утверждён" : "отклонён"}. Вы можете изменить
                статус при необходимости:
              </p>
            )}

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Комментарий при отклонении (что исправить)…"
              className="w-full resize-none text-[13px] rounded-[12px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8] mb-3"
            />

            <div className="flex flex-col gap-2">
              <button
                onClick={() => decide("approved")}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 text-[13px] font-medium bg-[#1F9D6B] text-white px-[14px] py-[8px] rounded-full hover:brightness-95 transition disabled:opacity-40"
              >
                {busy === "approve" ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                )}
                Утвердить релиз
              </button>
              <button
                onClick={() => decide("rejected")}
                disabled={busy !== null}
                className="inline-flex items-center justify-center gap-2 text-[13px] font-medium text-[#17161A] dark:text-[#F5F4F2] border border-[#D2D0CB] dark:border-[#33323A] bg-[#F0EEEA] dark:bg-[#242327] px-[14px] py-[8px] rounded-full hover:brightness-95 transition disabled:opacity-40"
              >
                {busy === "reject" ? (
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                ) : (
                  <X className="w-4 h-4" strokeWidth={2.5} />
                )}
                Отклонить на доработку
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
