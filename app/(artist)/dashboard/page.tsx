"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Target, ListChecks, ArrowRight, Wallet } from "lucide-react";
import EventsFeed from "@/components/artist/EventsFeed";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ManagerMessenger from "@/components/artist/ManagerMessenger";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";
import { listBudgetRequests } from "@/lib/supabase/cabinet";

// «Четверг, 16 июля» — с заглавной буквы
function formatToday(d: Date) {
  const s = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// ЗАГЛУШКА: задачи ставит менеджер из своего кабинета, таблицы для них
// пока нет — до подключения бэкенда показываем фиксированный список.
type Task = { id: number; title: string; meta: string; done: boolean };
const initial: Task[] = [
  { id: 1, title: "Загрузить финальный мастер", meta: "до 6 августа", done: false },
  { id: 2, title: "Согласовать обложку релиза", meta: "до 8 августа", done: false },
  { id: 3, title: "Записать промо-ролик для TikTok", meta: "до 10 августа", done: false },
];

export default function DashboardPage() {
  const [items, setItems] = useState(initial);
  const [name, setName] = useState("Артист");
  const [pending, setPending] = useState(0);
  const [today, setToday] = useState<string | null>(null);

  // Дата считается на клиенте, чтобы не расходиться с версией сервера
  useEffect(() => setToday(formatToday(new Date())), []);

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setName(displayNameOf(p));
      })
      .catch(() => {
        /* профиль недоступен — оставляем значение по умолчанию */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listBudgetRequests()
      .then((rows) => {
        if (cancelled) return;
        setPending(rows.filter((r) => r.status === "pending").length);
      })
      .catch(() => {
        /* не залогинен или сеть — счётчик остаётся нулевым */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = items.filter((t) => !t.done).length;
  const nextStep = items.find((t) => !t.done) ?? null;

  const toggle = (id: number) =>
    setItems((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  // Три состояния, а не два: пустой список — это не «всё выполнено»
  const subtitle =
    items.length === 0
      ? "задач пока нет"
      : openTasks === 0
        ? "все задачи выполнены"
        : `${openTasks} ${plural(openTasks, "задача", "задачи", "задач")} на сегодня`;

  return (
    <>
      {/* Приветствие */}
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">С возвращением, {name}</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">
          {today ?? " "} · {subtitle}
        </div>
      </div>

      {/* Следующий шаг — одно приоритетное действие */}
      {nextStep && (
        <div className="bg-[#17161A] text-white rounded-[16px] p-[22px] mb-4">
          <div className="text-[12px] text-white/50 mb-[6px]">Следующий шаг</div>
          <div className="text-[17px] font-medium tracking-[-0.01em] leading-[1.3]">
            {nextStep.title}
          </div>
          <div className="text-[13px] text-white/60 mt-[3px]">{nextStep.meta}</div>
          <button
            onClick={() => toggle(nextStep.id)}
            className="inline-flex items-center gap-[6px] bg-white text-[#17161A] font-medium text-[13px] px-[14px] py-[9px] rounded-[10px] hover:bg-white/90 transition mt-4"
          >
            Отметить выполненной
            <ArrowRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Задачи */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[6px] pb-[14px] mb-4">
        <div className="flex items-center gap-2 pt-4 pb-1">
          <ListChecks className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Задачи на сегодня</div>
        </div>
        {items.length === 0 && (
          <div className="py-[18px] text-[13px] text-[#A6A5AB] text-center">
            Ожидаются от менеджера
          </div>
        )}
        {items.map((t, i) => (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            className={`w-full flex items-center gap-3 py-[13px] text-left ${
              i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""
            }`}
          >
            <span
              className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center shrink-0 transition ${
                t.done ? "bg-[#1F9D6B] border-[#1F9D6B]" : "border-[#D2D0CB]"
              }`}
            >
              {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span>
              <span className={`block text-[14px] ${t.done ? "line-through text-[#A6A5AB]" : ""}`}>
                {t.title}
              </span>
              <span className="block text-[12px] text-[#A6A5AB] mt-[2px]">{t.meta}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Релизы */}
      <ReleaseCarousel />

      {/* Стратегия и заявки — две плитки в строку.
          Заявки показываем только когда есть что ждать; тогда стратегия
          занимает всю ширину, чтобы не оставлять пустую половину. */}
      <div className={`grid gap-3 mb-4 ${pending > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
        <Link
          href="/strategy"
          className="flex flex-col justify-between gap-4 min-h-[104px] bg-[#FBF1DE] border-[0.5px] border-[#F0E2BF] rounded-[4px] p-4 hover:border-[#E3D0A4] transition"
        >
          <Target className="w-[18px] h-[18px] text-[#8A5A16]" strokeWidth={1.75} />
          <span className="min-w-0">
            <span className="block text-[14px] font-medium truncate">Стратегия III кв.</span>
            <span className="block text-[12px] text-[#166B49] mt-[2px]">Утверждена</span>
          </span>
        </Link>

        {pending > 0 && (
          <Link
            href="/finance"
            className="flex flex-col justify-between gap-4 min-h-[104px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[4px] p-4 hover:border-[#D2D0CB] transition"
          >
            <Wallet className="w-[18px] h-[18px] text-[#6E6D73]" strokeWidth={1.75} />
            <span className="min-w-0">
              <span className="block text-[14px] font-medium truncate">Заявки</span>
              <span className="block text-[12px] text-[#6E6D73] mt-[2px]">
                {pending} на рассмотрении
              </span>
            </span>
          </Link>
        )}
      </div>

      {/* Переписка с менеджером */}
      <ManagerMessenger />

      {/* Новости и мероприятия */}
      <EventsFeed />
    </>
  );
}
