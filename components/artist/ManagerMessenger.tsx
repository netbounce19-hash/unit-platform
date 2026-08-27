"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, ChevronDown, MessageCircle } from "lucide-react";
import { SendIconControlled } from "@/components/ui/animated-state-icons";

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
 * Переписка с менеджером — сворачиваемая секция дашборда. Раньше это был
 * плавающий виджет в углу экрана; секцией он не перекрывает контент.
 * Свёрнута по умолчанию: на фокус-экране дня чат — справочный раздел,
 * а не то, с чего начинают.
 */
export default function ManagerMessenger() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Автоскролл ленты вниз при новом сообщении и при раскрытии секции
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const [sending, setSending] = useState(false);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: Date.now(), from: "me", text, time: nowTime() }]);
    setDraft("");
    setSending(true);
    setTimeout(() => setSending(false), 700);
  };

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] mb-4 overflow-hidden">
      {/* Заголовок-переключатель */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-[22px] py-[18px] text-left"
      >
        <MessageCircle className="w-[17px] h-[17px] text-[#6E6D73] shrink-0" strokeWidth={1.75} />
        <div className="text-[16px] font-semibold tracking-[-0.01em] shrink-0">Чат с менеджером</div>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#A6A5AB] shrink-0"
        >
          <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2} />
        </motion.span>
      </button>

      {/* Тело */}
      <div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
            {/* Менеджер */}
            <div className="flex items-center gap-3 px-[22px] pb-[14px] border-b-[0.5px] border-[#ECEAE5]">
              <span className="relative w-10 h-10 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[15px] font-medium shrink-0">
                {MANAGER.avatar}
                <span className="absolute -bottom-[1px] -right-[1px] w-[11px] h-[11px] rounded-full bg-[#1F9D6B] border-2 border-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[#17161A] truncate">
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
              <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] rounded-tl-[4px] px-[13px] py-[9px]">
                {m.ping && (
                  <div className="flex items-center gap-[5px] text-[11px] font-medium text-[#A62018] mb-[5px]">
                    <Bell className="w-3 h-3" strokeWidth={2} />
                    Напоминание
                  </div>
                )}
                <p className="text-[13.5px] leading-[1.45] text-[#17161A]">{m.text}</p>
                {m.task && (
                  <span className="inline-flex items-center gap-[6px] mt-2 text-[12px] font-medium text-[#6E6D73] bg-[#F0EEEA] rounded-[12px] px-[8px] py-[4px]">
                    <span className="w-[6px] h-[6px] rounded-full bg-[#E23A34]" />
                    {m.task}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[#A6A5AB] mt-[3px] ml-1">{m.time}</span>
            </div>
          ) : (
            <div key={m.id} className="flex flex-col items-end ml-auto max-w-[85%]">
              <div className="bg-[#E23A34] text-white rounded-[12px] rounded-tr-[4px] px-[13px] py-[9px]">
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
          className="w-9 h-9 shrink-0 rounded-full bg-[#E23A34] text-white flex items-center justify-center hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
        >
          <SendIconControlled size={18} color="white" sent={sending} />
        </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
