"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Target, ListChecks, ArrowRight, Wallet, Loader2, Disc3 } from "lucide-react";
import EventsFeed from "@/components/artist/EventsFeed";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ManagerMessenger from "@/components/artist/ManagerMessenger";
import StatsSection from "@/components/artist/StatsSection";
import PromoConfirm from "@/components/artist/PromoConfirm";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";
import {
  listBudgetRequests,
  fetchMyTasks,
  setTaskDone,
  formatDue,
  isTaskOverdue,
  type ArtistTask,
} from "@/lib/supabase/cabinet";

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

export default function DashboardPage() {
  const [items, setItems] = useState<ArtistTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [name, setName] = useState("Артист");
  const [pending, setPending] = useState(0);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => setToday(formatToday(new Date())), []);

  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setName(displayNameOf(p));
      })
      .catch(() => {});
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
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMyTasks()
      .then((rows) => !cancelled && setItems(rows))
      .catch((e) => {
        if (!cancelled) setTaskError(e instanceof Error ? e.message : "Не удалось загрузить задачи");
      })
      .finally(() => !cancelled && setTasksLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = items.filter((t) => t.status !== "done").length;
  const nextStep = items.find((t) => t.status !== "done") ?? null;

  const toggle = async (id: string) => {
    const task = items.find((t) => t.id === id);
    if (!task) return;
    const done = task.status !== "done";
    const prev = items;
    setItems((p) =>
      p.map((t) => (t.id === id ? { ...t, status: done ? "done" : "todo" } : t))
    );
    try {
      await setTaskDone(id, done);
    } catch {
      setItems(prev);
      setTaskError("Не удалось сохранить отметку");
    }
  };

  const subtitle =
    items.length === 0
      ? "задач пока нет"
      : openTasks === 0
        ? "все задачи выполнены"
        : `${openTasks} ${plural(openTasks, "задача", "задачи", "задач")} на сегодня`;

  return (
    <>
      {/* Студийная шапка */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-[0.5px] border-[#ECEAE5]">
        <div>
          <div className="text-[26px] font-semibold tracking-tight text-[#17161A]">
            С возвращением, {name}
          </div>
          <div className="text-[13px] text-[#6E6D73] mt-0.5">
            {today ?? " "} · <span className="text-[#17161A] font-medium">{subtitle}</span>
          </div>
        </div>

      </div>

      {/* Основная сетка: работа слева, связь и аналитика справа */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-6 lg:items-start">
        <div className="min-w-0 space-y-5">
          {/* Следующий шаг — фокусный баннер */}
          {nextStep && (
            <div className="bg-[#141316] text-white rounded-[16px] p-6 shadow-md relative overflow-hidden">
              <div className="absolute right-4 top-4 opacity-10">
                <Disc3 className="w-24 h-24 text-white" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono tracking-wider uppercase text-white/70">
                    Следующий шаг
                  </span>
                  <span className="text-[11px] font-mono text-white/60 font-medium">
                    {formatDue(nextStep.due_date)}
                  </span>
                </div>
                <div className="text-[19px] font-semibold tracking-tight text-white leading-snug">
                  {nextStep.title}
                </div>
                <div className="mt-5">
                  <button
                    onClick={() => toggle(nextStep.id)}
                    className="inline-flex items-center gap-2 bg-white text-[#17161A] font-medium text-[13px] px-[14px] py-[8px] rounded-full hover:bg-white/90 transition cursor-pointer shadow-sm"
                  >
                    Отметить выполненной
                    <ArrowRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Задачи на сегодня */}
          <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6">
            <div className="flex items-center justify-between pb-3 mb-3 border-b-[0.5px] border-[#ECEAE5]">
              <div className="flex items-center gap-2">
                <ListChecks className="w-[18px] h-[18px] text-[#17161A]" strokeWidth={2} />
                <div className="text-[15px] font-semibold tracking-tight text-[#17161A]">Задачи от менеджера</div>
              </div>
              <span className="text-[11px] font-mono text-[#6E6D73] bg-[#F0EEEA] px-2.5 py-0.5 rounded-full">
                {openTasks} в работе
              </span>
            </div>

            {taskError && (
              <div className="text-[12.5px] text-[#17161A] bg-[#F0EEEA] border border-[#D2D0CB] rounded-[12px] px-3.5 py-2 my-2 font-mono">
                {taskError}
              </div>
            )}

            {tasksLoading ? (
              <div className="py-6 flex items-center justify-center text-[#A6A5AB]">
                <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
              </div>
            ) : items.length === 0 ? (
              <div className="py-6 text-[13px] text-[#A6A5AB] font-mono text-center">
                Задач пока нет — их ставит менеджер
              </div>
            ) : (
              <div className="space-y-1.5">
                {items.map((t) => {
                  const done = t.status === "done";
                  const overdue = isTaskOverdue(t);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggle(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-[12px] text-left border transition cursor-pointer group ${
                        done
                          ? "bg-[#FAFAF9] border-transparent opacity-50"
                          : "bg-[#FAFAF9] hover:bg-white border-[#ECEAE5] hover:border-[#D2D0CB] hover:shadow-2xs"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-[6px] border flex items-center justify-center shrink-0 transition ${
                          done ? "bg-[#1F9D6B] border-[#1F9D6B] text-white" : "border-[#D2D0CB] group-hover:border-[#17161A]"
                        }`}
                      >
                        {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className={`block text-[13.5px] font-medium leading-snug ${done ? "line-through text-[#A6A5AB]" : "text-[#17161A]"}`}>
                          {t.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-[11px] font-mono ${
                              overdue && !done ? "text-[#17161A] font-semibold" : "text-[#A6A5AB]"
                            }`}
                          >
                            {formatDue(t.due_date)}
                            {overdue && !done && " · просрочена"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {items.length > 0 && openTasks === 0 && <PromoConfirm />}
          </div>

          {/* Релизы */}
          <ReleaseCarousel />

          {/* Показатели */}
          <StatsSection />
        </div>

        <div className="min-w-0 space-y-4 mt-5 lg:mt-0">
          {/* Стратегия и заявки */}
          <div className={`grid gap-3 ${pending > 0 ? "grid-cols-2" : "grid-cols-1"}`}>
            <Link
              href="/strategy"
              className="flex flex-col justify-between gap-4 min-h-[104px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-4 hover:border-[#17161A] hover:shadow-2xs transition"
            >
              <div className="flex items-center justify-between">
                <Target className="w-[18px] h-[18px] text-[#17161A]" strokeWidth={2} />
                <span className="text-[10px] font-mono text-[#166B49] bg-[#E9F6EF] px-2 py-0.5 rounded-full font-medium">
                  Утверждена
                </span>
              </div>
              <div>
                <span className="block text-[14px] font-semibold text-[#17161A]">Стратегия III кв.</span>
                <span className="block text-[11px] font-mono text-[#6E6D73] mt-0.5">План релизов и промо</span>
              </div>
            </Link>

            {pending > 0 && (
              <Link
                href="/finance"
                className="flex flex-col justify-between gap-4 min-h-[104px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-4 hover:border-[#17161A] hover:shadow-2xs transition"
              >
                <div className="flex items-center justify-between">
                  <Wallet className="w-[18px] h-[18px] text-[#17161A]" strokeWidth={2} />
                  <span className="text-[10px] font-mono text-[#8A5A16] bg-[#FBF1DE] px-2 py-0.5 rounded-full font-medium">
                    {pending} на согласовании
                  </span>
                </div>
                <div>
                  <span className="block text-[14px] font-semibold text-[#17161A]">Заявки на бюджет</span>
                </div>
              </Link>
            )}
          </div>

          {/* Переписка с менеджером */}
          <ManagerMessenger />

          {/* Новости и мероприятия */}
          <EventsFeed />
        </div>
      </div>
    </>
  );
}
