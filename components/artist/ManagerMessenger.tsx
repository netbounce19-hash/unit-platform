"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bell, CheckCheck } from "lucide-react";

interface Manager {
  name: string;
  role: string;
  avatar: string;
}

interface Message {
  id: number;
  from: "manager" | "me";
  text: string;
  time: string;
  task?: string; // связанная задача из плана
  ping?: boolean; // напоминание
}

const MANAGER: Manager = {
  name: "Анна Ковалёва",
  role: "A&R менеджер",
  avatar: "А",
};

// ЗАГЛУШКА: переписка не подключена к бэкенду, сообщения живут в памяти.
// Текст намеренно нейтральный — он не должен ссылаться на релизы и задачи,
// которых у аккаунта может не быть.
const initialMessages: Message[] = [
  {
    id: 1,
    from: "manager",
    text: "Привет! Я ваш A&R менеджер в UNIT. Пишите сюда по релизам, материалам и заявкам на финансирование.",
    time: "09:32",
  },
  {
    id: 2,
    from: "manager",
    text: "Демо и мастера загружайте в раздел «Материалы» — я посмотрю и вернусь с комментариями.",
    time: "09:33",
  },
];

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Переписка с менеджером — секция дашборда. Раньше это был плавающий
 * виджет в углу экрана; секцией он не перекрывает контент и не требует
 * отдельного состояния «открыт / свёрнут».
 */
export default function ManagerMessenger() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Автоскролл ленты вниз при новом сообщении
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), from: "me", text, time: nowTime() }]);
    setDraft("");
  };

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] mb-4 overflow-hidden">
      {/* Шапка — она же заголовок секции */}
      <div className="flex items-center gap-3 px-[22px] py-[14px] border-b-[0.5px] border-[#ECEAE5]">
        <span className="relative w-10 h-10 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[15px] font-medium shrink-0">
          {MANAGER.avatar}
          <span className="absolute -bottom-[1px] -right-[1px] w-[11px] h-[11px] rounded-full bg-[#1F9D6B] border-2 border-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold tracking-[-0.01em] text-[#17161A] truncate">
            {MANAGER.name}
          </div>
          <div className="text-[12px] text-[#1F9D6B] flex items-center gap-[5px]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#1F9D6B]" />
            {MANAGER.role} · на связи
          </div>
        </div>
      </div>

      {/* Лента сообщений */}
      <div ref={scrollRef} className="h-[340px] overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9]">
        {messages.map((m) =>
          m.from === "manager" ? (
            <div key={m.id} className="flex flex-col items-start max-w-[85%]">
              <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[14px] rounded-tl-[4px] px-[13px] py-[9px]">
                {m.ping && (
                  <div className="flex items-center gap-[5px] text-[11px] font-medium text-[#A62018] mb-[5px]">
                    <Bell className="w-3 h-3" strokeWidth={2} />
                    Напоминание
                  </div>
                )}
                <p className="text-[13.5px] leading-[1.45] text-[#17161A]">{m.text}</p>
                {m.task && (
                  <span className="inline-flex items-center gap-[6px] mt-2 text-[12px] font-medium text-[#6E6D73] bg-[#F0EEEA] rounded-[8px] px-[8px] py-[4px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E23A34]" />
                    {m.task}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#A6A5AB] mt-[3px] ml-1">{m.time}</span>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-end ml-auto max-w-[85%]">
              <div className="bg-[#E23A34] text-white rounded-[14px] rounded-tr-[4px] px-[13px] py-[9px]">
                <p className="text-[13.5px] leading-[1.45]">{m.text}</p>
              </div>
              <span className="flex items-center gap-[3px] text-[10px] text-[#A6A5AB] mt-[3px] mr-1">
                {m.time}
                <CheckCheck className="w-[13px] h-[13px] text-[#1F9D6B]" strokeWidth={2} />
              </span>
            </div>
          )
        )}
      </div>

      {/* Поле ввода */}
      <div className="flex items-end gap-2 px-3 py-3 border-t-[0.5px] border-[#ECEAE5]">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Сообщение менеджеру…"
          className="flex-1 resize-none max-h-24 text-[14px] leading-[1.4] rounded-[12px] border border-[#E5E3DE] bg-white px-[12px] py-[9px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          aria-label="Отправить"
          className="w-9 h-9 shrink-0 rounded-full bg-[#E23A34] text-white flex items-center justify-center hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowUp className="w-[18px] h-[18px]" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
