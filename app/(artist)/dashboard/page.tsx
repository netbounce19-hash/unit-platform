"use client";
import { useState } from "react";
import { Bell, Wallet, Check, Target, Plus, ChevronDown } from "lucide-react";
import ReleaseUploadModal from "@/components/artist/ReleaseUploadModal";
import ReleaseCarousel from "@/components/artist/ReleaseCarousel";
import ManagerMessenger from "@/components/artist/ManagerMessenger";
import BudgetRequestModal, { NewBudgetRequest } from "@/components/artist/BudgetRequestModal";
import ArtistProfileModal, { ArtistProfile, defaultProfile } from "@/components/artist/ArtistProfileModal";
import EventsFeed from "@/components/artist/EventsFeed";
import SwipeToDelete from "@/components/artist/SwipeToDelete";
import LabelNotice from "@/components/artist/LabelNotice";
import FaqSection from "@/components/artist/FaqSection";
import { AnimatePresence, motion } from "framer-motion";

// 65000 → «65k», 1200000 → «1.2M»
function formatListeners(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

const initial = [
  { id: 1, title: "Опубликовать промо-ролик в TikTok", meta: "Промо · дедлайн сегодня", done: false },
  { id: 2, title: "Проверить финальный мастер", meta: "Релиз · дедлайн сегодня", done: false },
  { id: 3, title: "Загрузить обложку альбома", meta: "Выполнено в 11:20", done: true },
];

// Количество выпущенных треков — задаёт менеджер из своего кабинета
const releasedTracks = 12;

// Утверждённая стратегия на ближайший квартал
const strategyPillars = [
  { title: "Выпустить Midnight Protocol", meta: "релиз + питчинг в плейлисты · июль" },
  { title: "Разогнать до 100k слушателей / мес", meta: "3 промо-ролика: TikTok + Reels" },
  { title: "Коллаборация с артистом лейбла", meta: "кросс-промо на аудиторию · сентябрь" },
];

type RequestStatus = "pending" | "approved" | "declined";

type BudgetRequest = {
  id: number;
  purpose: string;
  amount: number;
  meta: string;
  status: RequestStatus;
};

const statusLabels: Record<RequestStatus, { label: string; cls: string }> = {
  pending: { label: "На рассмотрении", cls: "bg-[#FBF1DE] text-[#8A5A16]" },
  approved: { label: "Одобрена", cls: "bg-[#E9F6EF] text-[#166B49]" },
  declined: { label: "Отклонена", cls: "bg-[#FDEDEB] text-[#A62018]" },
};

const initialRequests: BudgetRequest[] = [
  { id: 1, purpose: "Сведение и мастеринг", amount: 25000, meta: "отправлена вчера", status: "pending" },
  { id: 2, purpose: "Съёмка клипа на Midnight Protocol", amount: 350000, meta: "отправлена 12 июля", status: "pending" },
  { id: 3, purpose: "Промо-кампания: TikTok и Reels", amount: 80000, meta: "одобрена 8 июля", status: "approved" },
  { id: 4, purpose: "Фотосессия для пресс-кита", amount: 45000, meta: "одобрена 2 июля", status: "approved" },
  { id: 5, purpose: "Аренда студии, 5 смен", amount: 60000, meta: "отклонена 28 июня", status: "declined" },
];

export default function Dashboard() {
  const [items, setItems] = useState(initial);
  const [uploadRelease, setUploadRelease] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ArtistProfile>(defaultProfile);
  const [coverOverrides, setCoverOverrides] = useState<Record<string, string>>({});
  const [requests, setRequests] = useState<BudgetRequest[]>(initialRequests);
  const toggle = (id: number) =>
    setItems((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const removeRequest = (id: number) =>
    setRequests((prev) => prev.filter((r) => r.id !== id));

  const addRequest = (req: NewBudgetRequest) =>
    setRequests((prev) => [
      { id: Date.now(), purpose: req.purpose, amount: req.amount, meta: "отправлена только что", status: "pending" },
      ...prev,
    ]);

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      {/* Топбар */}
      <div className="flex items-center justify-between mb-6">
        <div className="font-semibold tracking-[0.16em] text-[17px]">UNIT</div>
        <div className="flex items-center gap-[14px]">
          <span className="inline-flex items-center gap-[6px] text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-white border-[0.5px] border-[#ECEAE5] text-[#6E6D73]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#E23A34]" />
            Кабинет артиста
          </span>
          <Bell className="w-[19px] h-[19px] text-[#6E6D73]" strokeWidth={1.75} />
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
        </div>
      </div>

      {/* Приветствие */}
      <div className="mb-[22px]">
        <div className="text-[22px] font-medium tracking-[-0.01em]">С возвращением, {profile.name}</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">Четверг, 16 июля · 2 задачи на сегодня</div>
      </div>

      {/* Релизы */}
      <ReleaseCarousel onUpload={setUploadRelease} coverOverrides={coverOverrides} />

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

      {/* Задачи */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[6px] pb-[14px] mb-4">
        <div className="text-[18px] font-semibold tracking-[-0.01em] pt-4 pb-1">Задачи на сегодня</div>
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

      {/* Метрики */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Слушатели / месяц</div>
          <div className="text-[22px] font-medium">{formatListeners(profile.listeners)}</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">цель 100k</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Стримы / квартал</div>
          <div className="text-[22px] font-medium">1.2M</div>
          <div className="text-[12px] text-[#1F9D6B] mt-[2px]">+18%</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Количество треков</div>
          <div className="text-[22px] font-medium">{releasedTracks}</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">выпущено</div>
        </div>
      </div>

      {/* Стратегия */}
      <div className="bg-[#FBF1DE] border-[0.5px] border-[#F0E2BF] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-[17px] h-[17px] text-[#8A5A16]" strokeWidth={1.75} />
            <div className="text-[18px] font-semibold tracking-[-0.01em]">Стратегия</div>
            <span className="text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-white/60 text-[#8A5A16]">III квартал 2026</span>
          </div>
          <span className="inline-flex items-center gap-[5px] text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-[#E9F6EF] text-[#166B49]">
            <Check className="w-3 h-3" strokeWidth={3} />
            Утверждена
          </span>
        </div>
        <div className="text-[13px] text-[#6E6D73] mb-4">Фокус квартала — вывести Midnight Protocol и вырасти в аудитории</div>
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

      {/* Заявки */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px]">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setRequestsOpen((v) => !v)}
            aria-expanded={requestsOpen}
            className="flex items-center gap-2 -my-1 py-1"
          >
            <Wallet className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
            <div className="text-[18px] font-semibold tracking-[-0.01em]">Заявки на финансирование</div>
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
                          className={`flex items-center justify-between gap-3 py-[13px] ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}`}
                        >
                          <div className="min-w-0">
                            <div className="text-[14px] font-medium truncate">Заявка: {r.purpose}</div>
                            <div className="text-[12px] text-[#A6A5AB] mt-[2px]">{r.amount.toLocaleString("ru-RU")} ₽ · {r.meta}</div>
                          </div>
                          <span className={`text-[12px] font-medium px-[10px] py-[4px] rounded-full shrink-0 ${statusLabels[r.status].cls}`}>{statusLabels[r.status].label}</span>
                        </div>
                      </SwipeToDelete>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {requests.length === 0 ? (
                  <div className="py-[18px] text-[13px] text-[#A6A5AB] text-center">Заявок нет</div>
                ) : (
                  <div className="pt-[10px] text-[11px] text-[#A6A5AB] text-center">Смахните заявку влево, чтобы удалить</div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Лента мероприятий и новостей */}
      <EventsFeed />

      {/* FAQ */}
      <FaqSection />

      <ReleaseUploadModal
        open={uploadRelease !== null}
        onClose={() => setUploadRelease(null)}
        releaseTitle={uploadRelease ?? ""}
        onSubmit={({ coverUrl }) => {
          if (coverUrl && uploadRelease) {
            setCoverOverrides((prev) => ({ ...prev, [uploadRelease]: coverUrl }));
          }
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
    </div>
  );
}
