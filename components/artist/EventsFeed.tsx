"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, MapPin, Clock, Check, AlertTriangle } from "lucide-react";

interface FeedEvent {
  id: number;
  title: string;
  city: string;
  venue: string;
  day: string;
  month: string;
  time: string;
}

// Ближайшие мероприятия. Позже будут приходить из аккаунта менеджера/лейбла.
const events: FeedEvent[] = [
  { id: 1, title: "Summer Jam", city: "Москва", venue: "Дизайн-завод Флакон", day: "25", month: "июл", time: "18:00" },
  { id: 2, title: "Яндекс Музыка Дача", city: "Москва", venue: "Парк Горького", day: "2", month: "авг", time: "14:00" },
  { id: 3, title: "Icegergert & Winline event", city: "Москва", venue: "ThugLife Mansion", day: "8", month: "авг", time: "22:00" },
  { id: 4, title: "Monochrome & Cream Soda — показ коллаборации", city: "Москва", venue: "Tsvetnoy", day: "15", month: "авг", time: "19:00" },
  { id: 5, title: "Media Basket Финал", city: "Москва", venue: "ЦСКА Арена", day: "23", month: "авг", time: "17:00" },
];

export default function EventsFeed() {
  // id мероприятий, по которым артист отправил запрос менеджеру
  const [requested, setRequested] = useState<number[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const wantToGo = (e: FeedEvent) => {
    if (requested.includes(e.id)) return;
    setRequested((prev) => [...prev, e.id]);
    // Уведомление артисту. Менеджеру уведомление уйдёт в его аккаунт.
    setToast(`Запрос отправлен менеджеру · ${e.title}`);
  };

  return (
    <>
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mt-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
          <div className="text-[15px] font-medium">Лента</div>
          <span className="text-[12px] text-[#A6A5AB]">мероприятия и новости от лейбла</span>
        </div>

        {/* Новость-напоминание от лейбла */}
        <div className="mt-3 mb-1 rounded-[12px] border-[0.5px] border-[#F3C9C6] bg-[#FDEDEB] p-4">
          <div className="flex items-center gap-2 mb-[6px]">
            <span className="inline-flex items-center gap-[5px] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#A62018] bg-white/70 rounded-full px-[9px] py-[3px]">
              <AlertTriangle className="w-[12px] h-[12px]" strokeWidth={2.25} />
              Важно
            </span>
            <span className="text-[12px] text-[#A62018]/70">напоминание от лейбла</span>
          </div>
          <p className="text-[13.5px] leading-[1.5] text-[#17161A]">
            Дорогие артисты, напоминаем, что все треки отгружаются за 3 недели до даты
            релиза. Учитывайте это при подготовке. Если вам нужна срочная отгрузка —
            напишите вашему менеджеру в мессенджере.
          </p>
        </div>

        {events.map((e, i) => {
          const sent = requested.includes(e.id);
          return (
            <div
              key={e.id}
              className={`flex items-center gap-3 py-[13px] ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}`}
            >
              {/* Дата */}
              <div className="w-[46px] shrink-0 rounded-[10px] bg-[#FAFAF9] border-[0.5px] border-[#ECEAE5] py-[6px] text-center">
                <div className="text-[16px] font-medium leading-none">{e.day}</div>
                <div className="text-[11px] text-[#A6A5AB] mt-[3px]">{e.month}</div>
              </div>

              {/* Инфо */}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium leading-[1.3]">{e.title}</div>
                <div className="flex items-center gap-[10px] text-[12px] text-[#A6A5AB] mt-[3px] flex-wrap">
                  <span className="inline-flex items-center gap-[4px]">
                    <MapPin className="w-[12px] h-[12px]" strokeWidth={1.75} />
                    {e.city} · {e.venue}
                  </span>
                  <span className="inline-flex items-center gap-[4px]">
                    <Clock className="w-[12px] h-[12px]" strokeWidth={1.75} />
                    {e.time}
                  </span>
                </div>
              </div>

              {/* Действие */}
              <button
                onClick={() => wantToGo(e)}
                disabled={sent}
                className={`shrink-0 text-[13px] font-medium px-[14px] py-[8px] rounded-[10px] transition ${
                  sent
                    ? "bg-[#E9F6EF] text-[#166B49] cursor-default"
                    : "bg-[#17161A] text-white hover:brightness-125"
                }`}
              >
                {sent ? (
                  <span className="inline-flex items-center gap-[5px]">
                    <Check className="w-[14px] h-[14px]" strokeWidth={2.5} />
                    Запрос отправлен
                  </span>
                ) : (
                  "Хочу пойти"
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Уведомление артисту */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            role="status"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-[10px] bg-[#17161A] text-white text-[13px] font-medium pl-[14px] pr-[18px] py-[11px] rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.28)] max-w-[calc(100vw-2rem)]"
          >
            <span className="w-5 h-5 rounded-full bg-[#1F9D6B] flex items-center justify-center shrink-0">
              <Check className="w-[13px] h-[13px]" strokeWidth={3} />
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
