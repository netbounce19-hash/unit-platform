"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  MessagesSquare,
  ArrowLeft,
  Search,
  CheckCheck,
  FileAudio,
  CheckCircle2,
  Wallet,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import {
  sendMessage,
  seedThreadIfEmpty,
  getThread,
  type Message,
  type MessageAttachment,
} from "@/lib/label/mockMessages";
import { useMessageThread } from "@/lib/label/useMessageThread";
import { SendIconControlled } from "@/components/ui/animated-state-icons";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessagesInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRoster(org.org_id)
      .then((rows) => {
        setArtists(rows);
        rows.forEach((a) => seedThreadIfEmpty(a.id, a.stage_name));
        // На десктопе автоматически выбираем первого артиста
        if (rows.length > 0 && window.innerWidth >= 768) {
          setSelected(rows[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить ростер"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const activeArtist = useMemo(
    () => artists.find((a) => a.id === selected) ?? null,
    [artists, selected]
  );

  const thread = useMessageThread(selected);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread, selected]);

  const previewOf = useCallback((artistId: string) => {
    const t = getThread(artistId);
    return t[t.length - 1] ?? null;
  }, []);

  const filteredArtists = useMemo(() => {
    return artists.filter((a) =>
      a.stage_name.toLowerCase().includes(search.toLowerCase().trim())
    );
  }, [artists, search]);

  const submit = (textToSend?: string) => {
    const text = (textToSend || draft).trim();
    if (!selected || !text) return;

    setSending(true);
    sendMessage(selected, "label", text);
    if (!textToSend) setDraft("");

    setTimeout(() => {
      setSending(false);
    }, 600);
  };

  const quickPrompts = [
    { label: "⚡ Дедлайн релиза", text: "Напоминаю про дедлайн сдачи финальных материалов по плану релиза." },
    { label: "🎧 Запросить мастер", text: "Пожалуйста, загрузи финальный мастер-трек в раздел материалов." },
    { label: "💰 Бюджет согласован", text: "Заявка на финансирование одобрена лейблом, запускаем в работу!" },
    { label: "💿 Обложка принята", text: "Обложка релиза утверждена арт-отделом, готовим промо-пак." },
  ];

  return (
    <LabelShell
      org={org}
      title="Сообщения"
      subtitle="Оперативная связь с артистами ростера UNIT"
    >
      {error && (
        <div className="text-[13px] text-[#17161A] bg-[#F0EEEA] border-[0.5px] border-[#D2D0CB] rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex items-center justify-center text-[#A6A5AB]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : artists.length === 0 ? (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] py-12 text-center text-[13px] text-[#A6A5AB]">
          В ростере пока нет артистов — переписка появится после добавления артистов
        </div>
      ) : (
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] overflow-hidden shadow-xs">
          {/* ── 1. Mobile Artist List Screen (when no active artist selected) ── */}
          {!activeArtist && (
            <div>
              {/* Search Header */}
              <div className="p-3.5 border-b-[0.5px] border-[#ECEAE5] bg-[#FAFAF9]">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#A6A5AB] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по артистам ростера…"
                    className="w-full bg-white border border-[#E5E3DE] rounded-[12px] pl-9 pr-3 py-1.5 text-[13px] text-[#17161A] placeholder:text-[#C4C3C8] outline-none focus:border-[#17161A] transition"
                  />
                </div>
              </div>

              {/* Roster Dialogs List */}
              <div className="divide-y-[0.5px] divide-[#ECEAE5]">
                {filteredArtists.map((a) => {
                  const last = previewOf(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a.id)}
                      className="w-full text-left px-4 py-3.5 hover:bg-[#FAFAF9] transition flex items-center gap-3 cursor-pointer group"
                    >
                      {/* Avatar with online status */}
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[14px] font-semibold">
                          {a.stage_name[0]}
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1F9D6B] border-2 border-white" />
                      </div>

                      {/* Info & Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[14px] font-semibold text-[#17161A] truncate group-hover:text-[#6E6D73] transition">
                            {a.stage_name}
                          </span>
                          {last && (
                            <span className="text-[11px] text-[#A6A5AB] shrink-0">
                              {fmtTime(last.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] text-[#6E6D73] truncate leading-tight">
                          {last ? (
                            <>
                              {last.from === "label" && (
                                <span className="text-[#17161A] font-medium">Вы: </span>
                              )}
                              {last.attachment ? `[${last.attachment.title}] ${last.text}` : last.text}
                            </>
                          ) : (
                            <span className="text-[#A6A5AB]">Нет сообщений</span>
                          )}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#A6A5AB] shrink-0 group-hover:translate-x-0.5 transition" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 2. Active Chat Conversation ── */}
          {activeArtist && (
            <div className="flex flex-col h-[calc(100dvh-240px)] min-h-[480px]">
              {/* Chat Topbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b-[0.5px] border-[#ECEAE5] bg-white">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="К списку артистов"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] hover:bg-[#FAFAF9] hover:text-[#17161A] transition shrink-0 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
                  </button>

                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[12px] font-semibold">
                      {activeArtist.stage_name[0]}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#1F9D6B] border-2 border-white" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#17161A] truncate leading-tight">
                      {activeArtist.stage_name}
                    </div>
                    <div className="text-[11px] text-[#1F9D6B] flex items-center gap-1 font-medium">
                      <span>На связи</span>
                      <span className="text-[#A6A5AB] font-normal">· Ростер UNIT</span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/label/artists/${activeArtist.id}`}
                  className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#6E6D73] hover:text-[#17161A] px-2.5 py-1 rounded-full bg-[#FAFAF9] hover:bg-[#F0EEEA] transition shrink-0"
                >
                  <span>Профиль</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Chat Messages Feed */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9]"
              >
                {thread.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[13px] text-[#A6A5AB] py-12">
                    <MessagesSquare className="w-8 h-8 mb-2 opacity-40" strokeWidth={1.5} />
                    <p>Начните переписку с {activeArtist.stage_name}</p>
                  </div>
                ) : (
                  thread.map((m) => {
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
                          {/* Rich Attachment Widget */}
                          {m.attachment && (
                            <div
                              className={`rounded-[12px] p-2.5 mb-2 text-[12px] border ${
                                isLabel
                                  ? "bg-white/10 border-white/15 text-white"
                                  : "bg-[#FAFAF9] border-[#ECEAE5] text-[#17161A]"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-0.5">
                                {m.attachment.type === "file" && (
                                  <FileAudio className={`w-3.5 h-3.5 ${isLabel ? "text-[#D4AF37]" : "text-[#17161A]"}`} />
                                )}
                                {m.attachment.type === "task" && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#1F9D6B]" />
                                )}
                                {m.attachment.type === "budget" && (
                                  <Wallet className="w-3.5 h-3.5 text-[#D97706]" />
                                )}
                                <span className="font-semibold">{m.attachment.title}</span>
                              </div>
                              {m.attachment.meta && (
                                <p className={`text-[10.5px] ${isLabel ? "text-white/70" : "text-[#6E6D73]"}`}>
                                  {m.attachment.meta}
                                </p>
                              )}
                            </div>
                          )}

                          <p className="text-[13.5px] leading-[1.45] whitespace-pre-wrap">
                            {m.text}
                          </p>
                        </div>

                        {/* Timestamp & checkmarks */}
                        <div className="flex items-center gap-1 mt-1 px-1">
                          <span className="text-[10px] text-[#A6A5AB]">
                            {fmtTime(m.createdAt)}
                          </span>
                          {isLabel && (
                            <CheckCheck className="w-3 h-3 text-[#1F9D6B]" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Prompts Bar */}
              <div className="px-3 py-2 bg-white border-t-[0.5px] border-[#ECEAE5] overflow-x-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10.5px] font-medium text-[#A6A5AB] shrink-0 mr-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#D97706]" />
                    Быстро:
                  </span>
                  {quickPrompts.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setDraft(q.text)}
                      className="text-[11px] font-medium text-[#6E6D73] hover:text-[#17161A] bg-[#FAFAF9] hover:bg-[#F0EEEA] border border-[#ECEAE5] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input Box */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex items-end gap-2 px-3 py-3 bg-white border-t-[0.5px] border-[#ECEAE5]"
              >
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder={`Сообщение ${activeArtist.stage_name}…`}
                  className="flex-1 resize-none max-h-24 text-[13.5px] leading-[1.4] rounded-[12px] border border-[#E5E3DE] bg-white px-3.5 py-2.5 outline-none focus:border-[#17161A] transition placeholder:text-[#C4C3C8]"
                />

                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Отправить"
                  className="w-10 h-10 shrink-0 rounded-full bg-[#17161A] text-white flex items-center justify-center hover:bg-[#2A282E] active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden cursor-pointer"
                >
                  <SendIconControlled size={18} color="white" sent={sending} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </LabelShell>
  );
}

export default function MessagesPage() {
  return <LabelGate>{({ org }) => <MessagesInner org={org} />}</LabelGate>;
}
