"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";
import { useState } from "react";
import Modal from "@/components/shared/Modal";
import { LockUnlockIconControlled } from "@/components/ui/animated-state-icons";

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
      case "pending": return "На рассмотрении";
      case "declined": return "Отклонено";
      case "locked": return "Заблокировано";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-success/20 text-success";
      case "pending": return "bg-brass/20 text-brass";
      case "declined": return "bg-error/20 text-[#d4564a]";
      default: return "bg-navy/50 text-alabaster-dim";
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
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-navy/30 border border-navy rounded-xl p-7"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster">
          Финансы и бюджеты
        </h3>
        <button
          onClick={() => setRequestModal(true)}
          className="text-[9px] tracking-widest uppercase text-brass hover:text-brass-dim transition-colors cursor-pointer"
        >
          + Свой запрос
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {budgetOptions.map((option) => {
          const unlocked = isUnlocked(option.unlockThreshold);
          return (
            <motion.button
              key={option.purpose}
              whileHover={unlocked ? { scale: 1.02 } : {}}
              whileTap={unlocked ? { scale: 0.98 } : {}}
              onClick={() => unlocked && handleRequest(option)}
              disabled={!unlocked}
              className={`
                relative p-4 rounded-lg border text-left transition-all
                ${unlocked
                  ? "border-navy hover:border-brass/50 bg-sapphire/50 cursor-pointer"
                  : "border-navy/30 bg-sapphire/20 cursor-not-allowed opacity-50"
                }
              `}
            >
              <p className="text-xs font-medium text-alabaster mb-2 leading-snug">{option.purpose}</p>
              <p className="text-base font-bold text-brass">{formatRub(option.amount)}</p>
              {!unlocked && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <LockUnlockIconControlled
                    size={16}
                    color="rgba(247,243,233,0.5)"
                    unlocked={false}
                  />
                  <span className="text-[9px] tracking-wide text-alabaster-dim leading-tight">
                    Открывается при {formatListeners(option.unlockThreshold)} слушателях
                  </span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {artistBudgets.length > 0 && (
        <div className="border-t border-navy/40 pt-5">
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">
            Ваши запросы
          </p>
          <div className="space-y-2.5">
            {artistBudgets.map((budget) => (
              <div
                key={budget.id}
                className="flex items-center justify-between bg-sapphire/40 rounded-lg px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm text-alabaster truncate">{budget.purpose}</span>
                  <span className="text-xs text-alabaster-dim flex-shrink-0">{formatRub(budget.amount)}</span>
                </div>
                <span className={`text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-full flex-shrink-0 ml-3 ${getStatusColor(budget.status)}`}>
                  {getStatusLabel(budget.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={requestModal} onClose={() => setRequestModal(false)} title="Запрос бюджета">
        <div className="space-y-5">
          <div>
            <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-2">Назначение</label>
            <input
              type="text"
              value={newRequest.purpose}
              onChange={(e) => setNewRequest({ ...newRequest, purpose: e.target.value })}
              placeholder="Например: Студийная сессия"
              className="w-full bg-sapphire border border-navy rounded-lg px-4 py-3 text-sm text-alabaster placeholder-alabaster-dim/50 focus:outline-none focus:border-brass/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[9px] tracking-widest uppercase text-alabaster-dim block mb-2">Сумма (₽)</label>
            <input
              type="number"
              value={newRequest.amount}
              onChange={(e) => setNewRequest({ ...newRequest, amount: e.target.value })}
              placeholder="0"
              className="w-full bg-sapphire border border-navy rounded-lg px-4 py-3 text-sm text-alabaster placeholder-alabaster-dim/50 focus:outline-none focus:border-brass/50 transition-colors"
            />
          </div>
          <button
            onClick={handleCustomRequest}
            className="w-full bg-brass text-sapphire font-semibold text-xs tracking-widest uppercase py-3.5 rounded-lg hover:bg-brass-dim transition-colors cursor-pointer"
          >
            Отправить запрос
          </button>
        </div>
      </Modal>
    </motion.section>
  );
}
