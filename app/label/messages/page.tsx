"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, MessagesSquare, ArrowLeft } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import { sendMessage, seedThreadIfEmpty, getThread } from "@/lib/label/mockMessages";
import { useMessageThread } from "@/lib/label/useMessageThread";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function MessagesInner({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    fetchRoster(org.org_id)
      .then((rows) => {
        setArtists(rows);
        rows.forEach((a) => seedThreadIfEmpty(a.id, a.stage_name));
        // Артиста не выбираем заранее: на телефоне сначала список,
        // переписка открывается по тапу.
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить ростер"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  const activeArtist = useMemo(() => artists.find((a) => a.id === selected) ?? null, [artists, selected]);
  const thread = useMessageThread(selected);

  // Превью последнего сообщения для списка слева — без лишней подписки,
  // достаточно текущего состояния треда (обновится вместе со списком при отправке).
  const previewOf = useCallback((artistId: string) => {
    const t = getThread(artistId);
    return t[t.length - 1] ?? null;
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    sendMessage(selected, "label", draft);
    setDraft("");
  };

  return (
    <LabelShell org={org} title="Сообщения" subtitle="Переписка с артистами лейбла">
      {error && (
        <div className="text-[13px] text-[#A62018] dark:text-[#F3928C] bg-[#FDEDEB] dark:bg-[#3A2422] border-[0.5px] border-[#F3C9C6] dark:border-[#4A2F2C] rounded-[10px] px-3 py-[9px] mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : artists.length === 0 ? (
        <div className={`${panelCls} py-12 text-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]`}>
          В ростере пока нет артистов — переписка появится, когда кто-то присоединится
        </div>
      ) : (
        <>
          {/* Список артистов — на узком экране это отдельный экран */}
          {!activeArtist && (
            <div className={`${panelCls} overflow-hidden`}>
              {artists.map((a, i) => {
                const last = previewOf(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a.id)}
                    className={`w-full text-left px-4 py-[13px] hover:bg-[#FAFAF9] dark:hover:bg-[#232227] transition ${
                      i > 0 ? "border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]" : ""
                    }`}
                  >
                    <div className="text-[14px] font-medium truncate text-[#17161A] dark:text-[#F5F4F2]">
                      {a.stage_name}
                    </div>
                    <div className="text-[12px] text-[#A6A5AB] dark:text-[#6E6D73] truncate mt-[2px]">
                      {last ? (last.from === "label" ? "Вы: " : "") + last.text : "Нет сообщений"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Переписка — открывается на весь экран поверх списка */}
          {activeArtist && (
            <div className={`${panelCls} flex flex-col h-[calc(100dvh-260px)] min-h-[420px] overflow-hidden`}>
                <div className="flex items-center gap-3 px-4 py-[13px] border-b-[0.5px] border-[#ECEAE5] dark:border-[#242327]">
                  <button
                    onClick={() => setSelected(null)}
                    aria-label="К списку артистов"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6D73] dark:text-[#9A98A0] hover:bg-[#F0EEEA] dark:hover:bg-[#232227] transition shrink-0"
                  >
                    <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2} />
                  </button>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] truncate">
                      {activeArtist.stage_name}
                    </div>
                    <div className="text-[11.5px] text-[#A6A5AB] dark:text-[#6E6D73]">
                      {activeArtist.user_id ? "Аккаунт привязан" : "Приглашение не принято"}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAFAF9] dark:bg-[#141316]">
                  {thread.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">
                      <MessagesSquare className="w-4 h-4 mr-2" strokeWidth={1.75} />
                      Сообщений пока нет
                    </div>
                  ) : (
                    thread.map((m) => (
                      <div key={m.id} className={`flex ${m.from === "label" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-[12px] px-[13px] py-[9px] ${
                            m.from === "label"
                              ? "bg-[#E23A34] text-white rounded-tr-[4px]"
                              : "bg-white dark:bg-[#1A191D] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] text-[#17161A] dark:text-[#F5F4F2] rounded-tl-[4px]"
                          }`}
                        >
                          <p className="text-[13.5px] leading-[1.45]">{m.text}</p>
                          <span
                            className={`block text-[10px] mt-[3px] ${
                              m.from === "label" ? "text-white/70" : "text-[#A6A5AB] dark:text-[#6E6D73]"
                            }`}
                          >
                            {fmtTime(m.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={submit}
                  className="flex items-end gap-2 px-4 py-3 border-t-[0.5px] border-[#ECEAE5] dark:border-[#242327]"
                >
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit(e);
                      }
                    }}
                    rows={1}
                    placeholder="Сообщение артисту…"
                    className="flex-1 resize-none max-h-24 text-[13.5px] leading-[1.4] rounded-[10px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[9px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    aria-label="Отправить"
                    className="w-9 h-9 shrink-0 rounded-full bg-[#E23A34] text-white flex items-center justify-center hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" strokeWidth={2} />
                  </button>
                </form>
            </div>
          )}
        </>
      )}
    </LabelShell>
  );
}

export default function MessagesPage() {
  return <LabelGate>{({ org }) => <MessagesInner org={org} />}</LabelGate>;
}
