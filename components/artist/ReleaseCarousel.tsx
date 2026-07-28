"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, BarChart3, ArrowRight, X, Trash2, Loader2, Disc3 } from "lucide-react";
import { listReleases, deleteRelease, type ReleaseView } from "@/lib/supabase/cabinet";

interface ReleaseCarouselProps {
  /** меняется при создании релиза — триггерит перезагрузку из БД */
  refreshKey?: number;
}

function releaseDate(r: ReleaseView) {
  if (r.release_date) return r.release_date;
  const d = new Date(r.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  return `Создан ${d}`;
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
      /* не залогинен / сеть — оставляем пусто */
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
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4 flex items-center gap-3 text-[#A6A5AB]">
        <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        <span className="text-[13px]">Загружаем релизы…</span>
      </div>
    );
  }

  // Пока релизов нет — приглашение вместо карусели
  if (!release) {
    return (
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">Релизы</div>
        <p className="text-[13px] text-[#6E6D73] mt-2">
          Релизов пока нет. Добавьте первый — загрузите аудио, обложку и данные об авторах.
        </p>
      </div>
    );
  }

  const isLive = release.status === "live";

  return (
    <div className="relative bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4 overflow-hidden">
      {/* Заголовок секции + навигация */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A]">
          {releases.length === 1 ? "Релиз" : `Релиз · ${safeIndex + 1} из ${releases.length}`}
        </div>
        {releases.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => go(-1)}
              disabled={safeIndex === 0}
              aria-label="Предыдущий релиз"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
            <button
              onClick={() => go(1)}
              disabled={safeIndex === releases.length - 1}
              aria-label="Следующие релизы"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={release.id}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {/* Обложка + название */}
          <div className="flex items-center gap-4 mb-[18px]">
            <div className="w-[72px] h-[72px] rounded-[12px] overflow-hidden border-[0.5px] border-[#ECEAE5] shrink-0 bg-[#17161A] flex items-center justify-center">
              {release.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.coverUrl}
                  alt={`Обложка релиза ${release.title}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc3 className="w-8 h-8 text-white/60" strokeWidth={1.5} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-[3px] flex-wrap">
                <span className="text-[18px] font-medium tracking-[-0.01em]">{release.title}</span>
                {isLive ? (
                  <span className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[10px] py-[3px] rounded-full bg-[#E9F6EF] text-[#166B49]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#1F9D6B] animate-pulse" />
                    Вышел · Live
                  </span>
                ) : (
                  <span className="text-[12px] font-medium px-[10px] py-[3px] rounded-full bg-[#FBF1DE] text-[#8A5A16]">
                    Готовится
                  </span>
                )}
              </div>
              <div className="text-[13px] text-[#6E6D73]">{releaseDate(release)}</div>
            </div>
            <button
              onClick={() => setConfirmOpen(true)}
              aria-label="Удалить релиз"
              title="Удалить релиз"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#A62018] hover:bg-[#FDEDEB] transition shrink-0 self-start"
            >
              <X className="w-[18px] h-[18px]" strokeWidth={2} />
            </button>
          </div>

          {isLive ? (
            <div className="flex items-center justify-between gap-4">
              <div className="text-[13px] text-[#6E6D73]">
                Трек в ротации — доступна статистика и текущие процессы
              </div>
              <Link
                href={`/releases/${release.id}`}
                className="inline-flex items-center gap-[7px] bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition shrink-0"
              >
                <BarChart3 className="w-[16px] h-[16px]" strokeWidth={2} />
                Смотреть данные
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="text-[13px] text-[#6E6D73]">В работе — файлы и данные загружены</div>
              <Link
                href={`/releases/${release.id}`}
                className="inline-flex items-center gap-[7px] text-[14px] font-medium text-[#17161A] border border-[#E5E3DE] px-[16px] py-[9px] rounded-[10px] hover:bg-[#F0EEEA] transition shrink-0"
              >
                Открыть
                <ArrowRight className="w-[14px] h-[14px]" strokeWidth={2} />
              </Link>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Индикаторы */}
      {releases.length > 1 && (
        <div className="flex items-center justify-center gap-[6px] mt-[18px]">
          {releases.map((r, i) => (
            <button
              key={r.id}
              onClick={() => {
                setDir(i > safeIndex ? 1 : -1);
                setIndex(i);
              }}
              aria-label={`Релиз ${r.title}`}
              className={`h-[6px] rounded-full transition-all ${
                i === safeIndex ? "w-5 bg-[#17161A]" : "w-[6px] bg-[#D2D0CB] hover:bg-[#A6A5AB]"
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm p-5"
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="w-full max-w-[360px] rounded-[16px] border-[0.5px] border-[#ECEAE5] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.18)] p-5 text-center"
            >
              <span className="w-11 h-11 rounded-full bg-[#FDEDEB] text-[#A62018] flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <div className="text-[15px] font-semibold tracking-[-0.01em]">Удалить релиз?</div>
              <div className="text-[13px] text-[#6E6D73] mt-1">
                «{release.title}» будет удалён без возможности восстановления.
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 text-[14px] font-medium text-[#17161A] px-4 py-[10px] rounded-[10px] border border-[#E5E3DE] hover:bg-[#F0EEEA] transition"
                >
                  Нет
                </button>
                <button
                  onClick={remove}
                  className="flex-1 text-[14px] font-medium text-white bg-[#E23A34] px-4 py-[10px] rounded-[10px] hover:brightness-95 transition"
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
