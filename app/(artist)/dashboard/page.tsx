"use client";

import React, { useState } from 'react';
import { GeistSans } from 'geist/font/sans';

// --- Types ---
type Task = {
  id: string;
  title: string;
  meta: string;
  done: boolean;
  doneAt?: string;
};

// --- Mock Data ---
const initialTasks: Task[] = [
  {
    id: '1',
    title: 'Опубликовать промо-ролик в TikTok',
    meta: 'Промо · дедлайн сегодня',
    done: false,
  },
  {
    id: '2',
    title: 'Проверить финальный мастер',
    meta: 'Релиз · дедлайн сегодня',
    done: false,
  },
  {
    id: '3',
    title: 'Загрузить обложку альбома',
    meta: 'Релиз',
    done: true,
    doneAt: 'Выполнено в 11:20',
  },
];

// --- Icons ---
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
);

const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);

export default function DashboardPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, done: !t.done };
      }
      return t;
    }));
  };

  return (
    <div className={`min-h-screen bg-f-bg text-f-ink ${GeistSans.className} flex flex-col items-center`}>
      {/* Layout Container */}
      <div className="w-full max-w-[720px] px-4 sm:px-6 py-6 sm:py-12 flex flex-col gap-8 sm:gap-10">
        
        {/* 1. Topbar */}
        <header className="flex items-center justify-between">
          <div className="font-bold text-lg sm:text-xl tracking-[0.16em]">UNIT</div>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-white border-[0.5px] border-f-line px-3 py-1.5 text-[13px] font-medium">
              <span className="text-f-accent text-[10px]">●</span>
              Режим фокуса
            </div>
            {/* Mobile simplified pill */}
            <div className="flex sm:hidden items-center justify-center w-8 h-8 rounded-full bg-white border-[0.5px] border-f-line">
              <span className="text-f-accent text-[10px]">●</span>
            </div>
            <button className="text-f-ink-2 hover:text-f-ink transition-colors cursor-pointer">
              <BellIcon />
            </button>
            <div className="w-8 h-8 rounded-full bg-f-ink flex items-center justify-center text-white text-sm font-medium cursor-pointer">
              K
            </div>
          </div>
        </header>

        {/* 2. Greeting */}
        <section className="flex flex-col gap-1 sm:gap-2">
          <h1 className="text-2xl sm:text-3xl font-medium leading-tight tracking-tight">С возвращением, KXDE</h1>
          <p className="text-f-ink-2 text-sm sm:text-[15px]">Четверг, 16 июля · 2 задачи на сегодня</p>
        </section>

        {/* 3. Active Release Card */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 sm:p-7 flex flex-col gap-5 sm:gap-6">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-1 sm:gap-1.5">
              <span className="text-f-ink-3 text-xs sm:text-[13px] font-medium">Активный релиз</span>
              <h2 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight">Midnight Protocol</h2>
            </div>
            <span className="bg-f-accent-bg text-f-accent-ink text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full font-medium mt-1">
              В работе
            </span>
          </div>
          
          <div className="flex flex-col gap-2 mt-1 sm:mt-2">
            <div className="flex justify-between items-center text-sm sm:text-[15px]">
              <span className="text-f-ink-2 font-medium">Прогресс релиза</span>
              <span className="font-semibold text-f-ink">65%</span>
            </div>
            <div className="w-full h-1.5 sm:h-2 bg-[#F0EEEA] rounded-full overflow-hidden">
              <div className="h-full bg-f-accent w-[65%] rounded-full" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4 sm:pt-5 border-t-[0.5px] border-f-line mt-1 sm:mt-2">
            <p className="text-[13px] sm:text-[14px] font-medium text-f-ink leading-relaxed">
              Следующий шаг: <span className="text-f-ink-2 font-normal">загрузить финальный мастер · через 3 дня</span>
            </p>
            <button className="bg-white border-[0.5px] border-f-line hover:bg-f-bg transition-colors text-f-ink px-5 py-2.5 rounded-[10px] text-[13px] font-semibold cursor-pointer w-full sm:w-auto text-center">
              Загрузить
            </button>
          </div>
        </section>

        {/* 4. Tasks Card */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 sm:p-7">
          <h2 className="text-[17px] sm:text-lg font-semibold mb-4 sm:mb-5">Задачи на сегодня</h2>
          <div className="flex flex-col">
            {tasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`flex items-start gap-3 sm:gap-4 py-3 sm:py-4 ${index !== tasks.length - 1 ? 'border-b-[0.5px] border-f-line' : ''}`}
                onClick={() => toggleTask(task.id)}
              >
                <button 
                  className={`flex-shrink-0 w-5 h-5 rounded-[6px] border-[0.5px] flex items-center justify-center transition-colors mt-0.5 cursor-pointer
                    ${task.done 
                      ? 'bg-f-ok border-f-ok text-white' 
                      : 'border-f-ink-3 bg-transparent hover:border-f-ink'}`}
                >
                  {task.done && <CheckIcon />}
                </button>
                <div className="flex flex-col cursor-pointer select-none">
                  <p className={`text-[14px] sm:text-[15px] font-medium transition-colors leading-snug ${task.done ? 'line-through text-f-ink-3' : 'text-f-ink'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs sm:text-[13px] text-f-ink-3 mt-1 font-normal">
                    {task.done && task.doneAt ? task.doneAt : task.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Stat Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {/* Card 1 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 flex flex-col justify-between gap-4 sm:gap-6">
            <p className="text-xs sm:text-[13px] text-f-ink-3 font-medium">Слушатели / месяц</p>
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <p className="text-2xl sm:text-[26px] font-semibold leading-none tracking-tight">65k</p>
              <p className="text-xs sm:text-[13px] text-f-ink-3 mt-0.5">цель 100k</p>
            </div>
          </div>
          {/* Card 2 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 flex flex-col justify-between gap-4 sm:gap-6">
            <p className="text-xs sm:text-[13px] text-f-ink-3 font-medium">Стримы / квартал</p>
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <p className="text-2xl sm:text-[26px] font-semibold leading-none tracking-tight">1.2M</p>
              <p className="text-xs sm:text-[13px] text-f-ok mt-0.5 font-medium">+18%</p>
            </div>
          </div>
          {/* Card 3 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 flex flex-col justify-between gap-4 sm:gap-6">
            <p className="text-xs sm:text-[13px] text-f-ink-3 font-medium">Роялти (мои условия)</p>
            <div className="flex flex-col gap-0.5 sm:gap-1">
              <p className="text-2xl sm:text-[26px] font-semibold leading-none tracking-tight">70 / 30</p>
              <p className="text-xs sm:text-[13px] text-f-ink-3 mt-0.5">срок 24 мес.</p>
            </div>
          </div>
        </section>

        {/* 6. Finance Row */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 flex items-center justify-between mb-8 sm:mb-10">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-f-ink-2">
              <WalletIcon />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[14px] sm:text-[15px] font-medium leading-snug">Заявка: сведение и мастеринг</p>
              <p className="text-xs sm:text-[13px] text-f-ink-3">25 000 ₽ · отправлена вчера</p>
            </div>
          </div>
          <span className="bg-f-warn-bg text-f-warn-ink text-[11px] sm:text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium whitespace-nowrap">
            На рассмотрении
          </span>
        </section>
        
      </div>
    </div>
  );
}
