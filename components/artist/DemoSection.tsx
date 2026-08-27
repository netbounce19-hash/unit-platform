"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Headphones,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  RotateCw,
  Disc3,
  Pencil,
} from "lucide-react";
import { useDemos } from "@/components/artist/DemoContext";

const PAGE_SIZE = 3;

function fmt(t: number) {
  if (!isFinite(t)) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * @param bare — режим вкладки на странице «Материалы»: без карточки-обёртки
 *   и без сворачивания, содержимое всегда раскрыто.
 */
export default function DemoSection({ bare = false }: { bare?: boolean } = {}) {
  const { demos } = useDemos();
  const [expanded, setExpanded] = useState(false);
  const open = bare || expanded;
  const setOpen = setExpanded;
  const [page, setPage] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalPages = Math.max(1, Math.ceil(demos.length / PAGE_SIZE));
  const visible = demos.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Сбрасываем выбор, если трек пропал (удалён на странице редактирования)
  useEffect(() => {
    if (current !== null && current >= demos.length) {
      setCurrent(null);
      setPlaying(false);
    }
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [demos.length, current, page, totalPages]);

  // Загружаем и запускаем выбранный трек
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || current === null || !demos[current]) return;
    audio.src = demos[current].src;
    audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const selectTrack = (index: number) => {
    if (index === current) {
      togglePlay();
      return;
    }
    setTime(0);
    setDuration(0);
    setCurrent(index);
    setPage(Math.floor(index / PAGE_SIZE));
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || current === null) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek7 = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 7);
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().then(() => setPlaying(true)).catch(() => {});
  };

  const next = () => {
    if (current === null || demos.length === 0) return;
    selectTrack((current + 1) % demos.length);
  };

  const onSeekBar = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * duration;
  };

  const cur = current !== null ? demos[current] ?? null : null;

  return (
    <div
      className={
        bare
          ? ""
          : "bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mb-4"
      }
    >
      {/* Заголовок-переключатель */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => !bare && setOpen((v) => !v)}
          aria-expanded={bare ? undefined : open}
          disabled={bare}
          className="flex items-center gap-2 flex-1 min-w-0 -my-1 py-1 text-left disabled:cursor-default"
        >
          <Headphones className="w-[17px] h-[17px] text-[#6E6D73] shrink-0" strokeWidth={1.75} />
          <div className="text-[16px] font-semibold tracking-[-0.01em] shrink-0">Демо</div>
          {!bare && (
            <motion.span
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-[#A6A5AB] shrink-0"
            >
              <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2} />
            </motion.span>
          )}
        </button>

        {open && (
          <Link
            href="/demo/edit"
            className="inline-flex items-center gap-[5px] text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition shrink-0"
          >
            <Pencil className="w-[14px] h-[14px]" strokeWidth={2} />
            Редактировать
          </Link>
        )}

        {open && totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Предыдущие треки"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronLeft className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Следующие треки"
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronRight className="w-[17px] h-[17px]" strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Тело */}
      <div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`pt-3 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
            {/* Сетка треков — 3 в ряд */}
            {demos.length === 0 ? (
              <div className="py-6 text-[13px] text-[#A6A5AB] text-center">
                Демо пока нет — добавьте их в редакторе
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {visible.map((t, i) => {
                  const index = page * PAGE_SIZE + i;
                  const isCur = index === current;
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTrack(index)}
                      className="text-left group"
                    >
                      <div
                        className={`relative aspect-square rounded-[12px] overflow-hidden flex items-center justify-center transition ${
                          isCur ? "ring-2 ring-[#E23A34] ring-offset-2" : ""
                        }`}
                        style={{ background: t.gradient }}
                      >
                        {t.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.image} alt={t.title} className="absolute inset-0 w-full h-full object-cover" />
                        ) : (
                          <Disc3
                            className={`w-8 h-8 text-white/70 ${isCur && playing ? "animate-spin" : ""}`}
                            style={{ animationDuration: "3s" }}
                            strokeWidth={1.5}
                          />
                        )}
                        <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          {isCur && playing ? (
                            <Pause className="w-6 h-6 text-white" strokeWidth={2} fill="currentColor" />
                          ) : (
                            <Play className="w-6 h-6 text-white" strokeWidth={2} fill="currentColor" />
                          )}
                        </span>
                      </div>
                      <div className={`text-[13px] font-medium truncate mt-[6px] ${isCur ? "text-[#E23A34]" : "text-[#17161A]"}`}>
                        {t.title}
                      </div>
                      <div className="text-[11px] text-[#A6A5AB]">Демо</div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Мини-плеер */}
            {cur && (
              <div className="mt-4 rounded-[12px] border-[0.5px] border-[#ECEAE5] bg-[#FAFAF9] p-3">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="relative w-11 h-11 rounded-[12px] shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: cur.gradient }}
                  >
                    {cur.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cur.image} alt={cur.title} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <Disc3
                        className={`w-5 h-5 text-white/80 ${playing ? "animate-spin" : ""}`}
                        style={{ animationDuration: "3s" }}
                        strokeWidth={1.5}
                      />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium truncate">{cur.title}</div>
                    <div className="text-[12px] text-[#A6A5AB]">
                      {fmt(time)} / {fmt(duration)}
                    </div>
                  </div>
                </div>

                {/* Прогресс */}
                <div
                  onClick={onSeekBar}
                  className="h-[6px] bg-[#ECEAE5] rounded-full overflow-hidden cursor-pointer mb-3"
                >
                  <div
                    className="h-full bg-[#E23A34] rounded-full"
                    style={{ width: duration ? `${(time / duration) * 100}%` : "0%" }}
                  />
                </div>

                {/* Управление */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={restart}
                    aria-label="Включить заново"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                  >
                    <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2} />
                  </button>
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? "Пауза" : "Играть"}
                    className="w-12 h-12 rounded-full bg-[#E23A34] text-white flex items-center justify-center hover:brightness-95 transition"
                  >
                    {playing ? (
                      <Pause className="w-5 h-5" strokeWidth={2} fill="currentColor" />
                    ) : (
                      <Play className="w-5 h-5 ml-[2px]" strokeWidth={2} fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={seek7}
                    aria-label="Перемотать на 7 секунд"
                    className="relative w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                  >
                    <RotateCw className="w-[22px] h-[22px]" strokeWidth={1.75} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">7</span>
                  </button>
                  <button
                    onClick={next}
                    aria-label="Следующий трек"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition"
                  >
                    <SkipForward className="w-[18px] h-[18px]" strokeWidth={2} fill="currentColor" />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
    </div>
  );
}
