"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, ArrowUp, Bell, CheckCheck } from "lucide-react";

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

const initialMessages: Message[] = [
  {
    id: 1,
    from: "manager",
    text: "Привет! Я веду твой релиз Midnight Protocol. По плану на этой неделе два шага 👇",
    time: "09:32",
  },
  {
    id: 2,
    from: "manager",
    text: "Напоминаю: нужно загрузить финальный мастер. Дедлайн через 3 дня.",
    time: "09:33",
    task: "Загрузить финальный мастер",
    ping: true,
  },
  {
    id: 3,
    from: "manager",
    text: "И промо-ролик в TikTok — по плану публикуем сегодня. Отметь, когда будет готово.",
    time: "09:33",
    task: "Опубликовать промо-ролик в TikTok",
    ping: true,
  },
];

function nowTime() {
  return new Date().toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ManagerMessenger() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [seen, setSeen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const unread = seen ? 0 : messages.filter((m) => m.from === "manager").length;

  // Автоскролл вниз при новом сообщении/открытии
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  // Esc закрывает панель
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    setSeen(true);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), from: "me", text, time: nowTime() },
    ]);
    setDraft("");
  };

  return (
    <>
      {/* Лаунчер */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            onClick={openPanel}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 22, stiffness: 320 }}
            aria-label="Открыть чат с менеджером"
            className="fixed bottom-5 right-5 z-40 flex items-center gap-[10px] bg-white border-[0.5px] border-[#ECEAE5] shadow-[0_10px_30px_rgba(0,0,0,0.12)] rounded-full pl-[6px] pr-[14px] py-[6px] hover:shadow-[0_14px_36px_rgba(0,0,0,0.16)] transition"
          >
            <span className="relative w-9 h-9 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[14px] font-medium shrink-0">
              {MANAGER.avatar}
              <span className="absolute -bottom-[1px] -right-[1px] w-3 h-3 rounded-full bg-[#1F9D6B] border-2 border-white" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[13px] font-medium text-[#17161A]">
                {MANAGER.name}
              </span>
              <span className="block text-[11px] text-[#6E6D73]">
                {MANAGER.role}
              </span>
            </span>
            {unread > 0 && (
              <span className="ml-1 min-w-5 h-5 px-[6px] rounded-full bg-[#E23A34] text-white text-[11px] font-semibold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Панель чата */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            role="dialog"
            aria-label={`Чат с менеджером ${MANAGER.name}`}
            className="fixed bottom-5 right-5 z-50 flex flex-col w-[360px] max-w-[calc(100vw-1.5rem)] h-[560px] max-h-[calc(100vh-2.5rem)] bg-white border-[0.5px] border-[#ECEAE5] rounded-[18px] shadow-[0_24px_60px_rgba(0,0,0,0.20)] overflow-hidden"
          >
            {/* Шапка */}
            <div className="flex items-center gap-3 px-4 py-[14px] border-b-[0.5px] border-[#ECEAE5] shrink-0">
              <span className="relative w-10 h-10 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[15px] font-medium shrink-0">
                {MANAGER.avatar}
                <span className="absolute -bottom-[1px] -right-[1px] w-[11px] h-[11px] rounded-full bg-[#1F9D6B] border-2 border-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium text-[#17161A] truncate">
                  {MANAGER.name}
                </div>
                <div className="text-[12px] text-[#1F9D6B] flex items-center gap-[5px]">
                  <span className="w-[6px] h-[6px] rounded-full bg-[#1F9D6B]" />
                  {MANAGER.role} · на связи
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Свернуть чат"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#F0EEEA] transition shrink-0"
              >
                <X className="w-[18px] h-[18px]" strokeWidth={2} />
              </button>
            </div>

            {/* Лента сообщений */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9]"
            >
              <div className="flex justify-center">
                <span className="text-[11px] text-[#A6A5AB] bg-white border-[0.5px] border-[#ECEAE5] rounded-full px-[10px] py-[3px]">
                  План релиза · Midnight Protocol
                </span>
              </div>

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
                      <p className="text-[13.5px] leading-[1.45] text-[#17161A]">
                        {m.text}
                      </p>
                      {m.task && (
                        <span className="inline-flex items-center gap-[6px] mt-2 text-[12px] font-medium text-[#6E6D73] bg-[#F0EEEA] rounded-[8px] px-[8px] py-[4px]">
                          <span className="w-[6px] h-[6px] rounded-full bg-[#E23A34]" />
                          {m.task}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#A6A5AB] mt-[3px] ml-1">
                      {m.time}
                    </span>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className="flex flex-col items-end ml-auto max-w-[85%]"
                  >
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
            <div className="flex items-end gap-2 px-3 py-3 border-t-[0.5px] border-[#ECEAE5] shrink-0">
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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
