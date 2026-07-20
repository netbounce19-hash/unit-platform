"use client";
import { useState } from "react";
import { Bell, Wallet, Check, Target, Plus } from "lucide-react";
import ReleaseUploadModal from "@/components/artist/ReleaseUploadModal";
import ManagerMessenger from "@/components/artist/ManagerMessenger";
import BudgetRequestModal, { NewBudgetRequest } from "@/components/artist/BudgetRequestModal";

const initial = [
  { id: 1, title: "Опубликовать промо-ролик в TikTok", meta: "Промо · дедлайн сегодня", done: false },
  { id: 2, title: "Проверить финальный мастер", meta: "Релиз · дедлайн сегодня", done: false },
  { id: 3, title: "Загрузить обложку альбома", meta: "Выполнено в 11:20", done: true },
];

// Утверждённая стратегия на ближайший квартал
const strategyPillars = [
  { title: "Выпустить Midnight Protocol", meta: "релиз + питчинг в плейлисты · июль" },
  { title: "Разогнать до 100k слушателей / мес", meta: "3 промо-ролика: TikTok + Reels" },
  { title: "Коллаборация с артистом лейбла", meta: "кросс-промо на аудиторию · сентябрь" },
];

type BudgetRequest = {
  id: number;
  purpose: string;
  amount: number;
  meta: string;
  status: "pending";
};

const initialRequests: BudgetRequest[] = [
  { id: 1, purpose: "Сведение и мастеринг", amount: 25000, meta: "отправлена вчера", status: "pending" },
];

export default function Dashboard() {
  const [items, setItems] = useState(initial);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [requests, setRequests] = useState<BudgetRequest[]>(initialRequests);
  const toggle = (id: number) =>
    setItems((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

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
            Режим фокуса
          </span>
          <Bell className="w-[19px] h-[19px] text-[#6E6D73]" strokeWidth={1.75} />
          <div className="w-8 h-8 rounded-full bg-[#17161A] text-white flex items-center justify-center text-[13px] font-medium">K</div>
        </div>
      </div>

      {/* Приветствие */}
      <div className="mb-[22px]">
        <div className="text-[22px] font-medium tracking-[-0.01em]">С возвращением, KXDE</div>
        <div className="text-[14px] text-[#6E6D73] mt-[3px]">Четверг, 16 июля · 2 задачи на сегодня</div>
      </div>

      {/* Активный релиз */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[12px] text-[#A6A5AB] mb-1">Активный релиз</div>
            <div className="text-[18px] font-medium tracking-[-0.01em]">Midnight Protocol</div>
          </div>
          <span className="text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-[#FDEDEB] text-[#A62018]">В работе</span>
        </div>
        <div className="flex justify-between text-[13px] text-[#6E6D73] mb-2">
          <span>Прогресс релиза</span>
          <span className="font-medium text-[#17161A]">65%</span>
        </div>
        <div className="h-2 bg-[#F0EEEA] rounded-full overflow-hidden mb-[18px]">
          <div className="h-full bg-[#E23A34] rounded-full" style={{ width: "65%" }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[13px] text-[#6E6D73]">
            <span className="text-[#17161A] font-medium">Следующий шаг:</span> загрузить финальный мастер · через 3 дня
          </div>
          <button onClick={() => setUploadOpen(true)} className="bg-[#E23A34] text-white font-medium text-[14px] px-[18px] py-[10px] rounded-[10px] hover:brightness-95 transition shrink-0">Загрузить</button>
        </div>
      </div>

      {/* Задачи */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[6px] pb-[14px] mb-4">
        <div className="text-[15px] font-medium pt-4 pb-1">Задачи на сегодня</div>
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
          <div className="text-[22px] font-medium">65k</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">цель 100k</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Стримы / квартал</div>
          <div className="text-[22px] font-medium">1.2M</div>
          <div className="text-[12px] text-[#1F9D6B] mt-[2px]">+18%</div>
        </div>
        <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[12px] px-4 py-[14px]">
          <div className="text-[12px] text-[#A6A5AB] mb-[6px]">Роялти (мои условия)</div>
          <div className="text-[22px] font-medium">70 / 30</div>
          <div className="text-[12px] text-[#6E6D73] mt-[2px]">срок 24 мес.</div>
        </div>
      </div>

      {/* Стратегия */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-[22px] mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
            <div className="text-[15px] font-medium">Стратегия</div>
            <span className="text-[12px] font-medium px-[9px] py-[3px] rounded-full bg-[#F0EEEA] text-[#6E6D73]">III квартал 2026</span>
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
        <div className="text-[12px] text-[#A6A5AB] mt-4 pt-3 border-t-[0.5px] border-[#ECEAE5]">Согласована с A&R · Анна Ковалёва · 14 июля</div>
      </div>

      {/* Заявки */}
      <div className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] px-[22px] pt-[18px] pb-[14px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Wallet className="w-[17px] h-[17px] text-[#6E6D73]" strokeWidth={1.75} />
            <div className="text-[15px] font-medium">Заявки</div>
          </div>
          <button
            onClick={() => setBudgetOpen(true)}
            className="inline-flex items-center gap-[6px] text-[13px] font-medium text-[#E23A34] hover:opacity-80 transition"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Сделать заявку
          </button>
        </div>
        {requests.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center justify-between gap-3 py-[13px] ${i > 0 ? "border-t-[0.5px] border-[#ECEAE5]" : ""}`}
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium truncate">Заявка: {r.purpose}</div>
              <div className="text-[12px] text-[#A6A5AB] mt-[2px]">{r.amount.toLocaleString("ru-RU")} ₽ · {r.meta}</div>
            </div>
            <span className="text-[12px] font-medium px-[10px] py-[4px] rounded-full bg-[#FBF1DE] text-[#8A5A16] shrink-0">На рассмотрении</span>
          </div>
        ))}
      </div>

      <ReleaseUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        releaseTitle="Midnight Protocol"
      />

      <BudgetRequestModal
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        onSubmit={addRequest}
      />

      <ManagerMessenger />
    </div>
  );
}
