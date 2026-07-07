"use client";

import { useApp } from "@/components/providers/AppProvider";
import { motion } from "framer-motion";

export default function FinanceHub() {
  const { state, dispatch } = useApp();

  const pendingBudgets = state.budgets.filter((b) => b.status === "pending");
  const processedBudgets = state.budgets.filter(
    (b) => b.status === "approved" || b.status === "declined"
  );

  const getArtistName = (id: string) =>
    state.artists.find((a) => a.id === id)?.name || "—";

  const totalPending = pendingBudgets.reduce((sum, b) => sum + b.amount, 0);

  const formatRub = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}М ₽`
      : n >= 1000
      ? `${(n / 1000).toFixed(0)}K ₽`
      : `${n} ₽`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-navy/30 border border-navy rounded-xl p-8"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-alabaster">
          Финансовый хаб
        </h3>
        {pendingBudgets.length > 0 && (
          <span className="px-2.5 py-1 bg-brass/20 text-brass text-[9px] tracking-wider uppercase rounded-full badge-pulse">
            {pendingBudgets.length} запросов · {formatRub(totalPending)}
          </span>
        )}
      </div>

      {pendingBudgets.length > 0 ? (
        <div className="space-y-3 mb-5">
          {pendingBudgets.map((budget) => (
            <motion.div
              key={budget.id}
              layout
              className="bg-sapphire/40 rounded-lg p-5 border border-navy/30"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-navy flex items-center justify-center text-[9px] font-bold text-alabaster flex-shrink-0">
                      {getArtistName(budget.artistId)[0]}
                    </div>
                    <span className="text-xs text-alabaster-dim">{getArtistName(budget.artistId)}</span>
                  </div>
                  <p className="text-sm font-semibold text-alabaster">{budget.purpose}</p>
                  <p className="text-[9px] text-alabaster-dim mt-0.5">Подано {budget.createdAt}</p>
                </div>
                <span className="text-lg font-bold text-brass ml-3 flex-shrink-0">
                  {formatRub(budget.amount)}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => dispatch({ type: "UPDATE_BUDGET_STATUS", payload: { id: budget.id, status: "approved" } })}
                  className="flex-1 py-2 bg-success/20 text-success text-xs font-semibold tracking-widest uppercase rounded-lg hover:bg-success/30 transition-colors cursor-pointer"
                >
                  Одобрить
                </button>
                <button
                  onClick={() => dispatch({ type: "UPDATE_BUDGET_STATUS", payload: { id: budget.id, status: "declined" } })}
                  className="flex-1 py-2 bg-error/20 text-[#d4564a] text-xs font-semibold tracking-widest uppercase rounded-lg hover:bg-error/30 transition-colors cursor-pointer"
                >
                  Отклонить
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center mb-5">
          <p className="text-xs text-alabaster-dim/40 tracking-wider uppercase">
            Нет активных запросов
          </p>
        </div>
      )}

      {processedBudgets.length > 0 && (
        <div className="border-t border-navy/40 pt-5">
          <p className="text-[9px] tracking-widest uppercase text-alabaster-dim mb-3">История</p>
          <div className="space-y-2.5">
            {processedBudgets.map((budget) => (
              <div key={budget.id} className="flex items-center justify-between bg-sapphire/30 rounded-lg px-4 py-3">

                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-alabaster truncate">{budget.purpose}</span>
                  <span className="text-[9px] text-alabaster-dim flex-shrink-0">— {getArtistName(budget.artistId)}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-alabaster-dim">{formatRub(budget.amount)}</span>
                  <span className={`text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-full ${
                    budget.status === "approved"
                      ? "bg-success/20 text-success"
                      : "bg-error/20 text-[#d4564a]"
                  }`}>
                    {budget.status === "approved" ? "Одобрено" : "Отклонено"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}
