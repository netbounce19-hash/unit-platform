"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  ChevronDown,
  Sparkles,
  FileAudio,
  CheckCircle2,
  Wallet,
  CheckCheck,
} from "lucide-react";
import { useApp } from "@/components/providers/AppProvider";
import { SendIconControlled } from "@/components/ui/animated-state-icons";
import {
  sendMessage,
  seedThreadIfEmpty,
  type Message,
} from "@/lib/label/mockMessages";
import { useMessageThread } from "@/lib/label/useMessageThread";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LabelMessengerWidget() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState(state.artists[0]?.id || "a1");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const artist = state.artists.find((a) => a.id === selectedArtistId) || state.artists[0];

  useEffect(() => {
    state.artists.forEach((a) => seedThreadIfEmpty(a.id, a.name));
  }, [state.artists]);

  const thread = useMessageThread(selectedArtistId);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread, open, selectedArtistId]);

  const send = (textToSend?: string) => {
    const text = (textToSend || draft).trim();
    if (!text || !selectedArtistId) return;

    setSending(true);
    sendMessage(selectedArtistId, "label", text);
    if (!textToSend) setDraft("");

    setTimeout(() => setSending(false), 600);
  };

  const quickPrompts = [
    { label: "⚡ Дедлайн релиза", text: "Напоминаю про дедлайн сдачи финальных материалов по плану релиза." },
    { label: "🎧 Запросить мастер", text: "Пожалуйста, загрузи финальный мастер-трек в раздел материалов." },
    { label: "💰 Бюджет одобрен", text: "Заявка на финансирование одобрена лейблом, запускаем в работу!" },
  ];

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] overflow-hidden shadow-xs">
      {/* Header Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#FAFAF9] transition cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[12px] font-semibold">
            <MessageCircle className="w-4 h-4" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-[#17161A] tracking-[-0.01em]">
              Диалог с артистами
            </div>
            <div className="text-[11px] text-[#6E6D73]">
              Прямой канал связи и оперативные задачи
            </div>
          </div>
        </div>

        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#A6A5AB]"
        >
          <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
        </motion.div>
      </button>

      {/* Accordion Body */}
      {open && (
        <div className="border-t-[0.5px] border-[#ECEAE5]">
          {/* Artist Tabs */}
          <div className="flex items-center gap-1.5 p-3 bg-[#FAFAF9] border-b-[0.5px] border-[#ECEAE5] overflow-x-auto">
            {state.artists.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedArtistId(a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedArtistId === a.id
                    ? "bg-[#17161A] text-white shadow-xs"
                    : "bg-white text-[#6E6D73] border border-[#ECEAE5] hover:border-[#D2D0CB]"
                }`}
              >
                <span>{a.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F9D6B]" />
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div
            ref={scrollRef}
            className="h-[300px] overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9]"
          >
            {thread.map((m) => {
              const isLabel = m.from === "label";
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isLabel ? "items-end ml-auto" : "items-start"} max-w-[85%]`}
                >
                  <div
                    className={`rounded-[12px] px-3.5 py-2.5 shadow-2xs ${
                      isLabel
                        ? "bg-[#17161A] text-white rounded-tr-[3px]"
                        : "bg-white border-[0.5px] border-[#ECEAE5] text-[#17161A] rounded-tl-[3px]"
                    }`}
                  >
                    {m.attachment && (
                      <div
                        className={`rounded-[12px] p-2 mb-1.5 text-[11px] border ${
                          isLabel
                            ? "bg-white/10 border-white/15 text-white"
                            : "bg-[#FAFAF9] border-[#ECEAE5] text-[#17161A]"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {m.attachment.type === "file" && <FileAudio className="w-3.5 h-3.5 text-[#D4AF37]" />}
                          {m.attachment.type === "task" && <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D6B]" />}
                          {m.attachment.type === "budget" && <Wallet className="w-3.5 h-3.5 text-[#D97706]" />}
                          <span className="font-semibold">{m.attachment.title}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-[13px] leading-[1.4]">{m.text}</p>
                  </div>
                  <span className="text-[10px] text-[#A6A5AB] mt-1 px-1 flex items-center gap-1">
                    {fmtTime(m.createdAt)}
                    {isLabel && <CheckCheck className="w-3 h-3 text-[#1F9D6B]" />}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-1.5 bg-white border-t-[0.5px] border-[#ECEAE5] overflow-x-auto flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#D97706] shrink-0 ml-1 mr-0.5" />
            {quickPrompts.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => send(q.text)}
                className="text-[10.5px] text-[#6E6D73] hover:text-[#17161A] bg-[#FAFAF9] hover:bg-[#F0EEEA] border border-[#ECEAE5] px-2 py-0.5 rounded-full whitespace-nowrap transition cursor-pointer"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-center gap-2 p-3 bg-white border-t-[0.5px] border-[#ECEAE5]"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Написать ${artist?.name || "артисту"}…`}
              className="flex-1 text-[13px] rounded-[12px] border border-[#E5E3DE] bg-white px-3 py-2 outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="w-9 h-9 shrink-0 rounded-full bg-[#E23A34] text-white flex items-center justify-center hover:brightness-95 active:scale-95 transition disabled:opacity-40 cursor-pointer"
            >
              <SendIconControlled size={16} color="white" sent={sending} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
