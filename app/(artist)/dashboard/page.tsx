"use client";
import { useEffect, useState } from "react";
import { Wallet, Check, Target, Plus, ChevronDown, Trash2, ListChecks, LogOut } from "lucide-react";
import ReleaseUploadModal from "@/components/artist/ReleaseUploadModal";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ManagerMessenger from "@/components/artist/ManagerMessenger";
import BudgetRequestModal, { NewBudgetRequest } from "@/components/artist/BudgetRequestModal";
import ArtistProfileModal, { ArtistProfile, defaultProfile } from "@/components/artist/ArtistProfileModal";
import EventsFeed from "@/components/artist/EventsFeed";
import SwipeToDelete from "@/components/artist/SwipeToDelete";
import LabelNotice from "@/components/artist/LabelNotice";
import FaqSection from "@/components/artist/FaqSection";
import DemoSection from "@/components/artist/DemoSection";
import ArtistFilesSection from "@/components/artist/ArtistFilesSection";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/auth/AuthGate";
import { getSupabase } from "@/lib/supabase/client";
import { fetchMyProfile, displayNameOf } from "@/lib/supabase/profile";
import {
  listBudgetRequests,
  createBudgetRequest,
  deleteBudgetRequest,
  type BudgetRequestRow,
  type RequestStatus,
} from "@/lib/supabase/cabinet";

// 65000 → «65k», 1200000 → «1.2M»
function formatListeners(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

// «Четверг, 16 июля» — с заглавной буквы
function formatToday(d: Date) {
  const s = d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

// Задачи ставит менеджер — у нового артиста список пуст.
type Task = { id: number; title: string; meta: string; done: boolean };
const initial: Task[] = [];

// Количество выпущенных треков — задаёт менеджер из своего кабинета
const releasedTracks = 0;

// Цель по слушателям из утверждённой стратегии
const LISTENERS_GOAL = 100_000;

// Утверждённая стратегия на ближайший квартал
const strategyPillars = [
  { title: "Выпуск сингла", meta: "мастер, обложка и питчинг в плейлисты" },
  { title: "Выпуск EP", meta: "сведение, тексты и данные об авторах" },
  { title: "Презентация EP", meta: "шоукейс и промо-кампания" },
];

const statusLabels: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Одобрена", cls: "bg-[#E9F6EF] text-[#166B49]" },
  declined: { label: "Отклонена", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

// «отправлена сегодня / вчера / 5 июля»
function formatSince(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.floor(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      day
  );
  if (diff <= 0) return "отправлена сегодня";
  if (diff === 1) return "отправлена вчера";
  return "отправлена " + d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

// Быстрый переход по разделам
const navItems = [
  { id: "tasks", label: "Задачи" },
  { id: "releases", label: "Релизы" },
  { id: "demo", label: "Демо" },
  { id: "files", label: "Файлы" },
  { id: "requests", label: "Заявки" },
  { id: "stats", label: "Показатели" },
  { id: "news", label: "Новости" },
];

function DashboardInner() {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [uploadRelease, setUploadRelease] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Имя подставится из профиля; до загрузки — нейтральное
  const [profile, setProfile] = useState<ArtistProfile>({ ...defaultProfile, name: "Артист" });
  const [releasesVersion, setReleasesVersion] = useState(0);
  const [requests, setRequests] = useState<BudgetRequestRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);

  // Дата считается на клиенте, чтобы не расходиться с версией сервера
  useEffect(() => setToday(formatToday(new Date())), []);

  // Имя берём из профиля, созданного при регистрации
  useEffect(() => {
    let cancelled = false;
    fetchMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setProfile((prev) => ({ ...prev, name: displayNameOf(p) }));
      })
      .catch(() => {
        /* профиль недоступен — оставляем значение по умолчанию */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Заявки — из БД, переживают перезагрузку
  useEffect(() => {
    let cancelled = false;
    listBudgetRequests()
      .then((rows) => !cancelled && setRequests(rows))
      .catch(() => {
        /* не залогинен или сеть — оставляем пустой список */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openTasks = items.filter((t) => !t.done).length;
  const listenersProgress = Math.min(100, Math.round((profile.listeners / LISTENERS_GOAL) * 100));

  const toggle = (id: number) =>
    setItems((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeRequest = async (id: string) => {
    const prev = requests;
    setRequests((r) => r.filter((x) => x.id !== id)); // оптимистично
    try {
      await deleteBudgetRequest(id);
    } catch {
      setRequests(prev); // откат
      setToast("Не удалось удалить заявку");
    }
  };

  const addRequest = async (req: NewBudgetRequest) => {
    try {
      const row = await createBudgetRequest(req.purpose, req.amount);
      setRequests((prev) => [row, ...prev]);
      setRequestsOpen(true);
      setToast(`Заявка отправлена менеджеру · ${req.purpose}`);
    } catch {
      setToast("Не удалось отправить заявку");
    }
  };

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      {/* Топбар */}
      <div className="flex items-center justify-between mb-6">
        <div className="font-semibold tracking-[0.16em] text-[17px]">UNIT</div>
        <div className="flex items-center gap-[14px]">
          <span className="text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-white border-[0.5px] border-[#ECEAE5] text-[#6E6D73]">
            Кабинет артиста
          </span>
          <button
            onClick={() => setProfileOpen(true)}
            aria-label="Редактировать профиль"
            title="Редактировать профиль"
            className="w-8 h-8 rounded-full overflow-hidden bg-[#17161A] text-white flex items-center justify-center text-[13px] font-medium hover:ring-2 hover:ring-[#E23A34]/30 transition"
          >
            {profile.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo} alt="Профиль" className="w-full h-full object-cover" />
            ) : (
              profile.name.charAt(0) || "?"
            )}
          </button>
          <button
            onClick={async () => {
              await getSupabase().auth.signOut();
              router.push("/");
            }}
            aria-label="Выйти"
            title="Выйти из аккаунта"
            className="inline-flex items-center gap-[5px] text-[12px] font-medium text-[#6E6D73] hover:text-[#A62018] transition"
          >
            <LogOut className="w-[14px] h-[14px]" strokeWidth={1.75} />
            Выйти
          </button>
        </div>
      </div>

      {/* Приветствие */}
      <div className="mb-4">
        <div className="text-[22px] font-medium tracking-[-0.01em]">С возвращением, {profile.name}</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">
          {today ?? " "}
          {openTasks > 0
            ? ` · ${openTasks} ${plural(openTasks, "задача", "задачи", "задач")} на сегодня`
            : " · задачи на сегодня выполнены"}
        </div>
      </div>

      {/* Быстрый переход */}
      <nav className="sticky top-0 z-30 -mx-5 px-5 py-2 mb-4 bg-[#FAFAF9]/90 backdrop-blur-sm">
        <div className="flex items-center gap-[6px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="shrink-0 text-[12px] font-medium text-[#6E6D73] bg-white border-[0.5px] border-[#ECEAE5] rounded-full px-[11px] py-[5px] hover:text-[#17161A] hover:border-[#D2D0CB] transition"
            >
              {n.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Задачи — главное действие дня */}
      <div id="tasks" className="scroll-mt-[60px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[6px] pb-[14px] mb-4">
        <div className="flex items-center gap-2 pt-4 pb-1">
          <ListChecks className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
          <div className="text-[16px] font-semibold tracking-[-0.01em]">Задачи на сегодня</div>
        </div>
        {items.length === 0 && (
          <div className="py-[18px] text-[13px] text-[#A6A5AB] text-center">
            Ожидаются от менеджера
          </div>
        )}
        {items.map((t, i) => (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            className={`w-full flex items-center gap-3 py-[13px] text-left ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}`}
          >
            <span className={`w-5 h-5 rounded-[6px] border-[1.5px] flex items-center justify-center shrink-0 transition ${t.done ? "bg-[#1F9D6B] border-[#1F9D6B]" : "border-[#D2D0CB]"}`}>
              {t.done && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </span>
            <span>
              <span className={`block text-[14px] ${t.done ? "line-through text-[#A6A5AB]" : ""}`}>{t.title}</span>
              <span className="block text-[12px] text-[#A6A5AB] mt-[2px]">{t.meta}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Релизы */}
      <div id="releases" className="scroll-mt-[60px]">
        <ReleaseCarousel refreshKey={releasesVersion} />
      </div>

      {/* Добавить новый релиз */}
      <button
        onClick={() => setUploadRelease("Новый релиз")}
        className="w-full mb-4 flex items-center justify-center gap-3 rounded-[16px] border border-dashed border-[#D2D0CB] bg-white px-5 py-[18px] hover:border-[#E23A34] hover:bg-[#FDEDEB]/50 transition"
      >
        <span className="w-10 h-10 rounded-full bg-[#E23A34] text-white flex items-center justify-center shrink-0">
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </span>
        <span className="text-[15px] font-medium">Добавить новый релиз</span>
      </button>

      {/* Напоминание от лейбла */}
      <LabelNotice />

      {/* Демо */}
      <div id="demo" className="scroll-mt-[60px]">
        <DemoSection />
      </div>

      {/* Файлы артиста */}
      <div id="files" className="scroll-mt-[60px]">
        <ArtistFilesSection />
      </div>

      {/* Заявки */}
      <div id="requests" className="scroll-mt-[60px] bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px] mb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setRequestsOpen((v) => !v)}
            aria-expanded={requestsOpen}
            className="flex items-center gap-2 -my-1 py-1"
          >
            <Wallet className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Заявки на финансирование</div>
            <motion.span
              animate={{ rotate: requestsOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-[#A6A5AB]"
            >
              <ChevronDown className="w-[18px] h-[18px]" strokeWidth={2} />
            </motion.span>
          </button>
          {requestsOpen && (
            <button
              onClick={() => setBudgetOpen(true)}
              className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Сделать заявку
            </button>
          )}
        </div>
        <div className="grid" style={{ gridTemplateRows: requestsOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden min-h-0">
            <div className={`pt-1 transition-opacity duration-200 ${requestsOpen ? "opacity-100" : "opacity-0"}`}>
                <AnimatePresence initial={false}>
                  {requests.map((r, i) => (
                    <motion.div
                      key={r.id}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <SwipeToDelete
                        onDelete={() => removeRequest(r.id)}
                        label={`Удалить заявку: ${r.purpose}`}
                      >
                        <div
                          className={`group flex items-center justify-between gap-3 py-[13px] ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium truncate">Заявка: {r.purpose}</div>
                            <div className="text-[12px] text-[#A6A5AB] mt-[2px]">{r.amount.toLocaleString("ru-RU")} ₽ · {formatSince(r.created_at)}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[12px] font-medium px-[10px] py-[4px] rounded-full ${statusLabels[r.status].cls}`}>{statusLabels[r.status].label}</span>
                            <button
                              onClick={() => removeRequest(r.id)}
                              aria-label={`Удалить заявку: ${r.purpose}`}
                              title="Удалить заявку"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#C4C3C8] hover:text-[#A62018] hover:bg-[#FDEDEB] transition"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      </SwipeToDelete>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {requests.length === 0 && (
                  <div className="py-[18px] text-[13px] text-[#A6A5AB] text-center">Заявок нет</div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Показатели */}
      <div id="stats" className="scroll-mt-[60px] grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Слушатели / месяц</div>
          <div className="text-[22px] font-medium">{formatListeners(profile.listeners)}</div>
          <div className="h-[4px] bg-[#F0EEEA] rounded-full overflow-hidden mt-[7px] mb-[5px]">
            <div className="h-full bg-[#E23A34] rounded-full transition-all" style={{ width: `${listenersProgress}%` }} />
          </div>
          <div className="text-[12px] text-[#6E6D73]">{listenersProgress}% до цели 100k</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Стримы / квартал</div>
          <div className="text-[22px] font-medium">0</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">пока нет данных</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Треков выпущено</div>
          <div className="text-[22px] font-medium">{releasedTracks}</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">за всё время</div>
        </div>
      </div>

      {/* Стратегия */}
      <div className="bg-[#FBF1DE] border-[0.5px] border-[#F0E2BF] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-[17px] h-[17px] text-[#8A5A16]" strokeWidth={1.75} />
            <div className="text-[16px] font-semibold tracking-[-0.01em]">Стратегия</div>
            <span className="text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-white/60 text-[#8A5A16]">III квартал 2026</span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-[#E9F6EF] text-[#166B49]">
            <Check className="w-3 h-3" strokeWidth={3} />
            Утверждена
          </span>
        </div>
        <div className="text-[13px] text-[#6E6D73] mb-4">Фокус квартала — выпустить первый сингл и EP</div>
        <div className="space-y-[10px]">
          {strategyPillars.map((p, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-[22px] h-[22px] rounded-full bg-[#FDEDEB] text-[#A62018] text-[12px] font-semibold flex items-center justify-center shrink-0 mt-[1px]">{i + 1}</span>
              <div>
                <div className="text-[14px] text-[#17161A] leading-[1.35]">{p.title}</div>
                <div className="text-[12px] text-[#A6A5AB] mt-[1px]">{p.meta}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[12px] text-[#8A5A16]/60 mt-4 pt-3 border-t-[0.5px] border-[#F0E2BF]">Согласована с A&R · Анна Ковалёва · 14 июля</div>
      </div>

      {/* Новости и мероприятия */}
      <div id="news" className="scroll-mt-[60px]">
        <EventsFeed />
      </div>

      {/* FAQ */}
      <FaqSection />

      <ReleaseUploadModal
        open={uploadRelease !== null}
        onClose={() => setUploadRelease(null)}
        releaseTitle={uploadRelease ?? ""}
        onSubmit={() => {
          setReleasesVersion((v) => v + 1);
          setToast("Релиз создан");
        }}
      />

      <BudgetRequestModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        onSubmit={addRequest}
      />

      <ArtistProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSave={setProfile}
      />

      <ManagerMessenger />

      {/* Уведомление */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            role="status"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-[10px] bg-[#17161A] text-white text-[13px] font-medium pl-[14px] pr-[18px] py-[11px] rounded-full shadow-[0_12px_36px_rgba(0,0,0,0.28)] max-w-[calc(100vw-2rem)]"
          >
            <span className="w-5 h-5 rounded-full bg-[#1F9D6B] flex items-center justify-center shrink-0">
              <Check className="w-[13px] h-[13px]" strokeWidth={3} />
            </span>
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Dashboard() {
  return (
    <AuthGate>
      <DashboardInner />
    </AuthGate>
  );
}
