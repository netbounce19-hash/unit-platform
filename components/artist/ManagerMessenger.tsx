"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CheckCheck, ChevronDown, MessageCircle, Loader2 } from "lucide-react";
import { SendIconControlled } from "@/components/ui/animated-state-icons";
import { fetchMyArtistLink, type MyArtistLink } from "@/lib/supabase/cabinet";
import {
  fetchThread,
  postMessage,
  formatTime,
  POLL_MS,
  type Message,
} from "@/lib/supabase/messages";

const MANAGER = { name: "A&R менеджер", avatar: "М" };

/**
 * Переписка с менеджером — сворачиваемая секция дашборда.
 * Свёрнута по умолчанию: на фокус-экране дня чат — справочный раздел.
 *
 * Ветка общая с кабинетом лейбла (таблица messages). Пока секция открыта,
 * она опрашивает ветку — иначе ответ менеджера пришлось бы ловить
 * перезагрузкой страницы.
 */
export default function ManagerMessenger() {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<MyArtistLink | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyArtistLink()
      .then((l) => !cancelled && setLink(l))
      .catch(() => {
        /* не привязан к лейблу — покажем пустое состояние */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (!link) return;
    try {
      setMessages(await fetchThread(link.artistId));
    } catch {
      /* сеть — оставляем то, что уже показано */
    }
  }, [link]);

  // Опрос только пока секция раскрыта: свёрнутая переписка не нужна
  useEffect(() => {
    if (!open || !link) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [open, link, load]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !link || sending) return;
    setSending(true);
    setError(null);
    try {
      const row = await postMessage({
        orgId: link.orgId,
        artistId: link.artistId,
        side: "artist",
        body,
      });
      setMessages((p) => [...p, row]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setTimeout(() => setSending(false), 700);
    }
  };

  return (
    <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] mb-4 overflow-hidden">
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

      <div className="grid" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden min-h-0">
          <div className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}>
            <div className="flex items-center gap-3 px-[22px] pb-[14px] border-b-[0.5px] border-[#ECEAE5]">
              <span className="w-10 h-10 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[15px] font-medium shrink-0">
                {MANAGER.avatar}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium text-[#17161A] truncate">{MANAGER.name}</div>
                <div className="text-[12px] text-[#A6A5AB]">
                  {link ? "переписка с вашим лейблом" : "аккаунт не привязан к лейблу"}
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="h-[340px] overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9]">
              {loading ? (
                <div className="h-full flex items-center justify-center text-[#A6A5AB]">
                  <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
                </div>
              ) : !link ? (
                <div className="h-full flex items-center justify-center text-center text-[13px] text-[#A6A5AB] px-6">
                  Пока аккаунт не привязан к лейблу, писать некому
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-[13px] text-[#A6A5AB] px-6">
                  Сообщений пока нет — напишите первым
                </div>
              ) : (
                messages.map((m) =>
                  m.from_side === "label" ? (
                    <div key={m.id} className="flex flex-col items-start max-w-[85%]">
                      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] rounded-tl-[4px] px-[13px] py-[9px]">
                        <p className="text-[13.5px] leading-[1.45] text-[#17161A]">{m.body}</p>
                      </div>
                      <span className="text-[10px] text-[#A6A5AB] mt-[3px] ml-1">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                  ) : (
                    <div key={m.id} className="flex flex-col items-end ml-auto max-w-[85%]">
                      <div className="bg-[#17161A] text-white rounded-[12px] rounded-tr-[4px] px-[13px] py-[9px]">
                        <p className="text-[13.5px] leading-[1.45]">{m.body}</p>
                      </div>
                      <span className="flex items-center gap-[3px] text-[10px] text-[#A6A5AB] mt-[3px] mr-1">
                        {formatTime(m.created_at)}
                        <CheckCheck className="w-[13px] h-[13px] text-[#1F9D6B]" strokeWidth={2} />
                      </span>
                    </div>
                  )
                )
              )}
            </div>

            {error && (
              <div className="text-[12.5px] text-[#17161A] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] px-4 py-[8px]">
                {error}
              </div>
            )}

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
                disabled={!link}
                placeholder="Сообщение менеджеру…"
                className="flex-1 resize-none max-h-24 text-[14px] leading-[1.4] rounded-[12px] border border-[#E5E3DE] bg-white px-[12px] py-[9px] outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8] disabled:opacity-50"
              />
              <button
                onClick={send}
                disabled={!draft.trim() || !link}
                aria-label="Отправить"
                className="w-9 h-9 shrink-0 rounded-full bg-[#17161A] text-white flex items-center justify-center hover:bg-[#2A282E] transition disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
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
