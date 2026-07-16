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
    <div className={`min-h-screen bg-f-bg text-f-ink ${GeistSans.className} font-sans`}>
      {/* Layout Container */}
      <div className="max-w-[720px] mx-auto px-4 py-4 sm:py-6 flex flex-col gap-6">
        
        {/* 1. Topbar */}
        <header className="flex items-center justify-between">
          <div className="font-semibold text-lg tracking-[0.16em]">UNIT</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-full bg-f-card border-[0.5px] border-f-line px-3 py-1 text-sm text-f-ink font-medium">
              <span className="text-f-accent text-[10px]">●</span>
              Режим фокуса
            </div>
            <button className="text-f-ink-2 hover:text-f-ink transition-colors">
              <BellIcon />
            </button>
            <div className="w-8 h-8 rounded-full bg-f-ink flex items-center justify-center text-white font-medium">
              K
            </div>
          </div>
        </header>

        {/* 2. Greeting */}
        <section className="mt-2">
          <h1 className="text-[22px] font-medium leading-tight">С возвращением, KXDE</h1>
          <p className="text-f-ink-2 text-sm mt-1">Четверг, 16 июля · 2 задачи на сегодня</p>
        </section>

        {/* 3. Active Release Card */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5 flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-f-ink-3 text-xs mb-1">Активный релиз</p>
              <h2 className="text-[18px] font-medium leading-tight">Midnight Protocol</h2>
            </div>
            <span className="bg-f-accent-bg text-f-accent-ink text-xs px-2.5 py-1 rounded-full font-medium">
              В работе
            </span>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Прогресс релиза 65%</span>
            </div>
            <div className="w-full h-1 bg-[#F0EEEA] rounded-full overflow-hidden">
              <div className="h-full bg-f-accent w-[65%] rounded-full" />
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 pt-4 border-t-[0.5px] border-f-line">
            <p className="text-sm text-f-ink-2">Следующий шаг: загрузить финальный мастер · через 3 дня</p>
            <button className="bg-f-accent hover:bg-f-accent-ink transition-colors text-white px-4 py-2 rounded-[10px] text-sm font-medium cursor-pointer">
              Загрузить
            </button>
          </div>
        </section>

        {/* 4. Tasks Card */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-5">
          <h2 className="text-[18px] font-medium mb-4">Задачи на сегодня</h2>
          <div className="flex flex-col">
            {tasks.map((task, index) => (
              <div 
                key={task.id} 
                className={`flex items-start gap-3 py-3 ${index !== tasks.length - 1 ? 'border-b-[0.5px] border-f-line' : ''}`}
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
                  <p className={`text-sm font-medium transition-colors ${task.done ? 'line-through text-f-ink-3' : 'text-f-ink'}`}>
                    {task.title}
                  </p>
                  <p className="text-xs text-f-ink-3 mt-0.5">
                    {task.done && task.doneAt ? task.doneAt : task.meta}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Stat Cards */}
        <section className="grid grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[12px] p-4 flex flex-col justify-between">
            <p className="text-xs text-f-ink-3 mb-2">Слушатели / месяц</p>
            <div>
              <p className="text-[22px] font-medium leading-tight">65k</p>
              <p className="text-xs text-f-ink-3 mt-1">цель 100k</p>
            </div>
          </div>
          {/* Card 2 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[12px] p-4 flex flex-col justify-between">
            <p className="text-xs text-f-ink-3 mb-2">Стримы / квартал</p>
            <div>
              <p className="text-[22px] font-medium leading-tight">1.2M</p>
              <p className="text-xs text-f-ok mt-1">+18%</p>
            </div>
          </div>
          {/* Card 3 */}
          <div className="bg-f-card border-[0.5px] border-f-line rounded-[12px] p-4 flex flex-col justify-between">
            <p className="text-xs text-f-ink-3 mb-2">Роялти (мои условия)</p>
            <div>
              <p className="text-[22px] font-medium leading-tight">70 / 30</p>
              <p className="text-xs text-f-ink-3 mt-1">срок 24 мес.</p>
            </div>
          </div>
        </section>

        {/* 6. Finance Row */}
        <section className="bg-f-card border-[0.5px] border-f-line rounded-[16px] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-f-ink-2">
              <WalletIcon />
            </div>
            <div>
              <p className="text-sm font-medium">Заявка: сведение и мастеринг</p>
              <p className="text-xs text-f-ink-3 mt-0.5">25 000 ₽ · отправлена вчера</p>
            </div>
          </div>
          <span className="bg-f-warn-bg text-f-warn-ink text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">
            На рассмотрении
          </span>
        </section>
        
      </div>
    </div>
  );
}
