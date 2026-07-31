"use client";

import { useEffect, useState } from "react";
import { Loader2, Info, Sun, Moon, Send, Ban, Check } from "lucide-react";
import LabelGate from "@/components/label/LabelGate";
import LabelShell, { panelCls } from "@/components/label/LabelShell";
import { useLabelTheme } from "@/components/label/LabelThemeProvider";
import { fetchRoster, type MyOrg, type RosterArtist } from "@/lib/supabase/label";
import { toggleBlacklisted } from "@/lib/label/mockBlacklist";
import { useBlacklist } from "@/lib/label/useBlacklist";

const TELEGRAM_STORAGE_KEY = "unit-label-telegram-chat";

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`${panelCls} p-5 mb-5`}>
      <h2 className="text-[14px] font-semibold text-[#17161A] dark:text-[#F5F4F2] mb-1">{title}</h2>
      {hint && <p className="text-[12.5px] text-[#6E6D73] dark:text-[#9A98A0] mb-4">{hint}</p>}
      {children}
    </div>
  );
}

function ThemeSection() {
  const { theme, setTheme } = useLabelTheme();
  return (
    <SectionCard title="Тема" hint="Влияет только на кабинет лейбла — остальной сайт не меняется">
      <div className="inline-flex items-center gap-1 bg-[#FAFAF9] dark:bg-[#141316] border-[0.5px] border-[#ECEAE5] dark:border-[#242327] rounded-[10px] p-[3px]">
        <button
          onClick={() => setTheme("light")}
          className={`inline-flex items-center gap-[6px] text-[13px] font-medium px-[14px] py-[7px] rounded-[8px] transition ${
            theme === "light"
              ? "bg-white text-[#17161A] shadow-sm"
              : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
          }`}
        >
          <Sun className="w-[14px] h-[14px]" strokeWidth={1.75} />
          Светлая
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={`inline-flex items-center gap-[6px] text-[13px] font-medium px-[14px] py-[7px] rounded-[8px] transition ${
            theme === "dark"
              ? "bg-[#1A191D] text-[#F5F4F2] shadow-sm"
              : "text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#17161A] dark:hover:text-[#F5F4F2]"
          }`}
        >
          <Moon className="w-[14px] h-[14px]" strokeWidth={1.75} />
          Тёмная
        </button>
      </div>
    </SectionCard>
  );
}

function TelegramSection() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TELEGRAM_STORAGE_KEY);
      if (stored) setSaved(stored);
    } catch {}
  }, []);

  const connect = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(TELEGRAM_STORAGE_KEY, trimmed);
    } catch {}
    setSaved(trimmed);
    setValue("");
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  };

  const disconnect = () => {
    try {
      localStorage.removeItem(TELEGRAM_STORAGE_KEY);
    } catch {}
    setSaved(null);
  };

  return (
    <SectionCard title="Telegram-уведомления">
      <div className="flex items-start gap-2 text-[12px] text-[#8A5A16] dark:text-[#E8B65A] bg-[#FBF1DE] dark:bg-[#3A2F14] border-[0.5px] border-[#F0E2BF] dark:border-[#4A3E1E] rounded-[10px] px-3 py-[9px] mb-4">
        <Info className="w-[14px] h-[14px] shrink-0 mt-[1px]" strokeWidth={2} />
        <span className="leading-[1.5]">
          Это заглушка: логин сохраняется только в браузере, бот к нему пока не подключён и сообщения не
          отправляются. Чтобы уведомления реально приходили, нужен Telegram-бот и серверная интеграция
          с таблицей notifications.
        </span>
      </div>

      {saved ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13.5px] text-[#17161A] dark:text-[#F5F4F2]">
            <Check className="w-4 h-4 text-[#166B49] dark:text-[#5FCB9B]" strokeWidth={2.5} />
            Указан: <span className="font-medium">{saved}</span>
          </div>
          <button
            onClick={disconnect}
            className="text-[12.5px] font-medium text-[#A62018] dark:text-[#F3928C] hover:underline"
          >
            Отключить
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="@username или chat_id"
            className="flex-1 max-w-[280px] text-[13.5px] rounded-[9px] border border-[#E5E3DE] dark:border-[#33323A] bg-white dark:bg-[#1A191D] px-3 py-[8px] outline-none focus:border-[#E23A34] transition placeholder:text-[#C4C3C8]"
          />
          <button
            onClick={connect}
            disabled={!value.trim()}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium bg-[#E23A34] text-white px-[14px] py-[8px] rounded-[9px] hover:brightness-95 transition disabled:opacity-40"
          >
            {justSaved ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Send className="w-4 h-4" strokeWidth={1.75} />}
            Подключить
          </button>
        </div>
      )}
    </SectionCard>
  );
}

function BlacklistSection({ org }: { org: MyOrg }) {
  const [artists, setArtists] = useState<RosterArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blacklist = useBlacklist();

  useEffect(() => {
    fetchRoster(org.org_id)
      .then(setArtists)
      .catch((e) => setError(e instanceof Error ? e.message : "Не удалось загрузить ростер"))
      .finally(() => setLoading(false));
  }, [org.org_id]);

  return (
    <SectionCard
      title="Чёрный список артистов"
      hint="Пока это UI-заглушка в памяти вкладки — реальное ограничение доступа потребует миграции и RLS-политики"
    >
      {error && (
        <div className="text-[13px] text-[#A62018] dark:text-[#F3928C] bg-[#FDEDEB] dark:bg-[#3A2422] border-[0.5px] border-[#F3C9C6] dark:border-[#4A2F2C] rounded-[10px] px-3 py-[9px] mb-3">
          {error}
        </div>
      )}
      {loading ? (
        <div className="py-6 flex items-center justify-center text-[#A6A5AB] dark:text-[#6E6D73]">
          <Loader2 className="w-5 h-5 animate-spin" strokeWidth={2} />
        </div>
      ) : artists.length === 0 ? (
        <p className="text-[13px] text-[#A6A5AB] dark:text-[#6E6D73]">В ростере пока нет артистов</p>
      ) : (
        <div className="divide-y-[0.5px] divide-[#ECEAE5] dark:divide-[#242327] -mx-5">
          {artists.map((a) => {
            const isBlocked = blacklist.has(a.id);
            return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-[10px]">
                <span
                  className={`text-[13.5px] ${
                    isBlocked
                      ? "text-[#A6A5AB] dark:text-[#6E6D73] line-through"
                      : "text-[#17161A] dark:text-[#F5F4F2]"
                  }`}
                >
                  {a.stage_name}
                </span>
                <button
                  onClick={() => toggleBlacklisted(a.id)}
                  className={`inline-flex items-center gap-[6px] text-[12px] font-medium px-[10px] py-[5px] rounded-[8px] transition ${
                    isBlocked
                      ? "bg-[#E9F6EF] dark:bg-[#1C3B2E] text-[#166B49] dark:text-[#5FCB9B]"
                      : "border border-[#E5E3DE] dark:border-[#33323A] text-[#6E6D73] dark:text-[#9A98A0] hover:text-[#A62018] dark:hover:text-[#F3928C] hover:border-[#F3C9C6] dark:hover:border-[#4A2F2C]"
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {isBlocked ? "В чёрном списке" : "Добавить"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function SettingsInner({ org }: { org: MyOrg }) {
  return (
    <LabelShell org={org} title="Настройки" subtitle="Тема, уведомления и доступ артистов">
      <ThemeSection />
      <TelegramSection />
      <BlacklistSection org={org} />
    </LabelShell>
  );
}

export default function SettingsPage() {
  return <LabelGate>{({ org }) => <SettingsInner org={org} />}</LabelGate>;
}
