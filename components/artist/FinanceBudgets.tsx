"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { LockUnlockIconControlled } from "@/components/ui/animated-state-icons";
import { Wallet, Plus, ArrowUpRight } from "lucide-react";

export default function FinanceBudgets() {
  const { state, dispatch } = useApp();
  const [requestModal, setRequestModal] = useState(false);
  const [newRequest, setNewRequest] = useState({ purpose: "", amount: "" });

  const target = state.targets.find((t) => t.artistId === state.currentArtistId);
  const currentListeners = target?.current || 0;

  const artistBudgets = state.budgets.filter(
    (b) => b.artistId === state.currentArtistId
  );

  const budgetOptions = [
    { purpose: "Сведение и мастеринг", amount: 25000, tier: "low" as const, unlockThreshold: 0 },
    { purpose: "Промо-кампания", amount: 80000, tier: "mid" as const, unlockThreshold: 50000 },
    { purpose: "Музыкальное видео", amount: 350000, tier: "high" as const, unlockThreshold: 100000 },
    { purpose: "PR и пресса", amount: 150000, tier: "high" as const, unlockThreshold: 80000 },
  ];

  const isUnlocked = (threshold: number) => currentListeners >= threshold;

  const formatRub = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}М ₽`
      : n >= 1000
      ? `${(n / 1000).toFixed(0)}K ₽`
      : `${n} ₽`;

  const formatListeners = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n.toString();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "Одобрено";
      case "pending": return "На согласовании";
      case "declined": return "Отклонено";
      case "locked": return "Заблокировано";
      default: return status;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "approved": return "bg-[#E9F6EF] text-[#166B49] border border-[#BDE8D3]";
      case "pending": return "bg-[#FBF1DE] text-[#8A5A16] border border-[#F4E1BA]";
      case "declined": return "bg-[#F0EEEA] text-[#17161A] border border-[#D2D0CB]";
      default: return "bg-[#F0EEEA] text-[#6E6D73]";
    }
  };

  const handleRequest = (option: typeof budgetOptions[0]) => {
    dispatch({
      type: "REQUEST_BUDGET",
      payload: {
        artistId: state.currentArtistId,
        amount: option.amount,
        purpose: option.purpose,
        status: "pending",
        tier: option.tier,
        unlockThreshold: option.unlockThreshold,
      },
    });
  };

  const handleCustomRequest = () => {
    if (!newRequest.purpose || !newRequest.amount) return;
    dispatch({
      type: "REQUEST_BUDGET",
      payload: {
        artistId: state.currentArtistId,
        amount: Number(newRequest.amount),
        purpose: newRequest.purpose,
        status: "pending",
        tier: "low",
        unlockThreshold: 0,
      },
    });
    setNewRequest({ purpose: "", amount: "" });
    setRequestModal(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-white border-[0.5px] border-[#ECEAE5] rounded-[16px] p-6 lg:p-7 flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-5 pb-3 border-b-[0.5px] border-[#ECEAE5]">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#17161A]" />
            <h3 className="text-[14px] font-semibold text-[#17161A] tracking-tight">
              Финансы и бюджеты
            </h3>
          </div>
          <button
            onClick={() => setRequestModal(true)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#17161A] bg-[#FAFAF9] hover:bg-white border border-[#E5E3DE] hover:border-[#D2D0CB] px-3 py-1 rounded-full transition cursor-pointer"
          >
            <Plus className="w-3 h-3 text-[#17161A]" /> Свой запрос
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {budgetOptions.map((option) => {
            const unlocked = isUnlocked(option.unlockThreshold);
            return (
              <motion.button
                key={option.purpose}
                whileHover={unlocked ? { y: -1 } : {}}
                whileTap={unlocked ? { scale: 0.99 } : {}}
                onClick={() => unlocked && handleRequest(option)}
                disabled={!unlocked}
                className={`
                  relative p-4 rounded-[12px] border text-left transition-all
                  ${unlocked
                    ? "border-[#ECEAE5] hover:border-[#17161A] bg-[#FAFAF9] hover:bg-white cursor-pointer shadow-2xs"
                    : "border-[#ECEAE5]/60 bg-[#FAFAF9]/40 cursor-not-allowed opacity-50"
                  }
                `}
              >
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-[12px] font-medium text-[#17161A] leading-snug">{option.purpose}</p>
                  {unlocked && <ArrowUpRight className="w-3.5 h-3.5 text-[#A6A5AB]" />}
                </div>
                <p className="text-[17px] font-semibold text-[#17161A]">{formatRub(option.amount)}</p>
                {!unlocked && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <LockUnlockIconControlled
                      size={14}
                      color="#A6A5AB"
                      unlocked={false}
                    />
                    <span className="text-[10px] font-mono text-[#A6A5AB] leading-tight">
                      От {formatListeners(option.unlockThreshold)} слушателей
                    </span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {artistBudgets.length > 0 && (
        <div className="border-t border-[#ECEAE5] pt-4">
          <p className="text-[11px] font-mono tracking-wider uppercase text-[#6E6D73] mb-2.5">
            История запросов
          </p>
          <div className="space-y-2">
            {artistBudgets.map((budget) => (
              <div
                key={budget.id}
                className="flex items-center justify-between bg-[#FAFAF9] border border-[#ECEAE5] rounded-[12px] px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium text-[#17161A] truncate">{budget.purpose}</span>
                  <span className="text-[11px] font-mono text-[#A6A5AB] flex-shrink-0">({formatRub(budget.amount)})</span>
                </div>
                <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full flex-shrink-0 ml-2 ${getStatusStyle(budget.status)}`}>
                  {getStatusLabel(budget.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={requestModal} onClose={() => setRequestModal(false)} title="Запрос бюджета">
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-mono tracking-wider uppercase text-[#6E6D73] block mb-1.5">
              Назначение расхода
            </label>
            <input
              type="text"
              value={newRequest.purpose}
              onChange={(e) => setNewRequest({ ...newRequest, purpose: e.target.value })}
              placeholder="Например: Студийная сессия и сведение"
              className="w-full bg-[#FAFAF9] border border-[#E5E3DE] focus:border-[#17161A] rounded-[12px] px-4 py-2.5 text-[14px] text-[#17161A] placeholder-[#A6A5AB] focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono tracking-wider uppercase text-[#6E6D73] block mb-1.5">
              Необходимая сумма (₽)
            </label>
            <input
              type="number"
              value={newRequest.amount}
              onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
              placeholder="50 000"
              className="w-full bg-[#FAFAF9] border border-[#E5E3DE] focus:border-[#17161A] rounded-[12px] px-4 py-2.5 text-[14px] text-[#17161A] placeholder-[#A6A5AB] focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={handleCustomRequest}
            disabled={!newRequest.purpose || !newRequest.amount}
            className="w-full bg-[#17161A] text-white font-medium text-[13px] py-3 rounded-full hover:bg-[#2A282E] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отправить на согласование
          </button>
        </div>
      </Modal>
    </motion.section>
  );
}
