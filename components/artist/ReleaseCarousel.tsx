"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, BarChart3, ArrowRight, X, Trash2 } from "lucide-react";

export interface Release {
  id: string;
  title: string;
  cover: string;
  status: "live" | "upcoming";
  date: string; // человекочитаемая дата
  /** только для upcoming */
  progress?: number;
  nextStep?: string;
}

const defaultReleases: Release[] = [
  {
    id: "midnight-protocol",
    title: "Midnight Protocol",
    cover: "/covers/midnight-protocol.svg",
    status: "live",
    date: "Вышел 27 июня 2026",
  },
  {
    id: "phantom-signal",
    title: "Phantom Signal",
    cover: "/covers/phantom-signal.svg",
    status: "upcoming",
    date: "Плановый релиз · 15 августа 2026",
    progress: 40,
    nextStep: "загрузить демо и данные об авторах",
  },
  {
    id: "low-orbit",
    title: "Low Orbit",
    cover: "/covers/low-orbit.svg",
    status: "upcoming",
    date: "Плановый релиз · 30 сентября 2026",
    progress: 10,
    nextStep: "загрузить аудио",
  },
];

interface ReleaseCarouselProps {
  /** вызывается для upcoming-релиза — открывает окно загрузки данных */
  onUpload: (releaseTitle: string) => void;
  /** загруженные обложки по названию релиза */
  coverOverrides?: Record<string, string>;
}

export default function ReleaseCarousel({ onUpload, coverOverrides }: ReleaseCarouselProps) {
  const [releases, setReleases] = useState<Release[]>(defaultReleases);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const safeIndex = Math.min(index, releases.length - 1);
  const release = releases[safeIndex];
  const isLive = release.status === "live";

  const go = (delta: number) => {
    const next = safeIndex + delta;
    if (next < 0 || next >= releases.length) return;
    setDir(delta);
    setIndex(next);
  };

  const deleteRelease = () => {
    setReleases((prev) => prev.filter((r) => r.id !== release.id));
    setIndex((i) => Math.max(0, i - 1));
    setConfirmOpen(false);
  };

  return (
    <div className="relative bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4 overflow-hidden">
      {/* Заголовок секции + навигация */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-[18px] font-semibold tracking-[-0.01em] text-[#17161A]">
          {isLive ? "Активный релиз" : `Следующий релиз · ${safeIndex} из ${releases.length - 1}`}
        </div>
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
            <img
              src={coverOverrides?.[release.title] ?? release.cover}
              alt={`Обложка релиза ${release.title}`}
              width={72}
              height={72}
              className="w-[72px] h-[72px] rounded-[12px] object-cover border-[0.5px] border-[#ECEAE5] shrink-0"
            />
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
              <div className="text-[13px] text-[#6E6D73]">{release.date}</div>
            </div>
            {!isLive && (
              <button
                onClick={() => setConfirmOpen(true)}
                aria-label="Удалить релиз"
                title="Удалить релиз"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#A6A5AB] hover:text-[#A62018] hover:bg-[#FDEDEB] transition shrink-0 self-start"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            )}
          </div>

          {isLive ? (
            /* Вышедший релиз — переход к данным */
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
            /* Будущий релиз — загрузка данных */
            <>
              <div className="flex justify-between text-[13px] text-[#6E6D73] mb-2">
                <span>Готовность</span>
                <span className="font-medium text-[#17161A]">{release.progress}%</span>
              </div>
              <div className="h-2 bg-[#F0EEEA] rounded-full overflow-hidden mb-[18px]">
                <div className="h-full bg-[#E23A34] rounded-full transition-all" style={{ width: `${release.progress}%` }} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-[13px] text-[#6E6D73]">
                  <span className="text-[#17161A] font-medium">Следующий шаг:</span> {release.nextStep}
                </div>
                <button
                  onClick={() => onUpload(release.title)}
                  className="bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition shrink-0"
                >
                  Загрузить данные
                </button>
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Индикаторы */}
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

      {/* Подсказка про следующие релизы */}
      {isLive && (
        <button
          onClick={() => go(1)}
          className="w-full flex items-center justify-center gap-[6px] text-[12px] text-[#6E6D73] hover:text-[#17161A] transition mt-[10px]"
        >
          Посмотреть следующие релизы
          <ArrowRight className="w-[13px] h-[13px]" strokeWidth={2} />
        </button>
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
              <div className="text-[15px] font-semibold tracking-[-0.01em]">
                Удалить релиз?
              </div>
              <div className="text-[13px] text-[#6E6D73] mt-1">
                «{release.title}» будет удалён из списка релизов.
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 text-[14px] font-medium text-[#17161A] px-4 py-[10px] rounded-[10px] border border-[#E5E3DE] hover:bg-[#F0EEEA] transition"
                >
                  Нет
                </button>
                <button
                  onClick={deleteRelease}
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
