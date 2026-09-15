"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  ArrowRight,
  X,
  Trash2,
  Loader2,
  Disc3,
  CalendarDays,
} from "lucide-react";
import {
  listReleases,
  deleteRelease,
  releaseStatusLabels,
  type ReleaseView,
  type ReleaseStatus,
} from "@/lib/supabase/cabinet";

interface ReleaseCarouselProps {
  refreshKey?: number;
}

export function formatPlannedDate(d: string | null): string | null {
  if (!d) return null;
  return new Date(`${d}T00:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const statusHint: Record<ReleaseStatus, string> = {
  draft: "Черновик — заполните данные и отправьте менеджеру",
  pending_approval: "Ждёт решения менеджера",
  approved: "Принят — готовим материалы",
  in_progress: "В работе у лейбла",
  released: "Вышел на площадках",
  rejected: "Отклонён — причину уточните в чате",
};

/** Этапы, которые проходит релиз. «Принят» и «в работе» — один этап для артиста. */
const STAGES = ["Согласование", "Модерация", "В работе", "Вышел"] as const;

/**
 * Индекс текущего этапа. Отклонённый релиз остаётся на согласовании;
 * принятый стоит на модерации, пока лейбл её не проведёт.
 */
function stageOf(r: ReleaseView): number {
  switch (r.status) {
    case "draft":
    case "pending_approval":
    case "rejected":
      return 0;
    case "approved":
      return r.moderation_status === "passed" ? 2 : 1;
    case "in_progress":
      return 2;
    case "released":
      return 3;
  }
}

export default function ReleaseCarousel({ refreshKey = 0 }: ReleaseCarouselProps) {
  const [releases, setReleases] = useState<ReleaseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setReleases(await listReleases());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const safeIndex = Math.max(0, Math.min(index, releases.length - 1));
  const release = releases[safeIndex];

  const go = (delta: number) => {
    const next = safeIndex + delta;
    if (next < 0 || next >= releases.length) return;
    setDir(delta);
    setIndex(next);
  };

  const remove = async () => {
    if (!release) return;
    setConfirmOpen(false);
    try {
      await deleteRelease(release);
    } finally {
      setIndex((i) => Math.max(0, i - 1));
      load();
    }
  };

  if (loading) {
    return (
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 mb-4 flex items-center gap-3 text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        <span className="text-[13px] font-mono">Загружаем релизы…</span>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[15px] font-semibold text-[#17161A]">Релизы</div>
        </div>
        <p className="text-[13px] text-[#6E6D73]">
          Релизов пока нет. Добавьте первый — аудио, обложку и данные об авторах.
        </p>
      </div>
    );
  }

  const isReleased = release.status === "released";
  const badge = releaseStatusLabels[release.status] ?? {
    label: release.status,
    cls: "bg-[#F0EEEA] text-[#6E6D73]",
  };
  const planned = formatPlannedDate(release.planned_date);

  return (
    <div className="relative bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 mb-4 overflow-hidden">
      {/* Заголовок секции + навигация */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b-[0.5px] border-[#ECEAE5]">
        <div className="flex items-center gap-2">
          <Disc3 className="w-[18px] h-[18px] text-[#17161A]" strokeWidth={2} />
          <div className="text-[15px] font-semibold text-[#17161A] tracking-tight">
            {releases.length === 1 ? "Текущий релиз" : `Релиз · ${safeIndex + 1} из ${releases.length}`}
          </div>
        </div>
        {releases.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => go(-1)}
              disabled={safeIndex === 0}
              aria-label="Предыдущий релиз"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
            <button
              onClick={() => go(1)}
              disabled={safeIndex === releases.length - 1}
              aria-label="Следующие релизы"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={release.id}
          initial={{ opacity: 0, x: dir * 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -20 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {/* Обложка + метаданные */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-[76px] h-[76px] rounded-[12px] overflow-hidden border border-[#ECEAE5] shrink-0 bg-[#141316] flex items-center justify-center shadow-xs">
              {release.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.coverUrl}
                  alt={`Обложка релиза ${release.title}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3 className="w-8 h-8 text-white/50" strokeWidth={1.5} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[17px] font-semibold tracking-tight text-[#17161A]">{release.title}</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                    isReleased
                      ? "bg-[#E9F6EF] text-[#166B49] border border-[#BDE8D3]"
                      : badge.cls
                  }`}
                >
                  {isReleased && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1F9D6B] animate-pulse" />
                  )}
                  {badge.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px] text-[#6E6D73] font-mono">
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {planned ?? "Дата не назначена"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Удалить релиз"
              title="Удалить релиз"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#17161A] hover:bg-[#F0EEEA] transition shrink-0 self-start cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Прогресс по этапам: где релиз сейчас и что дальше */}
          <div className="mb-4">
            <div className="grid grid-cols-4 gap-1.5">
              {STAGES.map((label, i) => {
                const current = stageOf(release);
                const rejected =
                  (release.status === "rejected" && i === 0) ||
                  (release.moderation_status === "needs_changes" && i === 1);
                return (
                  <div key={label} className="min-w-0">
                    <div
                      className={`h-1.5 rounded-full ${
                        rejected
                          ? "bg-[#A6A5AB]"
                          : i <= current
                            ? "bg-[#17161A]"
                            : "bg-[#ECEAE5]"
                      }`}
                    />
                    <div
                      className={`text-[11px] mt-1.5 truncate ${
                        i === current ? "text-[#17161A] font-medium" : "text-[#A6A5AB]"
                      }`}
                    >
                      {label}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[12.5px] text-[#6E6D73] mt-2">
              {release.moderation_status === "needs_changes" && release.status !== "rejected"
                ? "Модерация просит правки — откройте релиз"
                : release.status === "approved" && release.moderation_status !== "passed"
                  ? "Принят — лейбл проверяет трек перед отгрузкой"
                  : statusHint[release.status]}
            </p>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href={`/releases/${release.id}`}
              className={`inline-flex items-center gap-2 font-medium text-[13px] rounded-full transition cursor-pointer ${
                isReleased
                  ? "bg-[#17161A] text-white px-5 py-2 hover:bg-[#2A282E]"
                  : "bg-[#17161A] text-white px-5 py-2 hover:bg-[#2A282E]"
              }`}
            >
              {isReleased ? (
                <>
                  <BarChart3 className="w-4 h-4" strokeWidth={2} />
                  Смотреть данные
                </>
              ) : (
                <>
                  Открыть релиз
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </>
              )}
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Индикаторы */}
      {releases.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {releases.map((r, i) => (
            <button
              key={r.id}
              onClick={() => {
                setDir(i > safeIndex ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Релиз ${r.title}`}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === safeIndex ? "w-6 bg-[#17161A]" : "w-1.5 bg-[#D2D0CB] hover:bg-[#A6A5AB]"
              }`}
            />
          ))}
        </div>
      )}

      {/* Подтверждение удаления */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 backdrop-blur-xs p-5"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="w-full max-w-[360px] rounded-[16px] border border-[#ECEAE5] bg-white shadow-xl p-5 text-center"
            >
              <span className="w-10 h-10 rounded-full bg-[#F0EEEA] text-[#17161A] flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <div className="text-[15px] font-semibold text-[#17161A]">Удалить релиз?</div>
              <div className="text-[13px] text-[#6E6D73] mt-1">
                «{release.title}» будет удалён без возможности восстановления.
              </div>
              <div className="flex items-center gap-2 mt-5">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 text-[13px] font-medium text-[#17161A] px-4 py-2 rounded-full border border-[#E5E3DE] hover:bg-[#FAFAF9] transition cursor-pointer"
                >
                  Отмена
                </button>
                <button
                  onClick={remove}
                  className="flex-1 text-[13px] font-medium text-white bg-[#17161A] px-4 py-2 rounded-full hover:bg-[#2A282E] transition cursor-pointer"
                >
                  Да, удалить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
